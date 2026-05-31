"use server";

// features/safari/actions.ts
// サファリ狩り：パッシブ罠モード + アクティブ狩り（弓/槍）モード。
//
// パッシブ罠:
//   setTrap         : 罠を仕掛ける（UserTool 消費 → Hunt PLACED 作成）
//   checkTrap       : appears_at を過ぎていれば APPEARED に遷移
//   resolveTrap     : タイミングゲームの結果で CAUGHT / ESCAPED を確定
//
// アクティブ狩り:
//   getHuntStamina    : 今日の残り回数を取得（JST 深夜0時リセット込み）
//   startActiveHunt   : スタミナを消費し Hunt(APPEARED) を即作成
//   resolveActiveHunt : 命中精度を渡して CAUGHT/ESCAPED を確定

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// ── 型 ────────────────────────────────────────────────────────────────

type AnimalLite = {
  id: string;
  animalId: string;
  name: string;
  genericName: string;
  specificName: string;
  emoji: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  description: string;
  imageUrl: string | null;
  isExtinct: boolean;
};

// ── 内部ユーティリティ ────────────────────────────────────────────────

const RARITY_WEIGHT: Record<"COMMON" | "RARE" | "EPIC" | "LEGENDARY", number> = {
  COMMON: 62,
  RARE: 22,
  EPIC: 12,
  LEGENDARY: 4,
};

const RARITY_WEIGHT_RARE_BAIT: Record<"COMMON" | "RARE" | "EPIC" | "LEGENDARY", number> = {
  COMMON: 30,
  RARE: 30,
  EPIC: 22,
  LEGENDARY: 18,
};

const SSR_ANIMAL_IDS = new Set([
  "tyrannosaurus",
  "hercules_beetle",
  "lion_king",
  "megalodon",
  "dragon_king",
]);

function pickAnimalByRarity<T extends { rarity: string; animalId: string }>(
  animals: T[],
  useRareBait = false,
): T {
  const weightTable = useRareBait ? RARITY_WEIGHT_RARE_BAIT : RARITY_WEIGHT;
  const eligible = animals.filter((a) => {
    const isSSR = SSR_ANIMAL_IDS.has(a.animalId);
    if (isSSR && !useRareBait) return false;
    return true;
  });
  const pool = eligible.length > 0 ? eligible : animals;
  const total = pool.reduce(
    (s, a) => s + (weightTable[a.rarity as keyof typeof weightTable] ?? 1),
    0,
  );
  let r = Math.random() * total;
  for (const a of pool) {
    r -= weightTable[a.rarity as keyof typeof weightTable] ?? 1;
    if (r <= 0) return a;
  }
  return pool[pool.length - 1];
}

const TRAP_WAIT_MIN_MS = 30_000;
const TRAP_WAIT_MAX_MS = 90_000;

function pickWaitMs(): number {
  return TRAP_WAIT_MIN_MS + Math.floor(Math.random() * (TRAP_WAIT_MAX_MS - TRAP_WAIT_MIN_MS));
}

const HUNT_DAILY_LIMIT = 3;

function todayJstString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ── HuntStamina ────────────────────────────────────────────────────────

export type HuntStaminaInfo = {
  used: number;
  remaining: number;
  limit: number;
  lastHuntDate: string | null;
};

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

// ── パッシブ罠 ─────────────────────────────────────────────────────────

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
        targetRarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
      };
      updatedInventory: Array<{ itemId: string; quantity: number }>;
    }
  | { success: false; error: string };

const RARE_TRAP_IDS = new Set(["cage_trap", "leghold", "hunter_net", "sturdy_trap"]);

