// POST /api/quest/submit  → クエスト申請を送信する（外部アプリ連携用）
// GET  /api/quest/submit  → ヘルスチェック
//
// 認証: X-Api-Key ヘッダーに INTERNAL_API_KEY 環境変数の値が必要。
// Body: { userId: string; questId: string }
//
// 使用例:
//   curl -X POST http://localhost:3000/api/quest/submit \
//     -H "Content-Type: application/json" \
//     -H "X-Api-Key: your_secret" \
//     -d '{"userId":"xxx","questId":"yyy"}'

import { submitQuest } from "@/features/quest/actions";

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
    endpoint: "POST /api/quest/submit",
    body: "{ userId: string; questId: string }",
  });
}

export async function POST(req: Request) {
  if (!checkApiKey(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string; questId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, questId } = body;

  if (!userId || !questId) {
    return Response.json(
      { error: "userId と questId は必須です" },
      { status: 400 },
    );
  }

  const result = await submitQuest(userId, questId);

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
