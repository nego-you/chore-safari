// /kids/craft — クラフト（アイテムをつくる）画面。
// レシピで使う素材だけまとめて取得し、クライアントに渡す。

import { prisma } from "@/lib/prisma";
import { RECIPES, collectMaterialItemIds } from "@/lib/recipes";
import { CraftClient } from "./CraftClient";

export const dynamic = "force-dynamic";

export default async function CraftPage() {
  // レシピで参照されるすべての itemId（素材 + 完成品）を1回で取得。
  const itemIds = Array.from(
    new Set([
      ...collectMaterialItemIds(),
      ...RECIPES.map((r) => r.resultItemId),
    ]),
  );

  const inventory = await prisma.sharedInventoryItem.findMany({
    where: { itemId: { in: itemIds } },
    select: {
      itemId: true,
      itemName: true,
      quantity: true,
      itemType: true,
    },
  });

  return (
    <CraftClient
      recipes={RECIPES}
      inventory={inventory.map((i) => ({
        itemId: i.itemId,
        itemName: i.itemName,
        quantity: i.quantity,
        itemType: i.itemType as "FOOD" | "TRAP_PART",
      }))}
    />
  );
}
