"use server";

// 親（管理者）が銀行画面から呼び出すコイン操作のサーバアクション。
// すべて prisma.$transaction で「残高更新 + 履歴記録」をアトミックに行う。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
