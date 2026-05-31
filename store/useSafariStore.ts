"use client";
// store/useSafariStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// お手伝いサファリ グローバルストア（Zustand + persist）
//
// 役割（2026-05 リファクタ後）:
//   - coins      : DB(coinBalance) のミラー。ロード時にハイドレート、増減後は必ず syncCoins。
//   - inventory  : DB(GameInventoryItem) のミラー。debounce で DB にスナップショット保存。
//   - stamina / kizuna / bgmMuted : クライアント専用のゲーム/UI 状態（未DB化）。
//
// ※ 動物データ（捕獲）は DB(CaughtAnimal) が唯一のソース。ストアでは保持しない。
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { InventoryMap } from "@/types/safari";
import type { KizunaState } from "@/features/kizuna/actions";

// ─────────────────────────────────────────────────────────────────────────────
// State 型
// ─────────────────────────────────────────────────────────────────────────────
export interface SafariState {
  // ── 公開ステート ─────────────────────────────────────────
  /** 現在プレイ中の kidId。ユーザー切り替え検出に使う */
  activeKidId: string | null;
  /** コイン残高（DB coinBalance のミラー） */
  coins: number;
  /** インベントリ: { wood: 5, tomato: 2, ... }（DB GameInventoryItem のミラー） */
  inventory: InventoryMap;
  /** 現在の体力 (0–100) */
  stamina: number;

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
   * きょうの「予定」を立てた日付（"YYYY/M/D"）。
   * 1日1回だけ「今日イベントが あるか／ないか・お願いか お返しか」を抽選する。
   */
  kizunaPlanDate: string | null;
  /**
   * きょうの予定の中身。
   *   "ask"    … きょうは お願いイベントを出す予定
   *   "return" … きょうは お返しイベントを出す予定
   *   "none"   … きょうは イベントなし
   */
  kizunaPlanKind: "ask" | "return" | "none" | null;
  /**
   * 実際にイベントを発火した日付（"YYYY/M/D"）。
   * これがある日付＝もう今日は出さない（1日1回上限）。
   */
  kizunaFiredDate: string | null;

  // ── アクション ───────────────────────────────────────────

  /** サーバーレスポンスの newCoinBalance でコインを直接上書きする（クレーン等） */
  syncCoins: (amount: number) => void;

  /**
   * @internal ロード時にサーバ(DB)値でハイドレート済みか。
   * 永続化しないため毎ロード false で始動する（→必ず一度 DB から読み直す）。
   */
  _hydrated: boolean;
  /**
   * ページロード時に DB の値でストアを初期化する（DB = Single Source of Truth）。
   *   - coins は毎回 DB 値で上書き（親の Bank 承認・他端末の変化を反映）。
   *   - inventory / kizuna はセッション初回 or kid 変更時のみ DB 値を採用し、
   *     以降はストア（debounce で DB に保存）を作業コピーとする。
   *   - kid が変わった時だけ非DBゲーム状態（スタミナ等）をリセット。
   *   - stamina は設計上エフェメラル（ゲーム再開で全回復）のため DB 化しない。
   */
  hydrateFromServer: (
    kidId: string,
    coinBalance: number,
    inventory: InventoryMap,
    kizuna: KizunaState,
  ) => void;

  /** コインを増やす（楽観更新用。直後に必ず syncCoins(server) すること） */
  addCoins: (amount: number) => void;
  /** コインを使う（楽観更新用）。残高不足なら false を返して消費しない */
  spendCoins: (amount: number) => boolean;

  /** インベントリにアイテムを追加（農場・クラフトなどから呼ぶ） */
  addToInventory: (item: string, count: number) => void;
  /** インベントリを消費。不足なら false を返して消費しない */
  consumeInventory: (item: string, count: number) => boolean;

  /** 自分の家で休んで体力を全回復する */
  recoverStamina: () => void;
  /** スタミナを指定量消費する（0 未満にはならない） */
  consumeStamina: (amount: number) => void;
  /** スタミナを指定量回復する（100 を超えない） */
  restoreStamina: (amount: number) => void;

  // ── BGM ────────────────────────────────────────────────────
  /** BGM をミュートするか否か（localStorage に保存） */
  bgmMuted: boolean;
  /** BGM ミュートをトグルする */
  toggleBGMMute: () => void;