export async function setTrap(
  userId: string,
  trapItemId: string,
  baitItemId: string,
  posX: number = 50,
  posY: number = 50,
): Promise<SetTrapResult> {
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

  const toolRecord = await prisma.tool.findUnique({ where: { toolId: trapItemId } });
  if (!toolRecord || toolRecord.type !== "TRAP") {
    return { success: false, error: "パッシブ罠が えらばれていません" };
  }

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

  const useRareBait = RARE_TRAP_IDS.has(trapItemId);
  const chosen = pickAnimalByRarity(animals, useRareBait);
  const appearsAt = new Date(Date.now() + pickWaitMs());

  try {
    const created = await prisma.$transaction(async (tx) => {
      const upd = await tx.userTool.updateMany({
        where: { userId, toolId: toolRecord.id, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (upd.count !== 1) throw new Error("OUT_OF_TRAP");

      return tx.hunt.create({
        data: {
          userId,
          huntType: "TRAP",
          trapItemId,
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
    const upd = await prisma.hunt.updateMany({
      where: { id: trapId, status: "PLACED" },
      data: { status: "APPEARED" },
    });
    if (upd.count === 1) {
      revalidatePath("/kids/[kidId]/safari", "page");
      return {
        success: true,
        status: "APPEARED",
        appearsAt: trap.appearsAt.toISOString(),
      };
    }
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
      animal: AnimalLite;
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
      const now = new Date();
      const lifespanDays = trap.targetAnimal.lifespanYears ?? 10;
      const expiresAt = new Date(now.getTime() + lifespanDays * 24 * 60 * 60 * 1000);

      const result = await prisma.$transaction(async (tx) => {
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
      revalidatePath("/kids/[kidId]/safari", "page");
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

// ── アクティブ狩り ─────────────────────────────────────────────────────

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
        targetAnimal: AnimalLite;
        sweetSpotWidth: number;
      };
      updatedInventory?: Array<{ itemId: string; quantity: number }>;
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

  const userTool = await prisma.userTool.findUnique({
    where: { userId_toolId: { userId, toolId: tool.id } },
  });
  if (!userTool || userTool.quantity < 1) {
    return { success: false, error: `${tool.name}を もっていません。クラフトで つくってね！` };
  }

  const animals = await prisma.animal.findMany({
    where: stageDbId ? { stageId: stageDbId } : undefined,
  });
  if (animals.length === 0) {
    return { success: false, error: "このステージに どうぶつが いません" };
  }

  const useRareBait = tool.successRateBonus >= 0.3;
  const chosen = pickAnimalByRarity(animals, useRareBait);
  const now = new Date();

  try {
    const created = await prisma.$transaction(async (tx) => {
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

      return tx.hunt.create({
        data: {
          userId,
          huntType: tool.type === "BOW" ? "BOW" : tool.type === "SPEAR" ? "SPEAR" : "WEAPON",
          toolId: tool.id,
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

    revalidatePath("/kids/[kidId]/safari", "page");

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
        sweetSpotWidth: Math.max(0.05, Math.min(0.45, 0.1 + tool.successRateBonus)),
      },
      updatedInventory: undefined,
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
    console.error("startActiveHunt failed:", err);
    return { success: false, error: "狩りの開始に失敗しました" };
  }
}

export type ResolveActiveHuntResult = ResolveTrapResult;

export async function resolveActiveHunt(
  huntId: string,
  precision: number,
): Promise<ResolveActiveHuntResult> {
  const isHit = precision >= 0.65;
  return resolveTrap(huntId, isHit);
}

// ─────────────────────────────────────────────────────────────────────────────
// アクティブ狩り(HuntClient)のクイズ捕獲を DB(CaughtAnimal) に記録する。
//   HuntClient はクイズ正解で動物を「ともだち」にする。これを図鑑へ永続化し、
//   図鑑・レース・倉庫など「DB を唯一のソース」とする他機能と整合させる。
//   animalSlug は Animal.animalId（HuntClient の ANIMALS[].id と一致させてある）。
// ─────────────────────────────────────────────────────────────────────────────
export type RecordHuntCatchResult =
  | { success: true; animalName: string; remaining: number }
  | { success: false; error: string; limitReached?: boolean };

export async function recordActiveHuntCatch(
  kidId: string,
  animalSlug: string,
): Promise<RecordHuntCatchResult> {
  try {
    const [kid, animal] = await Promise.all([
      prisma.user.findFirst({
        where: { id: kidId, role: "CHILD" },
        select: { id: true, isTestAccount: true },
      }),
      prisma.animal.findUnique({
        where: { animalId: animalSlug },
        select: { id: true, name: true, genericName: true, lifespanYears: true },
      }),
    ]);
    if (!kid) return { success: false, error: "ユーザーが見つかりません" };
    if (!animal) return { success: false, error: `どうぶつ(${animalSlug})が見つかりません` };

    // 1日の捕獲回数制限（アクティブ狩り）。新しい日なら _readStaminaWithReset がリセット書き込みする。
    const sta = await _readStaminaWithReset(kidId);
    if (!kid.isTestAccount && sta.remaining <= 0) {
      return { success: false, error: "きょうは もう つかまえられないよ。また あした！", limitReached: true };
    }

    const lifespanDays = animal.lifespanYears ?? 10;
    const expiresAt = new Date(Date.now() + lifespanDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    const remaining = await prisma.$transaction(async (tx) => {
      if (!kid.isTestAccount) {
        // 残り回数がある時だけ条件付きで消費（同時実行の取りこぼし防止）
        const upd = await tx.user.updateMany({
          where: { id: kidId, dailyHuntCount: { lt: HUNT_DAILY_LIMIT } },
          data: { dailyHuntCount: { increment: 1 }, lastHuntDate: now },
        });
        if (upd.count !== 1) throw new Error("OUT_OF_LIMIT");
      }
      await tx.caughtAnimal.create({
        data: { animalId: animal.id, caughtByUserId: kid.id, expiresAt, isAlive: true },
      });
      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: kidId },
        select: { dailyHuntCount: true },
      });
      return Math.max(0, HUNT_DAILY_LIMIT - Math.min(fresh.dailyHuntCount, HUNT_DAILY_LIMIT));
    });

    revalidatePath(`/kids/${kidId}/dictionary`);
    revalidatePath(`/kids/${kidId}/warehouse`);
    revalidatePath(`/kids/${kidId}/race`);

    return { success: true, animalName: animal.genericName || animal.name, remaining };
  } catch (err) {
    if (err instanceof Error && err.message === "OUT_OF_LIMIT") {
      return { success: false, error: "きょうは もう つかまえられないよ。また あした！", limitReached: true };
    }
    console.error("recordActiveHuntCatch failed:", err);
    return { success: false, error: "捕獲の記録に失敗しました" };
  }
}
