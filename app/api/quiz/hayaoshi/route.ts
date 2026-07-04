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
  phrases: z.array(z.string()).min(2).max(3),
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

// 全体的にやさしめ。幼児〜小学校低学年の子が楽しめる範囲に下げてある。
const DIFFICULTY_GUIDE: Record<string, string> = {
  easy: `【難易度：やさしい】対象は年中〜小学1年生（幼児）。
どうぶつ・たべもの・みぢかなもの・いろ・かたちなど、子どもがよく知っているものを題材に。
ヒントを聞けばすぐ分かるくらい、とてもやさしい問題にしてください。`,
  normal: `【難易度：ふつう】対象は小学1〜2年生。
生活・しぜん・かんたんな常識など、小さい子でも知っている身近な題材を中心に。
少しだけ考えるけれど、低学年の子なら答えられるやさしいレベルにしてください。`,
  hard: `【難易度：むずかしい】対象は小学3〜4年生。
理科・社会・生活の基礎など、小学生が学校で習う範囲で少し考える問題にしてください。
あくまで小学生向け。大人向けの難しい雑学・専門用語・むずかしい漢字の知識は使わないこと。`,
};

// ── システムプロンプト ──────────────────────────────────────────────────────

function buildSystemPrompt(difficulty: string, chosenType: string): string {
  const diffGuide = DIFFICULTY_GUIDE[difficulty] ?? DIFFICULTY_GUIDE.easy;
  return `あなたは早押しクイズの問題作成者です。

${diffGuide}

【出題形式】今回は必ず "${chosenType}" 形式で1問だけ作り、JSONのみ返答してください。前置き・説明・マークダウン不要。

【ひらがなルール（最重要）】難易度に関わらず、phrases・hint1・hint2・answerReading は必ず全てひらがなで書いてください。漢字・カタカナ・アルファベット・数字は使わないこと（数字も「いち」「に」などひらがなにする）。answer も text と logic_sequence では必ずひらがなで書く。
※例外：kanji_cross の top/bottom/left/right/answer のみ漢字1文字でよい（漢字パズルのため）。その場合も phrases・hint・answerReading はひらがな。

【ランダム性】毎回まったく違う題材・切り口にし、表現も毎回変えてください。前回と似た言い回しや定番すぎる問題は避け、新鮮で意外性のある問いにしてください。

【みじかく（重要）】phrasesは2〜3個だけ。各フレーズはできるだけ短く（目安7〜12文字、最大でも15文字）。長い説明文は禁止。テンポよく読める短い言葉にすること。最初は遠回し、後半ほど具体的に。
hint1は軽いヒント、hint2はより具体的なヒント。どちらも短く。

形式ごとのJSON:
1. {"type":"text","phrases":["ふれーず1","ふれーず2"],"answer":"こたえ","hint1":"かるいひんと","hint2":"ぐたいてきなひんと","answerReading":"こたえのひらがな"}
2. {"type":"kanji_cross","phrases":["ふれーず1","ふれーず2","ふれーず3"],"top":"漢字","bottom":"漢字","left":"漢字","right":"漢字","answer":"中央の漢字1文字","hint1":"かるいひんと","hint2":"ぐたいてきなひんと","answerReading":"こたえのひらがな"}
3. {"type":"logic_sequence","phrases":["ふれーず1","ふれーず2","ふれーず3"],"items":["ようそ1","ようそ2","ようそ3","ようそ4","?"],"answer":"こたえ","hint1":"かるいひんと","hint2":"ぐたいてきなひんと","answerReading":"こたえのひらがな"}`;
}

// 出題形式をランダムに選ぶ（text を厚めに）
const TYPE_POOL = ["text", "text", "text", "logic_sequence", "kanji_cross"] as const;
function pickType(): string {
  return TYPE_POOL[Math.floor(Math.random() * TYPE_POOL.length)];
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
    ? `\n以下は出題済みなので絶対に出さないこと（言い回しを変えただけの類似問題も禁止）:\n${usedQuestions.slice(-8).join("\n")}`
    : "";

  // 毎回違う問題・違う表現にするためのランダム要素
  const chosenType = pickType();
  const variety = Math.random().toString(36).slice(2, 8);

  const userPrompt = `ジャンル「${genre}」から問題を1問作成してください。${usedHint}
（ランダムシード:${variety} ／ 毎回まったく違う題材と表現にすること）`;

  const result = await geminiGenerateObject(
    QuizSchema,
    buildSystemPrompt(difficulty, chosenType),
    userPrompt,
    { temperature: 1.1 },
  );

  if (!result.ok) {
    console.warn("[/api/quiz/hayaoshi] Gemini failed:", result.error);
    return NextResponse.json(
      { error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json(result.object);
}
