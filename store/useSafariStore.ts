"use client";
// store/useSafariStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// お手伝いサファリ グローバルストア（Zustand + persist）
//
// 使い方:
//   import { useSafariStore } from "@/store/useSafariStore";
//   const coins = useSafariStore((s) => s.coins);
//   const addCoins = useSafariStore((s) => s.addCoins);
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GameAnimal, InventoryMap, Medal, ShipResult } from "@/types/safari";

// ─────────────────────────────────────────────────────────────────────────────
// 勲章マスター定義（達成条件を判定するためにストア内で参照）
// ─────────────────────────────────────────────────────────────────────────────
const MEDAL_DEFS: Array<{
  id: string;
  emoji: string;
  name: string;
  check: (s: SafariState) => boolean;
}> = [
  {
    id: "first",
    emoji: "🥉",
    name: "はじめての おてつだい",
    check: (s) => s._stats.helpCount >= 1,
  },
  {
    id: "farm",
    emoji: "🥈",
    name: "ファーム・マスター",
    check: (s) => s._stats.totalAnimalsCaught >= 10,
  },
  {
    id: "hunter",
    emoji: "🥇",
    name: "でんせつの ハンター",
    check: (s) => s._stats.legendaryCaught >= 1,
  },
  {
    id: "logistics",
    emoji: "🏆",
    name: "ぶつりゅう の ほし",
    check: (s) => s._stats.totalShipped >= 20,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// コイン報酬テーブル
// ─────────────────────────────────────────────────────────────────────────────
const RARITY_COIN: Record<GameAnimal["rarity"], number> = {
  ふつう: 10,
  レア: 30,
  でんせつ: 100,
};

// ─────────────────────────────────────────────────────────────────────────────
// State 型
// ─────────────────────────────────────────────────────────────────────────────
export interface SafariState {
  // ── 公開ステート ─────────────────────────────────────────
  /** コイン残高（ゲーム経済圏） */
  coins: number;
  /** インベントリ: { wood: 5, tomato: 2, ... } */
  inventory: InventoryMap;
  /** 裏庭に一時保護されている動物 */
  animalsInYard: GameAnimal[];
  /** 物流センターで待機中・積載中の動物 */
  logisticsQueue: GameAnimal[];
  /** 現在の体力 (0–100) */
  stamina: number;
  /** 獲得済み勲章リスト */
  medals: Medal[];

  // ── 内部統計（勲章判定用）────────────────────────────────
  /** @internal */
  _stats: {
    helpCount: number;
    totalAnimalsCaught: number;
    legendaryCaught: number;
    totalShipped: number;
  };

  // ── アクション ───────────────────────────────────────────

  /** サーバー DB の coinBalance でストアを初期化（ページロード時に一度だけ呼ぶ） */
  initCoins: (amount: number) => void;

  /** コインを増やす */
  addCoins: (amount: number) => void;
  /** コインを使う。残高不足なら false を返して消費しない */
  spendCoins: (amount: number) => boolean;

  /** インベントリにアイテムを追加（農場・クラフトなどから呼ぶ） */
  addToInventory: (item: string, count: number) => void;
  /** インベントリを消費。不足なら false を返して消費しない */
  consumeInventory: (item: string, count: number) => boolean;

  /**
   * 狩りで動物を捕まえ、裏庭（animalsInYard）に追加する。
   * 同種がすでにいれば count をインクリメント。
   */
  catchAnimal: (animal: Omit<GameAnimal, "id" | "count">) => void;

  /** 裏庭の動物を物流センター（logisticsQueue）へ送る */
  sendToLogistics: (animalId: string) => void;

  /**
   * トラックを出発させ、報酬コイン・勲章を獲得してキューを空にする。
   * 結果オブジェクトを返す（アニメーション表示に使う）。
   */
  shipTruck: () => ShipResult;

  /** 自分の家で休んで体力を全回復する */
  recoverStamina: () => void;
  /** スタミナを指定量消費する（0 未満にはならない） */
  consumeStamina: (amount: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ストア本体
// ─────────────────────────────────────────────────────────────────────────────
export const useSafariStore = create<SafariState>()(
  persist(
    (set, get) => ({
      // ── 初期値 ────────────────────────────────────────────
      coins: 0,
      inventory: {},
      animalsInYard: [],
      logisticsQueue: [],
      stamina: 100,
      medals: [],
      _stats: {
        helpCount: 0,
        totalAnimalsCaught: 0,
        legendaryCaught: 0,
        totalShipped: 0,
      },

      // ── コイン ────────────────────────────────────────────
      initCoins: (amount) =>
        set((s) => ({
          // ストアにまだ保存値がなければ DB 値で上書き。
          // localStorage に保存済みの場合はゲーム内の増減を維持する。
          coins: s.coins === 0 ? amount : s.coins,
        })),

      addCoins: (amount) =>
        set((s) => ({ coins: s.coins + amount })),

      spendCoins: (amount) => {
        const { coins } = get();
        if (coins < amount) return false;
        set({ coins: coins - amount });
        return true;
      },

      // ── インベントリ ──────────────────────────────────────
      addToInventory: (item, count) =>
        set((s) => ({
          inventory: {
            ...s.inventory,
            [item]: (s.inventory[item] ?? 0) + count,
          },
        })),

      consumeInventory: (item, count) => {
        const current = get().inventory[item] ?? 0;
        if (current < count) return false;
        set((s) => ({
          inventory: {
            ...s.inventory,
            [item]: s.inventory[item] - count,
          },
        }));
        return true;
      },

      // ── 動物 ──────────────────────────────────────────────
      catchAnimal: (animalTemplate) => {
        const id = `${animalTemplate.name}-${Date.now()}`;
        set((s) => {
          const existing = s.animalsInYard.find(
            (a) => a.name === animalTemplate.name && a.rarity === animalTemplate.rarity
          );
          const nextYard = existing
            ? s.animalsInYard.map((a) =>
                a.id === existing.id ? { ...a, count: a.count + 1 } : a
              )
            : [...s.animalsInYard, { ...animalTemplate, id, count: 1 }];

          const nextStats = {
            ...s._stats,
            helpCount: s._stats.helpCount + 1,
            totalAnimalsCaught: s._stats.totalAnimalsCaught + 1,
            legendaryCaught:
              animalTemplate.rarity === "でんせつ"
                ? s._stats.legendaryCaught + 1
                : s._stats.legendaryCaught,
          };

          return { animalsInYard: nextYard, _stats: nextStats };
        });
        // 勲章判定は catch の後に副作用として行う
        _checkAndUnlockMedals(get, set);
      },

      sendToLogistics: (animalId) =>
        set((s) => {
          const target = s.animalsInYard.find((a) => a.id === animalId);
          if (!target) return s;
          return {
            animalsInYard: s.animalsInYard.filter((a) => a.id !== animalId),
            logisticsQueue: [...s.logisticsQueue, target],
          };
        }),

      shipTruck: () => {
        const { logisticsQueue, _stats } = get();
        if (logisticsQueue.length === 0) return { earnedCoins: 0, newMedals: [] };

        // 報酬コイン計算: レアリティ × 匹数
        const earnedCoins = logisticsQueue.reduce(
          (sum, a) => sum + RARITY_COIN[a.rarity] * a.count,
          0
        );
        const totalShipped = logisticsQueue.reduce((sum, a) => sum + a.count, 0);

        const nextStats = {
          ..._stats,
          totalShipped: _stats.totalShipped + totalShipped,
        };

        set((s) => ({
          coins: s.coins + earnedCoins,
          logisticsQueue: [],
          _stats: nextStats,
        }));

        // 勲章判定
        const newMedals = _checkAndUnlockMedals(get, set);
        return { earnedCoins, newMedals };
      },

      // ── スタミナ ──────────────────────────────────────────
      recoverStamina: () => set({ stamina: 100 }),

      consumeStamina: (amount) =>
        set((s) => ({ stamina: Math.max(0, s.stamina - amount) })),
    }),

    // ── persist 設定 ────────────────────────────────────────
    {
      name: "safari-store", // localStorage キー名
      storage: createJSONStorage(() => localStorage),
      // 内部統計も含めて全フィールドを保存
      partialize: (s) => ({
        coins: s.coins,
        inventory: s.inventory,
        animalsInYard: s.animalsInYard,
        logisticsQueue: s.logisticsQueue,
        stamina: s.stamina,
        medals: s.medals,
        _stats: s._stats,
      }),
    }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// 内部ヘルパー：勲章のチェック & 解除
// ─────────────────────────────────────────────────────────────────────────────
function _checkAndUnlockMedals(
  get: () => SafariState,
  set: (partial: Partial<SafariState>) => void
): Medal[] {
  const state = get();
  const today = new Date().toLocaleDateString("ja-JP");
  const newMedals: Medal[] = [];

  const nextMedals = MEDAL_DEFS.reduce<Medal[]>((acc, def) => {
    const existing = state.medals.find((m) => m.id === def.id);
    if (existing) return [...acc, existing]; // 既取得はスキップ
    if (def.check(state)) {
      const unlocked: Medal = { id: def.id, emoji: def.emoji, name: def.name, unlockedAt: today };
      newMedals.push(unlocked);
      return [...acc, unlocked];
    }
    return [...acc, { id: def.id, emoji: def.emoji, name: def.name, unlockedAt: null }];
  }, []);

  if (newMedals.length > 0) {
    set({ medals: nextMedals });
  }
  return newMedals;
}
