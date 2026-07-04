"use server";

// features/notifications/actions.ts
// 特大ボーナス通知 / ペナルティ通知の読み出し・既読化。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// ── 型 ────────────────────────────────────────────────────────────────

export type BonusNotificationDTO = {
  id: string;
  userId: string;
  reason: string;
  coinAmount: number;
  createdAt: string; // ISO
};

export type PenaltyNotificationDTO = {
  id: string;
  userId: string;
  reason: string;
  coinAmount: number;
  createdAt: string; // ISO
};

// ── ボーナス通知 ────────────────────────────────────────────────────────

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

// ── ペナルティ通知 ──────────────────────────────────────────────────────

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
