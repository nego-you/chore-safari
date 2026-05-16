// 親用の管理画面 (/bank)
// Server Component で DB から子供一覧を取得し、各操作 UI を組み立てる。

import { prisma } from "@/lib/prisma";
import { calculateAge, formatBirthDate } from "@/lib/age";
import { BankPortal } from "./BankPortal";

export const dynamic = "force-dynamic";

export default async function BankPage() {
  const [children, pendingSubmissions, penalties] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CHILD" },
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
  ]);

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

  const reviewItems = pendingSubmissions.map((s) => ({
    id: s.id,
    questId: s.questId,
    questTitle: s.quest.title,
    questEmoji: s.quest.emoji,
    rewardCoins: s.quest.rewardCoins,
    userId: s.userId,
    userName: s.user.name,
    submittedAt: s.submittedAt.toISOString(),
  }));

  return (
    <BankPortal
      children={childrenData}
      totalBalance={totalBalance}
      penaltyItems={penaltyItems}
      reviewItems={reviewItems}
    />
  );
}
