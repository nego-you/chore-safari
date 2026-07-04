// POST /api/quiz/generate
//   body: { specificName: string, description: string }
//   resp: { question, options[], answer, source: "gemini" | "fallback" }
//
// 動物の説明文を読んで答える3択クイズを Gemini でその場生成する。
// API エラー / JSON パース失敗時は決め打ちのフォールバックを返す。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { geminiGenerateObject, GEMINI_MODEL_NAME } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `あなたは子供向けのクイズ出題者です。
提供された動物の【説明文】の内容から、子供がしっかり文章を読んでいれば答えられる3択クイズを1問作成してください。

ルール:
- 子供が対象のため、難しい漢字は使わず、ひらがな中心（カタカナは可）にすること。
- 問題と選択肢は、必ず説明文に書いてある事実だけを根拠にすること。説明文に無い知識を問題にしないこと。
- 選択肢3つのうち、正解は1つだけ。残り2つは説明文の事実と矛盾するもっともらしい嘘にする。
- answer は options のいずれかと文字列一致させること。
- 出力は必ず以下のJSONフォーマットのみ。思考プロセスや他のテキストは一切含めないこと:
{ "question": "問題文", "options": ["選択肢1", "選択肢2", "選択肢3"], "answer": "正解の選択肢" }`;

const QuizSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(3),
  answer: z.string(),
});

type QuizPayload = z.infer<typeof QuizSchema>;

// 子供を完全に詰まらせないためのフォールバッククイズ。
function fallbackQuiz(specificName: string, description: string): QuizPayload {
  const firstSentence = description.split(/[。．]/)[0]?.slice(0, 40) ?? "";
  const question = `${specificName} の せつめいで、ただしいのは どれ？`;
  return {
    question,
    options: [
      firstSentence || `${specificName} は どうぶつだ`,
      `${specificName} は そらを とぶ きかいだ`,
      `${specificName} は たべると あまい たべものだ`,
    ],
    answer: firstSentence || `${specificName} は どうぶつだ`,
  };
}

export async function POST(req: NextRequest) {
  let body: { specificName?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const specificName = (body.specificName ?? "").trim();
  const description = (body.description ?? "").trim();
  if (!specificName || !description) {
    return NextResponse.json(
      { error: "specificName / description が ひつようです" },
      { status: 400 },
    );
  }

  const userPrompt = `動物名: ${specificName}\n説明文: ${description}`;

  const result = await geminiGenerateObject(QuizSchema, SYSTEM_PROMPT, userPrompt);

  if (!result.ok) {
    console.warn(
      `[/api/quiz/generate] Gemini failed (${GEMINI_MODEL_NAME}): ${result.error}`,
    );
    return NextResponse.json({
      ...fallbackQuiz(specificName, description),
      source: "fallback" as const,
      error: result.error,
    });
  }

  // answer が options に含まれているか確認（モデルが一致させ忘れた場合のガード）
  const quiz = result.object;
  const normalized = quiz.options.map((s) => s.trim());
  if (!normalized.includes(quiz.answer.trim())) {
    console.warn(
      `[/api/quiz/generate] answer not in options — using fallback. answer: ${quiz.answer}`,
    );
    return NextResponse.json({
      ...fallbackQuiz(specificName, description),
      source: "fallback" as const,
      error: "answer not in options",
    });
  }

  return NextResponse.json({
    ...quiz,
    options: normalized,
    answer: quiz.answer.trim(),
    source: "gemini" as const,
    model: GEMINI_MODEL_NAME,
  });
}
