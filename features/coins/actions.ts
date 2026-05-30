"use server";

// features/coins/actions.ts
// コイン増減の汎用サーバアクション。
//   コインは「子供のゲーム」と「親の Bank 承認」の2人が書き手になるため、
//   必ず increment/decrement の増分演算で更新し、CoinTransaction を 1 トランザクションで残す。
//   スナップショット上書きは厳禁（親の付与を踏み潰すため）。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CoinTxKind } from "@prisma/client";

export type AdjustCoinsResult =
  | { success: true; newCoinBalance: number }
  | { success: false; error: string };

/**
 * 子供のコイン残高を amount だけ増減する（負の値で消費）。
 * 残高不足の減算は失敗を返す（テストアカウントはバイパス）。
 */
export async function adjustCoins(
  kidId: string,
  amount: number,
  kind: CoinTxKind,
  reason: string,
): Promise<AdjustCoinsResult> {
  if (!Number.isInteger(amount) || amount === 0) {
    return { success: false, error: "amount は 0 以外の整数で指定してください" };
  }

  const user = await prisma.user.findUnique({
    where: { id: kidId },
    select: { role: true, isTestAccount: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "対象ユーザーが見つかりません" };
  }

  try {
    const fresh = await prisma.$transaction(async (tx) => {
      if (amount < 0 && !user.isTestAccount) {
        // 残高が足りる時だけ条件付きで減算（同時実行の取りこぼし防止）
        const upd = await tx.user.updateMany({
          where: { id: kidId, coinBalance: { gte: -amount } },
          data: { coinBalance: { increment: amount } },
        });
        if (upd.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
      } else {
        await tx.user.update({
          where: { id: kidId },
          data: { coinBalance: { increment: amount } },
        });
      }

      await tx.coinTransaction.create({
        data: { userId: kidId, amount, kind, reason },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: kidId },
        select: { coinBalance: true },
      });
    });

    revalidatePath("/kids");
    revalidatePath("/bank");

    return { success: true, newCoinBalance: fresh.coinBalance };
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return { success: false, error: "コインが足りません" };
    }
    console.error("[adjustCoins] failed:", err);
    return { success: false, error: "コイン操作に失敗しました" };
  }
}
