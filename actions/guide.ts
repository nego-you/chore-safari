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
  | { success: false; error: string; errorDetail: string };

// -------------------------------------------------------------------
// Gemini エラー分類ヘルパー
// -------------------------------------------------------------------
//
// lib/ai-guide の AIGuideReactor.generateReply() は
//   throw new Error(`Gemini error: ${result.error}`)
// という形で throw してくる。
// result.error は lib/gemini.ts が catch した err.message 文字列:
//   "GEMINI_API_KEY が設定されていません" -> APIキー未設定
//   "API_KEY_INVALID" / "API key not valid" -> 無効なキー
//   "QUOTA_EXCEEDED" / "429"               -> レート/クォータ制限
//   "SAFETY" / "blocked"                   -> 安全フィルター発動
//   "fetch failed" / "ECONNREFUSED" 等     -> ネットワークエラー
//   その他                                 -> 予期せぬエラー

function classifyGeminiError(err: unknown): {
  error: string;
  errorDetail: string;
} {
  const raw = err instanceof Error ? err.message : String(err);

  // APIキー未設定
  if (raw.includes("GEMINI_API_KEY")) {
    return {
      error: "Gemini APIキーが せっていされていないよ",
      errorDetail:
        "[APIキー未設定] GEMINI_API_KEY 環境変数が設定されていません。\n" +
        ".env ファイルに GEMINI_API_KEY=<your_key> を追加してください。\n" +
        "Raw: " + raw,
    };
  }

  // APIキー無効
  if (
    raw.includes("API_KEY_INVALID") ||
    raw.includes("API key not valid") ||
    raw.includes("invalid API key") ||
    raw.includes("UNAUTHENTICATED")
  ) {
    return {
      error: "Gemini APIキーが まちがっているよ",
      errorDetail:
        "[APIキー無効] GEMINI_API_KEY が無効です。\n" +
        "Google AI Studio (https://aistudio.google.com) で正しいキーを確認してください。\n" +
        "Raw: " + raw,
    };
  }

  // クォータ / レート制限
  if (
    raw.includes("QUOTA_EXCEEDED") ||
    raw.includes("429") ||
    raw.includes("quota") ||
    raw.includes("RESOURCE_EXHAUSTED")
  ) {
    return {
      error: "Gemini の つかいすぎで おやすみちゅうだよ",
      errorDetail:
        "[クォータ制限] API のレート制限またはクォータを超えました。\n" +
        "しばらく待ってから再試行するか、Google AI Studio でクォータ状況を確認してください。\n" +
        "Raw: " + raw,
    };
  }

  // 安全フィルター
  if (
    raw.includes("SAFETY") ||
    raw.includes("safety") ||
    raw.includes("blocked") ||
    raw.includes("RECITATION")
  ) {
    return {
      error: "Gemini が おへんじを ことわったよ",
      errorDetail:
        "[安全フィルター] Gemini の安全フィルターによりレスポンスがブロックされました。\n" +
        "入力テキストを変えて再試行してください。\n" +
        "Raw: " + raw,
    };
  }

  // ネットワークエラー
  if (
    raw.includes("fetch failed") ||
    raw.includes("ECONNREFUSED") ||
    raw.includes("ENOTFOUND") ||
    raw.includes("ETIMEDOUT")
  ) {
    return {
      error: "ネットワークに つながれなかったよ",
      errorDetail:
        "[ネットワークエラー] Gemini API に接続できませんでした。\n" +
        "インターネット接続を確認してください。\n" +
        "Raw: " + raw,
    };
  }

  // その他 / 未知のエラー
  return {
    error: "AIガイドとの つうしんに しっぱいしました",
    errorDetail:
      "[予期せぬエラー] 原因不明のエラーが発生しました。\n" +
      "Raw: " + raw,
  };
}

export async function chatWithAnimal(
  caughtAnimalId: string,
  message: string,
  userId: string,
): Promise<ChatWithAnimalResult> {
  if (!caughtAnimalId || !message.trim() || !userId) {
    return {
      success: false,
      error: "パラメータが足りません",
      errorDetail:
        "[バリデーション] caughtAnimalId / message / userId のいずれかが空です。",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "CHILD") {
    return {
      success: false,
      error: "ユーザーが みつかりません",
      errorDetail:
        "[認証] userId=" +
        JSON.stringify(userId) +
        " が存在しないか CHILD ロールではありません。",
    };
  }

  try {
    const service = new AIGuideService();
    const response = await service.chat(
      userId,
      caughtAnimalId,
      message,
      "house",
    );
    return { success: true, response };
  } catch (err) {
    if (err instanceof Error && err.message === "CAUGHT_ANIMAL_NOT_FOUND") {
      return {
        success: false,
        error: "どうぶつが みつかりません",
        errorDetail:
          "[DB] caughtAnimalId=" +
          JSON.stringify(caughtAnimalId) +
          " が存在しません。",
      };
    }

    // Gemini 起因のエラーを分類して返す
    const classified = classifyGeminiError(err);
    console.error(
      "[chatWithAnimal] Gemini error\n  errorDetail:",
      classified.errorDetail,
      "\n  Original error object:",
      err,
    );
    return { success: false, ...classified };
  }
}
