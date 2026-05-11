// 子供用ポータル (/kids)
// 「だれがあそぶ？」で子供を選び、その子のコインと共有インベントリを表示する。
// クライアントで選択状態を持つので、サーバではデータだけ用意して渡す。

import { prisma } from "@/lib/prisma";
import { KidsPortal } from "./KidsPortal";

export const dynamic = "force-dynamic";

export default async function KidsPage() {
  const [children, inventory] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CHILD" },
      orderBy: { birthDate: "asc" }, // 年上から表示
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
  ]);

  return <KidsPortal children={children} inventory={inventory} />;
}
