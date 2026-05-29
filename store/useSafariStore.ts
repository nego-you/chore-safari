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
  /** 現在プレイ中の kidId。ユーザー切り替え検出に使う */
  activeKidId: string | null;
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

  // ── おたがいさま（善意の手助け）イベント ────────────────
  /** 非公開の善行ポイント（だれかを助けるたびに加算） */
  kizunaPoints: number;
  /** これまでに善意で手助けした回数（累計） */
  kindnessCount: number;
  /**
   * まだ返ってきていない「お返し手助け」の残数。
   * 手助けするたびに +1、お返しを受け取るたびに -1。
   * この数だけ、あとで だれかが助けに来てくれる（助けた回数に応じる）。
   */
  pendingReturns: number;
  /** 絆の証（特別トロフィーアイテム）の所持数 ＝ 受け取ったお返しの累計 */
  kizunaBadgeCount: number;
  /**
   * 最後に絆イベント（お願い／お返し）を表示・評価した日付（"YYY/M/D"）。
   * 1日に1回までに制限するためのゲート。
   */
  lastKizunaDate: string | null;

  // ── 内部統計（勲章判定用）────────────────────────────────
  /** @internal */
  _stats: {
    helpCount: number;
    totalAnimalsCaught: number;
    legendaryCaught: number;
    totalShipped: number;
  };

  // ── アクション ───────────────────────────────────────────

  /**
   * ユーザー切り替え時に呼ぶ。
   * activeKidId が変わっていれば全ゲーム状態をリセットして DB 値を適用する。
   * 同一ユーザーの再訪問（同 kidId）ではリセットしない。
   */
  resetForKid: (kidId: string, coinBalance: number) => void;

  /** サーバー DB の coinBalance でストアを初期化（ページロード時に一度だけ呼ぶ） */
  initCoins: (amount: number) => void;

  /** サーバーレスポンスの newCoinBalance でコインを直接上書きする（クレーン等） */
  syncCoins: (amount: number) => void;

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
  /** スタミナを指定量回復する（100 を超えない） */
  restoreStamina: (amount: number) => void;

  // ── おたがいさまイベントアクション ────────────────────────
  /**
   * だれかを善意で手助けしたときに呼ぶ。
   * kindnessCount++、pendingReturns++（あとで1回ぶん返ってくる）、kizunaPoints+=10。
   * 見返りの約束はしない（純粋な善意）。
   */
  recordKindness: () => void;
  /**
   * お返しの手助けを1回受け取る。
   * pendingReturns--（0未満にはならない）、kizunaBadgeCount++、kizunaPoints+=20。
   */
  redeemReturn: () => void;
  /**
   * きょうの絆スロットを使用済みにする（1日1回ゲート）。
   * イベントを出した・出さなかったに関わらず、評価したら呼ぶ。
   */
  markKizunaShownToday: (date: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ゲーム状態の初期値（resetForKid で再利用）
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_GAME_STATE = {
  inventory: {} as InventoryMap,
  animalsInYard: [] as GameAnimal[],
  logisticsQueue: [] as GameAnimal[],
  stamina: 100,
  medals: [] as Medal[],
  kizunaPoints: 0,
  kindnessCount: 0,
  pendingReturns: 0,
  kizunaBadgeCount: 0,
  lastKizunaDate: null as string | null,
  _stats: {
    helpCount: 0,
    totalAnimalsCaught: 0,
    legendaryCaught: 0,
    totalShipped: 0,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ストア本体
// ─────────────────────────────────────────────────────────────────────────────
export const useSafariStore = create<SafariState>()(
  persist(
    (set, get) => ({
      // ── 初期値 ────────────────────────────────────────────
      activeKidId: null,
      coins: 0,
      ...INITIAL_GAME_STATE,

      // ── ユーザー切り替え ──────────────────────────────────
      resetForKid: (kidId, coinBalance) => {
        const { activeKidId } = get();
        // 同じユーザーが再訪問した場合はリセットしない（ゲーム進行を維持）
        if (activeKidId === kidId) return;
        set({ activeKidId: kidId, coins: coinBalance, ...INITIAL_GAME_STATE });
      },

      // ── コイン ────────────────────────────────────────────
      initCoins: (amount) =>
        set((s) => ({
          // ストアにまだ保存値がなければ DB 値で上書き。
          // localStorage に保存済みの場合はゲーム内の増減を維持する。
          coins: s.coins === 0 ? amount : s.coins,
        })),

      syncCoins: (amount) => set({ coins: amount }),

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

      restoreStamina: (amount) =>
        set((s) => ({ stamina: Math.min(100, s.stamina + amount) })),

      // ── おたがいさまイベント ──────────────────────────────
      recordKindness: () =>
        set((s) => ({
          kindnessCount: s.kindnessCount + 1,
          pendingReturns: s.pendingReturns + 1,
          kizunaPoints: s.kizunaPoints + 10,
        })),

      redeemReturn: () =>
        set((s) => ({
          pendingReturns: Math.max(0, s.pendingReturns - 1),
          kizunaBadgeCount: s.kizunaBadgeCount + 1,
          kizunaPoints: s.kizunaPoints + 20,
        })),

      markKizunaShownToday: (date) => set({ lastKizunaDate: date }),
    }),

    // ── persist 設定 ────────────────────────────────────────
    {
      name: "safari-store", // localStorage キー名
      storage: createJSONStorage(() => localStorage),
      // 旧スキーマ（helpedGrandma 等）からの移行用バージョン
      version: 2,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          // v1 の絆フィールドを新スキーマへ読み替える。
          // 過去に1度でも助けていれば 1 回ぶんのお返しを引き継ぐ。
          const helped = s.helpedGrandma === true;
          s.kindnessCount = helped ? 1 : 0;
          s.pendingReturns = helped ? 1 : 0;
          s.lastKizunaDate = null;
          delete s.helpedGrandma;
          delete s.kizunaTurnsAfterHelp;
        }
        return s;
      },
      // 内部統計も含めて全フィールドを保存
      partialize: (s) => ({
        activeKidId: s.activeKidId,
        coins: s.coins,
        inventory: s.inventory,
        animalsInYard: s.animalsInYard,
        logisticsQueue: s.logisticsQueue,
        stamina: s.stamina,
        medals: s.medals,
        kizunaPoints: s.kizunaPoints,
        kindnessCount: s.kindnessCount,
        pendingReturns: s.pendingReturns,
        kizunaBadgeCount: s.kizunaBadgeCount,
        lastKizunaDate: s.lastKizunaDate,
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
