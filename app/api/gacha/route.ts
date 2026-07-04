// POST /api/gacha  → ガチャを1回引く（外部アプリ連携用）
// GET  /api/gacha  → ヘルスチェック
//
// 認証: X-Api-Key ヘッダーに INTERNAL_API_KEY 環境変数の値が必要。
// Body: { userId: string }
//
// 使用例:
//   curl -X POST http://localhost:3000/api/gacha \
//     -H "Content-Type: application/json" \
//     -H "X-Api-Key: your_secret" \
//     -d '{"userId":"xxx"}'

import { playGacha } from "@/features/gacha/actions";
import { GACHA_COST } from "@/app/kids/config";

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
    endpoint: "POST /api/gacha",
    cost: GACHA_COST,
    body: "{ userId: string }",
  });
}

export async function POST(req: Request) {
  if (!checkApiKey(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId } = body;

  if (!userId) {
    return Response.json({ error: "userId は必須です" }, { status: 400 });
  }

  const result = await playGacha(userId);

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
