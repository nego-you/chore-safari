"use client";

// SafariLayoutShell — layout.tsx から呼ばれるクライアントラッパー。
// WeatherProvider + GuideProvider を提供し、GlobalHeader + {children} を縦積みで表示する。

import { useEffect } from "react";
import { WeatherProvider } from "./WeatherContext";
import { GuideProvider } from "./GuideContext";
import type { GuideInfo } from "./GuideContext";
import { GlobalHeader } from "./GlobalHeader";
import { useSafariStore } from "@/store/useSafariStore";
import { KizunaManager } from "@/components/KizunaManager";

// DB -> Store ブリッジ
function StoreInitializer({ kidId, coinBalance }: { kidId: string; coinBalance: number }) {
  const resetForKid = useSafariStore((s) => s.resetForKid);
  useEffect(() => {
    resetForKid(kidId, coinBalance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId]);
  return null;
}

type Props = {
  kidId: string;
  kidName: string;
  coinBalance: number;
  currentStreak: number;
  longestStreak: number;
  streakStatus: string;
  initialGuide: GuideInfo;
  children: React.ReactNode;
};

export function SafariLayoutShell({
  kidId,
  kidName,
  coinBalance,
  currentStreak,
  longestStreak,
  streakStatus,
  initialGuide,
  children,
}: Props) {
  return (
    <WeatherProvider>
      <GuideProvider initialGuide={initialGuide}>
        <StoreInitializer kidId={kidId} coinBalance={coinBalance} />
        <GlobalHeader
          kidId={kidId}
          kidName={kidName}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          streakStatus={streakStatus}
        />
        {children}
        {/* どのステージでも「おたがいさま」イベントを発生させる */}
        <KizunaManager />
      </GuideProvider>
    </WeatherProvider>
  );
}
