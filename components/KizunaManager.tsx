"use client";
// components/KizunaManager.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 「おたがいさま」イベントのグローバル制御。
//
// どのステージ（農場・牧場・動物園・サファリ…）でも、また ワールドマップでも、
// このコンポーネントをマウントしておけば 自動で イベントが発生する。
//
// ルール（Notion「助ける」より）:
//   - 1日に1回まで（あるか ないか くらい）。lastKizunaDate でゲート。
//   - お返しが たまっていれば（pendingReturns > 0）それを優先して必ず返す。
//     → 助けた回数に ちゃんと 応じて、すべての場所で お返しが発生する。
//   - お返しが無い日は、ときどき（確率）お願いイベントが出る。
//   - 見返りは ほのめかさない。お返しは おたがいさま の対等なトーン。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useSafariStore } from "@/store/useSafariStore";
import { KizunaEventDialog } from "@/components/KizunaEventDialog";
import {
  pickAsk,
  pickReturn,
  type KizunaAsk,
  type KizunaReturn,
} from "@/lib/kizunaScenarios";

// お願いイベントが出る確率（お返しが無い日のみ判定）。
// 「一日に一回 あるか ないか」を満たすため、毎日は出さない。
const ASK_CHANCE = 0.45;

// 当日 "YYYY/M/D"（ローカル）を返す。
function todayStr(): string {
  return new Date().toLocaleDateString("ja-JP");
}

type Active =
  | { kind: "ask"; ask: KizunaAsk }
  | { kind: "return"; ret: KizunaReturn }
  | null;

export function KizunaManager() {
  const pendingReturns       = useSafariStore((s) => s.pendingReturns);
  const lastKizunaDate       = useSafariStore((s) => s.lastKizunaDate);
  const recordKindness       = useSafariStore((s) => s.recordKindness);
  const redeemReturn         = useSafariStore((s) => s.redeemReturn);
  const markKizunaShownToday = useSafariStore((s) => s.markKizunaShownToday);

  const [active, setActive] = useState<Active>(null);
  const evaluatedRef = useRef(false);

  useEffect(() => {
    // 1ページ表示につき一度だけ評価する（ナビ毎の二重発火を防ぐ）。
    if (evaluatedRef.current) return;
    evaluatedRef.current = true;

    const today = todayStr();
    // きょう すでに評価済みなら何もしない（1日1回ゲート）。
    if (lastKizunaDate === today) return;

    // きょうのスロットを消費（出す・出さないに関わらず）。
    markKizunaShownToday(today);

    let decided: Active = null;
    if (pendingReturns > 0) {
      // お返しを優先。助けた回数に応じて 必ず返す。
      decided = { kind: "return", ret: pickReturn() };
    } else if (Math.random() < ASK_CHANCE) {
      decided = { kind: "ask", ask: pickAsk() };
    }

    if (decided) {
      // 画面が落ち着いてから 表示。
      const t = setTimeout(() => setActive(decided), 900);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!active) return null;

  if (active.kind === "ask") {
    return (
      <KizunaEventDialog
        mode="ask"
        ask={active.ask}
        onHelp={() => recordKindness()}
        onDecline={() => setActive(null)}
      />
    );
  }

  return (
    <KizunaEventDialog
      mode="return"
      ret={active.ret}
      onComplete={() => {
        redeemReturn();
        setActive(null);
      }}
    />
  );
}
