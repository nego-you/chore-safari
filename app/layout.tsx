import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// パステル基調のテーマカラー（manifest と揃える）。
const THEME_COLOR = "#fdf6e3";

export const metadata: Metadata = {
  title: {
    default: "Chore Safari",
    template: "%s · Chore Safari",
  },
  description: "おてつだいで すすめる かぞくの ぼうけん",
  applicationName: "Chore Safari",
  manifest: "/manifest.json",
  // iOS / iPadOS の「ホーム画面に追加」で URL バー無し起動するための指定。
  appleWebApp: {
    capable: true,
    title: "Safari",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    // 通常のファビコン／PWA icon
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS のホーム画面用（必ず PNG）
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

// スマホ実機でタップ判定がズレないよう、viewport を明示する。
// PWA 化に伴い、ノッチ込みで描画できるよう viewport-fit=cover も指定。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        touch-manipulation で iOS の 300ms タップ遅延と、active:scale 系で
        起きがちな「指が動いた扱いで click がキャンセル」現象を防止する。
        PWA らしい操作感のための user-select 等は globals.css 側で指定。
      */}
      <body className="min-h-full flex flex-col touch-manipulation">
        {children}
      </body>
    </html>
  );
}
