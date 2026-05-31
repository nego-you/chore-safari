"use client";

// SafariLayoutShell -- layout.tsx から呼ばれるクライアントラッパー。
// WeatherProvider + GuideProvider を提供し、GlobalHeader + {children} を縦積みで表示する。

import { useEffect } from "react";
import { WeatherProvider } from "./WeatherContext";
import { GuideProvider } from "./GuideContext";
import type { GuideInfo } from "./GuideContext";
import { GlobalHeader } from "./GlobalHeader";
import { useSafariStore, type SafariState } from "@/store/useSafariStore";
import { KizunaManager } from "@/components/KizunaManager";
import { BGMPlayer } from "@/components/BGMPlayer";
import { saveInventory, type InventoryMap } from "@/features/inventory/actions";
import { saveKizuna, type KizunaState } from "@/features/kizuna/actions";

// ストアから DB に保存する Kizuna スライスを取り出す。
function pickKizuna(s: SafariState): KizunaState {
  return {
    kizunaPoints: s.kizunaPoints,
    kindnessCount: s.kindnessCount,
    pendingReturns: s.pendingReturns,
    kizunaBadgeCount: s.kizunaBadgeCount,
    kizunaPlanDate: s.kizunaPlanDate,
    kizunaPlanKind: s.kizunaPlanKind,
    kizunaFiredDate: s.kizunaFiredDate,
  };
}

// DB -> Store ブリッジ（ロード時に DB 値でハイドレート）。
//   coins は毎回 DB 値で上書き。inventory / kizuna はセッション初回 or kid 変更時のみ採用。
function StoreInitializer({
  kidId,
  coinBalance,
  initialInventory,
  initialKizuna,
}: {
  kidId: string;
  coinBalance: number;
  initialInventory: InventoryMap;
  initialKizuna: KizunaState;
}) {
  const hydrateFromServer = useSafariStore((s) => s.hydrateFromServer);
  useEffect(() => {
    hydrateFromServer(kidId, coinBalance, initialInventory, initialKizuna);
    // initial* はオブジェクト参照が毎回変わるため依存に含めない（kidId/coinBalance で十分）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId, coinBalance]);
  return null;
}

// Store -> DB ブリッジ（inventory / kizuna のスナップショット同期）。
//   レイアウトに常駐するので子ページ遷移をまたいで購読が継続する。
//   単一書き手のため last-write-wins で安全。ハイドレート前は保存しない。
function GameStateSync({ kidId }: { kidId: string }) {
  useEffect(() => {
    let invTimer: ReturnType<typeof setTimeout> | null = null;
    let kizTimer: ReturnType<typeof setTimeout> | null = null;
    let lastInv = JSON.stringify(useSafariStore.getState().inventory);
    let lastKiz = JSON.stringify(pickKizuna(useSafariStore.getState()));

    const flushInv = () => {
      const st = useSafariStore.getState();
      if (!st._hydrated || st.activeKidId !== kidId) return;
      const json = JSON.stringify(st.inventory);
      if (json === lastInv) return;
      lastInv = json;
      void saveInventory(kidId, st.inventory);
    };
    const flushKiz = () => {
      const st = useSafariStore.getState();
      if (!st._hydrated || st.activeKidId !== kidId) return;
      const k = pickKizuna(st);
      const json = JSON.stringify(k);
      if (json === lastKiz) return;
      lastKiz = json;
      void saveKizuna(kidId, k);
    };

    const unsub = useSafariStore.subscribe((state, prev) => {
      if (state.inventory !== prev.inventory) {
        if (invTimer) clearTimeout(invTimer);
        invTimer = setTimeout(flushInv, 800);
      }
      // kizuna フィールドのいずれかが変化したら保存
      if (
        state.kizunaPoints !== prev.kizunaPoints ||
        state.kindnessCount !== prev.kindnessCount ||
        state.pendingReturns !== prev.pendingReturns ||
        state.kizunaBadgeCount !== prev.kizunaBadgeCount ||
        state.kizunaPlanDate !== prev.kizunaPlanDate ||
        state.kizunaPlanKind !== prev.kizunaPlanKind ||
        state.kizunaFiredDate !== prev.kizunaFiredDate
      ) {
        if (kizTimer) clearTimeout(kizTimer);
        kizTimer = setTimeout(flushKiz, 800);
      }
    });

    const flushAll = () => {
      if (invTimer) clearTimeout(invTimer);
      if (kizTimer) clearTimeout(kizTimer);
      flushInv();
      flushKiz();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushAll);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushAll);
      flushAll();
    };
  }, [kidId]);
  return null;
}

type Props = {
  kidId: string;
  kidName: string;
  coinBalance: number;
  initialInventory: InventoryMap;
  initialKizuna: KizunaState;
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
  initialKizuna,
  currentStreak,
  longestStreak,
  streakStatus,
  initialGuide,
  children,
}: Props) {
  return (
    <WeatherProvider>
      <GuideProvider initialGuide={initialGuide}>
        <StoreInitializer
          kidId={kidId}
          coinBalance={coinBalance}
          initialInventory={initialInventory}
          initialKizuna={initialKizuna}
        />
        <GameStateSync kidId={kidId} />
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
