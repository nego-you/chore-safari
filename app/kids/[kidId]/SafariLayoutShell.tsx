"use client";

// SafariLayoutShell — layout.tsx（サーバー）から呼ばれるクライアントラッパー。
// WeatherProvider を提供し、GlobalHeader + {children} を縦積みで表示する。
// GlobalHeader はスティッキ���（sticky top-0）なので、
// 各ページコンテンツは自然な位置から開始される。
//
// ★ Zustand 統合:
//   <StoreInitializer> が DB の coinBalance をストアへ反映する。
//   ストアに保���済みの値（localStorage）があ��場合はゲーム内の増減を維持する。

import { useEffect } from "react";
import { WeatherProvider } from "./WeatherContext";
import { GlobalHeader } from "./GlobalHeader";
import { useSafariStore } from "@/store/useSafariStore";

// ─── DB → Store ブリッジ ────────────────���─────────────────��─────────────────
// kidId が変わったとき（ユーザー切り替え）はゲーム状態を全リセットして
// DB の coinBalance を適用する。同一 kidId の再訪問では既存データを��持する。
function StoreInitializer({ kidId, coinBalance }: { kidId: string; coinBalance: number }) {
  const resetForKid = useSafariStore((s) => s.resetForKid);
  useEffect(() => {
    resetForKid(kidId, coinBalance);
    // kidId が変わったときだけ実行（coinBalance の細かい変動は無視）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId]);
  return null;
}

// ─── レイアウトシェル ─────────────────────────��──────────────────────────────
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
      {/* ユーザー切り替えを検出し DB 値でストアを初期化 */}
      <StoreInitializer kidId={kidId} coinBalance={coinBalance} />
      <GlobalHeader kidId={kidId} kidName={kidName} />
      {children}
    </WeatherProvider>
  );
}
