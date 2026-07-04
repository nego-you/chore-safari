"use server";

// features/gacha/actions.ts
// ガチャ：コイン消費 → ランダムアイテム（TRAP_PART）付与 → 履歴記録。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { GACHA_COST } from "@/app/kids/config";

// ── 排出テーブル ────────────────────────────────────────────────────────

type PoolEntry = {
  itemId: string;
  itemName: string;
  itemType: "TRAP_PART";
  weight: number;
};

const GACHA_POOL: PoolEntry[] = [
  { itemId: "rope",        itemName: "ロープ",         itemType: "TRAP_PART", weight: 35 },
  { itemId: "wood",        itemName: "きのいた",       itemType: "TRAP_PART", weight: 30 },
  { itemId: "net",         itemName: "あみ",           itemType: "TRAP_PART", weight: 20 },
  { itemId: "sturdy_trap", itemName: "じょうぶなワナ", itemType: "TRAP_PART", weight: 10 },
  { itemId: "hunter_net",  itemName: "ハンターネット", itemType: "TRAP_PART", weight: 5  },
];

function drawItem(): PoolEntry {
  const total = GACHA_POOL.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * total;
  for (const entry of GACHA_POOL) {
    r -= entry.weight;
    if (r <= 0) return entry;
  }
  return GACHA_POOL[GACHA_POOL.length - 1];
}

// ── 型 ────────────────────────────────────────────────────────────────

export type GachaResult =
  | {
      success: true;
      item: {
        itemId: string;
        itemName: string;
        itemType: "FOOD" | "TRAP_PART";
        totalQuantity: number;
      };
      newCoinBalance: number;
    }
  | { success: false; error: string };

// ── メインアクション ────────────────────────────────────────────────────

export async function playGacha(userId: string): Promise<GachaResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, coinBalance: true, isTestAccount: true },
  });

  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが見つかりません" };
  }
  if (!user.isTestAccount && user.coinBalance < GACHA_COST) {
    return {
      success: false,
      error: `コインが足りません（${GACHA_COST} ひつよう / いま ${user.coinBalance}）`,
    };
  }

  const prize = drawItem();

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (!user.isTestAccount) {
        const updated = await tx.user.updateMany({
          where: { id: userId, coinBalance: { gte: GACHA_COST } },
          data: { coinBalance: { decrement: GACHA_COST } },
        });
        if (updated.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
      }

      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { coinBalance: true },
      });

      await tx.coinTransaction.create({
        data: {
          userId,
          amount: -GACHA_COST,
          kind: "GACHA",
          reason: `ガチャ: ${prize.itemName}`,
        },
      });

      const inventoryRow = await tx.sharedInventoryItem.upsert({
        where: { itemId: prize.itemId },
        update: { quantity: { increment: 1 } },
        create: {
          itemId: prize.itemId,
          itemName: prize.itemName,
          itemType: prize.itemType,
          quantity: 1,
        },
      });

      await tx.gachaTransaction.create({
        data: {
          userId,
          costAmount: GACHA_COST,
          itemId: prize.itemId,
          itemName: prize.itemName,
          itemType: prize.itemType,
        },
      });

      return {
        newCoinBalance: fresh.coinBalance,
        totalQuantity: inventoryRow.quantity,
      };
    });

    revalidatePath("/kids");
    revalidatePath("/bank");

    return {
      success: true,
      item: {
        itemId: prize.itemId,
        itemName: prize.itemName,
        itemType: prize.itemType,
        totalQuantity: result.totalQuantity,
      },
      newCoinBalance: result.newCoinBalance,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return { success: false, error: "コインが足りません" };
    }
    console.error("playGacha failed:", err);
    return { success: false, error: "ガチャに失敗しました。もう一度試してね" };
  }
}
