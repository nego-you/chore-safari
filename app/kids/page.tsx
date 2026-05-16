// 子供用ポータルの入り口 (/kids)
// 「だれがあそぶ？」のピッカー画面を出すだけ。
// 子を選ぶと /kids/[kidId] へ遷移して、その子専用の画面が開く。
// 各子の URL は PWA の「ホーム画面に追加」で個別ショートカットとして使える想定。

import { prisma } from "@/lib/prisma";
import { KidsPortal } from "./KidsPortal";

export const dynamic = "force-dynamic";

export default async function KidsPage() {
  // ピッカーで子供カードを描画するのに必要な最小限のデータだけ取る。
  // 共有インベントリや通知はピッカーでは使わない（ホーム画面で取り直す）が、
  // KidsPortal の Props を満たすために空配列を渡しておく。
  const children = await prisma.user.findMany({
    where: { role: "CHILD" },
    orderBy: { birthDate: "asc" },
    select: { id: true, name: true, coinBalance: true },
  });

  return (
    <KidsPortal
      children={children}
      inventory={[]}
      initialSelectedId={null}
      initialNotifications={[]}
    />
  );
}
