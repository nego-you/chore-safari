"use server";

// 子供用ポータルのサーバアクション。
// 現状は playGacha のみ。残高チェック・抽選・在庫更新・履歴記録を
// prisma.$transaction で1スコープにまとめてアトミックに行う。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findRecipe } from "@/lib/recipes";
import { GACHA_COST } from "./config";


// ガチャの排出テーブル。weight が大きいほど出やすい。
// 既存の shared_inventory の itemId に合わせる（無ければ create する）。
type PoolEntry = {
  itemId: string;
  itemName: string;
  itemType: "FOOD" | "TRAP_PART";
  weight: number;
};

const GACHA_POOL: PoolEntry[] = [
  { itemId: "meat", itemName: "おにく", itemType: "FOOD", weight: 20 },
  { itemId: "fish", itemName: "おさかな", itemType: "FOOD", weight: 15 },
  { itemId: "berry", itemName: "きのみ", itemType: "FOOD", weight: 15 },
  { itemId: "rope", itemName: "ロープ", itemType: "TRAP_PART", weight: 25 },
  { itemId: "wood", itemName: "きのいた", itemType: "TRAP_PART", weight: 20 },
  { itemId: "net", itemName: "あみ", itemType: "TRAP_PART", weight: 5 },
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

export type GachaResult =
  | {
      success: true;
      item: {
        itemId: string;
        itemName: string;
        itemType: "FOOD" | "TRAP_PART";
        // 抽選後のこのアイテムの倉庫内総数（楽観的更新のフォールバック用）
        totalQuantity: number;
      };
      newCoinBalance: number;
    }
  | { success: false; error: string };

export async function playGacha(userId: string): Promise<GachaResult> {
  // 事前チェック（不正な userId / 残高不足はトランザクションに入らずに弾く）。
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, coinBalance: true },
  });

  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが見つかりません" };
  }
  if (user.coinBalance < GACHA_COST) {
    return {
      success: false,
      error: `コインが足りません（${GACHA_COST} ひつよう / いま ${user.coinBalance}）`,
    };
  }

  const prize = drawItem();

  try {
    // 同時押し対策：「coinBalance >= GACHA_COST」を更新条件に入れて、
    // 競合した場合は updateMany の count==0 で検出して abort する。
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, coinBalance: { gte: GACHA_COST } },
        data: { coinBalance: { decrement: GACHA_COST } },
      });
      if (updated.count !== 1) {
        throw new Error("INSUFFICIENT_FUNDS");
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

    // Server Component 側（/bank で残高を見ているケース等）も最新化。
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

// ─────────────────────────────────────────────
// サファリ探索：罠 + エサ を1つずつ消費して、どうぶつを1匹捕まえる。
// ─────────────────────────────────────────────

// rarity ごとの出現重み（数値が大きいほど出やすい）。
const RARITY_WEIGHT: Record<"COMMON" | "RARE" | "EPIC" | "LEGENDARY", number> = {
  COMMON: 55,
  RARE: 28,
  EPIC: 13,
  LEGENDARY: 4,
};

export type SafariResult =
  | {
      success: true;
      animal: {
        id: string;
        animalId: string;
        name: string;
        emoji: string;
        rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
        description: string;
        imageUrl: string | null;
      };
      caughtByName: string;
      caughtAt: string; // ISO
      updatedInventory: Array<{ itemId: string; quantity: number }>;
    }
  | { success: false; error: string };

export async function exploreSafari(
  userId: string,
  trapItemId: string,
  foodItemId: string,
): Promise<SafariResult> {
  // 入力チェック
  if (!trapItemId || !foodItemId) {
    return { success: false, error: "わなと エサを えらんでね" };
  }
  if (trapItemId === foodItemId) {
    return { success: false, error: "おなじ アイテムは えらべないよ" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが みつかりません" };
  }

  const [trap, food] = await Promise.all([
    prisma.sharedInventoryItem.findUnique({ where: { itemId: trapItemId } }),
    prisma.sharedInventoryItem.findUnique({ where: { itemId: foodItemId } }),
  ]);

  if (!trap || trap.itemType !== "TRAP_PART") {
    return { success: false, error: "わなパーツが えらばれていません" };
  }
  if (!food || food.itemType !== "FOOD") {
    return { success: false, error: "エサが えらばれていません" };
  }
  if (trap.quantity < 1) {
    return { success: false, error: `${trap.itemName}が たりません` };
  }
  if (food.quantity < 1) {
    return { success: false, error: `${food.itemName}が たりません` };
  }

  const animals = await prisma.animal.findMany();
  if (animals.length === 0) {
    return { success: false, error: "どうぶつが まだ いません" };
  }

  // rarity 加重抽選
  const totalWeight = animals.reduce(
    (s, a) => s + (RARITY_WEIGHT[a.rarity as keyof typeof RARITY_WEIGHT] ?? 1),
    0,
  );
  let r = Math.random() * totalWeight;
  let chosen = animals[0];
  for (const a of animals) {
    r -= RARITY_WEIGHT[a.rarity as keyof typeof RARITY_WEIGHT] ?? 1;
    if (r <= 0) {
      chosen = a;
      break;
    }
  }

  try {
    const caught = await prisma.$transaction(async (tx) => {
      // 競合防止：「quantity >= 1」を条件に updateMany。count !== 1 で中断。
      const trapUpd = await tx.sharedInventoryItem.updateMany({
        where: { itemId: trapItemId, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (trapUpd.count !== 1) throw new Error("OUT_OF_TRAP");

      const foodUpd = await tx.sharedInventoryItem.updateMany({
        where: { itemId: foodItemId, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (foodUpd.count !== 1) throw new Error("OUT_OF_FOOD");

      return tx.caughtAnimal.create({
        data: {
          animalId: chosen.id,
          caughtByUserId: userId,
          trapItemId,
          foodItemId,
        },
        include: {
          animal: true,
          caughtBy: { select: { name: true } },
        },
      });
    });

    revalidatePath("/kids");
    revalidatePath("/kids/safari");
    revalidatePath("/bank");

    return {
      success: true,
      animal: {
        id: caught.animal.id,
        animalId: caught.animal.animalId,
        name: caught.animal.name,
        emoji: caught.animal.emoji,
        rarity: caught.animal.rarity as
          | "COMMON"
          | "RARE"
          | "EPIC"
          | "LEGENDARY",
        description: caught.animal.description,
        imageUrl: caught.animal.imageUrl,
      },
      caughtByName: caught.caughtBy.name,
      caughtAt: caught.caughtAt.toISOString(),
      updatedInventory: [
        { itemId: trapItemId, quantity: trap.quantity - 1 },
        { itemId: foodItemId, quantity: food.quantity - 1 },
      ],
    };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "OUT_OF_TRAP") {
        return { success: false, error: "わなパーツが たりません" };
      }
      if (err.message === "OUT_OF_FOOD") {
        return { success: false, error: "エサが たりません" };
      }
    }
    console.error("exploreSafari failed:", err);
    return {
      success: false,
      error: "たんけんに しっぱい。もう いちど ためしてね",
    };
  }
}

// ─────────────────────────────────────────────
// クラフト：BOM レシピに従い素材を消費して完成品を産む。
// すべて prisma.$transaction で完全アトミック。
// ─────────────────────────────────────────────

export type CraftResult =
  | {
      success: true;
      product: {
        itemId: string;
        itemName: string;
        itemType: "FOOD" | "TRAP_PART";
        // クラフト後のこの完成品の倉庫内総数（楽観的更新で利用）
        totalQuantity: number;
      };
      // 消費後の素材の最新数量
      updatedInventory: Array<{ itemId: string; quantity: number }>;
    }
  | { success: false; error: string };

export async function craftItem(recipeId: string): Promise<CraftResult> {
  const recipe = findRecipe(recipeId);
  if (!recipe) {
    return { success: false, error: "レシピが みつかりません" };
  }

  // 事前チェック：在庫が足りるか（早期 return でユーザに親切な文言を返す）。
  const itemIds = recipe.materials.map((m) => m.itemId);
  const currentMaterials = await prisma.sharedInventoryItem.findMany({
    where: { itemId: { in: itemIds } },
  });
  const haveMap = new Map(currentMaterials.map((m) => [m.itemId, m.quantity]));
  for (const need of recipe.materials) {
    const have = haveMap.get(need.itemId) ?? 0;
    if (have < need.quantity) {
      return {
        success: false,
        error: `${need.itemName}が たりません（ひつよう: ${need.quantity} / いま: ${have}）`,
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 全素材を条件付き updateMany で減らす。1つでも条件不一致なら throw して全 rollback。
      for (const need of recipe.materials) {
        const upd = await tx.sharedInventoryItem.updateMany({
          where: {
            itemId: need.itemId,
            quantity: { gte: need.quantity },
          },
          data: { quantity: { decrement: need.quantity } },
        });
        if (upd.count !== 1) {
          throw new Error(`OUT_OF_${need.itemId}`);
        }
      }

      // 完成品を upsert（既にあれば increment、なければ create）。
      const product = await tx.sharedInventoryItem.upsert({
        where: { itemId: recipe.resultItemId },
        update: { quantity: { increment: recipe.resultQuantity } },
        create: {
          itemId: recipe.resultItemId,
          itemName: recipe.resultItemName,
          itemType: recipe.resultItemType,
          quantity: recipe.resultQuantity,
        },
      });

      return product;
    });

    revalidatePath("/kids");
    revalidatePath("/kids/craft");

    return {
      success: true,
      product: {
        itemId: result.itemId,
        itemName: result.itemName,
        itemType: result.itemType as "FOOD" | "TRAP_PART",
        totalQuantity: result.quantity,
      },
      updatedInventory: recipe.materials.map((m) => {
        const before = haveMap.get(m.itemId) ?? 0;
        return { itemId: m.itemId, quantity: before - m.quantity };
      }),
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("OUT_OF_")) {
      const missingId = err.message.replace("OUT_OF_", "");
      const need = recipe.materials.find((m) => m.itemId === missingId);
      return {
        success: false,
        error: need
          ? `${need.itemName}が たりません`
          : "そざいが たりません",
      };
    }
    console.error("craftItem failed:", err);
    return {
      success: false,
      error: "クラフトに しっぱい。もういちど ためしてね",
    };
  }
}

// ─────────────────────────────────────────────
// 特大達成ボーナス通知（祝賀演出用）の読み出し / 既読化。
// ─────────────────────────────────────────────

export type BonusNotificationDTO = {
  id: string;
  userId: string;
  reason: string;
  coinAmount: number;
  createdAt: string; // ISO
};

export async function getUnreadBonusNotifications(
  userId?: string,
): Promise<BonusNotificationDTO[]> {
  const rows = await prisma.specialBonusNotification.findMany({
    where: {
      isRead: false,
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    reason: r.reason,
    coinAmount: r.coinAmount,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function markBonusRead(
  notificationId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // updateMany + where { isRead: false } で「既読じゃないものだけ既読化」。
    // 既に既読化済みなら count=0 で OK 扱い。
    await prisma.specialBonusNotification.updateMany({
      where: { id: notificationId, isRead: false },
      data: { isRead: true },
    });
    revalidatePath("/kids");
    revalidatePath("/bank");
    return { success: true };
  } catch (err) {
    console.error("markBonusRead failed:", err);
    return { success: false, error: "既読化に しっぱい" };
  }
}
