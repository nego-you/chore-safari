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
// Ollama エラー分類ヘルパー
// -------------------------------------------------------------------
//
// lib/ai-guide の AIGuideReactor.generateReply() は
//   throw new Error(`Ollama error: ${result.error}`)
// という形で throw してくる。
// result.error の内容は lib/ollama.ts が組み立てた文字列:
//   "fetch failed"              -> Node.js 18+ での接続拒否
//   "ECONNREFUSED ..."          -> 接続拒否 (旧 Node / OS 直)
//   "Ollama HTTP 404: ..."      -> モデル未取得
//   "Ollama HTTP 5xx: ..."      -> Ollama 内部エラー
//   "Ollama timeout"            -> タイムアウト (AbortController)
//   "Ollama returned empty ..." -> 空レスポンス
//   その他                      -> 予期せぬエラー

function classifyOllamaError(err: unknown): {
  error: string;
  errorDetail: string;
} {
  const raw = err instanceof Error ? err.message : String(err);

  // Node.js の fetch が接続拒否時に返す "fetch failed" / ECONNREFUSED
  if (
    raw.includes("fetch failed") ||
    raw.includes("ECONNREFUSED") ||
    raw.includes("ENOTFOUND") ||
    raw.includes("connect ETIMEDOUT")
  ) {
    return {
      error: "Ollamaに つながれなかったよ",
      errorDetail:
        "[接続拒否] Ollama が起動していないようです。\n" +
        "ターミナルで `ollama serve` を実行してから再試行してください。\n" +
        "Raw: " +
        raw,
    };
  }

  // 404 -> モデルが存在しない
  if (raw.includes("HTTP 404") || raw.includes("model")) {
    const model = process.env.OLLAMA_MODEL ?? "llama3.2";
    return {
      error: "Ollamaのモデルが みつからないよ",
      errorDetail:
        "[404 Not Found] モデル \"" +
        model +
        "\" が Ollama に存在しません。\n" +
        "`ollama pull " +
        model +
        "` でダウンロードしてください。\n" +
        "Raw: " +
        raw,
    };
  }

  // タイムアウト
  if (raw.includes("timeout") || raw.includes("AbortError")) {
    return {
      error: "Ollamaのおへんじが こなかったよ",
      errorDetail:
        "[タイムアウト] Ollama の応答に時間がかかりすぎました。\n" +
        "OLLAMA_TIMEOUT_MS 環境変数を増やすか、より軽いモデルを使ってください。\n" +
        "Raw: " +
        raw,
    };
  }

  // 5xx サーバーエラー
  if (raw.includes("HTTP 5")) {
    return {
      error: "Ollamaが エラーを かえしてきたよ",
      errorDetail:
        "[HTTP 5xx] Ollama サーバー内部でエラーが発生しました。\n" +
        "ollama のログを確認してください。\n" +
        "Raw: " +
        raw,
    };
  }

  // 空レスポンス
  if (raw.includes("empty content")) {
    return {
      error: "Ollamaが なにも かえしてこなかったよ",
      errorDetail:
        "[空レスポンス] Ollama が空の応答を返しました。\n" +
        "モデルのメモリ不足や設定ミスの可能性があります。\n" +
        "Raw: " +
        raw,
    };
  }

  // その他 / 未知のエラー
  return {
    error: "AIガイドとの つうしんに しっぱいしました",
    errorDetail:
      "[予期せぬエラー] 原因不明のエラーが発生しました。\n" +
      "Raw: " +
      raw,
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

    // Ollama 起因のエラーを分類して返す
    const classified = classifyOllamaError(err);
    console.error(
      "[chatWithAnimal] Ollama error\n  errorDetail:",
      classified.errorDetail,
      "\n  Original error object:",
      err,
    );
    return { success: false, ...classified };
  }
}
