// /kids/[kidId]/safari/hunt — アクティブ狩り（投槍器・複合弓）専用ページ。
// 罠スタイル（/safari）と並ぶ、ゲージ式タイミングで即決着するモード。

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HuntClient } from "./HuntClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function HuntPage({ params }: { params: Params }) {
  const { kidId } = await params;

  const [kid, tools, stages, inventory] = await Promise.all([
    prisma.user.findFirst({
      where: { id: kidId, role: "CHILD" },
      select: { id: true, name: true, coinBalance: true },
    }),
    prisma.tool.findMany({
      where: { type: { in: ["BOW", "SPEAR"] } },
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
      include: { _count: { select: { animals: true } } },
    }),
    prisma.sharedInventoryItem.findMany({
      select: { itemId: true, quantity: true, itemName: true },
    }),
  ]);

  if (!kid) notFound();

  // BOW/SPEAR が無い場合（旧DB環境）も静かにフォールバック。
  const noTools = tools.length === 0;

  return (
    <HuntClient
      kidId={kid.id}
      kidName={kid.name}
      tools={tools.map((t) => ({
        id: t.id,
        toolId: t.toolId,
        name: t.name,
        emoji: t.emoji,
        description: t.description,
        historicalContext: t.historicalContext,
        type: t.type as "BOW" | "SPEAR",
        successRateBonus: t.successRateBonus,
        inventoryItemId: t.inventoryItemId,
        consumable: t.consumable,
      }))}
      stages={stages
        .filter((s) => s._count.animals > 0)
        .map((s) => ({
          id: s.id,
          stageId: s.stageId,
          name: s.name,
          emoji: s.emoji,
          description: s.description,
          animalCount: s._count.animals,
        }))}
      inventory={inventory}
      noTools={noTools}
    />
  );
}
