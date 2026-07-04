"use server";

// 親（管理者）が銀行画面から呼び出すコイン操作のサーバアクション。
// すべて prisma.$transaction で「残高更新 + 履歴記録」をアトミックに行う。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  LOGISTICS_REWARD_TOOL_ID,
  QUEST_CATEGORIES,
  normalizeCategory,
  type QuestCategory,
} from "@/lib/quest-categories";
import { computeStreakUpdate, type StreakMilestone } from "@/lib/streak";

const CHORE_AMOUNT = 100;
const PENALTY_AMOUNT = 50;
const BONUS_MIN = 500;
const BONUS_MAX = 5000;

async function ensureChild(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  if (user.role !== "CHILD") {
    throw new Error(`User is not a child: ${user.name}`);
  }
  return user;
}

export async function giveChoreCoins(userId: string) {
  await ensureChild(userId);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coinBalance: { increment: CHORE_AMOUNT } },
    }),
    prisma.coinTransaction.create({
      data: {
        userId,
        amount: CHORE_AMOUNT,
        kind: "CHORE",
        reason: "お手伝い",
      },
    }),
  ]);
  revalidatePath("/bank");
}

export async function applyPenalty(userId: string, reason?: string) {
  await ensureChild(userId);
  const trimmedReason = reason?.trim() || "喧嘩";
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coinBalance: { decrement: PENALTY_AMOUNT } },
    }),
    prisma.coinTransaction.create({
      data: {
        userId,
        amount: -PENALTY_AMOUNT,
        kind: "PENALTY",
        reason: trimmedReason,
      },
    }),
    prisma.penaltyNotification.create({
      data: {
        userId,
        reason: trimmedReason,
        coinAmount: PENALTY_AMOUNT,
        isRead: false,
      },
    }),
  ]);
  revalidatePath("/bank");
  revalidatePath("/kids");
}

// 特大達成ボーナス：コイン加算 + CoinTransaction 履歴 + 未読の SpecialBonusNotification を
// 1トランザクションで作成する。/kids 側はこの通知を見つけたら祝賀演出を出す。
export async function sendSpecialBonus(
  userId: string,
  reason: string,
  amount: number,
) {
  await ensureChild(userId);
  if (!Number.isInteger(amount) || amount < BONUS_MIN || amount > BONUS_MAX) {
    throw new Error(
      `ボーナス額は ${BONUS_MIN}〜${BONUS_MAX} コインの範囲で指定してください`,
    );
  }
  const trimmed = reason?.trim();
  if (!trimmed) {
    throw new Error("達成内容（reason）は必須です");
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coinBalance: { increment: amount } },
    }),
    prisma.coinTransaction.create({
      data: { userId, amount, kind: "BONUS", reason: trimmed },
    }),
    prisma.specialBonusNotification.create({
      data: {
        userId,
        reason: trimmed,
        coinAmount: amount,
        isRead: false,
      },
    }),
  ]);
  revalidatePath("/bank");
  revalidatePath("/kids");
}


// ─────────────────────────────────────────────
// クエスト検品（親の承認 / 差し戻し）
// approveQuest: PENDING の申請を APPROVED に更新 + 報酬コイン加算 + 履歴記録
// rejectQuest : PENDING の申請を REJECTED に更新（コインは動かない）
// いずれも $transaction で、すでに APPROVED/REJECTED 済みの申請は二重処理しない。
// ─────────────────────────────────────────────

export type QuestReviewResult =
  | {
      success: true;
      status: "APPROVED" | "REJECTED";
      submissionId: string;
      userId: string;
      questTitle: string;
      rewardCoins: number;
      newCoinBalance?: number;
      // ストリーク情報（APPROVED 時のみ）
      streak?: {
        currentStreak: number;
        longestStreak: number;
        streakStatus: string;
        didIncrement: boolean;
        milestone: StreakMilestone | null;
      };
      // うんぱんミッション（LOGISTICS）承認で付与したレア罠（APPROVED 時のみ）
      trapRewarded?: { toolName: string; emoji: string } | null;
    }
  | { success: false; error: string };

