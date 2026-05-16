// /kids/[kidId] — その子供 専用のポータル画面（後で PWA ホーム画面に追加する想定）。
// 役割は /kids（ピッカー）から子を選択した後の画面と同じ。
// initialSelectedId を渡すことで KidsPortal がピッカーをスキップして直接表示する。

import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { prisma } from "@/lib/prisma";
import { KidsPortal } from "../KidsPortal";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

// ─── 子供 ID → 表示名・アイコン情報 ───────────────────────────
// DB の id（cuid）ではなく URL の kidId（slug）は実際には DB の id が入る。
// 名前ベースのマッピングは KID_SLUG_MAP で行う（名前→slug）。
const KID_ICON_MAP: Record<string, {
  displayName: string;
  slug: string;
  themeColor: string;
}> = {
  "美琴": { displayName: "みこと", slug: "mikoto", themeColor: "#ec4899" },
  "幸仁": { displayName: "ゆきひと", slug: "yukihito", themeColor: "#3b82f6" },
  "叶泰": { displayName: "かなた", slug: "kanata", themeColor: "#22c55e" },
};

// ─── kidId から子供情報を取得する共通ヘルパー ───────────────
async function getKidInfo(kidId: string) {
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { name: true },
  });
  if (!kid) return null;
  const info = KID_ICON_MAP[kid.name];
  const slug = info?.slug ?? "default";
  const displayName = info?.displayName ?? kid.name;
  const themeColor = info?.themeColor ?? "#10b981";
  const iconBase = info ? `/icons/icon-${slug}` : "/icons/icon-default";
  const appName = `サファリ（${displayName}）`;
  return { slug, displayName, themeColor, iconBase, appName };
}

// PWA テーマカラーを子供ごとに切り替える（Next.js 14+ Viewport API）
export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { kidId } = await params;
  const info = await getKidInfo(kidId);
  return {
    themeColor: info?.themeColor ?? "#10b981",
  };
}

// kidId（DB の cuid）から子供情報を取得してメタデータを生成する。
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { kidId } = await params;
  const info = await getKidInfo(kidId);

  if (!info) {
    return { title: "お手伝いサファリ" };
  }

  const { slug, iconBase, appName } = info;

  return {
    title: appName,
    description: "お手伝いをしてコインをもらい、サファリで動物を捕まえよう！",
    manifest: `/api/manifest?kid=${slug}`,
    appleWebApp: {
      capable: true,
      title: appName,
      statusBarStyle: "black-translucent",
    },
    icons: {
      apple: [
        { url: `${iconBase}-192.png`, sizes: "192x192", type: "image/png" },
        { url: `${iconBase}-512.png`, sizes: "512x512", type: "image/png" },
      ],
      icon: [
        { url: `${iconBase}-192.png`, sizes: "192x192", type: "image/png" },
        { url: `${iconBase}-512.png`, sizes: "512x512", type: "image/png" },
      ],
    },
    other: {
      // iOS 向け apple-touch-icon（apple-mobile-web-app-capable と組み合わせ）
      "apple-mobile-web-app-capable": "yes",
      "mobile-web-app-capable": "yes",
    },
  };
}

export default async function KidsHomePage({ params }: { params: Params }) {
  const { kidId } = await params;

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
    prisma.specialBonusNotification.findMany({
      where: { isRead: false },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // 存在しない kidId のときは 404。
  if (!children.some((c) => c.id === kidId)) {
    notFound();
  }

  return (
    <KidsPortal
      children={children}
      inventory={inventory}
      initialSelectedId={kidId}
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
