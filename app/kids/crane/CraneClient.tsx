"use client";

// クレーンゲーム（UFO キャッチャー）クライアント。
// X 軸（左右）と Z 軸（前後＝奥行き）の 2 軸でクレーンを動かし、
// キャッチで降下 → 引き上げ → 取り出し口へ移動 → ドロップ → 結果モーダル。
// Three.js は使わず、CSS の transform / scale / transition だけで擬似 3D。

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { playCraneGame } from "../actions";
import { CRANE_COST } from "../config";

type Kid = { id: string; name: string; coinBalance: number };

type Props = {
  initialKidId: string | null;
  kids: Kid[];
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

const ITEM_EMOJI: Record<string, string> = {
  meat: "🍖",
  fish: "🐟",
  berry: "🍓",
  rope: "🪢",
  wood: "🪵",
  net: "🕸️",
  sturdy_trap: "🪤",
  premium_food: "🍱",
  hunter_net: "🥅",
  mixed_food: "🍲",
};

function NameRuby({ name }: { name: string }) {
  const yomi = NAME_READING[name];
  if (!yomi) return <>{name}</>;
  return (
    <ruby>
      {name}
      <rt className="text-[0.4em] tracking-widest">{yomi}</rt>
    </ruby>
  );
}

// (x, z) ∈ [0,100]² を、トラペゾイドの床に擬似 3D 投影する。
// z=0 が手前（大きく、画面下）、z=100 が奥（小さく、画面上）。
function project(x: number, z: number) {
  const t = z / 100; // 0=front, 1=back
  const leftEdge = 0.06 + 0.22 * t;
  const rightEdge = 0.94 - 0.22 * t;
  const xRatio = leftEdge + (x / 100) * (rightEdge - leftEdge);
  const yRatio = 1.0 - 0.7 * t;
  const scale = 1.0 - 0.4 * t;
  return { xRatio, yRatio, scale };
}

type Phase =
  | "idle"
  | "descend"
  | "grip"
  | "lift"
  | "move"
  | "drop"
  | "result";

type Prize = {
  itemId: string;
  itemName: string;
  itemType: "FOOD" | "TRAP_PART";
  totalQuantity: number;
};

// 取り出し口の位置（左手前）。
const OUTLET = { x: 10, z: 8 };

const STEP = 18; // 1 押しでの移動量

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function CraneClient({ initialKidId, kids }: Props) {
  const [kidId, setKidId] = useState<string | null>(initialKidId);
  const [craneX, setCraneX] = useState(50);
  const [craneZ, setCraneZ] = useState(50);
  const [phase, setPhase] = useState<Phase>("idle");
  const [prize, setPrize] = useState<Prize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coinBalance, setCoinBalance] = useState(
    initialKidId
      ? kids.find((k) => k.id === initialKidId)?.coinBalance ?? 0
      : 0,
  );

  // 子の切替時に残高を取り直す
  useEffect(() => {
    if (!kidId) return;
    const k = kids.find((x) => x.id === kidId);
    if (k) setCoinBalance(k.coinBalance);
  }, [kidId, kids]);

  const selectedKid = kidId ? kids.find((k) => k.id === kidId) ?? null : null;

  // 筐体に入っているアイテム（装飾）。リザルトを閉じるごとに再シャッフル。
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const items = useMemo(() => {
    const pool = Object.keys(ITEM_EMOJI);
    const seed = shuffleSeed; // ← デプス用フラグ
    void seed;
    return Array.from({ length: 11 }).map((_, i) => ({
      id: `${shuffleSeed}-${i}`,
      itemId: pool[Math.floor(Math.random() * pool.length)],
      x: 12 + Math.random() * 76,
      z: 12 + Math.random() * 76,
      rot: (Math.random() - 0.5) * 30,
    }));
  }, [shuffleSeed]);

  const moveBusy = phase !== "idle";

  const move = (dx: number, dz: number) => {
    if (moveBusy) return;
    setCraneX((v) => Math.max(0, Math.min(100, v + dx)));
    setCraneZ((v) => Math.max(0, Math.min(100, v + dz)));
  };

  const handleCatch = async () => {
    if (!selectedKid || phase !== "idle") return;
    if (coinBalance < CRANE_COST) {
      setError(`コインが ${CRANE_COST - coinBalance} まい たりないよ`);
      return;
    }
    setError(null);

    // 降下開始と同時にサーバ抽選を投げる（演出と並行）
    const resultPromise = playCraneGame(selectedKid.id);

    setPhase("descend");
    await wait(1100);

    setPhase("grip");
    const result = await resultPromise;
    if (!result.success) {
      setError(result.error);
      setPhase("idle");
      return;
    }
    setPrize({
      itemId: result.item.itemId,
      itemName: result.item.itemName,
      itemType: result.item.itemType,
      totalQuantity: result.item.totalQuantity,
    });
    setCoinBalance(result.newCoinBalance);
    await wait(450);

    setPhase("lift");
    await wait(1000);

    setPhase("move");
    setCraneX(OUTLET.x);
    setCraneZ(OUTLET.z);
    await wait(1100);

    setPhase("drop");
    await wait(550);

    setPhase("result");
  };

  const closeResult = () => {
    setPhase("idle");
    setPrize(null);
    setShuffleSeed((s) => s + 1);
    setCraneX(50);
    setCraneZ(50);
  };

  // ── キッド未選択 ─────────────────────────────
  if (!selectedKid) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-fuchsia-100 via-pink-100 to-amber-100 px-4 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-3xl">🕹️🎯🕹️</p>
          <h1 className="mt-2 text-3xl font-extrabold text-fuchsia-800 sm:text-4xl">
            だれが クレーンゲーム？
          </h1>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {kids.map((kid) => (
              <button
                key={kid.id}
                type="button"
                onClick={() => setKidId(kid.id)}
                className="rounded-3xl bg-white px-6 py-6 text-2xl font-extrabold text-fuchsia-800 shadow-lg ring-2 ring-fuchsia-200 transition active:scale-95 hover:ring-fuchsia-400"
              >
                <NameRuby name={kid.name} />
              </button>
            ))}
          </div>
          <Link
            href="/kids"
            className="mt-10 inline-block text-sm font-bold text-fuchsia-700 underline"
          >
            ← こども ポータルへ もどる
          </Link>
        </div>
      </main>
    );
  }

  // クレーン本体の投影位置
  const craneProj = project(craneX, craneZ);

  // キャッチ動作中のケーブル長さ（プレイエリア高さに対する％）
  const cableTopPercent = 6; // 天井すぐ下
  const cableRestPercent = 24; // 通常時のケーブル先端 Y
  const cableDeepPercent = 78; // 降りきった時の Y
  const cableTipPercent =
    phase === "descend" || phase === "grip"
      ? cableDeepPercent
      : phase === "drop"
        ? 60
        : cableRestPercent;

  // 掴んだアイテムを表示するのは grip 以降 result まで
  const showCarriedItem =
    prize !== null &&
    (phase === "grip" ||
      phase === "lift" ||
      phase === "move" ||
      phase === "drop");

  return (
    <main className="min-h-screen bg-gradient-to-b from-fuchsia-100 via-pink-100 to-amber-100 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href={`/kids?kid=${selectedKid.id}`}
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-fuchsia-700 shadow ring-1 ring-fuchsia-200 transition active:scale-95"
          >
            ← ポータルへ
          </Link>
          <p className="text-sm font-bold text-fuchsia-700/80">クレーンゲーム</p>
          <p className="rounded-full bg-amber-200 px-3 py-1 text-xs font-extrabold text-amber-900">
            <NameRuby name={selectedKid.name} />：
            {coinBalance.toLocaleString()} 🪙
          </p>
        </div>

        {/* 筐体 */}
        <section className="rounded-[2rem] bg-gradient-to-br from-pink-300 via-fuchsia-300 to-violet-300 p-2 shadow-2xl">
          <div className="rounded-[1.7rem] bg-gradient-to-br from-pink-200 to-violet-200 p-3 ring-4 ring-white">
            {/* タイトル看板 */}
            <div className="mb-2 text-center">
              <p className="inline-block rounded-full bg-white px-4 py-1 text-sm font-black text-fuchsia-700 shadow">
                🎯 CHORE SAFARI CRANE 🎯
              </p>
            </div>

            {/* プレイエリア（ガラス窓） */}
            <PlayArea
              items={items}
              craneProj={craneProj}
              craneX={craneX}
              craneZ={craneZ}
              phase={phase}
              prize={prize}
              cableTopPercent={cableTopPercent}
              cableTipPercent={cableTipPercent}
              showCarriedItem={showCarriedItem}
            />

            {/* コインスロット風の装飾 */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-fuchsia-700 ring-1 ring-fuchsia-300">
                🪙 1かい {CRANE_COST}
              </div>
              <div className="rounded-xl bg-rose-100 px-3 py-2 text-[10px] font-extrabold text-rose-700 ring-1 ring-rose-300">
                クラフトひんも でるよ！
              </div>
            </div>
          </div>
        </section>

        {/* 操作パネル */}
        <section className="rounded-3xl bg-white/90 p-4 shadow-lg ring-2 ring-fuchsia-200">
          <div className="flex items-center gap-4">
            {/* D-pad */}
            <div className="relative h-40 w-40 shrink-0">
              <DPadButton
                label="⬆️"
                sub="おく"
                position="top"
                onClick={() => move(0, +STEP)}
                disabled={moveBusy}
              />
              <DPadButton
                label="⬇️"
                sub="てまえ"
                position="bottom"
                onClick={() => move(0, -STEP)}
                disabled={moveBusy}
              />
              <DPadButton
                label="⬅️"
                sub="ひだり"
                position="left"
                onClick={() => move(-STEP, 0)}
                disabled={moveBusy}
              />
              <DPadButton
                label="➡️"
                sub="みぎ"
                position="right"
                onClick={() => move(+STEP, 0)}
                disabled={moveBusy}
              />
              <div className="absolute inset-x-12 inset-y-12 rounded-full bg-fuchsia-100" />
            </div>

            {/* キャッチ */}
            <button
              type="button"
              onClick={handleCatch}
              disabled={moveBusy || coinBalance < CRANE_COST}
              className={`flex h-40 flex-1 flex-col items-center justify-center rounded-3xl text-2xl font-black text-white shadow-xl transition active:scale-[0.97] ${
                moveBusy || coinBalance < CRANE_COST
                  ? "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
                  : "bg-gradient-to-br from-rose-500 via-fuchsia-500 to-violet-500 hover:brightness-110"
              }`}
            >
              <span className="text-5xl drop-shadow">🎯</span>
              <span className="mt-1">キャッチ！</span>
              <span className="mt-1 text-xs font-bold opacity-90">
                {CRANE_COST} コイン
              </span>
            </button>
          </div>

          {error && (
            <p className="mt-3 text-center text-sm font-bold text-rose-500">
              {error}
            </p>
          )}
          {moveBusy && (
            <p className="mt-3 text-center text-xs text-fuchsia-600/80">
              ☆ どうさちゅう… おちつけ おちつけ ☆
            </p>
          )}
        </section>

        <p className="text-center text-xs text-fuchsia-700/70">
          ✨ クレーンゲームは ガチャより いい アイテムが でるよ ✨
        </p>
      </div>

      {phase === "result" && prize && (
        <ResultModal prize={prize} onClose={closeResult} />
      )}
    </main>
  );
}

