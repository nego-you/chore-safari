// POST /api/webhook/voice-command
// Google Home などのスマートスピーカー（外部サービス）からの音声コマンドを受け取り、
// テキストを解析して **クエスト**（コイン加算）または **ペナルティ**（コイン没収）を
// 自動実行する Webhook。処理後は Google Home に結果を音声フィードバックする。
//
// 認証:
//   リクエストヘッダー `Authorization` に固定シークレットキー（環境変数
//   VOICE_WEBHOOK_SECRET）を必須で要求する。`Bearer <secret>` でも生の `<secret>` でも可。
//
// ペイロード:
//   { "rawText": "みことの おもちゃをかたづける を登録" }
//
// 使用例:
//   curl -X POST http://localhost:3000/api/webhook/voice-command \
//     -H "Content-Type: application/json" \
//     -H "Authorization: Bearer <VOICE_WEBHOOK_SECRET>" \
//     -d '{"rawText":"みことの おもちゃをかたづける を登録"}'

import { prisma } from "@/lib/prisma";
import { castToGoogleHome } from "@/lib/google-home-cast";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
// 名前の読み（ひらがな）↔ DB 上の表示名（漢字）の対応表。
// Google Home の音声認識はひらがな/カタカナで返ることがあるため、
// 漢字の登録名に加えて読みでも引っかかるようにする。
// （DB の User をソースに、ここはあくまで「別名」の補助辞書）
// ─────────────────────────────────────────────
const NAME_READINGS: Record<string, string[]> = {
  美琴: ["みこと", "ミコト"],
  幸仁: ["ゆきと", "ユキト"],
  叶泰: ["かなた", "カナタ"],
};

// アクション判定キーワード。
const NEGATIVE_KEYWORDS = ["ペナルティ", "没収", "だめ", "ダメ", "めっ", "罰", "ぼっしゅう"];
const POSITIVE_KEYWORDS = ["登録", "完了", "クエスト", "できた", "やった", "とうろく"];

// ファジーマッチの採用しきい値（0〜1）。これ未満なら「見つからない」とみなす。
const MATCH_THRESHOLD = 0.3;

// ─────────────────────────────────────────────
// 文字列正規化：NFKC → カタカナをひらがなに畳む → 空白/記号/助詞っぽい文字を除去 → 小文字化。
// 「ミコト」と「みこと」、「おもちゃ を かたづける」と「おもちゃをかたづける」を同一視するため。
// ─────────────────────────────────────────────
function normalize(s: string): string {
  return s
    .normalize("NFKC")
    // カタカナ（ァ〜ヶ）→ ひらがな
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    // 空白・主要な記号・読点句点などを除去
    .replace(/[\s・,，、。.\-ー！!？?「」『』“”"'（）()]/g, "")
    .toLowerCase();
}

// 文字 bigram 集合を作る。
function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

// Dice 係数（bigram ベース）で 2 文字列の類似度を 0〜1 で返す。
function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) {
    // 1 文字同士は包含で判定（bigram が作れないため）
    return a.includes(b) || b.includes(a) ? 0.5 : 0;
  }
  const A = bigrams(a);
  const B = bigrams(b);
  const counts = new Map<string, number>();
  for (const g of A) counts.set(g, (counts.get(g) ?? 0) + 1);
  let inter = 0;
  for (const g of B) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      inter++;
      counts.set(g, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

// rawText（正規化済み）と、マスタの title/description との一致度を返す。
//   - どちらかがもう一方を包含していれば最強（1.0）
//   - それ以外は bigram Dice 係数
function fieldScore(rawNorm: string, candidate: string | null | undefined): number {
  const c = normalize(candidate ?? "");
  if (!c) return 0;
  if (rawNorm.includes(c) || c.includes(rawNorm)) return 1;
  return diceCoefficient(rawNorm, c);
}

// title を主、description を従（重み 0.9）として最大スコアを採用。
function masterScore(
  rawNorm: string,
  title: string,
  description: string | null | undefined,
): number {
  return Math.max(fieldScore(rawNorm, title), fieldScore(rawNorm, description) * 0.9);
}

// 候補配列から最高スコアのマスタを 1 件選ぶ（しきい値未満なら null）。
function pickBest<T extends { title: string; description: string | null }>(
  rawNorm: string,
  candidates: T[],
): { item: T; score: number } | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const cand of candidates) {
    const score = masterScore(rawNorm, cand.title, cand.description);
    if (score > bestScore) {
      best = cand;
      bestScore = score;
    }
  }
  if (!best || bestScore < MATCH_THRESHOLD) return null;
  return { item: best, score: bestScore };
}

// ─────────────────────────────────────────────
// 認証チェック。
// ─────────────────────────────────────────────
type AuthResult = { ok: true } | { ok: false; status: number; error: string };