export async function approveQuest(
  submissionId: string,
): Promise<QuestReviewResult> {
  // 事前読み込み：UI へ返す情報のために quest と user も取る。
  const submission = await prisma.questSubmission.findUnique({
    where: { id: submissionId },
    include: { quest: true, user: true },
  });
  if (!submission) {
    return { success: false, error: "申請が見つかりません" };
  }
  if (submission.status !== "PENDING") {
    return { success: false, error: "すでに処理済みの申請です" };
  }

  // ストリークフィールドを型アサーションで取得
  // （prisma generate 前は生成型に含まれないが、DB マイグレーション後は実値が存在する）
  type UserWithStreak = typeof submission.user & {
    currentStreak: number;
    longestStreak: number;
    lastQuestCompletedAt: Date | null;
    streakStatus: string;
  };
  const userWithStreak = submission.user as UserWithStreak;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // PENDING のものだけを APPROVED に。二重承認は count=0 で弾く。
      const upd = await tx.questSubmission.updateMany({
        where: { id: submissionId, status: "PENDING" },
        data: { status: "APPROVED", reviewedAt: now },
      });
      if (upd.count !== 1) {
        throw new Error("ALREADY_PROCESSED");
      }

      // ── ストリーク判定 ───────────────────────────────────
      // 今日（JST）すでに承認済みのクエスト数を取得（この承認を含まない）
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayJST = jstNow.toISOString().slice(0, 10); // "YYYY-MM-DD"
      const todayStart = new Date(`${todayJST}T00:00:00+09:00`);
      const todayEnd = new Date(`${todayJST}T23:59:59+09:00`);

      const todayApprovedCount = await tx.questSubmission.count({
        where: {
          userId: submission.userId,
          status: "APPROVED",
          reviewedAt: { gte: todayStart, lte: todayEnd },
          id: { not: submissionId },
        },
      });

      const streakUpdate = computeStreakUpdate(
        {
          currentStreak: userWithStreak.currentStreak ?? 0,
          longestStreak: userWithStreak.longestStreak ?? 0,
          lastQuestCompletedAt: userWithStreak.lastQuestCompletedAt ?? null,
          streakStatus: userWithStreak.streakStatus ?? "ACTIVE",
        },
        now,
        todayApprovedCount,
      );

      // ── コイン加算（クエスト報酬 + ストリークマイルストーン） ──
      const milestoneCoins = streakUpdate.milestone?.bonusCoins ?? 0;
      const totalCoins = submission.quest.rewardCoins + milestoneCoins;

      const updatedUser = await tx.user.update({
        where: { id: submission.userId },
        // streak フィールドは prisma generate 前は型に含まれないため as any で回避
        // （DB マイグレーション適用後は正常動作する）
        data: {
          coinBalance: { increment: totalCoins },
          ...(({
            currentStreak: streakUpdate.currentStreak,
            longestStreak: streakUpdate.longestStreak,
            lastQuestCompletedAt: streakUpdate.lastQuestCompletedAt,
            streakStatus: streakUpdate.streakStatus,
          }) as Record<string, unknown>),
        } as Parameters<typeof tx.user.update>[0]["data"],
      });

      // クエスト報酬の履歴
      await tx.coinTransaction.create({
        data: {
          userId: submission.userId,
          amount: submission.quest.rewardCoins,
          kind: "CHORE",
          reason: `クエスト完了：${submission.quest.title}`,
        },
      });

      // ── うんぱんミッション（LOGISTICS）：レア罠を1個付与 ──────────
      // 「現実のモノの運搬」をゲーム進行上いちばん価値の高い行動にする
      // （一本道化 2026-06-12。レア罠はここでしか手に入らない）。
      let trapRewarded: { toolName: string; emoji: string } | null = null;
      if ((submission.quest.category ?? "").toUpperCase() === "LOGISTICS") {
        const rewardTool = await tx.tool.findUnique({
          where: { toolId: LOGISTICS_REWARD_TOOL_ID },
        });
        if (rewardTool) {
          await tx.userTool.upsert({
            where: {
              userId_toolId: {
                userId: submission.userId,
                toolId: rewardTool.id,
              },
            },
            update: { quantity: { increment: 1 } },
            create: {
              userId: submission.userId,
              toolId: rewardTool.id,
              quantity: 1,
            },
          });
          trapRewarded = { toolName: rewardTool.name, emoji: rewardTool.emoji };
        }
      }

      // マイルストーン報酬の履歴 + 通知
      if (streakUpdate.milestone) {
        const m = streakUpdate.milestone;
        await tx.coinTransaction.create({
          data: {
            userId: submission.userId,
            amount: m.bonusCoins,
            kind: "BONUS",
            reason: `🔥 れんぞく${m.days}日ボーナス：${m.label}`,
          },
        });
        await tx.specialBonusNotification.create({
          data: {
            userId: submission.userId,
            reason: `🔥 れんぞく${m.days}日たっせい！ ${m.label}`,
            coinAmount: m.bonusCoins,
            isRead: false,
          },
        });

        // 素材アイテムを SharedInventoryItem に追加
        if (m.bonusItem) {
          const item = m.bonusItem;
          await tx.sharedInventoryItem.upsert({
            where: { itemId: item.itemId },
            update: { quantity: { increment: item.quantity } },
            create: {
              itemId: item.itemId,
              itemName: item.itemName,
              quantity: item.quantity,
              itemType: item.itemType as never,
            },
          });
        }
      }

      return {
        newBalance: updatedUser.coinBalance,
        streak: {
          currentStreak: streakUpdate.currentStreak,
          longestStreak: streakUpdate.longestStreak,
          streakStatus: streakUpdate.streakStatus,
          didIncrement: streakUpdate.didIncrement,
          milestone: streakUpdate.milestone,
        },
        trapRewarded,
      };
    });

    revalidatePath("/bank");
    revalidatePath("/kids");
    revalidatePath("/kids/[kidId]/quests", "page");

    return {
      success: true,
      status: "APPROVED",
      submissionId,
      userId: submission.userId,
      questTitle: submission.quest.title,
      rewardCoins: submission.quest.rewardCoins,
      newCoinBalance: result.newBalance,
      streak: result.streak,
      trapRewarded: result.trapRewarded,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
      return { success: false, error: "すでに処理済みの申請です" };
    }
    console.error("approveQuest failed:", err);
    return { success: false, error: "承認に失敗しました" };
  }
}

