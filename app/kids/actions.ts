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
    select: { id: true, role: true, coinBalance: true, isTestAccount: true },
  });

  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが見つかりません" };
  }
  // テストユーザーはコイン無制限（チェックをスキップ）
  if (!user.isTestAccount && user.coinBalance < GACHA_COST) {
    return {
      success: false,
      error: `コインが足りません（${GACHA_COST} ひつよう / いま ${user.coinBalance}）`,
    };
  }

  const prize = drawItem();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // テストユーザーはコイン消費なし
      if (!user.isTestAccount) {
        const updated = await tx.user.updateMany({
          where: { id: userId, coinBalance: { gte: GACHA_COST } },
          data: { coinBalance: { decrement: GACHA_COST } },
        });
        if (updated.count !== 1) {
          throw new Error("INSUFFICIENT_FUNDS");
        }
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
  COMMON: 62,
  RARE: 22,
  EPIC: 12,
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

// 高品質ワナ（ハンターネット / じょうぶなワナ）の itemId。
// これらを使ったときだけ SSR 出現率テーブルを適用する（エサ統合後も維持）。
const RARE_BAIT_ITEM_IDS = new Set([
  "hunter_net",
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
      // 消費後の罠道具の残数（itemId = tool.toolId）
      updatedInventory: Array<{ itemId: string; quantity: number }>;
    }
  | { success: false; error: string };

// trapItemId は Tool.toolId（例: "pitfall"）を受け取る。
// UserTool で TRAP タイプの道具を 1 個消費してから Hunt を作成する。
export async function setTrap(
  userId: string,
  trapItemId: string,
  baitItemId: string,   // 現在は trapItemId と同値（統合ワナセット方式）
  posX: number = 50,
  posY: number = 50,
): Promise<SetTrapResult> {
  // 座標を 0〜100 の範囲に丸める（フィールド端にめり込まない安全マージン）
  const clampedX = Math.max(4, Math.min(96, Number(posX) || 50));
  const clampedY = Math.max(8, Math.min(92, Number(posY) || 50));

  if (!trapItemId) {
    return { success: false, error: "ワナを えらんでね" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが みつかりません" };
  }

  // Tool マスタから TRAP タイプの道具を取得
  const toolRecord = await prisma.tool.findUnique({ where: { toolId: trapItemId } });
  if (!toolRecord || toolRecord.type !== "TRAP") {
    return { success: false, error: "パッシブ罠が えらばれていません" };
  }

  // ユーザーの道具所持数を確認
  const userTool = await prisma.userTool.findUnique({
    where: { userId_toolId: { userId, toolId: toolRecord.id } },
  });
  if (!userTool || userTool.quantity < 1) {
    return { success: false, error: `${toolRecord.name}が たりません。クラフトで つくってね！` };
  }

  const animals = await prisma.animal.findMany();
  if (animals.length === 0) {
    return { success: false, error: "どうぶつが まだ いません" };
  }
  // 上位ワナ（かごわな・バネわな）を使うと SSR 出現率がアップ
  const RARE_TRAP_IDS = new Set(["cage_trap", "leghold", "hunter_net", "sturdy_trap"]);
  const useRareBait = RARE_TRAP_IDS.has(trapItemId);
  const chosen = pickAnimalByRarity(animals, useRareBait);
  const appearsAt = new Date(Date.now() + pickWaitMs());

  try {
    const created = await prisma.$transaction(async (tx) => {
      // UserTool を 1 個消費
      const upd = await tx.userTool.updateMany({
        where: { userId, toolId: toolRecord.id, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (upd.count !== 1) throw new Error("OUT_OF_TRAP");

      return tx.hunt.create({
        data: {
          userId,
          huntType: "TRAP",
          trapItemId,         // tool.toolId 文字列で記録
          baitItemId: trapItemId,
          status: "PLACED",
          appearsAt,
          targetAnimalId: chosen.id,
          posX: clampedX,
          posY: clampedY,
        },
      });
    });

    revalidatePath("/kids");

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
        targetRarity: chosen.rarity as "COMMON" | "RARE" | "EPIC" | "LEGENDARY",
      },
      updatedInventory: [{ itemId: trapItemId, quantity: userTool.quantity - 1 }],
    };
  } catch (err) {
    if (err instanceof Error && err.message === "OUT_OF_TRAP") {
      return { success: false, error: `${toolRecord.name}が たりません` };
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
  const trap = await prisma.hunt.findUnique({ where: { id: trapId } });
  if (!trap) {
    return { success: false, error: "罠が みつかりません" };
  }

  if (trap.status === "PLACED" && Date.now() >= trap.appearsAt.getTime()) {
    // PLACED → APPEARED へ昇格。並列リクエストにも耐えるよう条件付き update。
    const upd = await prisma.hunt.updateMany({
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
    const fresh = await prisma.hunt.findUnique({ where: { id: trapId } });
    return {
      success: true,
      status: (fresh?.status ?? trap.status) as "PLACED" | "APPEARED" | "CAUGHT" | "ESCAPED",
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
  const trap = await prisma.hunt.findUnique({
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
      // 捕獲日（現在時刻）+ lifespanYears 日数分を expiresAt として計算。
      const now = new Date();
      const lifespanDays = trap.targetAnimal.lifespanYears ?? 10;
      const expiresAt = new Date(now.getTime() + lifespanDays * 24 * 60 * 60 * 1000);

      const result = await prisma.$transaction(async (tx) => {
        // APPEARED → CAUGHT。二重処理を condition で防ぐ。
        const upd = await tx.hunt.updateMany({
          where: { id: trapId, status: "APPEARED" },
          data: { status: "CAUGHT", resolvedAt: now },
        });
        if (upd.count !== 1) throw new Error("ALREADY_RESOLVED");

        return tx.caughtAnimal.create({
          data: {
            animalId: trap.targetAnimalId,
            caughtByUserId: trap.userId,
            trapItemId: trap.trapItemId,
            foodItemId: trap.baitItemId,
            expiresAt,
            isAlive: true,
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
      const upd = await prisma.hunt.updateMany({
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
// アクティブ狩り（投槍器・複合弓）：状況判断 → 読解クイズで決着するモード。
//   getHuntStamina : 今日のアクティブ狩り残り回数を取得（深夜0時リセット込み）。
//   startActiveHunt : 1日3回までのスタミナを消費し、Hunt(APPEARED) を即作成。
//   resolveActiveHunt : 行動選択/読解クイズの正否を渡して CAUGHT/ESCAPED を確定。
// 既存の TRAP モード (setTrap/checkTrap/resolveTrap) との二刀流。
// ─────────────────────────────────────────────

// 1日の上限回数。子供が「絶対に逃したくない」と感じるようにあえて少なめ。
const HUNT_DAILY_LIMIT = 3;

// JST（Asia/Tokyo）で今日の日付文字列 (YYYY-MM-DD) を返す。
// 深夜0時のリセット判定は「サーバ時刻」ではなく「JSTでの日付」を使う。
function todayJstString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export type HuntStaminaInfo = {
  used: number;
  remaining: number;
  limit: number;
  lastHuntDate: string | null; // ISO
};

// User の lastHuntDate と現在 JST 日を比較し、日付が変わっていれば dailyHuntCount を 0 に戻す。
// すでに同日なら何もしない。返り値は最新の {used, remaining}。
async function _readStaminaWithReset(userId: string): Promise<HuntStaminaInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyHuntCount: true, lastHuntDate: true },
  });
  if (!user) {
    return { used: 0, remaining: 0, limit: HUNT_DAILY_LIMIT, lastHuntDate: null };
  }
  const today = todayJstString();
  const lastDate = user.lastHuntDate ? todayJstString(user.lastHuntDate) : null;

  if (lastDate !== today && user.dailyHuntCount > 0) {
    // 日付が変わっている → リセット。並列リクエストでも安全なように条件付き update。
    await prisma.user.updateMany({
      where: { id: userId, dailyHuntCount: { gt: 0 } },
      data: { dailyHuntCount: 0 },
    });
    return {
      used: 0,
      remaining: HUNT_DAILY_LIMIT,
      limit: HUNT_DAILY_LIMIT,
      lastHuntDate: user.lastHuntDate?.toISOString() ?? null,
    };
  }
  const used = Math.min(user.dailyHuntCount, HUNT_DAILY_LIMIT);
  return {
    used,
    remaining: Math.max(0, HUNT_DAILY_LIMIT - used),
    limit: HUNT_DAILY_LIMIT,
    lastHuntDate: user.lastHuntDate?.toISOString() ?? null,
  };
}

export async function getHuntStamina(userId: string): Promise<HuntStaminaInfo> {
  return _readStaminaWithReset(userId);
}

// ─────────────────────────────────────────────
// アクティブ狩り：内部実装
// ─────────────────────────────────────────────

export type StartActiveHuntResult =
  | {
      success: true;
      hunt: {
        id: string;
        userId: string;
        huntType: "BOW" | "SPEAR" | "WEAPON";
        toolId: string;
        toolName: string;
        toolEmoji: string;
        status: "APPEARED";
        placedAt: string;
        appearsAt: string;
        // 演出に必要な範囲で動物の情報を返す
        targetAnimal: AnimalLite;
        // 命中ゲージのスイートスポット幅（0〜1、道具で広がる）— 旧UI互換
        sweetSpotWidth: number;
      };
      // 道具が消費型なら倉庫が更新される
      updatedInventory?: Array<{ itemId: string; quantity: number }>;
      // 消費後のスタミナ
      stamina: HuntStaminaInfo;
    }
  | { success: false; error: string; stamina?: HuntStaminaInfo };

export async function startActiveHunt(
  userId: string,
  toolDbId: string,
  stageDbId?: string | null,
): Promise<StartActiveHuntResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isTestAccount: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが みつかりません" };
  }

  // 1日3回制限：先に日付リセット → 残り回数チェック（テストユーザーはスキップ）
  const staminaBefore = await _readStaminaWithReset(userId);
  if (!user.isTestAccount && staminaBefore.remaining <= 0) {
    return {
      success: false,
      error: `きょうの かりは もう おわり！ あしたまた チャレンジしてね`,
      stamina: staminaBefore,
    };
  }

  const tool = await prisma.tool.findUnique({ where: { id: toolDbId } });
  if (!tool) return { success: false, error: "どうぐが みつかりません" };
  if (tool.type === "TRAP") {
    return {
      success: false,
      error: "この どうぐは パッシブ罠 専用です（罠スタイルで仕掛けてね）",
    };
  }

  // アクティブ狩りの道具（BOW/SPEAR/WEAPON）は UserTool に所持数が必要。
  const userTool = await prisma.userTool.findUnique({
    where: { userId_toolId: { userId, toolId: tool.id } },
  });
  if (!userTool || userTool.quantity < 1) {
    return { success: false, error: `${tool.name}を もっていません。クラフトで つくってね！` };
  }

  // ステージで動物プールを絞り込む（指定が無ければ全体）
  const animals = await prisma.animal.findMany({
    where: stageDbId ? { stageId: stageDbId } : undefined,
  });
  if (animals.length === 0) {
    return { success: false, error: "このステージに どうぶつが いません" };
  }

  // 道具の補正でレア出現率を少しブースト
  const useRareBait = tool.successRateBonus >= 0.3;
  const chosen = pickAnimalByRarity(animals, useRareBait);

  const now = new Date();
  try {
    const created = await prisma.$transaction(async (tx) => {
      // スタミナを 1 消費（テストユーザーは消費しない）
      if (!user.isTestAccount) {
        const staUpd = await tx.user.updateMany({
          where: {
            id: userId,
            dailyHuntCount: { lt: HUNT_DAILY_LIMIT },
          },
          data: {
            dailyHuntCount: { increment: 1 },
            lastHuntDate: now,
          },
        });
        if (staUpd.count !== 1) throw new Error("OUT_OF_STAMINA");
      }

      // BOW/SPEAR/WEAPON は非消耗 → UserTool の消費なし。所持確認のみ（スタミナのみ減る）。
      return tx.hunt.create({
        data: {
          userId,
          huntType: tool.type === "BOW" ? "BOW" : tool.type === "SPEAR" ? "SPEAR" : "WEAPON",
          toolId: tool.id,
          // アクティブ狩りでも DB スキーマ上は trap/bait の id 列が必須なので、
          // ツール識別子をそのまま入れて互換を保つ（罠スタイルとの衝突は huntType で識別）。
          trapItemId: tool.toolId,
          baitItemId: tool.toolId,
          status: "APPEARED",
          appearsAt: now,
          targetAnimalId: chosen.id,
          posX: 50,
          posY: 50,
        },
      });
    });

    revalidatePath("/kids/safari");

    const animal: AnimalLite = {
      id: chosen.id,
      animalId: chosen.animalId,
      name: chosen.name,
      genericName: chosen.genericName,
      specificName: chosen.specificName,
      emoji: chosen.emoji,
      rarity: chosen.rarity as AnimalLite["rarity"],
      description: chosen.description,
      imageUrl: chosen.imageUrl,
      isExtinct: chosen.isExtinct,
    };

    return {
      success: true,
      hunt: {
        id: created.id,
        userId: created.userId,
        huntType: created.huntType as "BOW" | "SPEAR" | "WEAPON",
        toolId: tool.id,
        toolName: tool.name,
        toolEmoji: tool.emoji,
        status: "APPEARED",
        placedAt: created.placedAt.toISOString(),
        appearsAt: created.appearsAt.toISOString(),
        targetAnimal: animal,
        // 道具の successRateBonus を「スイートスポット幅」として UI に渡す（0.05〜0.45）
        sweetSpotWidth: Math.max(0.05, Math.min(0.45, 0.1 + tool.successRateBonus)),
      },
      updatedInventory: undefined,  // BOW/SPEAR/WEAPON は非消耗
      stamina: {
        used: staminaBefore.used + 1,
        remaining: Math.max(0, staminaBefore.remaining - 1),
        limit: HUNT_DAILY_LIMIT,
        lastHuntDate: now.toISOString(),
      },
    };
  } catch (err) {
    if (err instanceof Error && err.message === "OUT_OF_STAMINA") {
      const fresh = await _readStaminaWithReset(userId);
      return { success: false, error: "きょうの かりは もう おわり！", stamina: fresh };
    }
    if (err instanceof Error && err.message === "OUT_OF_MATERIAL") {
      return { success: false, error: "素材が たりません" };
    }
    console.error("startActiveHunt failed:", err);
    return { success: false, error: "狩りの開始に失敗しました" };
  }
}

// アクティブ狩りの結果。resolveTrap と同じ shape を流用するため alias。
export type ResolveActiveHuntResult = ResolveTrapResult;

export async function resolveActiveHunt(
  huntId: string,
  precision: number, // 0.0〜1.0
): Promise<ResolveActiveHuntResult> {
  // 命中精度 → 成功/失敗
  // 0.65 以上で命中扱い。失敗時も resolveTrap と同じく ESCAPED 経路で記録。
  const isHit = precision >= 0.65;
  return resolveTrap(huntId, isHit);
}

// ─────────────────────────────────────────────
// クラフト：BOM レシピに従い素材を消費して完成品を産む。
// すべて prisma.$transaction で完全アトミック。
// ─────────────────────────────────────────────

export type CraftResult =
  | {
      success: true;
      product: {
        toolId: string;
        toolName: string;
        toolType: "TRAP" | "BOW" | "SPEAR" | "WEAPON";
        // クラフト後のこの道具のユーザー所持数（楽観的更新で利用）
        totalQuantity: number;
      };
      // 消費後の素材の最新数量（materialId → quantity）
      updatedMaterials: Array<{ materialId: string; quantity: number }>;
    }
  | { success: false; error: string };

// userId を受け取り、そのユーザーの UserMaterial を消費して UserTool を産む。
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

  // 素材マスタ（materialId 文字列 → DB id）を取得
  const materialMasters = await prisma.material.findMany({
    where: { materialId: { in: recipe.materials.map((m) => m.materialId) } },
  });
  const masterByMaterialId = new Map(materialMasters.map((m) => [m.materialId, m]));

  // ユーザーの素材在庫を取得
  const userMaterials = await prisma.userMaterial.findMany({
    where: {
      userId,
      materialId: { in: materialMasters.map((m) => m.id) },
    },
  });
  const haveMap = new Map(userMaterials.map((um) => [um.materialId, um.quantity]));

  // 事前チェック：在庫が足りるか（早期 return でユーザに親切な文言を返す）。
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

  // 完成道具の DB レコードを取得
  const toolRecord = await prisma.tool.findUnique({
    where: { toolId: recipe.resultToolId },
  });
  if (!toolRecord) {
    return { success: false, error: "どうぐの データが みつかりません（シードを確認してね）" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 全素材を条件付き updateMany で減らす。1つでも条件不一致なら全 rollback。
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
        if (upd.count !== 1) {
          throw new Error(`OUT_OF_${need.materialId}`);
        }
      }

      // 完成道具を UserTool に upsert（既にあれば increment）。
      const userTool = await tx.userTool.upsert({
        where: { userId_toolId: { userId, toolId: toolRecord.id } },
        update: { quantity: { increment: recipe.resultQuantity } },
        create: { userId, toolId: toolRecord.id, quantity: recipe.resultQuantity },
      });

      // 消費後の素材量を返す（楽観的更新用）。
      const updatedMaterials = await tx.userMaterial.findMany({
        where: { userId, materialId: { in: materialMasters.map((m) => m.id) } },
      });

      return { userTool, updatedMaterials };
    });

    revalidatePath(`/kids`);

    // materialId DB id → materialId 文字列 に変換して返す
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

// ─────────────────────────────────────────────
// 特大達成ボーナス通知（祝賀演出用）の読み出し / 既読化。
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// クラフト画面用：ユーザーの素材・道具在庫を取得するサーバーアクション。
// ─────────────────────────────────────────────

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
// ペナルティ通知（子供側）。
// 親がペナルティを実行した際に生成された未読通知を取得・既読化する。
// ─────────────────────────────────────────────

export type PenaltyNotificationDTO = {
  id: string;
  userId: string;
  reason: string;
  coinAmount: number;
  createdAt: string; // ISO
};

export async function getUnreadPenaltyNotifications(
  userId?: string,
): Promise<PenaltyNotificationDTO[]> {
  const rows = await prisma.penaltyNotification.findMany({
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

export async function markPenaltyRead(
  notificationId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.penaltyNotification.updateMany({
      where: { id: notificationId, isRead: false },
      data: { isRead: true },
    });
    revalidatePath("/kids");
    revalidatePath("/bank");
    return { success: true };
  } catch (err) {
    console.error("markPenaltyRead failed:", err);
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
// クレーンゲーム：コイン消費 → 素材（UserMaterial）ドロップ → 履歴記録。
// 完成品（Tool）は絶対に落ちない。素材を集めてクラフトで作る仕組み。
// ─────────────────────────────────────────────

type MaterialPoolEntry = {
  materialId: string;
  materialName: string;
  emoji: string;
  weight: number;
};

const CRANE_MATERIAL_POOL: MaterialPoolEntry[] = [
  { materialId: "wood_branch", materialName: "きのえだ",         emoji: "🪵", weight: 30 },
  { materialId: "stone",       materialName: "いし",             emoji: "🪨", weight: 28 },
  { materialId: "sturdy_rope", materialName: "じょうぶな イト", emoji: "🪢", weight: 22 },
  { materialId: "iron_shard",  materialName: "てつの かけら",   emoji: "⚙️", weight: 14 },
  { materialId: "gunpowder",   materialName: "かやく",           emoji: "💥", weight: 6  },
];

function drawCraneMaterial(): MaterialPoolEntry {
  const total = CRANE_MATERIAL_POOL.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of CRANE_MATERIAL_POOL) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return CRANE_MATERIAL_POOL[CRANE_MATERIAL_POOL.length - 1];
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

// クレーン結果：捕獲成功なら各素材の totalQuantity に在庫数、失敗（途中で落とす）
// なら UserMaterial は更新せず、prize 情報だけ返す（演出用）。
// 1 プレイで 1〜3 個取れる可能性があり、同じ materialId が複数回当たった場合は
// items[] 内で count で集約して返す。
// クライアントは「アニメーションを全部走らせた最終結果」を didCatch に乗せて呼ぶ。
export type CranePrizeItem = {
  materialId: string;
  materialName: string;
  emoji: string;
  // この回で取れた（または落とした）個数
  count: number;
  // didCatch=false なら null。didCatch=true ならその素材のユーザー在庫合計。
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
    select: { id: true, role: true, coinBalance: true, isTestAccount: true },
  });

  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが見つかりません" };
  }
  // テストユーザーはコイン無制限
  if (!user.isTestAccount && user.coinBalance < CRANE_COST) {
    return {
      success: false,
      error: `コインが足りません（${CRANE_COST} ひつよう / いま ${user.coinBalance}）`,
    };
  }

  // 抽選：個数 → 個数ぶん独立に素材を引く → materialId で集約。
  const prizeCount = drawCranePrizeCount();
  const drawnPrizes: MaterialPoolEntry[] = [];
  for (let i = 0; i < prizeCount; i++) drawnPrizes.push(drawCraneMaterial());

  type AggregatedMat = { entry: MaterialPoolEntry; count: number };
  const aggregated = new Map<string, AggregatedMat>();
  for (const p of drawnPrizes) {
    const existing = aggregated.get(p.materialId);
    if (existing) existing.count += 1;
    else aggregated.set(p.materialId, { entry: p, count: 1 });
  }
  const aggregatedList = Array.from(aggregated.values());

  // 履歴の reason 用ラベル：「きのえだ x2 + いし」のような形にする。
  const reasonLabel = aggregatedList
    .map((a) => (a.count > 1 ? `${a.entry.materialName} x${a.count}` : a.entry.materialName))
    .join(" + ");

  try {
    const result = await prisma.$transaction(async (tx) => {
      // テストユーザーはコイン消費なし
      if (!user.isTestAccount) {
        const updated = await tx.user.updateMany({
          where: { id: userId, coinBalance: { gte: CRANE_COST } },
          data: { coinBalance: { decrement: CRANE_COST } },
        });
        if (updated.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
      }

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

      // didCatch=true なら、集約済みエントリごとに UserMaterial を増やす + ガチャ履歴を残す。
      // didCatch=false の時は在庫変動なし。totalQuantity は null。
      const items: CranePrizeItem[] = [];
      for (const { entry, count } of aggregatedList) {
        let totalQuantity: number | null = null;
        if (didCatch) {
          // Material マスタを取得（materialId 文字列 → DB id）
          const matMaster = await tx.material.findUnique({
            where: { materialId: entry.materialId },
          });
          if (matMaster) {
            const row = await tx.userMaterial.upsert({
              where: { userId_materialId: { userId, materialId: matMaster.id } },
              update: { quantity: { increment: count } },
              create: { userId, materialId: matMaster.id, quantity: count },
            });
            totalQuantity = row.quantity;
          }

          // ガチャ履歴（MATERIAL タイプで記録）
          await tx.gachaTransaction.create({
            data: {
              userId,
              costAmount: CRANE_COST,
              itemId: entry.materialId,
              itemName: count > 1 ? `${entry.emoji} ${entry.materialName} x${count}` : `${entry.emoji} ${entry.materialName}`,
              itemType: "MATERIAL",
            },
          });
        }
        items.push({
          materialId: entry.materialId,
          materialName: entry.materialName,
          emoji: entry.emoji,
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

// ─────────────────────────────────────────────
// レース ベット / 報酬
// betOnRace  : レース開始時にコインを消費する（トランザクション安全）
// claimRaceReward : 勝利時に報酬コインを付与する
// ─────────────────────────────────────────────

export async function betOnRace(
  userId: string,
  amount: number,
): Promise<
  | { success: true; newCoinBalance: number }
  | { success: false; error: string }
> {
  if (amount <= 0) return { success: false, error: "ベット額が ただしくありません" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, coinBalance: true, isTestAccount: true },
  });
  if (!user) return { success: false, error: "ユーザーが みつかりません" };

  if (!user.isTestAccount && user.coinBalance < amount) {
    return {
      success: false,
      error: `コインが たりません（もってる: ${user.coinBalance} / ひつよう: ${amount}）`,
    };
  }

  try {
    const fresh = await prisma.$transaction(async (tx) => {
      if (!user.isTestAccount) {
        const result = await tx.user.updateMany({
          where: { id: userId, coinBalance: { gte: amount } },
          data: { coinBalance: { decrement: amount } },
        });
        if (result.count !== 1) throw new Error("INSUFFICIENT_COINS");
      }
      await tx.coinTransaction.create({
        data: { userId, amount: -amount, kind: "GACHA", reason: `レース ベット ${amount}コイン` },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { coinBalance: true },
      });
    });

    revalidatePath("/kids");
    revalidatePath("/bank");
    return { success: true, newCoinBalance: fresh.coinBalance };
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_COINS") {
      return { success: false, error: "コインが たりません（だれかに さきを こされた？）" };
    }
    console.error("betOnRace failed:", err);
    return { success: false, error: "ベット しっぱい。もう一度 やってみてね" };
  }
}

export async function claimRaceReward(
  userId: string,
  amount: number,
): Promise<
  | { success: true; newCoinBalance: number }
  | { success: false; error: string }
> {
  if (amount <= 0) return { success: false, error: "ほうしゅう額が ただしくありません" };

  try {
    const fresh = await prisma.$transaction(async (tx) => {
      await tx.coinTransaction.create({
        data: { userId, amount, kind: "BONUS", reason: `レース よそうてき中！ +${amount}コイン` },
      });
      return tx.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: amount } },
        select: { coinBalance: true },
      });
    });

    revalidatePath("/kids");
    revalidatePath("/bank");
    return { success: true, newCoinBalance: fresh.coinBalance };
  } catch (err) {
    console.error("claimRaceReward failed:", err);
    return { success: false, error: "ほうしゅうの うけとりに しっぱいしました" };
  }
}
