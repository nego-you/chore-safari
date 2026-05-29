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

// ── 難易度ガイド ────────────────────────────────────────────────────────────

const DIFFICULTY_GUIDE: Record<string, string> = {
  easy: `【難易度：やさしい】対象は年長〜小学1年生。
身近なものを題材にしますが、すぐ分かる超簡単な問題は避け、少しだけ考える問題にしてください。
ひらがな中心のやさしい日本語。漢字を使う場合はふりがな相当のやさしさを保つ。`,
  normal: `【難易度：ふつう】対象は小学2〜4年生。
理科・社会・生活・国語の基礎知識を使う、少し歯ごたえのある問題にしてください。
答えがすぐ分からず、フレーズやヒントを聞いて考える必要があるレベル。`,
  hard: `【難易度：むずかしい】対象は小学5〜6年生以上。
雑学・歴史・理科・漢字・計算・なぞなぞなど、大人でも少し考えるくらいの本格的な問題にしてください。
ありきたりで簡単な問題は禁止。ひねりのある、知的な問題を作ってください。`,
};

// ── システムプロンプト ──────────────────────────────────────────────────────

function buildSystemPrompt(difficulty: string): string {
  const diffGuide = DIFFICULTY_GUIDE[difficulty] ?? DIFFICULTY_GUIDE.easy;
  return `あなたは子ども向け早押しクイズの問題作成者です。

${diffGuide}

以下の3種類からランダムに1つ選び、JSONのみ返答してください。前置き・説明・マークダウン不要。

phrasesは意味のかたまりで3〜4個に分割。最初は遠回し、後半ほど具体的になるよう設計。
hint1は軽いヒント、hint2はより具体的なヒント。難易度に合わせた言葉づかいで。

1. {"type":"text","phrases":["フレーズ1","フレーズ2","フレーズ3"],"answer":"答え","hint1":"軽いヒント","hint2":"具体的なヒント","answerReading":"答えのひらがな"}
2. {"type":"kanji_cross","phrases":["フレーズ1","フレーズ2","フレーズ3"],"top":"漢字","bottom":"漢字","left":"漢字","right":"漢字","answer":"中央の漢字1文字","hint1":"軽いヒント","hint2":"具体的なヒント","answerReading":"答えのひらがな"}
3. {"type":"logic_sequence","phrases":["フレーズ1","フレーズ2","フレーズ3"],"items":["要素1","要素2","要素3","要素4","?"],"answer":"答え","hint1":"軽いヒント","hint2":"具体的なヒント","answerReading":"答えのひらがな"}`;
}

export async function POST(req: NextRequest) {
  let body: { genre?: string; usedQuestions?: string[]; difficulty?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const genre = (body.genre ?? "こどもクイズ").trim();
  const usedQuestions = body.usedQuestions ?? [];
  const difficulty = (body.difficulty ?? "easy").trim();

  const usedHint = usedQuestions.length
    ? `\n以下は出題済みなので絶対に出さないこと:\n${usedQuestions.slice(-5).join("\n")}`
    : "";

  const userPrompt = `ジャンル「${genre}」から問題を1問作成してください。${usedHint}`;

  const result = await geminiGenerateObject(QuizSchema, buildSystemPrompt(difficulty), userPrompt);

  if (!result.ok) {
    console.warn("[/api/quiz/hayaoshi] Gemini failed:", result.error);
    return NextResponse.json(
      { error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json(result.object);
}