export async function rejectQuest(
  submissionId: string,
): Promise<QuestReviewResult> {
  const submission = await prisma.questSubmission.findUnique({
    where: { id: submissionId },
    include: { quest: true },
  });
  if (!submission) {
    return { success: false, error: "申請が見つかりません" };
  }
  if (submission.status !== "PENDING") {
    return { success: false, error: "すでに処理済みの申請です" };
  }

  try {
    const upd = await prisma.questSubmission.updateMany({
      where: { id: submissionId, status: "PENDING" },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });
    if (upd.count !== 1) {
      return { success: false, error: "すでに処理済みの申請です" };
    }
  } catch (err) {
    console.error("rejectQuest failed:", err);
    return { success: false, error: "差し戻しに失敗しました" };
  }

  revalidatePath("/bank");
  revalidatePath("/kids");
  revalidatePath("/kids/[kidId]/quests", "page");

  return {
    success: true,
    status: "REJECTED",
    submissionId,
    userId: submission.userId,
    questTitle: submission.quest.title,
    rewardCoins: submission.quest.rewardCoins,
  };
}

// ─────────────────────────────────────────────
// クエストマスタ管理（親が自由にクエストを追加・編集・削除）
// ─────────────────────────────────────────────

const QUEST_TITLE_MAX = 80;
const QUEST_DESC_MAX = 400;
const QUEST_REWARD_MIN = 1;
const QUEST_REWARD_MAX = 10000;

// クエストカテゴリ（許容値・正規化・型）は lib/quest-categories.ts に集約。
// "use server" ファイルからは非関数の export が Server Action 参照に
// 変換されてしまうため、配列定数や型はここでは再定義せず import するだけにする。

