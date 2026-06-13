// /kids/[kidId]/logistics — うんぱんミッション（一本道化リフォーム 2026-06-12）
// 旧：画面内で完結するエサ配送ミニゲーム（LogisticsClient）→ 廃止。
// 新：親が Bank で登録した LOGISTICS カテゴリのクエスト（現実のモノの運搬）を
//     申請する特別なクエスト枠。承認でコイン＋レアわなが手に入る。

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LogisticsMissionsClient } from "./LogisticsMissionsClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function LogisticsPage({ params }: { params: Params }) {
  const { kidId } = await params;
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();

  const [missions, submissions] = await Promise.all([
    // LOGISTICS カテゴリ ＆（全員用 OR 自分専用）のみ
    prisma.quest.findMany({
      where: {
        isActive: true,
        category: "LOGISTICS",
        OR: [
          { targetUsers: { none: {} } },
          { targetUsers: { some: { id: kid.id } } },
        ],
      },
      orderBy: [{ rewardCoins: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        rewardCoins: true,
        emoji: true,
      },
    }),
    // この子の申請状況（PENDING 表示用）
    prisma.questSubmission.findMany({
      where: { userId: kid.id, quest: { category: "LOGISTICS" } },
      orderBy: { submittedAt: "desc" },
      take: 200,
      select: { questId: true, status: true },
    }),
  ]);

  return (
    <LogisticsMissionsClient
      kid={kid}
      missions={missions}
      submissions={submissions.map((s) => ({
        questId: s.questId,
        status: s.status as "PENDING" | "APPROVED" | "REJECTED",
      }))}
    />
  );
}
