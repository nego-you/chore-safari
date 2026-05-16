// /kids/[kidId]/dictionary — 本格博物学図鑑ページ。
// 全動物をグリッド表示。未捕獲=シルエット+「？？？」、捕獲済み=カラー+詳細。

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DictionaryClient } from "./DictionaryClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function DictionaryPage({ params }: { params: Params }) {
  const { kidId } = await params;

  const [kid, allAnimals, caughtAnimals] = await Promise.all([
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
      },
    }),
    // この子が捕まえた動物の animalId 一覧（重複なし）
    prisma.caughtAnimal.findMany({
      where: { caughtByUserId: kidId },
      select: { animalId: true },
      distinct: ["animalId"],
    }),
  ]);

  if (!kid) notFound();

  // 捕獲済み animalId の Set（Animal.id 基準）
  const caughtSet = new Set(caughtAnimals.map((c) => c.animalId));

  const animals = allAnimals.map((a) => ({
    ...a,
    caught: caughtSet.has(a.id),
  }));

  return (
    <DictionaryClient
      kidId={kid.id}
      kidName={kid.name}
      animals={animals}
    />
  );
}
