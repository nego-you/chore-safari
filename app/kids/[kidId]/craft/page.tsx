// /kids/craft — クラフト（アイテムをつくる）画面。
// レシピで使う素材だけまとめて取得し、クライアントに渡す。
// ?kid= は内部ロジックでは使わないが「← ポータルへ」戻る時の引き継ぎ用に通す。

import { prisma } from "@/lib/prisma";
import { RECIPES, collectMaterialItemIds } from "@/lib/recipes";
import { CraftClient } from "./CraftClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function CraftPage({
  params,
}: {
  params: Params;
}) {
  const { kidId: kidParam } = await params;

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
      kidId={kidParam ?? null}
      inventory={inventory.map((i) => ({
        itemId: i.itemId,
        itemName: i.itemName,
        quantity: i.quantity,
        itemType: i.itemType as "FOOD" | "TRAP_PART",
      }))}
    />
  );
}
