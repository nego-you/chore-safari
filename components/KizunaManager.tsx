"use client";
// components/KizunaManager.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 「おたがいさま」イベントのグローバル制御。
//
// どのステージ（農場・牧場・動物園・サファリ…）でも、また ワールドマップでも、
// このコンポーネントをマウントしておけば 自動で イベントが発生する。
//
// ルール（Notion「助ける」より）:
//   - 1日に1回まで（あるか ないか くらい）。kizunaFiredDate で上限ゲート。
//   - 「今日 出すか・お願いか お返しか」は 1日1回だけ抽選（kizunaPlanDate/Kind）。
//   - 「いつ 出すか」は ページ遷移ごとに 確率判定。
//     → その日の最初の画面に固定されず、ランダムな タイミングで現れる。
//   - お返しが たまっていれば（pendingReturns > 0）その日は お返しを予定し、
//     助けた回数に ちゃんと 応じて、すべての場所で お返しが返ってくる。
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

// その日を「お願いイベントが ある日」にする確率（お返しが無い日のみ抽選）。
// 「一日に一回 あるか ないか」を満たすため、毎日は出さない。
const ASK_DAY_CHANCE = 0.5;

// 1ページ表示あたりの発火確率（タイミングを散らすためのロール）。
// 低めにして「最初の画面で必ず出る」を防ぎ、遷移を重ねるうちに ランダムに出す。
const TRIGGER_RETURN = 0.55; // お返しは その日のうちに 比較的 出やすく
const TRIGGER_ASK = 0.45; // お願いは より控えめに

// 当日 "YYYY/M/D"（ローカル）を返す。
function todayStr(): string {
  return new Date().toLocaleDateString("ja-JP");
}

type Active =
  | { kind: "ask"; ask: KizunaAsk }
  | { kind: "return"; ret: KizunaReturn }
  | null;

export function KizunaManager() {
  const pendingReturns = useSafariStore((s) => s.pendingReturns);
  const kizunaPlanDate = useSafariStore((s) => s.kizunaPlanDate);
  const kizunaPlanKind = useSafariStore((s) => s.kizunaPlanKind);
  const kizunaFiredDate = useSafariStore((s) => s.kizunaFiredDate);
  const recordKindness = useSafariStore((s) => s.recordKindness);
  const redeemReturn = useSafariStore((s) => s.redeemReturn);
  const planKizunaDay = useSafariStore((s) => s.planKizunaDay);
  const markKizunaFired = useSafariStore((s) => s.markKizunaFired);

  const [active, setActive] = useState<Active>(null);
  const evaluatedRef = useRef(false);

  useEffect(() => {
    // 1ページ表示につき一度だけ評価する（ナビ毎の二重評価を防ぐ）。
    if (evaluatedRef.current) return;
    evaluatedRef.current = true;

    const today = todayStr();

    // すでに今日 発火済みなら何もしない（1日1回 上限）。
    if (kizunaFiredDate === today) return;

    // 今日の予定がまだ無ければ、1日1回だけ抽選して確定する。
    let kind: "ask" | "return" | "none" | null = kizunaPlanKind;
    if (kizunaPlanDate !== today) {
      kind =
        pendingReturns > 0
          ? "return"
          : Math.random() < ASK_DAY_CHANCE
          ? "ask"
          : "none";
      planKizunaDay(today, kind);
    }

    // 予定が無い日（あるか ないか の「ない」）はここで終了。
    if (kind === "none" || !kind) return;

    // 「いつ出すか」を遷移ごとに確率判定。今回 見送れば 次のページ／別の日に回る。
    const triggerChance = kind === "return" ? TRIGGER_RETURN : TRIGGER_ASK;
    if (Math.random() >= triggerChance) return;

    // 発火決定。少し待ち（さらに ランダムな間）を置いてから表示する。
    const decided: Active =
      kind === "return"
        ? { kind: "return", ret: pickReturn() }
        : { kind: "ask", ask: pickAsk() };

    const delay = 700 + Math.random() * 1500;
    const t = setTimeout(() => {
      // 実際に表示できた時点で その日を消費する（途中離脱では消費しない）。
      markKizunaFired(todayStr());
      setActive(decided);
    }, delay);
    return () => clearTimeout(t);
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
