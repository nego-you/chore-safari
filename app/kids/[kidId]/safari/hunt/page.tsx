// /kids/[kidId]/safari/hunt — アクティブ狩り（投槍器・複合弓・武器）専用ページ。
// 罠スタイル（/safari）と並ぶ、ゲージ式タイミングで即決着するモード。
// 2026-05-18: SharedInventoryItem → UserTool に切替。WEAPON タイプを追加。

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHuntStamina } from "../../../actions";
import { HuntClient } from "./HuntClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function HuntPage({ params }: { params: Params }) {
  const { kidId } = await params;

  const [kid, userTools, stages, stamina] = await Promise.all([
    prisma.user.findFirst({
      where: { id: kidId, role: "CHILD" },
      select: { id: true, name: true, coinBalance: true },
    }),
    // この子が持っている BOW / SPEAR / WEAPON 型の道具だけ返す。
    prisma.userTool.findMany({
      where: {
        userId: kidId,
        quantity: { gt: 0 },
        tool: { type: { in: ["BOW", "SPEAR", "WEAPON"] } },
      },
      include: {
        tool: {
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
            sortOrder: true,
          },
        },
      },
      orderBy: { tool: { sortOrder: "asc" } },
    }),
    prisma.stage.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { animals: true } } },
    }),
    getHuntStamina(kidId),
  ]);

  if (!kid) notFound();

  const noTools = userTools.length === 0;

  return (
    <HuntClient
      kidId={kid.id}
      kidName={kid.name}
      tools={userTools.map((ut) => ({
        id: ut.tool.id,
        toolId: ut.tool.toolId,
        name: ut.tool.name,
        emoji: ut.tool.emoji,
        description: ut.tool.description,
        historicalContext: ut.tool.historicalContext,
        type: ut.tool.type as "BOW" | "SPEAR" | "WEAPON",
        successRateBonus: ut.tool.successRateBonus,
        inventoryItemId: ut.tool.inventoryItemId,
        consumable: ut.tool.consumable,
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
      noTools={noTools}
      initialStamina={stamina}
    />
  );
}