// ────────── プレイエリア ──────────
function PlayArea({
  items,
  craneProj,
  craneX,
  craneZ,
  phase,
  prize,
  cableTopPercent,
  cableTipPercent,
  showCarriedItem,
}: {
  items: Array<{ id: string; itemId: string; x: number; z: number; rot: number }>;
  craneProj: { xRatio: number; yRatio: number; scale: number };
  craneX: number;
  craneZ: number;
  phase: Phase;
  prize: Prize | null;
  cableTopPercent: number;
  cableTipPercent: number;
  showCarriedItem: boolean;
}) {
  const areaRef = useRef<HTMLDivElement>(null);

  // 移動アニメ用のトランジション秒数（フェーズで切り替え）
  const carriageTransition =
    phase === "move"
      ? "left 1.0s cubic-bezier(.4,0,.2,1), top 1.0s cubic-bezier(.4,0,.2,1), transform 1.0s"
      : "left 0.45s, top 0.45s, transform 0.45s";

  const cableTransition =
    phase === "descend"
      ? "top 1.1s cubic-bezier(.55,.05,.4,1), height 1.1s cubic-bezier(.55,.05,.4,1)"
      : phase === "lift"
        ? "top 1.0s cubic-bezier(.4,0,.2,1), height 1.0s cubic-bezier(.4,0,.2,1)"
        : phase === "drop"
          ? "top 0.55s ease-in, height 0.55s ease-in"
          : "top 0.4s, height 0.4s";

  return (
    <div
      ref={areaRef}
      className="relative aspect-[5/6] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-amber-50 to-amber-200 shadow-inner"
    >
      {/* 背景の奥の壁＋床（パース感） */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(125,184,255,0.25) 0%, rgba(125,184,255,0.12) 25%, transparent 40%)",
        }}
      />
      {/* 床（台形クリップで奥行き） */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(217,119,6,0.45), rgba(245,158,11,0.25) 35%, transparent 60%)",
          clipPath: "polygon(6% 100%, 94% 100%, 72% 30%, 28% 30%)",
        }}
      />
      {/* 床のグリッド線（薄め） */}
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {[0.4, 0.55, 0.7, 0.85].map((y, i) => (
          <line
            key={i}
            x1={28 - (100 - y * 100) * 0}
            x2={72 + (100 - y * 100) * 0}
            y1={30 + (100 - 30) * ((y - 0.4) / 0.6)}
            y2={30 + (100 - 30) * ((y - 0.4) / 0.6)}
            stroke="rgba(120,80,40,0.18)"
            strokeWidth="0.4"
          />
        ))}
      </svg>

      {/* 取り出し口 */}
      <div
        className="absolute rounded-tl-xl rounded-tr-2xl border-2 border-amber-700/60 bg-gradient-to-b from-slate-900/30 to-slate-900/60"
        style={{
          left: "4%",
          bottom: "0%",
          width: "20%",
          height: "16%",
        }}
      >
        <p className="absolute inset-x-0 -top-5 text-center text-[10px] font-extrabold text-amber-800">
          とりだしぐち
        </p>
      </div>

      {/* 上部の天井レール */}
      <div className="absolute inset-x-3 top-3 h-2 rounded-full bg-gradient-to-b from-slate-700 to-slate-500 shadow" />

      {/* 落ちているアイテム達 */}
      {items.map((it) => {
        const p = project(it.x, it.z);
        return (
          <span
            key={it.id}
            className="pointer-events-none absolute select-none drop-shadow"
            style={{
              left: `${p.xRatio * 100}%`,
              top: `${p.yRatio * 100}%`,
              transform: `translate(-50%, -50%) scale(${p.scale}) rotate(${it.rot}deg)`,
              fontSize: "2.5rem",
              transition: "transform 0.3s",
            }}
          >
            {ITEM_EMOJI[it.itemId] ?? "❓"}
          </span>
        );
      })}

      {/* クレーン本体（キャリッジ＋ケーブル＋グラバー） */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${craneProj.xRatio * 100}%`,
          top: `${cableTopPercent}%`,
          transform: `translate(-50%, 0) scale(${craneProj.scale})`,
          transformOrigin: "top center",
          transition: carriageTransition,
        }}
      >
        {/* キャリッジ */}
        <div className="relative -translate-x-1/2 left-1/2">
          <div className="h-3 w-16 rounded-md bg-gradient-to-b from-slate-700 to-slate-900 shadow-lg" />
          <div className="mx-auto h-1 w-2 bg-slate-700" />
        </div>
      </div>

      {/* ケーブル + グラバー（同じ X だが、ケーブル先端の Y は phase で変動） */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${craneProj.xRatio * 100}%`,
          top: `${cableTopPercent + 2}%`,
          transform: `translate(-50%, 0)`,
          transition: "left 0.45s, transform 0.45s",
        }}
      >
        {/* ケーブル（高さ可変） */}
        <div
          className="mx-auto w-[3px] bg-gradient-to-b from-slate-500 to-slate-700"
          style={{
            height: `calc(${cableTipPercent - cableTopPercent - 2}% * 6)`,
            transition: cableTransition,
          }}
        />
        {/* グラバー */}
        <div
          className="relative -mt-1 mx-auto flex h-8 w-10 items-end justify-center"
          style={{
            transform: `scale(${craneProj.scale})`,
            transformOrigin: "top center",
            transition: "transform 0.45s",
          }}
        >
          {/* 左ツメ */}
          <span
            className="absolute -left-1 bottom-0 block h-7 w-2 rounded-b-md bg-gradient-to-b from-slate-500 to-slate-800"
            style={{
              transform:
                phase === "grip" || phase === "lift" || phase === "move"
                  ? "rotate(20deg)"
                  : "rotate(40deg)",
              transformOrigin: "top center",
              transition: "transform 0.4s",
            }}
          />
          {/* 右ツメ */}
          <span
            className="absolute -right-1 bottom-0 block h-7 w-2 rounded-b-md bg-gradient-to-b from-slate-500 to-slate-800"
            style={{
              transform:
                phase === "grip" || phase === "lift" || phase === "move"
                  ? "rotate(-20deg)"
                  : "rotate(-40deg)",
              transformOrigin: "top center",
              transition: "transform 0.4s",
            }}
          />
          {/* 中央の本体 */}
          <span className="block h-3 w-6 rounded-b-md bg-slate-700" />

          {/* 掴んだアイテム */}
          {showCarriedItem && prize && (
            <span
              className="absolute left-1/2 top-3 -translate-x-1/2 select-none text-3xl drop-shadow"
              style={{
                transition: "transform 0.5s",
                transform:
                  phase === "drop"
                    ? "translate(-50%, 36px) scale(0.9)"
                    : "translate(-50%, 0) scale(1)",
                opacity: phase === "drop" ? 0.5 : 1,
              }}
            >
              {ITEM_EMOJI[prize.itemId] ?? "❓"}
            </span>
          )}
        </div>
      </div>

      {/* デバッグ：座標表示（小さく） */}
      <div className="absolute right-2 top-2 rounded-md bg-white/70 px-2 py-0.5 text-[10px] font-bold text-fuchsia-700">
        X:{craneX} Z:{craneZ}
      </div>
    </div>
  );
}

