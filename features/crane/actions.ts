"use server";

// features/crane/actions.ts
// クレーンゲーム：コイン消費 → 素材（UserMaterial）ドロップ → 履歴記録。
// 完成品（Tool）は絶対に落ちない。素材を集めてクラフトで作る仕組み。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CRANE_COST } from "@/app/kids/config";

// ── 素材プール ──────────────────────────────────────────────────────────

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
function drawCranePrizeCount(): number {
  const r = Math.random();
  if (r < 0.05) return 3;
  if (r < 0.3) return 2;
  return 1;
}

// ── 型 ────────────────────────────────────────────────────────────────

export type CranePrizeItem = {
  materialId: string;
  materialName: string;
  emoji: string;
  count: number;
  /** didCatch=false なら null。didCatch=true ならその素材のユーザー在庫合計。 */
  totalQuantity: number | null;
};

export type CraneResult =
  | {
      success: true;
      didCatch: boolean;
      items: CranePrizeItem[];
      newCoinBalance: number;
    }
  | { success: false; error: string };

// ── メインアクション ────────────────────────────────────────────────────

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
  if (!user.isTestAccount && user.coinBalance < CRANE_COST) {
    return {
      success: false,
      error: `コインが足りません（${CRANE_COST} ひつよう / いま ${user.coinBalance}）`,
    };
  }

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

  const reasonLabel = aggregatedList
    .map((a) => (a.count > 1 ? `${a.entry.materialName} x${a.count}` : a.entry.materialName))
    .join(" + ");

  try {
    const result = await prisma.$transaction(async (tx) => {
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

      const items: CranePrizeItem[] = [];
      for (const { entry, count } of aggregatedList) {
        let totalQuantity: number | null = null;
        if (didCatch) {
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

          await tx.gachaTransaction.create({
            data: {
              userId,
              costAmount: CRANE_COST,
              itemId: entry.materialId,
              itemName:
                count > 1
                  ? `${entry.emoji} ${entry.materialName} x${count}`
                  : `${entry.emoji} ${entry.materialName}`,
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

      return { newCoinBalance: fresh.coinBalance, items };
    });

    revalidatePath("/kids");
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
