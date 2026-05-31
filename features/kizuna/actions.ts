"use server";

// features/kizuna/actions.ts
// 「おたがいさま（恩送り）」の進捗を DB(User) に永続化する。
//   書き手は子供本人のみ（単一書き手）なので、在庫と同じくスナップショット同期で運用する。
//   ロード時に getKizuna でハイドレート、変更後は debounce で saveKizuna。

import { prisma } from "@/lib/prisma";

export type KizunaState = {
  kizunaPoints: number;
  kindnessCount: number;
  pendingReturns: number;
  kizunaBadgeCount: number;
  kizunaPlanDate: string | null;
  kizunaPlanKind: "ask" | "return" | "none" | null;
  kizunaFiredDate: string | null;
};

export async function getKizuna(kidId: string): Promise<KizunaState> {
  const u = await prisma.user.findUnique({
    where: { id: kidId },
    select: {
      kizunaPoints: true,
      kindnessCount: true,
      pendingReturns: true,
      kizunaBadgeCount: true,
      kizunaPlanDate: true,
      kizunaPlanKind: true,
      kizunaFiredDate: true,
    },
  });
  return {
    kizunaPoints: u?.kizunaPoints ?? 0,
    kindnessCount: u?.kindnessCount ?? 0,
    pendingReturns: u?.pendingReturns ?? 0,
    kizunaBadgeCount: u?.kizunaBadgeCount ?? 0,
    kizunaPlanDate: u?.kizunaPlanDate ?? null,
    kizunaPlanKind: (u?.kizunaPlanKind as KizunaState["kizunaPlanKind"]) ?? null,
    kizunaFiredDate: u?.kizunaFiredDate ?? null,
  };
}

export async function saveKizuna(
  kidId: string,
  k: KizunaState,
): Promise<{ success: boolean }> {
  try {
    await prisma.user.update({
      where: { id: kidId },
      data: {
        kizunaPoints: Math.max(0, Math.trunc(k.kizunaPoints) || 0),
        kindnessCount: Math.max(0, Math.trunc(k.kindnessCount) || 0),
        pendingReturns: Math.max(0, Math.trunc(k.pendingReturns) || 0),
        kizunaBadgeCount: Math.max(0, Math.trunc(k.kizunaBadgeCount) || 0),
        kizunaPlanDate: k.kizunaPlanDate,
        kizunaPlanKind: k.kizunaPlanKind,
        kizunaFiredDate: k.kizunaFiredDate,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[saveKizuna] failed:", err);
    return { success: false };
  }
}
