"use client";

// SafariLayoutShell — layout.tsx（サーバー）から呼ばれるクライアントラッパー。
// WeatherProvider を提供し、GlobalHeader + {children} を縦積みで表示する。
// GlobalHeader はスティッキー（sticky top-0）なので、
// 各ページコンテンツは自然な位置から開始される。

import { WeatherProvider } from "./WeatherContext";
import { GlobalHeader } from "./GlobalHeader";

type Props = {
  kidId: string;
  kidName: string;
  coinBalance: number;
  children: React.ReactNode;
};

export function SafariLayoutShell({
  kidId,
  kidName,
  coinBalance,
  children,
}: Props) {
  return (
    <WeatherProvider>
      <GlobalHeader kidId={kidId} kidName={kidName} coinBalance={coinBalance} />
      {children}
    </WeatherProvider>
  );
}
