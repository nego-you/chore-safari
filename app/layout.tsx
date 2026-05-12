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

export const metadata: Metadata = {
  title: "Chore Safari",
  description: "おてつだいで すすめる かぞくの ぼうけん",
};

// スマホ実機でタップ判定がズレないよう、viewport を明示する。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        touch-manipulation で iOS の 300ms タップ遅延と、active:scale 系で
        起きがちな「指が動いた扱いで click がキャンセル」現象を防止する。
      */}
      <body className="min-h-full flex flex-col touch-manipulation">{children}</body>
    </html>
  );
}