export type QuestMasterInput = {
  title: string;
  description?: string;
  rewardCoins: number;
  emoji?: string;
  category?: QuestCategory;
  targetUserIds: string[];
};

export type QuestMasterResult =
  | {
      success: true;
      quest: {
        id: string;
        title: string;
        description: string | null;
        rewardCoins: number;
        emoji: string;
        isActive: boolean;
        category: QuestCategory;
        targetUserIds: string[];
      };
    }
  | { success: false; error: string };

function validateQuestInput(data: QuestMasterInput): string | null {
  const title = data.title?.trim();
  if (!title) return "タイトルは必須です";
  if (title.length > QUEST_TITLE_MAX) {
    return `タイトルは ${QUEST_TITLE_MAX} 文字以内にしてください`;
  }
  if (data.description && data.description.length > QUEST_DESC_MAX) {
    return `説明は ${QUEST_DESC_MAX} 文字以内にしてください`;
  }
  if (
    !Number.isInteger(data.rewardCoins) ||
    data.rewardCoins < QUEST_REWARD_MIN ||
    data.rewardCoins > QUEST_REWARD_MAX
  ) {
    return `報酬コインは ${QUEST_REWARD_MIN}〜${QUEST_REWARD_MAX} の整数で指定してください`;
  }
  if (
    data.category !== undefined &&
    !(QUEST_CATEGORIES as readonly string[]).includes(data.category)
  ) {
    return `カテゴリは ${QUEST_CATEGORIES.join(" / ")} のいずれかを指定してください`;
  }
  return null;
}

export async function createQuest(
  data: QuestMasterInput,
): Promise<QuestMasterResult> {
  const err = validateQuestInput(data);
  if (err) return { success: false, error: err };

  try {
    const quest = await prisma.quest.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        rewardCoins: data.rewardCoins,
        emoji: data.emoji?.trim() || "⭐",
        category: normalizeCategory(data.category),
        targetUsers: data.targetUserIds.length > 0 ? {
          connect: data.targetUserIds.map(id => ({ id })),
        } : undefined,
      },
      include: { targetUsers: true },
    });

    revalidatePath("/bank");
    revalidatePath("/bank/quests");
    revalidatePath("/kids/[kidId]/quests", "page");

    return {
      success: true,
      quest: {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        rewardCoins: quest.rewardCoins,
        emoji: quest.emoji,
        isActive: quest.isActive,
        category: normalizeCategory(quest.category),
        targetUserIds: quest.targetUsers.map(u => u.id),
      },
    };
  } catch (e) {
    console.error("createQuest failed:", e);
    return { success: false, error: "クエストの作成に失敗しました" };
  }
}

export async function updateQuest(
  id: string,
  data: QuestMasterInput,
): Promise<QuestMasterResult> {
  const err = validateQuestInput(data);
  if (err) return { success: false, error: err };

  try {
    const exists = await prisma.quest.findUnique({ where: { id } });
    if (!exists) {
      return { success: false, error: "クエストが見つかりません" };
    }

    const quest = await prisma.quest.update({
      where: { id },
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        rewardCoins: data.rewardCoins,
        emoji: data.emoji?.trim() || exists.emoji || "⭐",
        category: normalizeCategory(data.category),
        targetUsers: {
          set: data.targetUserIds.map(id => ({ id })),
        },
      },
      include: { targetUsers: true },
    });

    revalidatePath("/bank");
    revalidatePath("/bank/quests");
    revalidatePath("/kids/[kidId]/quests", "page");

    return {
      success: true,
      quest: {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        rewardCoins: quest.rewardCoins,
        emoji: quest.emoji,
        isActive: quest.isActive,
        category: normalizeCategory(quest.category),
        targetUserIds: quest.targetUsers.map(u => u.id),
      },
    };
  } catch (e) {
    console.error("updateQuest failed:", e);
    return { success: false, error: "クエストの更新に失敗しました" };
  }
}

