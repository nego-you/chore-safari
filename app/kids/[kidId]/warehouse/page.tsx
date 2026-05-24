// /kids/[kidId]/warehouse — 博物倉庫。
// 図鑑（コンプリート率・シルエットUI入口）+ 共有インベントリ + 道具一覧 を統合。
// 年齢（1日=1年）・殿堂入り（寿命満了）・報酬ダイアログ を追加。

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WarehouseClient } from "./WarehouseClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function WarehousePage({ params }: { params: Params }) {
  const { kidId } = await params;

  const [kid, allAnimals, caughtAnimals, inventory, tools, stages, myAnimals] = await Promise.all([
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
    // 🌟 家族全員ぶんの捕獲履歴（家族共通図鑑のため）
    prisma.caughtAnimal.findMany({
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
    // 🌟 この子供が捕まえた動物の一覧（寿命・卒業表示用）
    prisma.caughtAnimal.findMany({
      where: { caughtByUserId: kidId },
      orderBy: { caughtAt: "desc" },
      select: {
        id: true,
        caughtAt: true,
        expiresAt: true,
        isAlive: true,
        isGraduated: true,
        rewardClaimed: true,
        animal: {
          select: {
            id: true,
            animalId: true,
            specificName: true,
            genericName: true,
            emoji: true,
            rarity: true,
            lifespanYears: true,
          },
        },
      },
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

  const now = new Date();

  const myAnimalsMapped = myAnimals.map((ca) => {
    // 経過日数（1日 = 1ゲーム年）
    const elapsedDays = Math.floor(
      (now.getTime() - ca.caughtAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const ageInYears = elapsedDays;
    const isLegendary = ca.animal.lifespanYears >= 999;

    // 卒業判定：expiresAt 超過 or 経過日数 >= lifespanYears
    const isExpiredByDate = ca.expiresAt !== null && ca.expiresAt <= now;
    const isExpiredByAge = !isLegendary && ageInYears >= ca.animal.lifespanYears;
    const isGraduated = ca.isGraduated || isExpiredByDate || isExpiredByAge;

    // 生存フラグ（isAlive DB値 AND 卒業していない）
    const isAlive = ca.isAlive && !isGraduated;

    return {
      id: ca.id,
      caughtAt: ca.caughtAt.toISOString(),
      expiresAt: ca.expiresAt?.toISOString() ?? null,
      isAlive,
      isGraduated,
      rewardClaimed: ca.rewardClaimed,
      ageInYears,
      animal: {
        id: ca.animal.id,
        animalId: ca.animal.animalId,
        specificName: ca.animal.specificName,
        genericName: ca.animal.genericName,
        emoji: ca.animal.emoji,
        rarity: ca.animal.rarity as "COMMON" | "RARE" | "EPIC" | "LEGENDARY",
        lifespanYears: ca.animal.lifespanYears,
      },
    };
  });

  return (
    <WarehouseClient
      kidId={kid.id}
      kidName={kid.name}
      caughtCount={caughtCount}
      totalCount={totalCount}
      stageProgress={stageProgress}
      inventory={inventory.map((i) => ({ ...i, itemType: i.itemType as "FOOD" | "TRAP_PART" }))}
      tools={tools.map((t) => ({
        ...t,
        type: t.type as "TRAP" | "BOW" | "SPEAR",
      }))}
      myAnimals={myAnimalsMapped}
      nowIso={now.toISOString()}
    />
  );
}
