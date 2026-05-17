// POST /api/quiz/generate
//   body: { specificName: string, description: string }
//   resp: { question, options[], answer, source: "ollama" | "fallback" }
//
// 動物の説明文を読んで答える3択クイズを Ollama でその場生成する。
// ローカル LLM の出力ゆらぎに備え、JSON パース失敗時は決め打ちのフォールバックを返す。

import { NextRequest, NextResponse } from "next/server";
import { ollamaChat, OLLAMA_MODEL } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `あなたは子供向けのクイズ出題者です。
提供された動物の【説明文】の内容から、子供がしっかり文章を読んでいれば答えられる3択クイズを1問作成してください。

ルール:
- 子供が対象のため、難しい漢字は使わず、ひらがな中心（カタカナは可）にすること。
- 問題と選択肢は、必ず説明文に書いてある事実だけを根拠にすること。説明文に無い知識を問題にしないこと。
- 選択肢3つのうち、正解は1つだけ。残り2つは説明文の事実と矛盾するもっともらしい嘘にする。
- 出力は必ず以下のJSONフォーマットのみ。思考プロセスや他のテキストは一切含めないこと:
{ "question": "問題文", "options": ["選択肢1", "選択肢2", "選択肢3"], "answer": "正解の選択肢" }
- answer は options のいずれかと文字列一致させること。`;

type QuizPayload = {
  question: string;
  options: string[];
  answer: string;
};

function tryParseQuiz(raw: string): QuizPayload | null {
  // モデルが ```json ... ``` で囲ってくることがあるので削っておく。
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    // 部分文字列の {...} を抜き出して再挑戦
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      json = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const question = typeof o.question === "string" ? o.question.trim() : "";
  const options = Array.isArray(o.options)
    ? o.options
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0)
    : [];
  const answer = typeof o.answer === "string" ? o.answer.trim() : "";

  if (!question || options.length < 2 || !answer) return null;
  // answer が options に含まれているかチェック（前後空白を許容）
  const normalized = options.map((s) => s.trim());
  if (!normalized.includes(answer.trim())) return null;
  return { question, options: normalized, answer: answer.trim() };
}

// 子供を完全に詰まらせないためのフォールバッククイズ。
// 説明文の冒頭文をそのまま正解候補に流用する。
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

  const result = await ollamaChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { json: true },
  );

  if (!result.ok) {
    // Ollama が落ちている / モデル未 pull / タイムアウト → フォールバック
    console.warn(
      `[/api/quiz/generate] Ollama failed (${OLLAMA_MODEL}): ${result.error}`,
    );
    return NextResponse.json({
      ...fallbackQuiz(specificName, description),
      source: "fallback" as const,
      error: result.error,
    });
  }

  const parsed = tryParseQuiz(result.content);
  if (!parsed) {
    console.warn(
      `[/api/quiz/generate] failed to parse Ollama output: ${result.content.slice(0, 200)}`,
    );
    return NextResponse.json({
      ...fallbackQuiz(specificName, description),
      source: "fallback" as const,
      error: "ollama JSON parse failed",
    });
  }

  return NextResponse.json({
    ...parsed,
    source: "ollama" as const,
    model: result.model,
  });
}
