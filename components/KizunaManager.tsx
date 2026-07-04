"use client";
// components/KizunaManager.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 「おたがいさま」イベントのグローバル制御。
//
// どのステージ（農場・牧場・動物園・サファリ…）でも、また ワールドマップでも、
// このコンポーネントをマウントしておけば 自動で イベントが発生する。
//
// ルール（2026-05 改訂）:
//   - ログインだけでなく、ページを移動する たびに 確率 5% で発生しうる。
//   - 連続発火を防ぐため 短いクールダウンを置く（直前の発火から一定時間は出さない）。
//   - お返しが たまっていれば（pendingReturns > 0）優先して お返しを返す。なければ お願い。
//   - お願いは 3択（やさしい／ふつう／いじわる）。やさしい時だけ お返しが たまる。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSafariStore } from "@/store/useSafariStore";
import { KizunaEventDialog } from "@/components/KizunaEventDialog";
import {
  pickAsk,
  pickReturn,
  KIZUNA_CHOICE_META,
  type KizunaAsk,
  type KizunaReturn,
} from "@/lib/kizunaScenarios";

// 1回の移動（ページ表示）あたりの発火確率。
const TRIGGER_CHANCE = 0.05;
// 直前の発火から この時間は 再発火しない（連続表示の抑制）。
const COOLDOWN_MS = 10_000;

type Active =
  | { kind: "ask"; ask: KizunaAsk }
  | { kind: "return"; ret: KizunaReturn }
  | null;

export function KizunaManager() {
  const pathname = usePathname();
  const recordKizunaResult = useSafariStore((s) => s.recordKizunaResult);
  const redeemReturn = useSafariStore((s) => s.redeemReturn);

  const [active, setActive] = useState<Active>(null);
  const activeRef = useRef(false);
  const lastFiredRef = useRef(0);

  // 移動（pathname 変化）の たびに 5% で抽選する。
  useEffect(() => {
    // すでに表示中なら何もしない。
    if (activeRef.current) return;
    // クールダウン中は出さない。
    if (Date.now() - lastFiredRef.current < COOLDOWN_MS) return;
    // 5% 抽選。
    if (Math.random() >= TRIGGER_CHANCE) return;

    // お返しが たまっていれば お返し、なければ お願い。
    const pending = useSafariStore.getState().pendingReturns;
    const decided: Active =
      pending > 0
        ? { kind: "return", ret: pickReturn() }
        : { kind: "ask", ask: pickAsk() };

    // 少しの ランダムな間を置いてから表示。
    const delay = 600 + Math.random() * 1200;
    const t = setTimeout(() => {
      lastFiredRef.current = Date.now();
      activeRef.current = true;
      setActive(decided);
    }, delay);
    return () => clearTimeout(t);
  }, [pathname]);

  const close = () => {
    activeRef.current = false;
    setActive(null);
  };

  if (!active) return null;

  if (active.kind === "ask") {
    return (
      <KizunaEventDialog
        mode="ask"
        ask={active.ask}
        onChoose={(choice) => {
          const meta = KIZUNA_CHOICE_META[choice];
          recordKizunaResult(meta.grantReturn, meta.points);
        }}
        onClose={close}
      />
    );
  }

  return (
    <KizunaEventDialog
      mode="return"
      ret={active.ret}
      onComplete={() => {
        redeemReturn();
        close();
      }}
    />
  );
}