// ────────── D-pad ボタン ──────────
function DPadButton({
  label,
  sub,
  position,
  onClick,
  disabled,
}: {
  label: string;
  sub: string;
  position: "top" | "bottom" | "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  const posClass =
    position === "top"
      ? "top-0 left-1/2 -translate-x-1/2"
      : position === "bottom"
        ? "bottom-0 left-1/2 -translate-x-1/2"
        : position === "left"
          ? "left-0 top-1/2 -translate-y-1/2"
          : "right-0 top-1/2 -translate-y-1/2";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`absolute ${posClass} flex h-12 w-12 flex-col items-center justify-center rounded-2xl text-lg font-black shadow-lg ring-2 ring-white transition active:scale-90 ${
        disabled
          ? "cursor-not-allowed bg-gray-200 text-gray-400"
          : "bg-gradient-to-br from-fuchsia-300 to-violet-300 text-fuchsia-900 hover:brightness-110"
      }`}
      aria-label={sub}
    >
      <span>{label}</span>
      <span className="text-[9px] font-bold">{sub}</span>
    </button>
  );
}

// ────────── 結果モーダル ──────────
function ResultModal({
  prize,
  onClose,
}: {
  prize: Prize;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-live="polite"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm touch-manipulation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-4 max-w-sm rounded-[2rem] bg-gradient-to-br from-yellow-200 via-pink-200 to-violet-200 p-1 shadow-2xl"
      >
        <div className="rounded-[1.7rem] bg-white px-6 py-10 text-center">
          <p className="text-sm font-extrabold tracking-[0.3em] text-fuchsia-500">
            ✨ ゲット ✨
          </p>
          <div className="relative my-4 flex items-center justify-center">
            <span aria-hidden className="absolute text-9xl opacity-20 blur-md">
              {ITEM_EMOJI[prize.itemId] ?? "🎁"}
            </span>
            <span
              aria-hidden
              className="relative text-8xl drop-shadow-lg animate-bounce"
            >
              {ITEM_EMOJI[prize.itemId] ?? "🎁"}
            </span>
          </div>
          <p className="text-3xl font-black text-fuchsia-700">
            {prize.itemName}
          </p>
          <p className="mt-2 text-base font-bold text-fuchsia-500">
            を ゲットしたよ！
          </p>
          <p className="mt-2 text-xs text-fuchsia-700/70">
            そうこに ぜんぶで {prize.totalQuantity} こ
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-full bg-fuchsia-500 px-6 py-2 text-sm font-extrabold text-white shadow transition hover:brightness-110"
          >
            やったー！
          </button>
        </div>
      </div>
    </div>
  );
}
