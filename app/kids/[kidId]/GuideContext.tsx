"use client";

// app/kids/[kidId]/GuideContext.tsx
// ガイドキャラクター グローバルコンテキスト。
// WeatherContext と同パターンで、全画面でガイド情報を共有する。
//
//   - layout.tsx が DB から取得した initialGuide を GuideProvider に渡す
//   - GlobalHeader が useGuide() でガイドウィジェットを描画する
//   - BaseCampClient が setGuide() でガイド変更を即座にヘッダーへ反映する

import { createContext, useContext, useState } from "react";

// ── 型定義 ──────────────────────────────────────────────────────
export type GuideInfo = {
  id: string;           // CaughtAnimal.id
  animalName: string;   // animal.genericName
  emoji: string;
  intimacyScore: number;
} | null;

type GuideContextType = {
  guide: GuideInfo;
  setGuide: (g: GuideInfo) => void;
};

// ── Context ─────────────────────────────────────────────────────
const GuideContext = createContext<GuideContextType>({
  guide: null,
  setGuide: () => {},
});

// ── Provider ────────────────────────────────────────────────────
export function GuideProvider({
  initialGuide,
  children,
}: {
  initialGuide: GuideInfo;
  children: React.ReactNode;
}) {
  const [guide, setGuide] = useState<GuideInfo>(initialGuide);
  return (
    <GuideContext.Provider value={{ guide, setGuide }}>
      {children}
    </GuideContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────
export function useGuide(): GuideContextType {
  return useContext(GuideContext);
}
