// POST /api/race — 2匹の動物を受け取り、Gemini で熱血実況をストリーミング生成。
// GET /api/race   — APIキーとモデル名のヘルスチェック（curl で動作確認用）。

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Animal = {
  name: string;
  description?: string;
  rarity?: string;
};

type Body = {
  animals: Animal[];
};

// gemini-1.5-flash は 2025 年に廃止されたため既定値は 2.5-flash。
// 必要に応じて GEMINI_MODEL 環境変数で差し替え可能。
function resolveModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function resolveApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    undefined
  );
}

function buildSystemPrompt(): string {
  return [
    "あなたは熱血スポーツ実況の名解説者です。",
    "少年漫画の武闘会や競馬の熱血実況のように、子供がワクワクする ハイテンション な日本語で実況してください。",
    "ひらがな多めで小学校低学年でも理解できる文体。マークダウンや見出しは使わない。",
  ].join("\n");
}

function buildUserPrompt(a: Animal, b: Animal): string {
  const aDesc = a.description ? `（${a.description}）` : "";
  const bDesc = b.description ? `（${b.description}）` : "";
  return [
    "次の2匹の動物がサバンナの大舞台でレースをします。",
    `■ 1号: ${a.name}${aDesc}`,
    `■ 2号: ${b.name}${bDesc}`,
    "",
    "次の条件で 約300文字 の熱血実況テキストを書いてください:",
    "- 「実況：」から書き始める",
    "- 「!」や擬音（ダッシュ！ うおー！ など）を多用して熱気を演出する",
    "- スタート → 中盤 → ラストスパート の流れを盛り込む",
    "- 最後に「勝者：◯◯！」の形式で勝者を1匹だけ宣言する",
    "- 勝者の決め手は ランダム で OK（足の速さ、根性、運、観客の声援など）",
  ].join("\n");
}

// 診断用：キーやモデルが正しく載っているか curl で確認できる。
export async function GET() {
  const apiKey = resolveApiKey();
  return Response.json({
    ok: true,
    apiKeyPresent: !!apiKey,
    apiKeyPrefix: apiKey ? `${apiKey.slice(0, 6)}…` : null,
    model: resolveModelName(),
    runtime: "nodejs",
    note: "POST に 'animals: [{name,description},{name,description}]' を送ると実況をストリームします。",
  });
}

export async function POST(req: Request) {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error("[/api/race] GEMINI_API_KEY is not set");
    return new Response(
      "GEMINI_API_KEY が設定されていません。.env を確認してください。",
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const animals = Array.isArray(body.animals) ? body.animals : [];
  if (animals.length !== 2 || !animals[0]?.name || !animals[1]?.name) {
    return new Response("animals は 2匹（name 必須）で指定してください", {
      status: 400,
    });
  }
  if (animals[0].name === animals[1].name) {
    return new Response("ちがう どうぶつを 2ひき えらんでね", {
      status: 400,
    });
  }

  const modelName = resolveModelName();
  console.log(
    `[/api/race] starting model=${modelName} animals=${animals.map((a) => a.name).join(" vs ")}`,
  );

  const google = createGoogleGenerativeAI({ apiKey });

  try {
    const result = streamText({
      model: google(modelName),
      system: buildSystemPrompt(),
      prompt: buildUserPrompt(animals[0], animals[1]),
      temperature: 1.0,
      // ストリーム中のエラーをサーバログに残す。
      onError({ error }) {
        console.error("[/api/race] streamText error:", error);
      },
    });

    // ストリーム中にエラーが起きた場合、既定では body から消えてしまうので
    // クライアントが「サイレントに空」にならないよう、エラーをテキスト化して流す。
    return result.toTextStreamResponse({
      getErrorMessage: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[/api/race] stream getErrorMessage:", msg);
        return `\n[実況エラー] ${msg}\n（モデル名や API キーを見直してください）`;
      },
    });
  } catch (err) {
    console.error("[/api/race] failed to start streamText:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`実況の開始に失敗しました: ${msg}`, { status: 500 });
  }
}