export async function deleteQuest(
  id: string,
): Promise<{ success: boolean; error?: string; deletedSubmissions?: number }> {
  try {
    // schema 側で onDelete: Cascade が効いているが、件数を返したいので
    // トランザクション内で先に明示 deleteMany → quest.delete とする。
    const result = await prisma.$transaction(async (tx) => {
      const subs = await tx.questSubmission.deleteMany({
        where: { questId: id },
      });
      await tx.quest.delete({ where: { id } });
      return subs.count;
    });

    revalidatePath("/bank");
    revalidatePath("/bank/quests");
    revalidatePath("/kids/[kidId]/quests", "page");

    return { success: true, deletedSubmissions: result };
  } catch (e) {
    console.error("deleteQuest failed:", e);
    return { success: false, error: "クエストの削除に失敗しました" };
  }
}

// ─────────────────────────────────────────────
// ペナルティマスタ管理（親が「やったらコイン没収」を事前定義）
// クエストと同じく、targetUserIds が空なら全員用、入っていれば特定の子供のみ。
// applyPenaltyMaster で実際にコインを没収し、coin_transactions に記録する。
// ─────────────────────────────────────────────

const PENALTY_TITLE_MAX = 80;
const PENALTY_DESC_MAX = 400;
// クエストと揃えて 10 の倍数に縛る（UI 側でも step=10 にしている）。
const PENALTY_COIN_MIN = 10;
const PENALTY_COIN_MAX = 10000;
const PENALTY_COIN_STEP = 10;

export type PenaltyMasterInput = {
  title: string;
  description?: string;
  coinAmount: number;
  emoji?: string;
  targetUserIds: string[];
};

export type PenaltyMasterResult =
  | {
      success: true;
      penalty: {
        id: string;
        title: string;
        description: string | null;
        coinAmount: number;
        emoji: string;
        isActive: boolean;
        targetUserIds: string[];
      };
    }
  | { success: false; error: string };

function validatePenaltyInput(data: PenaltyMasterInput): string | null {
  const title = data.title?.trim();
  if (!title) return "タイトルは必須です";
  if (title.length > PENALTY_TITLE_MAX) {
    return `タイトルは ${PENALTY_TITLE_MAX} 文字以内にしてください`;
  }
  if (data.description && data.description.length > PENALTY_DESC_MAX) {
    return `説明は ${PENALTY_DESC_MAX} 文字以内にしてください`;
  }
  if (
    !Number.isInteger(data.coinAmount) ||
    data.coinAmount < PENALTY_COIN_MIN ||
    data.coinAmount > PENALTY_COIN_MAX
  ) {
    return `没収コインは ${PENALTY_COIN_MIN}〜${PENALTY_COIN_MAX} の整数で指定してください`;
  }
  if (data.coinAmount % PENALTY_COIN_STEP !== 0) {
    return `没収コインは ${PENALTY_COIN_STEP} の倍数で指定してください`;
  }
  return null;
}

export async function createPenalty(
  data: PenaltyMasterInput,
): Promise<PenaltyMasterResult> {
  const err = validatePenaltyInput(data);
  if (err) return { success: false, error: err };

  try {
    const penalty = await prisma.penalty.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        coinAmount: data.coinAmount,
        emoji: data.emoji?.trim() || "🚨",
        targetUsers:
          data.targetUserIds.length > 0
            ? { connect: data.targetUserIds.map((id) => ({ id })) }
            : undefined,
      },
      include: { targetUsers: true },
    });

    revalidatePath("/bank");
    revalidatePath("/bank/penalties");

    return {
      success: true,
      penalty: {
        id: penalty.id,
        title: penalty.title,
        description: penalty.description,
        coinAmount: penalty.coinAmount,
        emoji: penalty.emoji,
        isActive: penalty.isActive,
        targetUserIds: penalty.targetUsers.map((u) => u.id),
      },
    };
  } catch (e) {
    console.error("createPenalty failed:", e);
    return { success: false, error: "ペナルティの作成に失敗しました" };
  }
}

