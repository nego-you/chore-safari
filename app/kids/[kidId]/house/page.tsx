// /kids/[kidId]/house  ベースキャンプ Server Component
// DB からガイド・動物データを取得して Client へ渡す
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BaseCampClient from "./BaseCampClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function HousePage({ params }: { params: Params }) {
  const { kidId } = await params;

  // NOTE: activeGuideAnimalId / activeGuideAnimal / caughtAnimals(named) は
  //       schema.prisma 更新済み。prisma generate 後に型が解決される。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user.findFirst as any)({
    where: { id: kidId, role: "CHILD" },
    select: {
      id: true,
      name: true,
      coinBalance: true,
      currentStreak: true,
      activeGuideAnimalId: true,
      activeGuideAnimal: {
        select: {
          id: true,
          intimacyScore: true,
          caughtAt: true,
          expiresAt: true,
          animal: {
            select: {
              id: true,
              genericName: true,
              specificName: true,
              emoji: true,
              lifespanYears: true,
              rarity: true,
            },
          },
          personality: {
            select: { firstPerson: true, toneRule: true },
          },
        },
      },
      caughtAnimals: {
        where: { isAlive: true },
        orderBy: { caughtAt: "desc" },
        select: {
          id: true,
          intimacyScore: true,
          caughtAt: true,
          expiresAt: true,
          animal: {
            select: {
              id: true,
              genericName: true,
              specificName: true,
              emoji: true,
              lifespanYears: true,
              rarity: true,
            },
          },
          personality: {
            select: { firstPerson: true },
          },
        },
      },
    },
  }) as any;

  if (!user) notFound();

  return (
    <BaseCampClient
      kidId={user.id}
      userName={user.name}
      coinBalance={user.coinBalance}
      currentStreak={user.currentStreak}
      initialGuide={user.activeGuideAnimal ?? null}
      initialAnimals={user.caughtAnimals ?? []}
    />
  );
}
