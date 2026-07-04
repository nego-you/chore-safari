// GET  /api/coins?userId=xxx        → コイン残高と取引履歴を返す
// POST /api/coins                   → コインを加算する（外部アプリ連携用）
//
// 認証: X-Api-Key ヘッダーに INTERNAL_API_KEY 環境変数の値が必要。
// 未設定の場合はリクエストを通す（ローカル開発用フォールバック）。

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function checkApiKey(req: Request): boolean {
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret) return true; // 未設定なら開発環境と判断して通す
  return req.headers.get("x-api-key") === secret;
}

// ── GET: 残高取得 ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!checkApiKey(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId は必須です" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, coinBalance: true, role: true },
  });

  if (!user) {
    return Response.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  const history = await prisma.coinTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, amount: true, kind: true, reason: true, createdAt: true },
  });

  return Response.json({
    userId: user.id,
    name: user.name,
    coinBalance: user.coinBalance,
    role: user.role,
    recentTransactions: history.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

// ── POST: コイン加算 ──────────────────────────────────────────────────────
// Body: { userId: string; amount: number; reason: string }

type AddCoinsBody = {
  userId: string;
  amount: number;
  reason: string;
};

export async function POST(req: Request) {
  if (!checkApiKey(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AddCoinsBody;
  try {
    body = (await req.json()) as AddCoinsBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, amount, reason } = body;

  if (!userId || typeof amount !== "number" || !reason) {
    return Response.json(
      { error: "userId・amount（数値）・reason は必須です" },
      { status: 400 },
    );
  }
  if (amount === 0) {
    return Response.json({ error: "amount が 0 です" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, coinBalance: true },
  });
  if (!user) {
    return Response.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }
  if (user.role !== "CHILD") {
    return Response.json({ error: "CHILD ロールのユーザーのみ対象です" }, { status: 400 });
  }

  // 減算の場合は残高チェック
  if (amount < 0 && user.coinBalance + amount < 0) {
    return Response.json(
      {
        error: `コインが足りません（残高: ${user.coinBalance} / 必要: ${Math.abs(amount)}）`,
        coinBalance: user.coinBalance,
      },
      { status: 400 },
    );
  }

  try {
    const fresh = await prisma.$transaction(async (tx) => {
      await tx.coinTransaction.create({
        data: { userId, amount, kind: "ADJUSTMENT", reason },
      });
      return tx.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: amount } },
        select: { coinBalance: true },
      });
    });

    revalidatePath("/kids");
    revalidatePath("/bank");

    return Response.json({
      success: true,
      userId,
      amount,
      reason,
      newCoinBalance: fresh.coinBalance,
    });
  } catch (err) {
    console.error("[/api/coins POST] failed:", err);
    return Response.json({ error: "コイン操作に失敗しました" }, { status: 500 });
  }
}
