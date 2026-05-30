"use server";

// features/inventory/actions.ts
// ゲーム内インベントリ（草・石・うんち・作物・素材など）の永続化。
//   書き手は子供本人のみ（単一書き手）なので、スナップショット同期（last-write-wins）で運用する。
//   コインは含めない（features/coins/actions.ts で別管理）。

import { prisma } from "@/lib/prisma";

export type InventoryMap = Record<string, number>;

/** 子供のインベントリを {itemKey: quantity} で取得（数量0は除外）。ロード時のハイドレート用。 */
export async function getInventory(kidId: string): Promise<InventoryMap> {
  const rows = await prisma.gameInventoryItem.findMany({
    where: { userId: kidId },
    select: { itemKey: true, quantity: true },
  });
  const map: InventoryMap = {};
  for (const r of rows) {
    if (r.quantity > 0) map[r.itemKey] = r.quantity;
  }
  return map;
}

/**
 * インベントリ全体をスナップショット保存する（debounce 経由でのみ呼ぶこと）。
 *   - map に含まれるキーは upsert。
 *   - map に含まれない既存キーは削除（= 0 になったものを掃除）。
 * ハイドレート前に呼ぶと DB を消しかねないため、呼び出し側で _hydrated を必ず確認する。
 */
export async function saveInventory(
  kidId: string,
  map: InventoryMap,
): Promise<{ success: boolean }> {
  // 数量を非負整数に正規化し、0 以下は保存対象から除外（=削除されるキー）。
  const entries = Object.entries(map)
    .map(([k, v]) => [k, Math.max(0, Math.trunc(Number(v) || 0))] as const)
    .filter(([, q]) => q > 0);
  const keepKeys = entries.map(([k]) => k);

  try {
    await prisma.$transaction([
      ...entries.map(([itemKey, quantity]) =>
        prisma.gameInventoryItem.upsert({
          where: { userId_itemKey: { userId: kidId, itemKey } },
          create: { userId: kidId, itemKey, quantity },
          update: { quantity },
        }),
      ),
      // map から消えたキー（0 になったもの）を掃除。keepKeys が空なら全削除。
      prisma.gameInventoryItem.deleteMany({
        where: { userId: kidId, itemKey: { notIn: keepKeys } },
      }),
    ]);
    return { success: true };
  } catch (err) {
    console.error("[saveInventory] failed:", err);
    return { success: false };
  }
}
