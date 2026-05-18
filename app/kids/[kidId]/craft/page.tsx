// /kids/[kidId]/craft — クラフト（どうぐをつくる）画面。
// UserMaterial（素材）を消費して UserTool（道具）を作るページ。

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RECIPES, collectMaterialIds } from "@/lib/recipes";
import { CraftClient } from "./CraftClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function CraftPage({
  params,
}: {
  params: Params;
}) {
  const { kidId } = await params;

  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();

  // Material マスタ（materialId 一覧で引く）
  const materialIds = collectMaterialIds();
  const [materialMasters, userMaterials, userTools] = await Promise.all([
    prisma.material.findMany({
      where: { materialId: { in: materialIds } },
    }),
    prisma.userMaterial.findMany({
      where: { userId: kidId },
      include: { material: true },
    }),
    prisma.userTool.findMany({
      where: { userId: kidId },
      include: { tool: true },
    }),
  ]);

  // materialId → 所持数のマップ
  const matQtyByMaterialId = new Map(
    userMaterials.map((um) => [um.material.materialId, um.quantity]),
  );

  // Material マスタを UserMaterialRow 形式に変換（所持数 0 でも表示する）
  const materials = materialMasters.map((m) => ({
    materialId: m.materialId,
    materialName: m.name,
    emoji: m.emoji,
    quantity: matQtyByMaterialId.get(m.materialId) ?? 0,
  }));

  // ユーザーの道具所持一覧
  const tools = userTools.map((ut) => ({
    toolId: ut.tool.toolId,
    toolName: ut.tool.name,
    emoji: ut.tool.emoji,
    toolType: ut.tool.type as "TRAP" | "BOW" | "SPEAR" | "WEAPON",
    quantity: ut.quantity,
  }));

  return (
    <CraftClient
      kidId={kidId}
      kidName={kid.name}
      recipes={RECIPES}
      materials={materials}
      ownedTools={tools}
    />
  );
}
