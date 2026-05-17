"use client";

// 30秒カオスレースプレイヤー。
// Ollamaが生成したシナリオに従いキャラクターが走り、実況テロップが流れる。
// Framer Motion でアバターアニメーション制御、canvas-confetti でゴール演出。

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import confetti from "canvas-confetti";

// ─── 型定義 ───────────────────────────────────────────────────

type Action = "pause" | "speed_up" | "speed_down" | "chaotic" | "finish";
type CharKey = "みこと" | "ゆきと" | "かなた";

type RaceEvent = {
  time: number;
  character: string; // CharKey | "all"
  action: Action;
  message: string;
};

type Scenario = {
  winner: string;
  events: RaceEvent[];
};

type Phase = "idle" | "loading" | "running" | "finished";
type EffectState = "normal" | "pause" | "speed_up" | "speed_down" | "chaotic";

// ─── 定数 ─────────────────────────────────────────────────────

const RACE_DURATION = 30; // 秒
const TICK_MS = 80; // ms（滑らか表示のため小さめ）
const BASE_SPEED = 100 / RACE_DURATION; // %/秒 ≒ 3.33

const CHARACTERS: Array<{
  key: CharKey;
  emoji: string;
  trackGrad: string; // レーン背景
  avatarGrad: string; // アバターバブル背景
  label: string; // ルビ付き表示名
}> = [
  {
    key: "みこと",
    emoji: "🦭",
    trackGrad: "from-sky-200/60 to-cyan-100/60",
    avatarGrad: "from-sky-400 to-cyan-500",
    label: "みこと",
  },
  {
    key: "ゆきと",
    emoji: "🐹",
    trackGrad: "from-yellow-200/60 to-pink-100/60",
    avatarGrad: "from-yellow-400 to-pink-400",
    label: "ゆきと",
  },
  {
    key: "かなた",
    emoji: "🦦",
    trackGrad: "from-teal-200/60 to-emerald-100/60",
    avatarGrad: "from-teal-400 to-emerald-500",
    label: "かなた",
  },
];

// speed_up 時のカーソル倍率など
const SPEED_MULT: Record<Action, number> = {
  pause: 0,
  speed_up: 2.6,
  speed_down: 0.3,
  chaotic: 0.4,
  finish: 0,
};

// ─── Framer Motion バリアント ──────────────────────────────────

const shakeAnim = {
  x: [0, -14, 14, -14, 14, -8, 8, 0],
  y: [0, -5, 5, -5, 5, 0],
  rotate: [0, -10, 10, -10, 10, 0],
  transition: { duration: 0.55, repeat: Infinity, repeatType: "loop" as const },
};
const pulseAnim = {
  scale: [1, 1.2, 0.95, 1.2, 1],
  transition: { duration: 0.5, repeat: Infinity, repeatType: "loop" as const },
};
const pauseAnim = {
  scale: 0.85,
  y: [0, -3, 0],
  transition: { duration: 1.2, repeat: Infinity, repeatType: "loop" as const },
};

// ─── 内部ヘルパー ─────────────────────────────────────────────

function fireConfetti() {
  const palette = ["#fda4af","#fcd34d","#a7f3d0","#bae6fd","#ddd6fe","#fbcfe8"];
  confetti({ particleCount: 200, spread: 120, startVelocity: 55, origin: { x: 0.5, y: 0.4 }, colors: palette, zIndex: 9999 });
  setTimeout(() => confetti({ particleCount: 100, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors: palette, zIndex: 9999 }), 200);
  setTimeout(() => confetti({ particleCount: 100, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors: palette, zIndex: 9999 }), 400);
}

// ─── メインコンポーネント ─────────────────────────────────────

type Props = { kidId: string };

