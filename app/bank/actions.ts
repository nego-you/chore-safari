"use server";

// 親（管理者）が銀行画面から呼び出すコイン操作のサーバアクション。
// すべて prisma.$transaction で「残高更新 + 履歴記録」をアトミックに行う。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  QUEST_CATEGORIES,
  normalizeCategory,
  type QuestCategory,
} from "@/lib/quest-categories";

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
        reason: reason?.trim() || "喧嘩",
      },
    }),
  ]);
  revalidatePath("/bank");
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      // PENDING のものだけを APPROVED に。二重承認は count=0 で弾く。
      const upd = await tx.questSubmission.updateMany({
        where: { id: submissionId, status: "PENDING" },
        data: { status: "APPROVED", reviewedAt: new Date() },
      });
      if (upd.count !== 1) {
        throw new Error("ALREADY_PROCESSED");
      }

      // 報酬コイン加算
      const updatedUser = await tx.user.update({
        where: { id: submission.userId },
        data: { coinBalance: { increment: submission.quest.rewardCoins } },
      });

      // コイン履歴に「クエスト完了報酬」として記録
      await tx.coinTransaction.create({
        data: {
          userId: submission.userId,
          amount: submission.quest.rewardCoins,
          kind: "CHORE",
          reason: `クエスト完了：${submission.quest.title}`,
        },
      });

      return { newBalance: updatedUser.coinBalance };
    });

    revalidatePath("/bank");
    revalidatePath("/kids");
    revalidatePath("/kids/quests");

    return {
      success: true,
      status: "APPROVED",
      submissionId,
      userId: submission.userId,
      questTitle: submission.quest.title,
      rewardCoins: submission.quest.rewardCoins,
      newCoinBalance: result.newBalance,
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
  revalidatePath("/kids/quests");

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
    revalidatePath("/kids/quests");

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
    revalidatePath("/kids/quests");

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
    revalidatePath("/kids/quests");

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
const PENALTY_COIN_MIN = 1;
const PENALTY_COIN_MAX = 10000;

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
