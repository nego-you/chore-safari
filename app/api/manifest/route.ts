// 動的 PWA マニフェスト生成 API。
// ?kid=mikoto / yukihito / kanata で子供ごとに name・icon を切り替える。
// iOS Safari の「ホーム画面に追加」でも個別アイコン・アプリ名になる。

import { NextRequest, NextResponse } from "next/server";

// kid パラメータ → アプリ名・アイコンパスのマスタ
const KID_CONFIG: Record<
  string,
  { name: string; shortName: string; themeColor: string }
> = {
  mikoto: {
    name: "サファリ（みこと）",
    shortName: "みことのサファリ",
    themeColor: "#ec4899", // ピンク
  },
  yukihito: {
    name: "サファリ（ゆきひと）",
    shortName: "ゆきひとのサファリ",
    themeColor: "#3b82f6", // ブルー
  },
  kanata: {
    name: "サファリ（かなた）",
    shortName: "かなたのサファリ",
    themeColor: "#22c55e", // グリーン
  },
};

const DEFAULT_CONFIG = {
  name: "お手伝いサファリ",
  shortName: "おてつだいサファリ",
  themeColor: "#10b981",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kid = (searchParams.get("kid") ?? "").toLowerCase();

  const config = KID_CONFIG[kid] ?? DEFAULT_CONFIG;
  const iconBase = KID_CONFIG[kid] ? `/icons/icon-${kid}` : "/icons/icon-default";

  const manifest = {
    name: config.name,
    short_name: config.shortName,
    description: "お手伝いをしてコインをもらい、サファリで動物を捕まえよう！",
    start_url: kid && KID_CONFIG[kid] ? `/kids/${encodeURIComponent(kid)}` : "/kids",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: config.themeColor,
    orientation: "portrait",
    icons: [
      {
        src: `${iconBase}-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: `${iconBase}-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["games", "kids", "education"],
    lang: "ja",
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json",
      // PWA キャッシュを短め（子供ページが更新されても反映される）
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
