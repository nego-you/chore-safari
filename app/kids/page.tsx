// 子供用ポータル (/kids)
// 「だれがあそぶ？」で子供を選び、その子のコインと共有インベントリを表示する。
// 親から送られた未読の特大達成ボーナス通知もまとめて取得して渡す。

import { prisma } from "@/lib/prisma";
import { KidsPortal } from "./KidsPortal";

export const dynamic = "force-dynamic";

export default async function KidsPage() {
  const [children, inventory, notifications] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CHILD" },
      orderBy: { birthDate: "asc" },
      select: { id: true, name: true, coinBalance: true },
    }),
    prisma.sharedInventoryItem.findMany({
      orderBy: [{ itemType: "asc" }, { itemName: "asc" }],
      select: {
        id: true,
        itemId: true,
        itemName: true,
        quantity: true,
        itemType: true,
      },
    }),
    // 全 CHILD の未読通知を取得。クライアントでログイン中の子の分だけフィルタする。
    prisma.specialBonusNotification.findMany({
      where: { isRead: false },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <KidsPortal
      children={children}
      inventory={inventory}
      initialNotifications={notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        reason: n.reason,
        coinAmount: n.coinAmount,
        createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}
