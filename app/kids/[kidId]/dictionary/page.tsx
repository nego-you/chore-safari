// /kids/[kidId]/dictionary — 家族共通の博物学図鑑ページ。
// 家族の誰か1人でも捕まえた動物は「カラー＋詳細」、誰も未捕獲は「シルエット＋？？？」。
// 詳細モーダルには「だれが何回捕まえたか」のスタッツを表示。

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DictionaryClient } from "./DictionaryClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function DictionaryPage({ params }: { params: Params }) {
  const { kidId } = await params;

  const [kid, allAnimals, allCaught, allChildren] = await Promise.all([
    prisma.user.findFirst({
      where: { id: kidId, role: "CHILD" },
      select: { id: true, name: true },
    }),
    // 全動物マスタを rarity 順・genericName 順で取得
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
      },
    }),
    // 🌟 家族全員ぶんの捕獲履歴を取得（個別ではなく、システム全体）
    prisma.caughtAnimal.findMany({
      where: {
        caughtBy: { isTestAccount: false },
      },
      select: {
        animalId: true,
        caughtByUserId: true,
        caughtBy: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "CHILD", isTestAccount: false },
      orderBy: { birthDate: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!kid) notFound();

  // animalId → {childId → count} の集計表
  const statsByAnimal = new Map<string, Map<string, number>>();
  for (const c of allCaught) {
    const inner =
      statsByAnimal.get(c.animalId) ?? new Map<string, number>();
    inner.set(c.caughtByUserId, (inner.get(c.caughtByUserId) ?? 0) + 1);
    statsByAnimal.set(c.animalId, inner);
  }

  const animals = allAnimals.map((a) => {
    const inner = statsByAnimal.get(a.id);
    const familyCaught = inner !== undefined && inner.size > 0;
    // 家族メンバーの並びは年上から（allChildren の順）
    const captureStats = allChildren.map((ch) => ({
      userId: ch.id,
      userName: ch.name,
      count: inner?.get(ch.id) ?? 0,
    }));
    const totalCount = captureStats.reduce((s, x) => s + x.count, 0);
    return {
      ...a,
      // 家族全体での捕獲済みフラグ（誰か1人でも捕まえていれば true）
      caught: familyCaught,
      captureStats,
      totalCount,
    };
  });

  return (
    <DictionaryClient
      kidId={kid.id}
      kidName={kid.name}
      animals={animals}
      familySize={allChildren.length}
    />
  );
}