export function RacePlayer({ kidId }: Props) {
  const portalHref = `/kids/${kidId}`;

  // ── フェーズ＆表示 state ──────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [commentary, setCommentary] = useState("🎙️ レーススタートを待っています…");
  const [displayTimer, setDisplayTimer] = useState(0);
  const [winner, setWinner] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // レンダリング用ポジション（0–100）
  const [positions, setPositions] = useState<Record<CharKey, number>>({
    みこと: 0, ゆきと: 0, かなた: 0,
  });
  // エフェクト状態（アイコン上の視覚演出）
  const [effects, setEffects] = useState<Record<CharKey, EffectState>>({
    みこと: "normal", ゆきと: "normal", かなた: "normal",
  });

  // ── Framer Motion アニメーションコントロール ──────────────
  // ※ キャラクターの水平移動はモーションdivのstyleで直接管理し、
  //   shake/pulse など特殊エフェクトだけをcontrols経由で制御する。
  const ctrlMikoto = useAnimation();
  const ctrlYukito = useAnimation();
  const ctrlKanata = useAnimation();
  const controls: Record<CharKey, ReturnType<typeof useAnimation>> = {
    みこと: ctrlMikoto, ゆきと: ctrlYukito, かなた: ctrlKanata,
  };

  // ── 内部ミュータブルRef（setInterval内のstale closure回避） ──
  const posRef = useRef<Record<CharKey, number>>({ みこと: 0, ゆきと: 0, かなた: 0 });
  const multRef = useRef<Record<CharKey, number>>({ みこと: 1, ゆきと: 1, かなた: 1 });
  const elapsedRef = useRef(0); // 秒（小数）
  const scenarioRef = useRef<Scenario | null>(null);
  const processedRef = useRef<Set<string>>(new Set()); // 処理済みeventキーセット（重複防止）
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("idle");

  // phaseRefをphaseと同期
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── エフェクト適用（controls + effects state） ───────────
  const applyEffect = useCallback((charKey: CharKey, action: Action) => {
    const ctrl = controls[charKey];
    setEffects(prev => ({ ...prev, [charKey]: action as EffectState }));
    switch (action) {
      case "chaotic":
        ctrl.start(shakeAnim);
        break;
      case "speed_up":
        ctrl.start(pulseAnim);
        break;
      case "pause":
        ctrl.start(pauseAnim);
        break;
      case "speed_down":
        ctrl.start({ scale: 0.9, transition: { duration: 0.3 } });
        break;
      case "finish":
        ctrl.start({ scale: [1, 1.4, 1], rotate: [0, 360], transition: { duration: 0.8 } });
        break;
      default:
        ctrl.start({ x: 0, y: 0, rotate: 0, scale: 1, transition: { duration: 0.3 } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── イベント処理 ─────────────────────────────────────────
  const processEvents = useCallback((elapsed: number) => {
    const sc = scenarioRef.current;
    if (!sc) return;

    for (const ev of sc.events) {
      // まだ到達していないイベントはスキップ
      if (elapsed < ev.time) continue;
      // 処理済みならスキップ（同一timeが複数ある場合はindexも使えるが、timeで代用）
      const evKey = `${ev.time}:${ev.character}:${ev.action}`;
      if (processedRef.current.has(evKey)) continue;
      processedRef.current.add(evKey);

      // 実況テロップ更新
      setCommentary(ev.message);

      const targets: CharKey[] =
        ev.character === "all"
          ? ["みこと", "ゆきと", "かなた"]
          : (["みこと", "ゆきと", "かなた"] as CharKey[]).filter(k => k === ev.character);

      for (const charKey of targets) {
        if (ev.action === "finish") {
          // ゴール処理は別途
          continue;
        }
        // スピード倍率を更新
        multRef.current[charKey] = SPEED_MULT[ev.action] ?? 1;
        // Framer Motionエフェクト
        applyEffect(charKey, ev.action);
      }
    }
  }, [applyEffect]);

  // ── レース終了処理 ───────────────────────────────────────
  const finishRace = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const sc = scenarioRef.current;
    const winnerName = sc?.winner ?? "";

    // 全員をゴール位置まで移動
    const finalPos: Record<CharKey, number> = { みこと: 100, ゆきと: 100, かなた: 100 };
    setPositions(finalPos);
    setDisplayTimer(RACE_DURATION);
    setWinner(winnerName);
    setPhase("finished");
    setCommentary(`🏆 本日の勝者は ${winnerName}！！`);

    // 紙吹雪
    fireConfetti();
    setTimeout(fireConfetti, 800);
  }, []);

  // ── タイマーループ ───────────────────────────────────────
  const startInterval = useCallback(() => {
    elapsedRef.current = 0;
    posRef.current = { みこと: 0, ゆきと: 0, かなた: 0 };
    multRef.current = { みこと: 1, ゆきと: 1, かなた: 1 };
    processedRef.current = new Set();

    intervalRef.current = setInterval(() => {
      const dt = TICK_MS / 1000; // 秒
      elapsedRef.current += dt;
      const elapsed = elapsedRef.current;

      // 各キャラクターのポジション更新
      const newPos = { ...posRef.current };
      for (const char of ["みこと", "ゆきと", "かなた"] as CharKey[]) {
        const delta = BASE_SPEED * multRef.current[char] * dt;
        newPos[char] = Math.min(100, newPos[char] + delta);
      }
      posRef.current = newPos;

      // イベント処理
      processEvents(elapsed);

      // React stateを更新（レンダリング用）
      setPositions({ ...newPos });
      setDisplayTimer(Math.min(RACE_DURATION, Math.floor(elapsed)));

      // 終了判定
      if (elapsed >= RACE_DURATION) {
        finishRace();
      }
    }, TICK_MS);
  }, [processEvents, finishRace]);

  // ── シナリオ取得 → レース開始 ────────────────────────────
  const handleStart = useCallback(async () => {
    setPhase("loading");
    setErrorMsg(null);
    setCommentary("🎲 シナリオを生成中…");
    setPositions({ みこと: 0, ゆきと: 0, かなた: 0 });
    setEffects({ みこと: "normal", ゆきと: "normal", かなた: "normal" });
    setDisplayTimer(0);
    setWinner("");

    // コントロールをリセット
    for (const ctrl of Object.values(controls)) {
      ctrl.start({ x: 0, y: 0, rotate: 0, scale: 1, transition: { duration: 0 } });
    }

    try {
      const res = await fetch("/api/race/generate", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const scenario = (await res.json()) as Scenario;
      scenarioRef.current = scenario;
      setCommentary("🏁 よーい…ドン！！");
      setPhase("running");
      startInterval();
    } catch (e) {
      console.error(e);
      setErrorMsg("シナリオ生成に失敗しました。もう一度お試しください。");
      setPhase("idle");
    }
  }, [controls, startInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── タイマー表示フォーマット ──────────────────────────────
  const timerLabel = `${displayTimer.toString().padStart(2, "0")}`;
  const timerPct = (displayTimer / RACE_DURATION) * 100;

  return (
    <main className="h-screen overflow-hidden flex flex-col bg-gradient-to-b from-amber-900 via-orange-800 to-yellow-700 relative">
      {/* ── 背景装飾 ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
        <span className="absolute top-2 left-4 text-5xl opacity-20">🌵</span>
        <span className="absolute top-4 right-8 text-6xl opacity-15">🦁</span>
        <span className="absolute top-8 left-1/4 text-4xl opacity-10">☀️</span>
        <span className="absolute top-12 right-1/3 text-5xl opacity-10">🌴</span>
        <span className="absolute bottom-24 left-6 text-4xl opacity-15">🌿</span>
        <span className="absolute bottom-20 right-4 text-5xl opacity-15">🦒</span>
        {/* 地平線 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-yellow-900/40" />
      </div>

      {/* ── ヘッダー ── */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2 z-10">
        <Link
          href={portalHref}
          className="rounded-full bg-white/20 backdrop-blur px-3 py-1.5 text-sm font-bold text-white shadow ring-1 ring-white/30 transition hover:bg-white/30 active:scale-95"
        >
          ← ポータルへ
        </Link>
        <div className="text-center">
          <p className="text-xs font-extrabold text-amber-200/80 tracking-widest">🏁 カオスレース 🏁</p>
        </div>
        <div className="w-24 text-right">
          <span className="font-mono text-2xl font-black text-white drop-shadow">
            {timerLabel}
            <span className="text-sm text-amber-200/70"> / 30</span>
          </span>
        </div>
      </header>

      {/* ── タイムバー ── */}
      <div className="shrink-0 h-1.5 bg-white/20 mx-4 rounded-full overflow-hidden z-10">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-rose-400 rounded-full"
          animate={{ width: `${timerPct}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>

      {/* ── レーストラック ── */}
      <section className="flex-1 flex flex-col justify-center px-3 py-2 gap-2 z-10" aria-label="レーストラック">
        {CHARACTERS.map((char) => {
          const pos = positions[char.key];
          const eff = effects[char.key];
          // アバターのX位置: 0→0%, 100→82% (右端に余白を残す)
          const leftPct = pos * 0.82;

          return (
            <div
              key={char.key}
              className={`relative rounded-2xl bg-gradient-to-r ${char.trackGrad} backdrop-blur border border-white/30 overflow-hidden`}
              style={{ height: "5.5rem" }}
            >
              {/* 草の模様 */}
              <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden>
                <span className="absolute bottom-1 left-1/4 text-xl">🌱</span>
                <span className="absolute bottom-1 left-1/2 text-lg">🌿</span>
                <span className="absolute bottom-1 right-1/4 text-xl">🌱</span>
              </div>

              {/* レーンライン（点線） */}
              <div className="absolute top-1/2 left-20 right-4 h-0.5 -translate-y-1/2 border-t-2 border-dashed border-white/30 pointer-events-none" />

              {/* スタートフラグ */}
              <div className="absolute left-14 top-0 bottom-0 w-0.5 bg-white/40" />

              {/* ゴールフラグ */}
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xl pointer-events-none" aria-hidden>🏁</span>

              {/* キャラクター名ラベル */}
              <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col items-center w-12 z-10">
                <span className="text-xs font-black text-white/90 drop-shadow leading-tight">{char.label}</span>
              </div>

              {/* 動くアバター */}
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 z-20"
                style={{
                  left: `calc(${leftPct}% + 3.5rem)`,
                  transition: `left ${TICK_MS / 1000}s linear`,
                }}
              >
                <motion.div
                  animate={controls[char.key]}
                  className={`relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br ${char.avatarGrad} shadow-lg ring-4 ring-white/60`}
                >
                  <span className="text-3xl leading-none" aria-hidden>{char.emoji}</span>

                  {/* エフェクトオーバーレイ */}
                  {eff === "speed_up" && (
                    <span className="absolute -right-2 -top-2 text-xl animate-bounce" aria-hidden>🔥</span>
                  )}
                  {eff === "pause" && (
                    <span className="absolute -right-2 -top-2 text-xl" aria-hidden>💤</span>
                  )}
                  {eff === "chaotic" && (
                    <span className="absolute -right-2 -top-2 text-xl animate-spin" aria-hidden>🌀</span>
                  )}
                  {eff === "speed_down" && (
                    <span className="absolute -right-2 -top-2 text-lg" aria-hidden>🐢</span>
                  )}
                </motion.div>
              </motion.div>
            </div>
          );
        })}
      </section>

      {/* ── 実況テロップ ── */}
      <div className="shrink-0 mx-3 mb-2 z-10">
        <div className="rounded-2xl bg-black/85 border border-amber-400/40 backdrop-blur px-4 py-3 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg" aria-hidden>🎙️</span>
            <span className="text-[10px] font-extrabold text-amber-300 tracking-widest uppercase">Live Commentary</span>
            {phase === "running" && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping inline-block" />
                LIVE
              </span>
            )}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={commentary}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-white font-bold text-sm leading-snug min-h-[2.5rem] flex items-center"
              aria-live="polite"
            >
              {commentary}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* ── スタートボタン ── */}
      {(phase === "idle" || phase === "finished") && (
        <div className="shrink-0 px-4 pb-4 z-10">
          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 py-4 text-xl font-black text-white shadow-2xl transition hover:brightness-110 active:scale-[0.98]"
          >
            {phase === "finished" ? "🔄 もういちどレース！" : "🔥 レーススタート！"}
          </button>
          {errorMsg && (
            <p className="mt-2 text-center text-sm text-rose-200 font-bold">{errorMsg}</p>
          )}
        </div>
      )}

      {/* ── ロード中インジケーター ── */}
      {phase === "loading" && (
        <div className="shrink-0 px-4 pb-4 z-10">
          <div className="w-full rounded-2xl bg-white/10 border border-white/20 py-4 flex items-center justify-center gap-3">
            <span className="text-2xl animate-spin">🎲</span>
            <span className="text-white font-bold text-base">シナリオ生成中…</span>
          </div>
        </div>
      )}

      {/* ── 勝者ポップアップ ── */}
      <AnimatePresence>
        {phase === "finished" && winner && (
          <motion.div
            key="winner-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6"
            onClick={handleStart}
          >
            <motion.div
              initial={{ scale: 0.5, y: 60 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 60 }}
              transition={{ type: "spring", damping: 14, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-[2.5rem] bg-gradient-to-br from-yellow-300 via-amber-300 to-orange-400 p-1 shadow-[0_30px_80px_rgba(251,191,36,0.5)]"
            >
              <div className="rounded-[2.25rem] bg-white/95 px-6 py-8 text-center">
                {/* 背景のキラキラ */}
                <div className="relative flex justify-center mb-3">
                  <span className="absolute text-[7rem] opacity-10 blur-sm" aria-hidden>🏆</span>
                  <motion.span
                    className="relative text-8xl drop-shadow-lg"
                    animate={{ rotate: [0, 10, -10, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: "loop" }}
                    aria-hidden
                  >
                    🏆
                  </motion.span>
                </div>

                <p className="text-sm font-extrabold tracking-[0.3em] text-amber-600 animate-pulse">
                  🎉 WINNER 🎉
                </p>
                <h2 className="mt-2 text-4xl font-black bg-gradient-to-r from-rose-600 via-orange-500 to-amber-500 bg-clip-text text-transparent leading-tight">
                  本日の勝者は
                </h2>
                <p className="mt-1 text-5xl font-black text-slate-800 drop-shadow">
                  {winner}！！
                </p>

                <motion.button
                  type="button"
                  onClick={handleStart}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-6 w-full rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 py-4 text-lg font-black text-white shadow-lg"
                >
                  🔄 もういちどレース！
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
