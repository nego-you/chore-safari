"use client";

// SafariLayoutShell -- layout.tsx から呼ばれるクライアントラッパー。
// WeatherProvider + GuideProvider を提供し、GlobalHeader + {children} を縦積みで表示する。

import { useEffect } from "react";
import { WeatherProvider } from "./WeatherContext";
import { GuideProvider } from "./GuideContext";
import type { GuideInfo } from "./GuideContext";
import { GlobalHeader } from "./GlobalHeader";
import { useSafariStore } from "@/store/useSafariStore";
import { KizunaManager } from "@/components/KizunaManager";
import { BGMPlayer } from "@/components/BGMPlayer";
import { saveInventory, type InventoryMap } from "@/features/inventory/actions";

// DB -> Store ブリッジ（ロード時に DB 値でハイドレート）。
//   coins は毎回 DB 値で上書き。inventory はセッション初回 or kid 変更時のみ採用。
function StoreInitializer({
  kidId,
  coinBalance,
  initialInventory,
}: {
  kidId: string;
  coinBalance: number;
  initialInventory: InventoryMap;
}) {
  const hydrateFromServer = useSafariStore((s) => s.hydrateFromServer);
  useEffect(() => {
    hydrateFromServer(kidId, coinBalance, initialInventory);
    // initialInventory はオブジェクト参照が毎回変わるため依存に含めない（kidId/coinBalance で十分）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId, coinBalance]);
  return null;
}

// Store -> DB ブリッジ（インベントリのスナップショット同期）。
//   レイアウトに常駐するので子ページ遷移をまたいで購読が継続する。
//   単一書き手のため last-write-wins で安全。ハイドレート前は保存しない。
function InventorySync({ kidId }: { kidId: string }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastJson = JSON.stringify(useSafariStore.getState().inventory);

    const flush = () => {
      const st = useSafariStore.getState();
      if (!st._hydrated || st.activeKidId !== kidId) return;
      const json = JSON.stringify(st.inventory);
      if (json === lastJson) return;
      lastJson = json;
      void saveInventory(kidId, st.inventory);
    };

    const unsub = useSafariStore.subscribe((state, prev) => {
      if (state.inventory === prev.inventory) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 800);
    });

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        if (timer) clearTimeout(timer);
        flush();
      }
    };
    const onPageHide = () => {
      if (timer) clearTimeout(timer);
      flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      if (timer) clearTimeout(timer);
      flush();
    };
  }, [kidId]);
  return null;
}

type Props = {
  kidId: string;
  kidName: string;
  coinBalance: number;
  initialInventory: InventoryMap;
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
  initialInventory,
  currentStreak,
  longestStreak,
  streakStatus,
  initialGuide,
  children,
}: Props) {
  return (
    <WeatherProvider>
      <GuideProvider initialGuide={initialGuide}>
        <StoreInitializer kidId={kidId} coinBalance={coinBalance} initialInventory={initialInventory} />
        <InventorySync kidId={kidId} />
        <GlobalHeader
          kidId={kidId}
          kidName={kidName}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          streakStatus={streakStatus}
        />
        {children}
        <KizunaManager />
        <BGMPlayer />
      </GuideProvider>
    </WeatherProvider>
  );
}
