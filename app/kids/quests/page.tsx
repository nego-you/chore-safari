// /kids/quests — クエストにちょうせん画面。
// 子供は ?kid= で誰がプレイ中か特定。指定が無いときはピッカーを出す。

import { prisma } from "@/lib/prisma";
import { QuestsClient } from "./QuestsClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kid?: string | string[] }>;

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const kidParam = Array.isArray(sp.kid) ? sp.kid[0] : sp.kid;

  const [kids, quests, submissions] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CHILD" },
      orderBy: { birthDate: "asc" },
      select: { id: true, name: true, coinBalance: true },
    }),
    prisma.quest.findMany({
      where: {
        isActive: true,
        OR: [
          { targetUserId: null }, // 全員用
          { targetUserId: kidParam }, // 自分専用
        ],
      },
      orderBy: [{ rewardCoins: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        rewardCoins: true,
        emoji: true,
        targetUserId: true,
      },
    }),
    // 直近の各申請（誰の何のクエストが PENDING/APPROVED/REJECTED か）。
    // 各クエストごとに最新の状態だけ知れれば良いので take は十分に大きく取る。
    prisma.questSubmission.findMany({
      orderBy: { submittedAt: "desc" },
      take: 500,
      select: {
        id: true,
        questId: true,
        userId: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
      },
    }),
  ]);

  const initialKid =
    kidParam && kids.some((k) => k.id === kidParam) ? kidParam : null;

  return (
    <QuestsClient
      initialKidId={initialKid}
      kids={kids}
      quests={quests.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        rewardCoins: q.rewardCoins,
        emoji: q.emoji,
      }))}
      submissions={submissions.map((s) => ({
        id: s.id,
        questId: s.questId,
        userId: s.userId,
        status: s.status as "PENDING" | "APPROVED" | "REJECTED",
        submittedAt: s.submittedAt.toISOString(),
        reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
      }))}
    />
  );
}
