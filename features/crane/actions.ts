"use server";

// features/crane/actions.ts
// クレーンゲーム：コインを消費してプレイする。DB ではコインの増減と履歴のみを確定する。
//   景品（素材）はクライアント側で抽選し、ゲーム内在庫（GameInventoryItem / Zustand）へ加算する。
//   ※ 旧 UserMaterial への書き込みは廃止（唯一の読み手だったレガシー craftItem を撤去したため）。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CRANE_COST } from "@/app/kids/config";

export type CraneResult =
  | { success: true; didCatch: boolean; newCoinBalance: number }
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
  if (!user.isTestAccount && user.coinBalance < CRANE_COST) {
    return {
      success: false,
      error: `コインが足りません（${CRANE_COST} ひつよう / いま ${user.coinBalance}）`,
    };
  }

  try {
    const fresh = await prisma.$transaction(async (tx) => {
      if (!user.isTestAccount) {
        const updated = await tx.user.updateMany({
          where: { id: userId, coinBalance: { gte: CRANE_COST } },
          data: { coinBalance: { decrement: CRANE_COST } },
        });
        if (updated.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
      }

      await tx.coinTransaction.create({
        data: { userId, amount: -CRANE_COST, kind: "GACHA", reason: "クレーンゲーム" },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { coinBalance: true },
      });
    });

    revalidatePath("/kids");
    revalidatePath("/bank");

    return { success: true, didCatch, newCoinBalance: fresh.coinBalance };
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return { success: false, error: "コインが足りません" };
    }
    console.error("playCraneGame failed:", err);
    return { success: false, error: "クレーンゲームに失敗しました。もう一度試してね" };
  }
}
