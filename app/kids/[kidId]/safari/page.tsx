// /kids/safari — 罠を仕掛けて、出現→タイミングゲームで捕獲する非同期フロー。
// 即時抽選 (旧 exploreSafari) は廃止。setTrap → 待機 → checkTrap → resolveTrap の流れ。

import { prisma } from "@/lib/prisma";
import { SafariClient } from "./SafariClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function SafariPage({
  params,
}: {
  params: Params;
}) {
  const { kidId: kidParam } = await params;

  const [kids, inventory, activeTraps, caughtAnimals] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CHILD" },
      orderBy: { birthDate: "asc" },
      select: { id: true, name: true, coinBalance: true },
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
    // 全 CHILD の仕掛け中・出現中の罠。クライアントで選択中の子の分だけ表示。
    prisma.hunt.findMany({
      where: { status: { in: ["PLACED", "APPEARED"] } },
      orderBy: { appearsAt: "asc" },
      include: { targetAnimal: true },
    }),
    prisma.caughtAnimal.findMany({
      orderBy: { caughtAt: "desc" },
      take: 200,
      include: {
        animal: true,
        caughtBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  const initialKid =
    kidParam && kids.some((k) => k.id === kidParam) ? kidParam : null;

  const traps = activeTraps.map((t) => ({
    id: t.id,
    userId: t.userId,
    trapItemId: t.trapItemId,
    baitItemId: t.baitItemId,
    status: t.status as "PLACED" | "APPEARED",
    placedAt: t.placedAt.toISOString(),
    appearsAt: t.appearsAt.toISOString(),
    posX: t.posX,
    posY: t.posY,
    // ターゲットの種別だけ最小限渡す（捕獲成功時の演出用に使う）
    targetAnimal: {
      id: t.targetAnimal.id,
      animalId: t.targetAnimal.animalId,
      name: t.targetAnimal.name,
      genericName: t.targetAnimal.genericName,
      specificName: t.targetAnimal.specificName,
      emoji: t.targetAnimal.emoji,
      rarity: t.targetAnimal.rarity as
        | "COMMON"
        | "RARE"
        | "EPIC"
        | "LEGENDARY",
      description: t.targetAnimal.description,
      imageUrl: t.targetAnimal.imageUrl,
      isExtinct: t.targetAnimal.isExtinct,
    },
  }));

  const catches = caughtAnimals.map((c) => ({
    id: c.id,
    animal: {
      id: c.animal.id,
      animalId: c.animal.animalId,
      name: c.animal.name,
      genericName: c.animal.genericName,
      specificName: c.animal.specificName,
      emoji: c.animal.emoji,
      rarity: c.animal.rarity as "COMMON" | "RARE" | "EPIC" | "LEGENDARY",
      description: c.animal.description,
      imageUrl: c.animal.imageUrl,
      isExtinct: c.animal.isExtinct,
    },
    caughtBy: { id: c.caughtBy.id, name: c.caughtBy.name },
    caughtAt: c.caughtAt.toISOString(),
  }));

  return (
    <SafariClient
      initialKidId={initialKid}
      kids={kids}
      inventory={inventory}
      activeTraps={traps}
      catches={catches}
    />
  );
}
