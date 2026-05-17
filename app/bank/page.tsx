// 親用の管理画面 (/bank)
// Server Component で DB から子供一覧を取得し、BankPortal に渡す。

import { prisma } from "@/lib/prisma";
import { calculateAge, formatBirthDate } from "@/lib/age";
import { BankPortal } from "./BankPortal";

export const dynamic = "force-dynamic";

// JST の今日 00:00:00 を UTC で返す
function jstTodayStart(): Date {
  const now = new Date();
  // JST = UTC+9
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  // JST の日付部分だけ取り出して 00:00:00 にし、UTC に戻す
  const jstMidnight = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate())
  );
  return new Date(jstMidnight.getTime() - jstOffset);
}

export default async function BankPage() {
  const todayStart = jstTodayStart();

  const [children, pendingSubmissions, penalties, todaySubmissions] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CHILD", isTest: false },
      orderBy: { birthDate: "asc" },
    }),
    prisma.questSubmission.findMany({
      where: { status: "PENDING" },
      orderBy: { submittedAt: "asc" },
      include: {
        quest: true,
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.penalty.findMany({
      where: { isActive: true },
      orderBy: [{ coinAmount: "asc" }, { createdAt: "asc" }],
      include: { targetUsers: { select: { id: true } } },
    }),
    // 今日の全申請（ステータス問わず）: 「今日N回目」のカウント用
    prisma.questSubmission.findMany({
      where: { submittedAt: { gte: todayStart } },
      select: { id: true, userId: true, questId: true, submittedAt: true },
      orderBy: { submittedAt: "asc" },
    }),
  ]);

  // (userId, questId) → 今日の申請リスト（昇順）でインデックス
  const todayMap = new Map<string, string[]>();
  for (const s of todaySubmissions) {
    const key = `${s.userId}::${s.questId}`;
    if (!todayMap.has(key)) todayMap.set(key, []);
    todayMap.get(key)!.push(s.id);
  }

  const childrenData = children.map((c) => ({
    id: c.id,
    name: c.name,
    age: calculateAge(c.birthDate),
    birthDateFormatted: formatBirthDate(c.birthDate),
    coinBalance: c.coinBalance,
  }));

  const penaltyItems = penalties.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    coinAmount: p.coinAmount,
    emoji: p.emoji,
    targetUserIds: p.targetUsers.map((u) => u.id),
  }));

  const totalBalance = children.reduce((sum, c) => sum + c.coinBalance, 0);

  const reviewItems = pendingSubmissions.map((s) => {
    const key = `${s.userId}::${s.questId}`;
    const todayIds = todayMap.get(key) ?? [];
    // この申請が今日の何番目か（1始まり）
    const todayNth = todayIds.indexOf(s.id) + 1;
    return {
      id: s.id,
      questId: s.questId,
      questTitle: s.quest.title,
      questEmoji: s.quest.emoji,
      rewardCoins: s.quest.rewardCoins,
      userId: s.userId,
      userName: s.user.name,
      submittedAt: s.submittedAt.toISOString(),
      todayNth,          // 今日何回目か（0 = 今日初の場合も 1 になる）
      todayTotal: todayIds.length, // 今日の申請総数
    };
  });

  return (
    <BankPortal
      children={childrenData}
      totalBalance={totalBalance}
      penaltyItems={penaltyItems}
      reviewItems={reviewItems}
    />
  );
}
