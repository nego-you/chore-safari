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

export async function giveBonus(
  userId: string,
  amount: number,
  reason: string,
) {
  await ensureChild(userId);
  if (!Number.isInteger(amount) || amount < BONUS_MIN || amount > BONUS_MAX) {
    throw new Error(
      `ボーナス額は ${BONUS_MIN}〜${BONUS_MAX} コインの範囲で指定してください`,
    );
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error("達成内容（reason）は必須です");
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coinBalance: { increment: amount } },
    }),
    prisma.coinTransaction.create({
      data: { userId, amount, kind: "BONUS", reason: reason.trim() },
    }),
  ]);
  revalidatePath("/bank");
}