function checkAuth(req: Request): AuthResult {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[/api/webhook/voice-command] VOICE_WEBHOOK_SECRET が未設定です。.env を確認してください。",
    );
    return { ok: false, status: 500, error: "VOICE_WEBHOOK_SECRET is not configured" };
  }
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : header.trim();
  if (!provided || provided !== secret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

// 音声フィードバックを試行しつつ JSON を返すユーティリティ。
async function respondAndCast(
  payload: Record<string, unknown>,
  status: number,
  spoken?: string,
): Promise<Response> {
  if (spoken) {
    // ベストエフォート。失敗してもレスポンスには影響させない。
    await castToGoogleHome(spoken);
  }
  return Response.json(spoken ? { ...payload, spoken } : payload, { status });
}

// ─────────────────────────────────────────────
// 本体
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  // ── 認証 ──
  const auth = checkAuth(req);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  // ── ペイロード ──
  let body: { rawText?: string };
  try {
    body = (await req.json()) as { rawText?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawText = body.rawText?.trim();
  if (!rawText) {
    return Response.json({ error: "rawText は必須です" }, { status: 400 });
  }
  const rawNorm = normalize(rawText);

  // ── A. 対象ユーザーの特定 ──
  const children = await prisma.user.findMany({
    where: { role: "CHILD" },
    select: { id: true, name: true },
  });

  const child = children.find((u) => {
    const aliases = [u.name, ...(NAME_READINGS[u.name] ?? [])];
    return aliases.some((a) => rawNorm.includes(normalize(a)));
  });

  if (!child) {
    return respondAndCast(
      { success: false, error: "対象の子供を特定できませんでした", rawText },
      404,
      "ごめんね、だれのことか分からなかったよ。もう一度教えてね。",
    );
  }

  // ── B. アクション種別の判定 ──
  // ネガティブキーワードが1つでもあればペナルティ。なければクエスト扱い。
  const isPenalty = NEGATIVE_KEYWORDS.some((k) => rawNorm.includes(normalize(k)));
  const hasPositiveKeyword = POSITIVE_KEYWORDS.some((k) => rawNorm.includes(normalize(k)));

  // ── C-1. ペナルティ ──
  if (isPenalty) {
    const penalties = await prisma.penalty.findMany({
      where: {
        isActive: true,
        OR: [{ targetUsers: { none: {} } }, { targetUsers: { some: { id: child.id } } }],
      },
      select: { id: true, title: true, description: true, coinAmount: true },
    });

    const picked = pickBest(rawNorm, penalties);
    if (!picked) {
      return respondAndCast(
        {
          success: false,
          error: "該当するペナルティが見つかりませんでした",
          child: child.name,
          rawText,
        },
        404,
        `ごめんね、${child.name}ちゃんのペナルティが見つからなかったよ。`,
      );
    }
    const penalty = picked.item;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: child.id },
          data: { coinBalance: { decrement: penalty.coinAmount } },
          select: { coinBalance: true },
        });
        await tx.coinTransaction.create({
          data: {
            userId: child.id,
            amount: -penalty.coinAmount,
            kind: "PENALTY",
            reason: penalty.title,
          },
        });
        await tx.penaltyNotification.create({
          data: {
            userId: child.id,
            reason: penalty.title,
            coinAmount: penalty.coinAmount,
            isRead: false,
          },
        });
        return u;
      });

      revalidatePath("/kids");
      revalidatePath("/bank");

      const spoken = `${child.name}ちゃんの「${penalty.title}」でペナルティ。${penalty.coinAmount}コイン没収です。`;
      return respondAndCast(
        {
          success: true,
          action: "penalty",
          child: child.name,
          matched: { id: penalty.id, title: penalty.title, coinAmount: penalty.coinAmount },
          score: Number(picked.score.toFixed(3)),
          newCoinBalance: updated.coinBalance,
        },
        200,
        spoken,
      );
    } catch (err) {
      console.error("[/api/webhook/voice-command] penalty tx failed:", err);
      return Response.json({ error: "ペナルティの適用に失敗しました" }, { status: 500 });
    }
  }

  // ── C-2. クエスト ──
  const quests = await prisma.quest.findMany({
    where: {
      isActive: true,
      OR: [{ targetUsers: { none: {} } }, { targetUsers: { some: { id: child.id } } }],
    },
    select: { id: true, title: true, description: true, rewardCoins: true },
  });

  const picked = pickBest(rawNorm, quests);
  if (!picked) {
    return respondAndCast(
      {
        success: false,
        error: "該当するクエストが見つかりませんでした",
        child: child.name,
        hasPositiveKeyword,
        rawText,
      },
      404,
      `ごめんね、${child.name}ちゃんのクエストが見つからなかったよ。`,
    );
  }
  const quest = picked.item;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: child.id },
        data: { coinBalance: { increment: quest.rewardCoins } },
        select: { coinBalance: true },
      });
      await tx.coinTransaction.create({
        data: {
          userId: child.id,
          amount: quest.rewardCoins,
          kind: "CHORE",
          reason: quest.title,
        },
      });
      return u;
    });

    revalidatePath("/kids");
    revalidatePath("/bank");

    const spoken = `${child.name}ちゃんの「${quest.title}」を登録しました。${quest.rewardCoins}コインゲットです！`;
    return respondAndCast(
      {
        success: true,
        action: "quest",
        child: child.name,
        matched: { id: quest.id, title: quest.title, rewardCoins: quest.rewardCoins },
        score: Number(picked.score.toFixed(3)),
        hasPositiveKeyword,
        newCoinBalance: updated.coinBalance,
      },
      200,
      spoken,
    );
  } catch (err) {
    console.error("[/api/webhook/voice-command] quest tx failed:", err);
    return Response.json({ error: "クエストの登録に失敗しました" }, { status: 500 });
  }
}
