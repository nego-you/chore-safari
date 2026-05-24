"use server";

// app/kids/[kidId]/actions.ts
// [kidId] スコープのサーバアクション:
//   chatWithGuide         — AIガイドキャラクターとのチャット
//   claimGraduationReward — 寿命満了動物の「ありがとうのプレゼント」受取

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AIGuideService } from "@/lib/ai-guide";
import type { AiResponse } from "@/lib/ai-guide";

// ─────────────────────────────────────────────────────────────
// AIガイドチャット
// ─────────────────────────────────────────────────────────────

export type ChatResult =
  | { success: true; response: AiResponse }
  | { success: false; error: string };

export async function chatWithGuide(
  userId: string,
  caughtAnimalId: string,
  message: string,
  currentScreen: string,
): Promise<ChatResult> {
  if (!userId || !caughtAnimalId || !message.trim()) {
    return { success: false, error: "パラメータが 足りません" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが みつかりません" };
  }

  try {
    const service = new AIGuideService();
    const response = await service.chat(userId, caughtAnimalId, message, currentScreen);
    return { success: true, response };
  } catch (err) {
    if (err instanceof Error && err.message === "CAUGHT_ANIMAL_NOT_FOUND") {
      return { success: false, error: "どうぶつが みつかりません" };
    }
    console.error("chatWithGuide failed:", err);
    return { success: false, error: "AIガイドとの通信に 失敗しました。もう一度試してね" };
  }
}

// ─────────────────────────────────────────────────────────────
// 卒業報酬受け取り（ありがとうのプレゼント）
//   - rewardClaimed が false の卒業済み動物に対してのみ付与
//   - lifespanYears × 10 コインをボーナス付与
//   - rewardClaimed を true に更新（二重受取防止）
// ─────────────────────────────────────────────────────────────

export type GraduationRewardResult =
  | { success: true; coinsAwarded: number; newCoinBalance: number; animalName: string }
  | { success: false; error: string };

export async function claimGraduationReward(
  caughtAnimalId: string,
  userId: string,
): Promise<GraduationRewardResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが みつかりません" };
  }

  const ca = await prisma.caughtAnimal.findUnique({
    where: { id: caughtAnimalId },
    select: {
      id: true,
      caughtByUserId: true,
      rewardClaimed: true,
      caughtAt: true,
      expiresAt: true,
      animal: {
        select: {
          genericName: true,
          specificName: true,
          lifespanYears: true,
        },
      },
    },
  });

  if (!ca) return { success: false, error: "どうぶつが みつかりません" };
  if (ca.caughtByUserId !== userId) return { success: false, error: "この どうぶつは あなたのものじゃないよ" };
  if (ca.rewardClaimed) return { success: false, error: "もう プレゼントを うけとったよ" };

  // 卒業条件チェック（経過日数 >= lifespanYears、または expiresAt 超過）
  const elapsedDays = Math.floor(
    (Date.now() - ca.caughtAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const isExpiredByDays = elapsedDays >= ca.animal.lifespanYears;
  const isExpiredByDate = ca.expiresAt !== null && ca.expiresAt <= new Date();
  if (!isExpiredByDays && !isExpiredByDate) {
    return { success: false, error: "まだ じゅみょうに たっしていないよ" };
  }

  const coinsAwarded = ca.animal.lifespanYears * 10;
  const animalName = ca.animal.genericName || ca.animal.specificName;

  try {
    const fresh = await prisma.$transaction(async (tx) => {
      // 二重受取防止：rewardClaimed=false の行だけ更新
      const upd = await tx.caughtAnimal.updateMany({
        where: { id: caughtAnimalId, rewardClaimed: false },
        data: { rewardClaimed: true, isGraduated: true, isAlive: false },
      });
      if (upd.count !== 1) throw new Error("ALREADY_CLAIMED");

      await tx.coinTransaction.create({
        data: {
          userId,
          amount: coinsAwarded,
          kind: "BONUS",
          reason: `${animalName}の 卒業プレゼント (+${coinsAwarded}コイン)`,
        },
      });

      return tx.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: coinsAwarded } },
        select: { coinBalance: true },
      });
    });

    revalidatePath(`/kids/${userId}/warehouse`);
    revalidatePath(`/kids/${userId}/dictionary`);
    revalidatePath("/bank");

    return {
      success: true,
      coinsAwarded,
      newCoinBalance: fresh.coinBalance,
      animalName,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_CLAIMED") {
      return { success: false, error: "もう プレゼントを うけとったよ" };
    }
    console.error("claimGraduationReward failed:", err);
    return { success: false, error: "プレゼントの うけとりに しっぱいしました" };
  }
}