export async function updatePenalty(
  id: string,
  data: PenaltyMasterInput,
): Promise<PenaltyMasterResult> {
  const err = validatePenaltyInput(data);
  if (err) return { success: false, error: err };

  try {
    const exists = await prisma.penalty.findUnique({ where: { id } });
    if (!exists) {
      return { success: false, error: "ペナルティが見つかりません" };
    }

    const penalty = await prisma.penalty.update({
      where: { id },
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        coinAmount: data.coinAmount,
        emoji: data.emoji?.trim() || exists.emoji || "🚨",
        targetUsers: {
          set: data.targetUserIds.map((id) => ({ id })),
        },
      },
      include: { targetUsers: true },
    });

    revalidatePath("/bank");
    revalidatePath("/bank/penalties");

    return {
      success: true,
      penalty: {
        id: penalty.id,
        title: penalty.title,
        description: penalty.description,
        coinAmount: penalty.coinAmount,
        emoji: penalty.emoji,
        isActive: penalty.isActive,
        targetUserIds: penalty.targetUsers.map((u) => u.id),
      },
    };
  } catch (e) {
    console.error("updatePenalty failed:", e);
    return { success: false, error: "ペナルティの更新に失敗しました" };
  }
}

export async function deletePenalty(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.penalty.delete({ where: { id } });
    revalidatePath("/bank");
    revalidatePath("/bank/penalties");
    return { success: true };
  } catch (e) {
    console.error("deletePenalty failed:", e);
    return { success: false, error: "ペナルティの削除に失敗しました" };
  }
}

// マスタから選んだペナルティを実際に適用する。
// 既存の applyPenalty(userId, reason) と違って、coinAmount は penalty 側に従う。
export async function applyPenaltyMaster(
  penaltyId: string,
  userId: string,
): Promise<{ success: boolean; error?: string; newCoinBalance?: number }> {
  try {
    const penalty = await prisma.penalty.findUnique({
      where: { id: penaltyId },
      include: { targetUsers: { select: { id: true } } },
    });
    if (!penalty || !penalty.isActive) {
      return { success: false, error: "ペナルティが見つかりません" };
    }

    // 対象チェック：targetUsers が空なら全員 OK。指定があればその子だけ。
    if (
      penalty.targetUsers.length > 0 &&
      !penalty.targetUsers.some((u) => u.id === userId)
    ) {
      return { success: false, error: "この子供は対象ではありません" };
    }

    await ensureChild(userId);

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { coinBalance: { decrement: penalty.coinAmount } },
      });
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: -penalty.coinAmount,
          kind: "PENALTY",
          reason: penalty.title,
        },
      });
      await tx.penaltyNotification.create({
        data: {
          userId,
          reason: penalty.title,
          coinAmount: penalty.coinAmount,
          isRead: false,
        },
      });
      return u;
    });

    revalidatePath("/bank");
    revalidatePath("/kids");

    return { success: true, newCoinBalance: updatedUser.coinBalance };
  } catch (e) {
    console.error("applyPenaltyMaster failed:", e);
    return { success: false, error: "ペナルティ適用に失敗しました" };
  }
}

// ─────────────────────────────────────────────
// テスト用裏アカウント
// ─────────────────────────────────────────────

/** テストユーザーが存在しなければ作成し、id を返す */
export async function getOrCreateTestUser(): Promise<{ id: string; name: string; coinBalance: number }> {
  const existing = await prisma.user.findFirst({ where: { isTestAccount: true } });
  if (existing) {
    return { id: existing.id, name: existing.name, coinBalance: existing.coinBalance };
  }
  const created = await prisma.user.create({
    data: {
      name: "🧪 テスト",
      birthDate: new Date("2000-01-01"),
      role: "CHILD",
      coinBalance: 99999,
      isTestAccount: true,
    },
  });
  return { id: created.id, name: created.name, coinBalance: created.coinBalance };
}

/** テストユーザーのコインを 99999 にリセット */
export async function resetTestUser(): Promise<{ success: boolean }> {
  try {
    await prisma.user.updateMany({
      where: { isTestAccount: true },
      data: { coinBalance: 99999, dailyHuntCount: 0 },
    });
    revalidatePath("/bank");
    return { success: true };
  } catch (e) {
    console.error("resetTestUser failed:", e);
    return { success: false };
  }
}
