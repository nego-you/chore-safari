// /kids/[kidId]/safari — 罠を仕掛けて、出現→タイミングゲームで捕獲する非同期フロー。
// 即時抽選 (旧 exploreSafari) は廃止。setTrap → 待機 → checkTrap → resolveTrap の流れ。
// 2026-05-18: インベントリを SharedInventoryItem → UserTool（TRAP タイプ）に切替。

import { prisma } from "@/lib/prisma";
import { getHuntStamina } from "../../actions";
import { SafariClient } from "./SafariClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function SafariPage({
  params,
}: {
  params: Params;
}) {
  const { kidId: kidParam } = await params;

  // kids 一覧を先に取得して initialKid を確定する（UserTool クエリに必要）。
  const kids = await prisma.user.findMany({
    where: { role: "CHILD" },
    orderBy: { birthDate: "asc" },
    select: { id: true, name: true, coinBalance: true },
  });

  const initialKid =
    kidParam && kids.some((k) => k.id === kidParam) ? kidParam : null;

  const [ownedTrapRows, activeTraps, caughtAnimals] = await Promise.all([
    // この子が持っている TRAP 型の道具だけを返す。
    initialKid
      ? prisma.userTool.findMany({
          where: {
            userId: initialKid,
            tool: { type: "TRAP" },
          },
          include: { tool: true },
          orderBy: { tool: { sortOrder: "asc" } },
        })
      : Promise.resolve([]),
    // 全 CHILD の仕掛け中・出現中の罠。クライアントで選択中の子の分だけ表示。
    prisma.hunt.findMany({
      where: { status: { in: ["PLACED", "APPEARED"] } },
      orderBy: { appearsAt: "asc" },
      include: { targetAnimal: true },
    }),
    prisma.caughtAnimal.findMany({
      where: { caughtBy: { isTestAccount: false } },
      orderBy: { caughtAt: "desc" },
      take: 200,
      include: {
        animal: true,
        caughtBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  // アクティブ狩り（BOW/SPEAR）用の本日残り回数。罠スタイル自体は制限なし。
  const huntStamina = initialKid ? await getHuntStamina(initialKid) : null;

  // UserTool → クライアント用の軽量型に変換。
  const ownedTraps = ownedTrapRows.map((ut) => ({
    toolId: ut.tool.toolId,
    toolName: ut.tool.name,
    emoji: ut.tool.emoji,
    quantity: ut.quantity,
  }));

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
      ownedTraps={ownedTraps}
      activeTraps={traps}
      catches={catches}
      huntStaminaRemaining={huntStamina?.remaining ?? null}
      huntStaminaLimit={huntStamina?.limit ?? 3}
    />
  );
}