  // ── おたがいさまイベントアクション ────────────────────────
  /**
   * 3択（やさしい／ふつう／いじわる）の結果を反映する。
   *   grantReturn=true（やさしい）のときだけ kindnessCount++・pendingReturns++（あとでお返しが返ってくる）。
   *   points は善行ポイントの増分。
   */
  recordKizunaResult: (grantReturn: boolean, points: number) => void;
  /**
   * だれかを善意で手助けしたときに呼ぶ（旧API・recordKizunaResult(true,10) と同等）。
   * kindnessCount++、pendingReturns++、kizunaPoints+=10。
   */
  recordKindness: () => void;
  /**
   * お返しの手助けを1回受け取る。
   * pendingReturns--（0未満にはならない）、kizunaBadgeCount++、kizunaPoints+=20。
   */
  redeemReturn: () => void;
  /** きょうの予定を確定する（1日1回だけ抽選した結果を保存）。 */
  planKizunaDay: (date: string, kind: "ask" | "return" | "none") => void;
  /** きょう実際にイベントを発火したことを記録する（以降その日は出さない）。 */
  markKizunaFired: (date: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 非DBゲーム状態の初期値（kid 変更時にリセットする範囲）
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_GAME_STATE = {
  inventory: {} as InventoryMap,
  stamina: 100,
  kizunaPoints: 0,
  kindnessCount: 0,
  pendingReturns: 0,
  kizunaBadgeCount: 0,
  kizunaPlanDate: null as string | null,
  kizunaPlanKind: null as "ask" | "return" | "none" | null,
  kizunaFiredDate: null as string | null,
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
      bgmMuted: false,
      _hydrated: false,
      ...INITIAL_GAME_STATE,

      // ── コイン ────────────────────────────────────────────
      syncCoins: (amount) => set({ coins: amount }),

      hydrateFromServer: (kidId, coinBalance, inventory, kizuna) =>
        set((s) => {
          const kidChanged = s.activeKidId !== kidId;
          const needSnapshot = kidChanged || !s._hydrated;
          return {
            // kid が変わった時だけ非DBゲーム状態（スタミナ等）をリセット
            ...(kidChanged ? INITIAL_GAME_STATE : {}),
            // inventory / kizuna はセッション初回 or kid 変更時のみ DB 値を採用
            ...(needSnapshot ? { inventory, ...kizuna } : {}),
            activeKidId: kidId,
            coins: coinBalance, // DB 常に勝ち
            _hydrated: true,
          };
        }),

      addCoins: (amount) => set((s) => ({ coins: s.coins + amount })),

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

      // ── スタミナ ──────────────────────────────────────────
      recoverStamina: () => set({ stamina: 100 }),

      consumeStamina: (amount) =>
        set((s) => ({ stamina: Math.max(0, s.stamina - amount) })),

      restoreStamina: (amount) =>
        set((s) => ({ stamina: Math.min(100, s.stamina + amount) })),

      // ── おたがいさまイベント ──────────────────────────────
      recordKizunaResult: (grantReturn, points) =>
        set((s) => ({
          kindnessCount: s.kindnessCount + (grantReturn ? 1 : 0),
          pendingReturns: s.pendingReturns + (grantReturn ? 1 : 0),
          kizunaPoints: s.kizunaPoints + (points || 0),
        })),

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

      planKizunaDay: (date, kind) =>
        set({ kizunaPlanDate: date, kizunaPlanKind: kind }),

      markKizunaFired: (date) => set({ kizunaFiredDate: date }),

      // ── BGM ────────────────────────────────────────────────
      toggleBGMMute: () => set((s) => ({ bgmMuted: !s.bgmMuted })),
    }),

    // ── persist 設定 ────────────────────────────────────────
    {
      name: "safari-store", // localStorage キー名
      storage: createJSONStorage(() => localStorage),
      // 旧スキーマからの移行用バージョン
      version: 5,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version < 5) {
          // v5: 動物データ(animalsInYard/logisticsQueue)・勲章(medals)・統計(_stats)を撤去。
          //     これらは DB(CaughtAnimal) を唯一のソースとするため localStorage から破棄。
          delete s.animalsInYard;
          delete s.logisticsQueue;
          delete s.medals;
          delete s._stats;
        }
        if (version < 4) {
          // v4: 絆イベントを「予定（1日1回抽選）＋発火（ランダムなタイミング）」に分離。
          s.kizunaPlanDate = null;
          s.kizunaPlanKind = null;
          s.kizunaFiredDate = null;
          delete s.lastKizunaDate;
        }
        if (version < 3) {
          // v3: bgmMuted を追加
          if (s.bgmMuted === undefined) s.bgmMuted = false;
        }
        if (version < 2) {
          // v1 の絆フィールドを新スキーマへ読み替える。
          const helped = s.helpedGrandma === true;
          s.kindnessCount = helped ? 1 : 0;
          s.pendingReturns = helped ? 1 : 0;
          delete s.helpedGrandma;
          delete s.kizunaTurnsAfterHelp;
        }
        return s;
      },
      partialize: (s) => ({
        activeKidId: s.activeKidId,
        coins: s.coins,
        bgmMuted: s.bgmMuted,
        inventory: s.inventory,
        stamina: s.stamina,
        kizunaPoints: s.kizunaPoints,
        kindnessCount: s.kindnessCount,
        pendingReturns: s.pendingReturns,
        kizunaBadgeCount: s.kizunaBadgeCount,
        kizunaPlanDate: s.kizunaPlanDate,
        kizunaPlanKind: s.kizunaPlanKind,
        kizunaFiredDate: s.kizunaFiredDate,
      }),
    }
  )
);
