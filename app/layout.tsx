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

const THEME_COLOR = "#fdf6e3";

export const metadata: Metadata = {
  title: {
    default: "Chore Safari",
    template: "%s · Chore Safari",
  },
  description: "おてつだいで すすめる かぞくの ぼうけん",
  applicationName: "Chore Safari",
  manifest: "/manifest.json",
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
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

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
      <body className="min-h-full touch-manipulation bg-stone-200">
        {/*
          スマホ(Pixel 9a など)では従来どおり max-w-md の「アプリカード」表示。
          iPad(md=768px〜)では幅制約を解放し、各ページが持つ自前の
          max-w / md: ブレークポイントが効くようにする。これまではこの
          wrapper が 448px に握り潰し、子ページの iPad 対応が無効化されていた。
        */}
        <div className="w-full max-w-md md:max-w-none mx-auto min-h-screen bg-white md:bg-transparent relative shadow-2xl md:shadow-none [transform:translateZ(0)]">
          {children}
        </div>
      </body>
    </html>
  );
}
