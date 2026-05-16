"use server";

// 子供用ポータルのサーバアクション。
// 現状は playGacha のみ。残高チェック・抽選・在庫更新・履歴記録を
// prisma.$transaction で1スコープにまとめてアトミックに行う。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findRecipe } from "@/lib/recipes";
import { CRANE_COST, GACHA_COST } from "./config";


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
// サファリ：罠を「仕掛ける → 待機 → 出現 → タイミングゲーム」の非同期フロー。
//   setTrap     : 罠とエサを1個ずつ消費、target_animal を事前抽選し PLACED で作る
//   checkTrap   : appears_at を過ぎていれば APPEARED に状態遷移
//   resolveTrap : タイミングゲームの結果で CAUGHT / ESCAPED にする
// ─────────────────────────────────────────────

// rarity ごとの出現重み（数値が大きいほど出やすい）。通常エサ使用時。
const RARITY_WEIGHT: Record<"COMMON" | "RARE" | "EPIC" | "LEGENDARY", number> = {
  COMMON: 55,
  RARE: 28,
  EPIC: 13,
  LEGENDARY: 4,
};

// ✨ レアアイテム使用時の出現重み（LEGENDARY が 15〜20% で出現する）。
// SSR 最強王シリーズはこちらのテーブルでのみ高確率で選ばれる。
const RARITY_WEIGHT_RARE_BAIT: Record<"COMMON" | "RARE" | "EPIC" | "LEGENDARY", number> = {
  COMMON: 30,
  RARE: 30,
  EPIC: 22,
  LEGENDARY: 18, // ≒ 18% で LEGENDARY（SSR が含まれる）
};

// レアアイテム（とっきゅうのエサ / ハンターネット / ミックスごはん / じょうぶなワナ）の itemId。
// これらを使ったときだけ SSR 出現率テーブルを適用する。
const RARE_BAIT_ITEM_IDS = new Set([
  "premium_food",
  "hunter_net",
  "mixed_food",
  "sturdy_trap",
]);

// 出現待ち時間の最小・最大（ms）。テスト用に短め＝30〜90秒。
const TRAP_WAIT_MIN_MS = 30_000;
const TRAP_WAIT_MAX_MS = 90_000;

type AnimalLite = {
  id: string;
  animalId: string;
  name: string;
  // ゲームプレイ中の抽象名（例: ゾウ）
  genericName: string;
  // 図鑑詳細の種名（例: アフリカゾウ）
  specificName: string;
  emoji: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  description: string;
  imageUrl: string | null;
  isExtinct: boolean;
};

function pickAnimalByRarity<T extends { rarity: string; animalId: string }>(
  animals: T[],
  useRareBait = false,
): T {
  const weightTable = useRareBait ? RARITY_WEIGHT_RARE_BAIT : RARITY_WEIGHT;

  // レアアイテム使用時は SSR 最強王シリーズ（animalId に "_king" や固有IDを含む）
  // を LEGENDARY プールに含める。通常時は SSR 固有動物を除外する。
  const SSR_ANIMAL_IDS = new Set([
    "tyrannosaurus",
    "hercules_beetle",
    "lion_king",
    "megalodon",
    "dragon_king",
  ]);

  const eligible = animals.filter((a) => {
    const isSSR = SSR_ANIMAL_IDS.has(a.animalId);
    // レアアイテム使用時のみ SSR 動物を候補に入れる
    if (isSSR && !useRareBait) return false;
    return true;
  });

  const pool = eligible.length > 0 ? eligible : animals;
  const total = pool.reduce(
    (s, a) =>
      s + (weightTable[a.rarity as keyof typeof weightTable] ?? 1),
    0,
  );
  let r = Math.random() * total;
  for (const a of pool) {
    r -= weightTable[a.rarity as keyof typeof weightTable] ?? 1;
    if (r <= 0) return a;
  }
  return pool[pool.length - 1];
}

function pickWaitMs(): number {
  return (
    TRAP_WAIT_MIN_MS +
    Math.floor(Math.random() * (TRAP_WAIT_MAX_MS - TRAP_WAIT_MIN_MS))
  );
}

