"use server";

// features/race/actions.ts
// レース ベット / 報酬。
//   betOnRace       : レース開始時にコインを消費する（トランザクション安全）
//   claimRaceReward : 勝利時に報酬コインを付与する

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AIGuideService } from "@/lib/ai-guide";

// ── メインアクション ────────────────────────────────────────────────────

export async function betOnRace(
  userId: string,
  amount: number,
): Promise<
  | { success: true; newCoinBalance: number }
  | { success: false; error: string }
> {
  if (amount <= 0) return { success: false, error: "ベット額が ただしくありません" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, coinBalance: true, isTestAccount: true },
  });
  if (!user) return { success: false, error: "ユーザーが みつかりません" };

  if (!user.isTestAccount && user.coinBalance < amount) {
    return {
      success: false,
      error: `コインが たりません（もってる: ${user.coinBalance} / ひつよう: ${amount}）`,
    };
  }

  try {
    const fresh = await prisma.$transaction(async (tx) => {
      if (!user.isTestAccount) {
        const result = await tx.user.updateMany({
          where: { id: userId, coinBalance: { gte: amount } },
          data: { coinBalance: { decrement: amount } },
        });
        if (result.count !== 1) throw new Error("INSUFFICIENT_COINS");
      }
      await tx.coinTransaction.create({
        data: { userId, amount: -amount, kind: "GACHA", reason: `レース ベット ${amount}コイン` },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { coinBalance: true },
      });
    });

    revalidatePath("/kids");
    revalidatePath("/bank");
    // レース利用履歴を記録（AIガイドの提案に反映される）
    void AIGuideService.recordActivity(userId, "race").catch(() => {});
    return { success: true, newCoinBalance: fresh.coinBalance };
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_COINS") {
      return { success: false, error: "コインが たりません（だれかに さきを こされた？）" };
    }
    console.error("betOnRace failed:", err);
    return { success: false, error: "ベット しっぱい。もう一度 やってみてね" };
  }
}

export async function claimRaceReward(
  userId: string,
  amount: number,
): Promise<
  | { success: true; newCoinBalance: number }
  | { success: false; error: string }
> {
  if (amount <= 0) return { success: false, error: "ほうしゅう額が ただしくありません" };

  try {
    const fresh = await prisma.$transaction(async (tx) => {
      await tx.coinTransaction.create({
        data: { userId, amount, kind: "BONUS", reason: `レース よそうてき中！ +${amount}コイン` },
      });
      return tx.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: amount } },
        select: { coinBalance: true },
      });
    });

    revalidatePath("/kids");
    revalidatePath("/bank");
    return { success: true, newCoinBalance: fresh.coinBalance };
  } catch (err) {
    console.error("claimRaceReward failed:", err);
    return { success: false, error: "ほうしゅうの うけとりに しっぱいしました" };
  }
}
