// /kids/[kidId]/dictionary — 家族共通の博物学図鑑ページ。
// 家族の誰か1人でも捕まえた動物は「カラー＋詳細」、誰も未捕獲は「シルエット＋？？？」。
// 詳細モーダルには「だれが何回捕まえたか」のスタッツを表示。
// 捕獲済み動物には「いま 〇さい（じゅみょう：〇ねん）」を表示。
// 寿命に達した動物は殿堂入りバッジを表示。

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DictionaryClient } from "./DictionaryClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function DictionaryPage({ params }: { params: Params }) {
  const { kidId } = await params;

  const now = new Date();

  const [kid, allAnimals, allCaught, allChildren, kidCaught] = await Promise.all([
    prisma.user.findFirst({
      where: { id: kidId, role: "CHILD" },
      select: { id: true, name: true },
    }),
    prisma.animal.findMany({
      orderBy: [{ rarity: "asc" }, { genericName: "asc" }, { specificName: "asc" }],
      select: {
        id: true,
        animalId: true,
        name: true,
        genericName: true,
        specificName: true,
        emoji: true,
        rarity: true,
        description: true,
        imageUrl: true,
        isExtinct: true,
        habitat: true,
        era: true,
        location: true,
        lifespanYears: true,
      },
    }),
    prisma.caughtAnimal.findMany({
      where: { caughtBy: { isTestAccount: false } },
      select: {
        animalId: true,
        caughtByUserId: true,
        caughtAt: true,
        caughtBy: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "CHILD", isTestAccount: false },
      orderBy: { birthDate: "asc" },
      select: { id: true, name: true },
    }),
    // この子自身の捕獲履歴（年齢・卒業表示用、caughtAt 昇順で最初の捕獲を使う）
    prisma.caughtAnimal.findMany({
      where: { caughtByUserId: kidId },
      orderBy: { caughtAt: "asc" },
      select: {
        animalId: true,
        caughtAt: true,
        expiresAt: true,
        isGraduated: true,
      },
    }),
  ]);

  if (!kid) notFound();

  // animalId → {childId → count} の集計表
  const statsByAnimal = new Map<string, Map<string, number>>();
  for (const c of allCaught) {
    const inner = statsByAnimal.get(c.animalId) ?? new Map<string, number>();
    inner.set(c.caughtByUserId, (inner.get(c.caughtByUserId) ?? 0) + 1);
    statsByAnimal.set(c.animalId, inner);
  }

  // animalId → この子が最初に捕まえた記録（年齢計算用）
  const kidCatchMap = new Map<
    string,
    { caughtAt: string; expiresAt: string | null; isGraduated: boolean }
  >();
  for (const kc of kidCaught) {
    if (!kidCatchMap.has(kc.animalId)) {
      kidCatchMap.set(kc.animalId, {
        caughtAt: kc.caughtAt.toISOString(),
        expiresAt: kc.expiresAt?.toISOString() ?? null,
        isGraduated: kc.isGraduated,
      });
    }
  }

  const animals = allAnimals.map((a) => {
    const inner = statsByAnimal.get(a.id);
    const familyCaught = inner !== undefined && inner.size > 0;
    const captureStats = allChildren.map((ch) => ({
      userId: ch.id,
      userName: ch.name,
      count: inner?.get(ch.id) ?? 0,
    }));
    const totalCount = captureStats.reduce((s, x) => s + x.count, 0);

    const kidCatch = kidCatchMap.get(a.id) ?? null;
    let ageInYears: number | null = null;
    let isGraduated = false;

    if (kidCatch) {
      ageInYears = Math.floor(
        (now.getTime() - new Date(kidCatch.caughtAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const isExpiredByDate =
        kidCatch.expiresAt !== null && new Date(kidCatch.expiresAt) <= now;
      const isExpiredByAge = a.lifespanYears < 999 && ageInYears >= a.lifespanYears;
      isGraduated = kidCatch.isGraduated || isExpiredByDate || isExpiredByAge;
    }

    return {
      ...a,
      caught: familyCaught,
      captureStats,
      totalCount,
      kidCaughtAt: kidCatch?.caughtAt ?? null,
      ageInYears,
      isGraduated,
    };
  });

  return (
    <DictionaryClient
      kidId={kid.id}
      kidName={kid.name}
      animals={animals}
      familySize={allChildren.length}
      nowIso={now.toISOString()}
    />
  );
}