export type SetTrapResult =
  | {
      success: true;
      trap: {
        id: string;
        userId: string;
        trapItemId: string;
        baitItemId: string;
        status: "PLACED";
        placedAt: string;
        appearsAt: string;
        posX: number;
        posY: number;
        // 動物の正体（name / emoji）は隠すが、難易度ヒント用に rarity だけ返す
        targetRarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
      };
      updatedInventory: Array<{ itemId: string; quantity: number }>;
    }
  | { success: false; error: string };

export async function setTrap(
  userId: string,
  trapItemId: string,
  baitItemId: string,
  posX: number = 50,
  posY: number = 50,
): Promise<SetTrapResult> {
  // 座標を 0〜100 の範囲に丸める（フィールド端にめり込まない安全マージン）
  const clampedX = Math.max(4, Math.min(96, Number(posX) || 50));
  const clampedY = Math.max(8, Math.min(92, Number(posY) || 50));

  if (!trapItemId || !baitItemId) {
    return { success: false, error: "わなと エサを えらんでね" };
  }
  if (trapItemId === baitItemId) {
    return { success: false, error: "おなじ アイテムは えらべないよ" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが みつかりません" };
  }

  const [trap, bait] = await Promise.all([
    prisma.sharedInventoryItem.findUnique({ where: { itemId: trapItemId } }),
    prisma.sharedInventoryItem.findUnique({ where: { itemId: baitItemId } }),
  ]);
  if (!trap || trap.itemType !== "TRAP_PART") {
    return { success: false, error: "わなパーツが えらばれていません" };
  }
  if (!bait || bait.itemType !== "FOOD") {
    return { success: false, error: "エサが えらばれていません" };
  }
  if (trap.quantity < 1) {
    return { success: false, error: `${trap.itemName}が たりません` };
  }
  if (bait.quantity < 1) {
    return { success: false, error: `${bait.itemName}が たりません` };
  }

  const animals = await prisma.animal.findMany();
  if (animals.length === 0) {
    return { success: false, error: "どうぶつが まだ いません" };
  }
  // レアアイテム（とっきゅうのエサ等）を使った場合のみ SSR 動物が高確率で出現する
  const useRareBait = RARE_BAIT_ITEM_IDS.has(baitItemId) || RARE_BAIT_ITEM_IDS.has(trapItemId);
  const chosen = pickAnimalByRarity(animals, useRareBait);
  const appearsAt = new Date(Date.now() + pickWaitMs());

  try {
    const created = await prisma.$transaction(async (tx) => {
      const trapUpd = await tx.sharedInventoryItem.updateMany({
        where: { itemId: trapItemId, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (trapUpd.count !== 1) throw new Error("OUT_OF_TRAP");

      const baitUpd = await tx.sharedInventoryItem.updateMany({
        where: { itemId: baitItemId, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (baitUpd.count !== 1) throw new Error("OUT_OF_BAIT");

      return tx.activeTrap.create({
        data: {
          userId,
          trapItemId,
          baitItemId,
          status: "PLACED",
          appearsAt,
          targetAnimalId: chosen.id,
          posX: clampedX,
          posY: clampedY,
        },
      });
    });

    revalidatePath("/kids");
    revalidatePath("/kids/safari");

    return {
      success: true,
      trap: {
        id: created.id,
        userId: created.userId,
        trapItemId: created.trapItemId,
        baitItemId: created.baitItemId,
        status: "PLACED",
        placedAt: created.placedAt.toISOString(),
        appearsAt: created.appearsAt.toISOString(),
        posX: created.posX,
        posY: created.posY,
        targetRarity: chosen.rarity as
          | "COMMON"
          | "RARE"
          | "EPIC"
          | "LEGENDARY",
      },
      updatedInventory: [
        { itemId: trapItemId, quantity: trap.quantity - 1 },
        { itemId: baitItemId, quantity: bait.quantity - 1 },
      ],
    };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "OUT_OF_TRAP") {
        return { success: false, error: "わなパーツが たりません" };
      }
      if (err.message === "OUT_OF_BAIT") {
        return { success: false, error: "エサが たりません" };
      }
    }
    console.error("setTrap failed:", err);
    return { success: false, error: "罠の設置に失敗しました" };
  }
}

export type CheckTrapResult =
  | {
      success: true;
      status: "PLACED" | "APPEARED" | "CAUGHT" | "ESCAPED";
      appearsAt: string;
    }
  | { success: false; error: string };

export async function checkTrap(trapId: string): Promise<CheckTrapResult> {
  const trap = await prisma.activeTrap.findUnique({ where: { id: trapId } });
  if (!trap) {
    return { success: false, error: "罠が みつかりません" };
  }

  if (trap.status === "PLACED" && Date.now() >= trap.appearsAt.getTime()) {
    // PLACED → APPEARED へ昇格。並列リクエストにも耐えるよう条件付き update。
    const upd = await prisma.activeTrap.updateMany({
      where: { id: trapId, status: "PLACED" },
      data: { status: "APPEARED" },
    });
    if (upd.count === 1) {
      revalidatePath("/kids/safari");
      return {
        success: true,
        status: "APPEARED",
        appearsAt: trap.appearsAt.toISOString(),
      };
    }
    // 競合で既に他リクエストが昇格させていた → 再 fetch して最新を返す。
    const fresh = await prisma.activeTrap.findUnique({ where: { id: trapId } });
    return {
      success: true,
      status: (fresh?.status ?? trap.status) as CheckTrapResult["status"] &
        string,
      appearsAt: trap.appearsAt.toISOString(),
    };
  }

  return {
    success: true,
    status: trap.status as "PLACED" | "APPEARED" | "CAUGHT" | "ESCAPED",
    appearsAt: trap.appearsAt.toISOString(),
  };
}

export type ResolveTrapResult =
  | {
      success: true;
      caught: true;
      animal: AnimalLite;
      caughtAt: string;
    }
  | {
      success: true;
      caught: false;
      animal: AnimalLite; // 「逃げられた動物」も結果表示に使う
    }
  | { success: false; error: string };

export async function resolveTrap(
  trapId: string,
  isSuccess: boolean,
): Promise<ResolveTrapResult> {
  const trap = await prisma.activeTrap.findUnique({
    where: { id: trapId },
    include: { targetAnimal: true },
  });
  if (!trap) {
    return { success: false, error: "罠が みつかりません" };
  }
  if (trap.status !== "APPEARED") {
    if (trap.status === "PLACED") {
      return { success: false, error: "まだ どうぶつが きていないよ" };
    }
    return { success: false, error: "もう しょうぶ ついてるよ" };
  }

  const animal: AnimalLite = {
    id: trap.targetAnimal.id,
    animalId: trap.targetAnimal.animalId,
    name: trap.targetAnimal.name,
    genericName: trap.targetAnimal.genericName,
    specificName: trap.targetAnimal.specificName,
    emoji: trap.targetAnimal.emoji,
    rarity: trap.targetAnimal.rarity as AnimalLite["rarity"],
    description: trap.targetAnimal.description,
    imageUrl: trap.targetAnimal.imageUrl,
    isExtinct: trap.targetAnimal.isExtinct,
  };

  try {
    if (isSuccess) {
      const result = await prisma.$transaction(async (tx) => {
        // APPEARED → CAUGHT。二重処理を condition で防ぐ。
        const upd = await tx.activeTrap.updateMany({
          where: { id: trapId, status: "APPEARED" },
          data: { status: "CAUGHT", resolvedAt: new Date() },
        });
        if (upd.count !== 1) throw new Error("ALREADY_RESOLVED");

        return tx.caughtAnimal.create({
          data: {
            animalId: trap.targetAnimalId,
            caughtByUserId: trap.userId,
            trapItemId: trap.trapItemId,
            foodItemId: trap.baitItemId,
          },
        });
      });

      revalidatePath("/kids");
      revalidatePath("/kids/safari");
      revalidatePath("/bank");

      return {
        success: true,
        caught: true,
        animal,
        caughtAt: result.caughtAt.toISOString(),
      };
    } else {
      const upd = await prisma.activeTrap.updateMany({
        where: { id: trapId, status: "APPEARED" },
        data: { status: "ESCAPED", resolvedAt: new Date() },
      });
      if (upd.count !== 1) {
        return { success: false, error: "もう しょうぶ ついてるよ" };
      }
      revalidatePath("/kids/safari");
      return { success: true, caught: false, animal };
    }
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_RESOLVED") {
      return { success: false, error: "もう しょうぶ ついてるよ" };
    }
    console.error("resolveTrap failed:", err);
    return { success: false, error: "結果の保存に失敗しました" };
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

// ─────────────────────────────────────────────
// クエスト申請（子供側）。
// 同じ (user, quest) に PENDING な申請がある場合は重複申請をはじく。
// ─────────────────────────────────────────────

export type SubmitQuestResult =
  | {
      success: true;
      submission: {
        id: string;
        questId: string;
        userId: string;
        status: "PENDING";
        submittedAt: string;
      };
    }
  | { success: false; error: string };

export async function submitQuest(
  userId: string,
  questId: string,
): Promise<SubmitQuestResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが みつかりません" };
  }

  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest || !quest.isActive) {
    return { success: false, error: "クエストが みつかりません" };
  }

  const pending = await prisma.questSubmission.findFirst({
    where: { userId, questId, status: "PENDING" },
  });
  if (pending) {
    return { success: false, error: "もう しんせいずみだよ" };
  }

  const created = await prisma.questSubmission.create({
    data: { userId, questId, status: "PENDING" },
  });

  revalidatePath("/kids/quests");
  revalidatePath("/bank");

  return {
    success: true,
    submission: {
      id: created.id,
      questId: created.questId,
      userId: created.userId,
      status: "PENDING",
      submittedAt: created.submittedAt.toISOString(),
    },
  };
}

// ─────────────────────────────────────────────
// クレーンゲーム：コイン消費 → 抽選 → 在庫増 → 履歴記録。
// ガチャより当たりが豪華（クラフト完成品も直接ドロップする）。
// ─────────────────────────────────────────────


const CRANE_POOL: PoolEntry[] = [
  // 基本素材：ガチャより少なめの重み
  { itemId: "meat", itemName: "おにく", itemType: "FOOD", weight: 8 },
  { itemId: "fish", itemName: "おさかな", itemType: "FOOD", weight: 12 },
  { itemId: "berry", itemName: "きのみ", itemType: "FOOD", weight: 12 },
  { itemId: "rope", itemName: "ロープ", itemType: "TRAP_PART", weight: 12 },
  { itemId: "wood", itemName: "きのいた", itemType: "TRAP_PART", weight: 12 },
  { itemId: "net", itemName: "あみ", itemType: "TRAP_PART", weight: 12 },
  // 上位ドロップ：クラフトしないと手に入らないはずの完成品が直接出る！
  { itemId: "sturdy_trap", itemName: "じょうぶなワナ", itemType: "TRAP_PART", weight: 12 },
  { itemId: "premium_food", itemName: "とっきゅうのエサ", itemType: "FOOD", weight: 12 },
  { itemId: "hunter_net", itemName: "ハンターネット", itemType: "TRAP_PART", weight: 4 },
  { itemId: "mixed_food", itemName: "ミックスごはん", itemType: "FOOD", weight: 4 },
];

function drawCranePrize(): PoolEntry {
  const total = CRANE_POOL.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of CRANE_POOL) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return CRANE_POOL[CRANE_POOL.length - 1];
}

// 1 プレイで何個取れるかを決める：
//   70% で 1 個、25% で 2 個、5% で 3 個。
// 落とした場合（didCatch=false）も同じ確率分布で「何個落としたか」を決める。
function drawCranePrizeCount(): number {
  const r = Math.random();
  if (r < 0.05) return 3;
  if (r < 0.3) return 2;
  return 1;
}

// クレーン結果：捕獲成功なら各 itemId の totalQuantity に在庫数、失敗（途中で落とす）
// なら inventory には入れず、prize 情報だけ返す（演出用）。
// 1 プレイで 1〜3 個取れる可能性があり、同じ itemId が複数回当たった場合は
// items[] 内で count で集約して返す（UI 側で「おにく × 2」と表示できるように）。
// クライアントは「アニメーションを全部走らせた最終結果」を didCatch に乗せて呼ぶ。
export type CranePrizeItem = {
  itemId: string;
  itemName: string;
  itemType: "FOOD" | "TRAP_PART";
  // この回で取れた（または落とした）個数
  count: number;
  // didCatch=false なら null。didCatch=true ならその itemId の在庫合計。
  totalQuantity: number | null;
};

export type CraneResult =
  | {
      success: true;
      didCatch: boolean;
      // 1 件以上。複数取れた場合は itemId ごとにまとめてある。
      items: CranePrizeItem[];
      newCoinBalance: number;
    }
  | { success: false; error: string };

export async function playCraneGame(
  userId: string,
  didCatch: boolean,
): Promise<CraneResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, coinBalance: true },
  });

  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが見つかりません" };
  }
  if (user.coinBalance < CRANE_COST) {
    return {
      success: false,
      error: `コインが足りません（${CRANE_COST} ひつよう / いま ${user.coinBalance}）`,
    };
  }

  // 抽選：個数 → 個数ぶん独立に prize を引く → itemId で集約。
  const prizeCount = drawCranePrizeCount();
  const drawnPrizes: PoolEntry[] = [];
  for (let i = 0; i < prizeCount; i++) drawnPrizes.push(drawCranePrize());

  type Aggregated = { entry: PoolEntry; count: number };
  const aggregated = new Map<string, Aggregated>();
  for (const p of drawnPrizes) {
    const existing = aggregated.get(p.itemId);
    if (existing) existing.count += 1;
    else aggregated.set(p.itemId, { entry: p, count: 1 });
  }
  const aggregatedList = Array.from(aggregated.values());

  // 履歴の reason 用ラベル：「おにく x2 + ロープ」のような形にする。
  const reasonLabel = aggregatedList
    .map((a) => (a.count > 1 ? `${a.entry.itemName} x${a.count}` : a.entry.itemName))
    .join(" + ");

  try {
    const result = await prisma.$transaction(async (tx) => {
      // コインは必ず引く（リアルなクレーンゲーム仕様）。
      const updated = await tx.user.updateMany({
        where: { id: userId, coinBalance: { gte: CRANE_COST } },
        data: { coinBalance: { decrement: CRANE_COST } },
      });
      if (updated.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { coinBalance: true },
      });

      // コイン履歴は成否で文言を分ける。
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: -CRANE_COST,
          kind: "GACHA",
          reason: didCatch
            ? `クレーン: ${reasonLabel}`
            : `クレーン失敗（${reasonLabel}を落とした）`,
        },
      });

      // didCatch=true なら、集約済みエントリごとに在庫を増やす + ガチャ履歴を残す。
      // didCatch=false の時は在庫変動なし。totalQuantity は null。
      const items: CranePrizeItem[] = [];
      for (const { entry, count } of aggregatedList) {
        let totalQuantity: number | null = null;
        if (didCatch) {
          const row = await tx.sharedInventoryItem.upsert({
            where: { itemId: entry.itemId },
            update: { quantity: { increment: count } },
            create: {
              itemId: entry.itemId,
              itemName: entry.itemName,
              itemType: entry.itemType,
              quantity: count,
            },
          });
          totalQuantity = row.quantity;

          // ガチャ履歴は「同じ itemId が n 個取れた」を 1 行にまとめる。
          // costAmount は CRANE_COST をそのまま入れる（1 行で 1 プレイの代金）。
          await tx.gachaTransaction.create({
            data: {
              userId,
              costAmount: CRANE_COST,
              itemId: entry.itemId,
              itemName:
                count > 1 ? `${entry.itemName} x${count}` : entry.itemName,
              itemType: entry.itemType,
            },
          });
        }
        items.push({
          itemId: entry.itemId,
          itemName: entry.itemName,
          itemType: entry.itemType,
          count,
          totalQuantity,
        });
      }

      return {
        newCoinBalance: fresh.coinBalance,
        items,
      };
    });

    revalidatePath("/kids");
    revalidatePath("/kids/crane");
    revalidatePath("/bank");

    return {
      success: true,
      didCatch,
      items: result.items,
      newCoinBalance: result.newCoinBalance,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return { success: false, error: "コインが足りません" };
    }
    console.error("playCraneGame failed:", err);
    return { success: false, error: "クレーンゲームに失敗しました。もう一度試してね" };
  }
}
