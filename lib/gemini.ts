// lib/gemini.ts
// Gemini API クライアント（Vercel AI SDK: @ai-sdk/google）
//
//   GEMINI_API_KEY : Google AI Studio で取得した API キー
//   GEMINI_MODEL   : 例) gemini-2.5-flash / gemini-2.0-flash（gemini-1.5-flash は廃止済み）
//
// generateText + 手動 JSON パースにより、
// Gemini の structured output サポートに依存せず安定して動作する。

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";

export const GEMINI_MODEL_NAME =
  process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

/** GEMINI_API_KEY を注入した Google プロバイダーを生成する */
function createProvider() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が設定されていません");
  }
  return createGoogleGenerativeAI({ apiKey });
}

export type GeminiObjectResult<T> =
  | { ok: true; object: T }
  | { ok: false; error: string };

/**
 * Gemini でテキストを生成し、JSON としてパース・Zod 検証して返す。
 *
 * システムプロンプト側で「JSON のみを出力すること」を指示しておく前提。
 * モデルが Markdown コードブロックで包んで返しても自動的に除去する。
 *
 * @param schema      - Zod スキーマ（レスポンスの形状）
 * @param systemPrompt - キャラクター設定・出力形式を記述したシステムプロンプト
 * @param userText    - ユーザーの入力テキスト
 * @param options     - 任意の生成オプション（temperature など）。省略時は従来挙動。
 */
export async function geminiGenerateObject<T>(
  schema: z.ZodSchema<T>,
  systemPrompt: string,
  userText: string,
  options?: { temperature?: number },
): Promise<GeminiObjectResult<T>> {
  try {
    const provider = createProvider();
    const { text } = await generateText({
      model: provider(GEMINI_MODEL_NAME),
      system: systemPrompt,
      prompt: userText,
      ...(options?.temperature != null ? { temperature: options.temperature } : {}),
    });

    console.log("[geminiGenerateObject] raw text:", text);

    // Markdown コードブロック（```json ... ```）を除去してから parse
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const validated = schema.parse(parsed);
    console.log("[geminiGenerateObject] validated:", JSON.stringify(validated));
    return { ok: true, object: validated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[geminiGenerateObject] error:", message);
    return { ok: false, error: message };
  }
}
