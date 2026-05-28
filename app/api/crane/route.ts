// POST /api/crane  → クレーンゲームを1プレイ実行する（外部アプリ連携用）
// GET  /api/crane  → ヘルスチェック
//
// 認証: X-Api-Key ヘッダーに INTERNAL_API_KEY 環境変数の値が必要。
// Body: { userId: string; didCatch: boolean }
//
// 使用例:
//   curl -X POST http://localhost:3000/api/crane \
//     -H "Content-Type: application/json" \
//     -H "X-Api-Key: your_secret" \
//     -d '{"userId":"xxx","didCatch":true}'

import { playCraneGame } from "@/features/crane/actions";
import { CRANE_COST } from "@/app/kids/config";

export const dynamic = "force-dynamic";

function checkApiKey(req: Request): boolean {
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret) return true;
  return req.headers.get("x-api-key") === secret;
}

export async function GET(req: Request) {
  if (!checkApiKey(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    ok: true,
    endpoint: "POST /api/crane",
    cost: CRANE_COST,
    body: "{ userId: string; didCatch: boolean }",
    note: "didCatch はクライアント側でアニメーション結果を確定してから送信してください",
  });
}

export async function POST(req: Request) {
  if (!checkApiKey(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string; didCatch?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, didCatch } = body;

  if (!userId || typeof didCatch !== "boolean") {
    return Response.json(
      { error: "userId（文字列）と didCatch（真偽値）は必須です" },
      { status: 400 },
    );
  }

  const result = await playCraneGame(userId, didCatch);

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
