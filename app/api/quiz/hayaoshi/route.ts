// POST /api/quiz/hayaoshi
//   body: { genre: string; usedQuestions?: string[] }
//   resp: { type, phrases, answer, hint1, hint2, answerReading, ...type-specific fields }
//
// 早押しクイズの問題を Gemini で生成する。
// ガイドキャラ等と同様に geminiGenerateObject を利用。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { geminiGenerateObject } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Zod スキーマ（3種類の問題形式を union で定義） ─────────────────────────

const BaseSchema = z.object({
  phrases: z.array(z.string()).min(2).max(4),
  answer: z.string(),
  hint1: z.string(),
  hint2: z.string(),
  answerReading: z.string(),
});

const TextSchema = BaseSchema.extend({ type: z.literal("text") });

const KanjiCrossSchema = BaseSchema.extend({
  type: z.literal("kanji_cross"),
  top: z.string(),
  bottom: z.string(),
  left: z.string(),
  right: z.string(),
});

const LogicSequenceSchema = BaseSchema.extend({
  type: z.literal("logic_sequence"),
  items: z.array(z.string()).min(3).max(6),
});

const QuizSchema = z.union([TextSchema, KanjiCrossSchema, LogicSequenceSchema]);

// ── システムプロンプト ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `あなたは子ども向け早押しクイズの問題作成者です。
対象は幼児〜小学校低学年。やさしい日本語（ひらがな中心、カタカナ可）を使ってください。

以下の3種類からランダムに1つ選び、JSONのみ返答してください。前置き・説明・マークダウン不要。

phrasesは意味のかたまりで3〜4個に分割。最初は遠回し、後半ほど具体的になるよう設計。
hint1は軽いヒント、hint2はより具体的なヒント。やさしい言葉で。

1. {"type":"text","phrases":["フレーズ1","フレーズ2","フレーズ3"],"answer":"答え","hint1":"軽いヒント","hint2":"具体的なヒント","answerReading":"答えのひらがな"}
2. {"type":"kanji_cross","phrases":["フレーズ1","フレーズ2","フレーズ3"],"top":"漢字","bottom":"漢字","left":"漢字","right":"漢字","answer":"中央の漢字1文字","hint1":"軽いヒント","hint2":"具体的なヒント","answerReading":"答えのひらがな"}
3. {"type":"logic_sequence","phrases":["フレーズ1","フレーズ2","フレーズ3"],"items":["要素1","要素2","要素3","要素4","?"],"answer":"答え","hint1":"軽いヒント","hint2":"具体的なヒント","answerReading":"答えのひらがな"}`;

export async function POST(req: NextRequest) {
  let body: { genre?: string; usedQuestions?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const genre = (body.genre ?? "こどもクイズ").trim();
  const usedQuestions = body.usedQuestions ?? [];

  const usedHint = usedQuestions.length
    ? `\n以下は出題済みなので絶対に出さないこと:\n${usedQuestions.slice(-5).join("\n")}`
    : "";

  const userPrompt = `ジャンル「${genre}」から問題を1問作成してください。${usedHint}`;

  const result = await geminiGenerateObject(QuizSchema, SYSTEM_PROMPT, userPrompt);

  if (!result.ok) {
    console.warn("[/api/quiz/hayaoshi] Gemini failed:", result.error);
    return NextResponse.json(
      { error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json(result.object);
}
