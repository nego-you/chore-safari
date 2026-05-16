// /kids/[kidId]/warehouse — 博物倉庫。
// 図鑑（コンプリート率・シルエットUI入口）+ 共有インベントリ + 道具一覧 を統合。

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WarehouseClient } from "./WarehouseClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function WarehousePage({ params }: { params: Params }) {
  const { kidId } = await params;

  const [kid, allAnimals, caughtAnimals, inventory, tools, stages] = await Promise.all([
    prisma.user.findFirst({
      where: { id: kidId, role: "CHILD" },
      select: { id: true, name: true, coinBalance: true },
    }),
    prisma.animal.findMany({
      orderBy: [{ rarity: "asc" }, { genericName: "asc" }, { specificName: "asc" }],
      select: {
        id: true,
        animalId: true,
        rarity: true,
        emoji: true,
        isExtinct: true,
        stageId: true,
        specificName: true,
        genericName: true,
      },
    }),
    prisma.caughtAnimal.findMany({
      where: { caughtByUserId: kidId },
      select: { animalId: true },
      distinct: ["animalId"],
    }),
    prisma.sharedInventoryItem.findMany({
      orderBy: [{ itemType: "asc" }, { itemName: "asc" }],
      select: {
        id: true,
        itemId: true,
        itemName: true,
        quantity: true,
        itemType: true,
      },
    }),
    prisma.tool.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        toolId: true,
        name: true,
        emoji: true,
        description: true,
        historicalContext: true,
        type: true,
        successRateBonus: true,
        inventoryItemId: true,
        consumable: true,
      },
    }),
    prisma.stage.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, stageId: true, name: true, emoji: true },
    }),
  ]);

  if (!kid) notFound();

  const caughtSet = new Set(caughtAnimals.map((c) => c.animalId));

  const animalsByStage = new Map<string | null, { caught: number; total: number }>();
  for (const a of allAnimals) {
    const k = a.stageId ?? null;
    const cur = animalsByStage.get(k) ?? { caught: 0, total: 0 };
    cur.total += 1;
    if (caughtSet.has(a.id)) cur.caught += 1;
    animalsByStage.set(k, cur);
  }

  const stageProgress = stages.map((s) => {
    const p = animalsByStage.get(s.id) ?? { caught: 0, total: 0 };
    return {
      stageId: s.stageId,
      name: s.name,
      emoji: s.emoji,
      caught: p.caught,
      total: p.total,
    };
  });

  const caughtCount = allAnimals.filter((a) => caughtSet.has(a.id)).length;
  const totalCount = allAnimals.length;

  return (
    <WarehouseClient
      kidId={kid.id}
      kidName={kid.name}
      caughtCount={caughtCount}
      totalCount={totalCount}
      stageProgress={stageProgress}
      inventory={inventory}
      tools={tools.map((t) => ({
        ...t,
        type: t.type as "TRAP" | "BOW" | "SPEAR",
      }))}
    />
  );
}
