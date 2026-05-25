// /kids/[kidId]/layout.tsx — 子供ポータル配下の共通レイアウト。
// DB から子供の基本情報（名前・コイン残高）を取得し、
// WeatherContext 付きの SafariLayoutShell に渡す。
// このレイアウトに含まれるすべての画面（マップ・クラフト・レース等）で
// グローバルヘッダーが表示される。

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SafariLayoutShell } from "./SafariLayoutShell";

type Params = Promise<{ kidId: string }>;

export default async function KidLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { kidId } = await params;

  // select に streak フィールドを含める。prisma generate 前は型に含まれないため
  // as unknown 経由でキャストしている（DB マイグレーション後は正常動作）。
  const kid = await (prisma.user.findFirst as unknown as (args: unknown) => Promise<{
    id: string;
    name: string;
    coinBalance: number;
    currentStreak: number;
    longestStreak: number;
    streakStatus: string;
  } | null>)({
    where: { id: kidId, role: "CHILD" },
    select: {
      id: true,
      name: true,
      coinBalance: true,
      currentStreak: true,
      longestStreak: true,
      streakStatus: true,
    },
  });

  if (!kid) notFound();

  return (
    <SafariLayoutShell
      kidId={kid.id}
      kidName={kid.name}
      coinBalance={kid.coinBalance}
      currentStreak={kid.currentStreak ?? 0}
      longestStreak={kid.longestStreak ?? 0}
      streakStatus={kid.streakStatus ?? "ACTIVE"}
    >
      {children}
    </SafariLayoutShell>
  );
}
