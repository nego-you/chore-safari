// app/api/synthesize/route.ts
// Next.js サーバーサイドプロキシ。
// ブラウザ（React クライアント）から同一オリジンの /api/synthesize に POST し、
// Docker 内部ネットワーク経由で FastAPI TTS ブリッジ（backend:8000）に転送する。
// CORS 問題なし・ブラウザに FastAPI のポートを公開する必要なし。

import { NextRequest, NextResponse } from "next/server";

// docker-compose.yml の web/web-prod に BACKEND_URL=http://backend:8000 を設定済み。
// ローカル直実行（docker 外）でも動くよう localhost:8000 をデフォルトにする。
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body as { text?: string })?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text は必須です" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      // WAV 生成は最大 30 秒程度かかる場合がある
      signal: AbortSignal.timeout(35_000),
    });
  } catch (err) {
    console.error("[/api/synthesize] FastAPI に接続できません:", err);
    return NextResponse.json(
      { error: "TTS バックエンドに接続できません。backend コンテナを確認してください。" },
      { status: 503 },
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[/api/synthesize] FastAPI error ${res.status}: ${detail}`);
    return NextResponse.json(
      { error: `音声合成に失敗しました (${res.status})`, detail },
      { status: 502 },
    );
  }

  const wavBuffer = await res.arrayBuffer();
  return new NextResponse(wavBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}
