"use server";

// features/craft/actions.ts
// クラフト：BOM レシピに従い素材を消費して完成品（UserTool）を産む。
// すべて prisma.$transaction で完全アトミック。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findRecipe } from "@/lib/recipes";

// ── 型 ────────────────────────────────────────────────────────────────

export type UserMaterialRow = {
  materialId: string;
  materialName: string;
  emoji: string;
  quantity: number;
};

export type UserToolRow = {
  toolId: string;
  toolName: string;
  emoji: string;
  toolType: "TRAP" | "BOW" | "SPEAR" | "WEAPON";
  quantity: number;
};

export type CraftResult =
  | {
      success: true;
      product: {
        toolId: string;
        toolName: string;
        toolType: "TRAP" | "BOW" | "SPEAR" | "WEAPON";
        totalQuantity: number;
      };
      updatedMaterials: Array<{ materialId: string; quantity: number }>;
    }
  | { success: false; error: string };

// ── メインアクション ────────────────────────────────────────────────────

export async function craftItem(recipeId: string, userId: string): Promise<CraftResult> {
  if (!userId) return { success: false, error: "ユーザーが ひつようです" };

  const recipe = findRecipe(recipeId);
  if (!recipe) {
    return { success: false, error: "レシピが みつかりません" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが みつかりません" };
  }

  const materialMasters = await prisma.material.findMany({
    where: { materialId: { in: recipe.materials.map((m) => m.materialId) } },
  });
  const masterByMaterialId = new Map(materialMasters.map((m) => [m.materialId, m]));

  const userMaterials = await prisma.userMaterial.findMany({
    where: {
      userId,
      materialId: { in: materialMasters.map((m) => m.id) },
    },
  });
  const haveMap = new Map(userMaterials.map((um) => [um.materialId, um.quantity]));

  for (const need of recipe.materials) {
    const master = masterByMaterialId.get(need.materialId);
    const have = master ? (haveMap.get(master.id) ?? 0) : 0;
    if (have < need.quantity) {
      return {
        success: false,
        error: `${need.materialName}が たりません（ひつよう: ${need.quantity} / いま: ${have}）`,
      };
    }
  }

  const toolRecord = await prisma.tool.findUnique({
    where: { toolId: recipe.resultToolId },
  });
  if (!toolRecord) {
    return { success: false, error: "どうぐの データが みつかりません（シードを確認してね）" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const need of recipe.materials) {
        const master = masterByMaterialId.get(need.materialId);
        if (!master) throw new Error(`MISSING_MASTER_${need.materialId}`);
        const upd = await tx.userMaterial.updateMany({
          where: {
            userId,
            materialId: master.id,
            quantity: { gte: need.quantity },
          },
          data: { quantity: { decrement: need.quantity } },
        });
        if (upd.count !== 1) throw new Error(`OUT_OF_${need.materialId}`);
      }

      const userTool = await tx.userTool.upsert({
        where: { userId_toolId: { userId, toolId: toolRecord.id } },
        update: { quantity: { increment: recipe.resultQuantity } },
        create: { userId, toolId: toolRecord.id, quantity: recipe.resultQuantity },
      });

      const updatedMaterials = await tx.userMaterial.findMany({
        where: { userId, materialId: { in: materialMasters.map((m) => m.id) } },
      });

      return { userTool, updatedMaterials };
    });

    revalidatePath(`/kids`);

    const masterById = new Map(materialMasters.map((m) => [m.id, m.materialId]));

    return {
      success: true,
      product: {
        toolId: toolRecord.toolId,
        toolName: toolRecord.name,
        toolType: toolRecord.type as "TRAP" | "BOW" | "SPEAR" | "WEAPON",
        totalQuantity: result.userTool.quantity,
      },
      updatedMaterials: result.updatedMaterials.map((um) => ({
        materialId: masterById.get(um.materialId) ?? um.materialId,
        quantity: um.quantity,
      })),
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("OUT_OF_")) {
      const missingId = err.message.replace("OUT_OF_", "");
      const need = recipe.materials.find((m) => m.materialId === missingId);
      return {
        success: false,
        error: need ? `${need.materialName}が たりません` : "そざいが たりません",
      };
    }
    console.error("craftItem failed:", err);
    return {
      success: false,
      error: "クラフトに しっぱい。もういちど ためしてね",
    };
  }
}

export async function getUserInventory(userId: string): Promise<{
  materials: UserMaterialRow[];
  tools: UserToolRow[];
}> {
  const [materials, tools] = await Promise.all([
    prisma.userMaterial.findMany({
      where: { userId },
      include: { material: true },
    }),
    prisma.userTool.findMany({
      where: { userId },
      include: { tool: true },
    }),
  ]);

  return {
    materials: materials.map((um) => ({
      materialId: um.material.materialId,
      materialName: um.material.name,
      emoji: um.material.emoji,
      quantity: um.quantity,
    })),
    tools: tools.map((ut) => ({
      toolId: ut.tool.toolId,
      toolName: ut.tool.name,
      emoji: ut.tool.emoji,
      toolType: ut.tool.type as "TRAP" | "BOW" | "SPEAR" | "WEAPON",
      quantity: ut.quantity,
    })),
  };
}
