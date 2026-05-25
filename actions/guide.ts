"use server";

// actions/guide.ts
// AIガイドキャラクター関連 Server Actions
//   setGuideAnimal      : ガイドキャラを任命する
//   getGuideSuggestion  : 自発的な声かけテキストを取得する (3R/3C)
//   chatWithAnimal      : 動物と 1:1 チャットする

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AIGuideService } from "@/lib/ai-guide";
import type { SuggestionResponse, AiResponse } from "@/lib/ai-guide";

// -------------------------------------------------------------------
// ガイドキャラ任命
// -------------------------------------------------------------------

export type SetGuideResult =
  | { success: true; activeGuideAnimalId: string }
  | { success: false; error: string };

export async function setGuideAnimal(
  userId: string,
  caughtAnimalId: string,
): Promise<SetGuideResult> {
  if (!userId || !caughtAnimalId) {
    return { success: false, error: "パラメータが足りません" };
  }

  const ca = await prisma.caughtAnimal.findUnique({
    where: { id: caughtAnimalId },
    select: { caughtByUserId: true, isAlive: true },
  });

  if (!ca) return { success: false, error: "どうぶつが みつかりません" };
  if (ca.caughtByUserId !== userId) {
    return { success: false, error: "この どうぶつは あなたのものじゃないよ" };
  }
  if (!ca.isAlive) {
    return { success: false, error: "このこは もう たびだってしまったよ" };
  }

  // NOTE: activeGuideAnimalId は schema.prisma 更新済み。
  // prisma generate 実行後に型が解決される。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.user.update as any)({
    where: { id: userId },
    data: { activeGuideAnimalId: caughtAnimalId },
  });

  revalidatePath(`/kids/${userId}/house`);
  return { success: true, activeGuideAnimalId: caughtAnimalId };
}

// -------------------------------------------------------------------
// 自発提案取得 (3R/3C)
// -------------------------------------------------------------------

export type GetGuideSuggestionResult =
  | { success: true; suggestion: SuggestionResponse | null }
  | { success: false; error: string };

export async function getGuideSuggestion(
  userId: string,
  activeGuideId: string,
): Promise<GetGuideSuggestionResult> {
  if (!userId || !activeGuideId) {
    return { success: false, error: "パラメータが足りません" };
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
    const suggestion = await service.suggestProactively(userId, activeGuideId);
    return { success: true, suggestion };
  } catch (err) {
    console.error("getGuideSuggestion failed:", err);
    return { success: true, suggestion: null };
  }
}

// -------------------------------------------------------------------
// 動物との 1:1 チャット
// -------------------------------------------------------------------

export type ChatWithAnimalResult =
  | { success: true; response: AiResponse }
  | { success: false; error: string };

export async function chatWithAnimal(
  caughtAnimalId: string,
  message: string,
  userId: string,
): Promise<ChatWithAnimalResult> {
  if (!caughtAnimalId || !message.trim() || !userId) {
    return { success: false, error: "パラメータが足りません" };
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
    const response = await service.chat(userId, caughtAnimalId, message, "house");
    return { success: true, response };
  } catch (err) {
    if (err instanceof Error && err.message === "CAUGHT_ANIMAL_NOT_FOUND") {
      return { success: false, error: "どうぶつが みつかりません" };
    }
    console.error("chatWithAnimal failed:", err);
    return {
      success: false,
      error: "AIガイドとの つうしんに しっぱいしました。もう一度 ためしてね",
    };
  }
}
