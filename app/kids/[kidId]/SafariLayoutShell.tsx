"use client";

// SafariLayoutShell — layout.tsx（サーバー）から呼ばれるクライアントラッパー。
// WeatherProvider を提供し、GlobalHeader + {children} を縦積みで表示する。
// GlobalHeader はスティッキー（sticky top-0）なので、
// 各ページコンテンツは自然な位置から開始される。
//
// ★ Zustand 統合:
//   <StoreInitializer> が DB の coinBalance をストアへ反映する。
//   ストアに保存済みの値（localStorage）がある場合はゲーム内の増減を維持する。

import { useEffect } from "react";
import { WeatherProvider } from "./WeatherContext";
import { GlobalHeader } from "./GlobalHeader";
import { useSafariStore } from "@/store/useSafariStore";

// ─── DB → Store ブリッジ ────────────────────────────────────────────────────
function StoreInitializer({ coinBalance }: { coinBalance: number }) {
  const initCoins = useSafariStore((s) => s.initCoins);
  useEffect(() => {
    initCoins(coinBalance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinBalance]);
  return null;
}

// ─── レイアウトシェル ────────────────────────────────────────────────────────
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
      {/* DB の初期コインをストアに注入 */}
      <StoreInitializer coinBalance={coinBalance} />
      <GlobalHeader kidId={kidId} kidName={kidName} />
      {children}
    </WeatherProvider>
  );
}
