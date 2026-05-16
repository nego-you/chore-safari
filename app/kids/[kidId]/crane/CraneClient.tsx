"use client";

// アーケード仕様のクレーンゲーム。
// - アイテムは中央に「山積み」（座標と結果のミスマッチを回避）
// - フェーズ: IDLE → DROPPING → GRABBING → RAISING → MOVING_TO_EXIT → RELEASE → SHOW
// - RAISING / MOVING_TO_EXIT 中に 20% の確率でアイテム落下（ハラハラ仕様）
// - 落下時は inventory に入らず、コインだけ消費（バックエンドの didCatch=false で）

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { playCraneGame } from "../../actions";
import { CRANE_COST } from "../../config";

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

type Phase =
  | "idle"
  | "dropping"      // アームが降りる
  | "grabbing"      // ツメを閉じる（API 叩く）
  | "raising"       // 持ち上げる
  | "moving_to_exit"
  | "release"
  | "show";

type Prize = {
  itemId: string;
  itemName: string;
  itemType: "FOOD" | "TRAP_PART";
  count: number; // この回で取れた個数
  totalQuantity: number | null; // 在庫合計（dropped 時は null）
  emoji: string;
};

type Outcome =
  | { kind: "caught"; prizes: Prize[] }
  | { kind: "dropped"; prizes: Prize[] }
  | null;

const STEP = 18;
const DROP_CHANCE = 0.2; // 20%
const OUTLET = { x: 10, z: 5 };

// 各フェーズ時間 (ms)
const T = {
  drop: 1000,
  grab: 500,
  raise: 1000,
  move: 1000,
  release: 600,
  fall: 800, // 途中で落ちる演出
};

// アームの降下量（px）。play area の中央〜下まで届く長さ。
// vh と px の min で「広い画面では 360px、狭い画面では 48vh」の保険つき。
const ARM_DESCEND = {
  rest: "0px",
  deep: "min(48vh, 360px)",  // dropping / grabbing
  release: "min(28vh, 200px)", // 取り出し口で少しだけ下げる
} as const;

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// (x, z) ∈ [0,100]² を擬似 3D 投影（クレーンの平面位置だけに使う）
function projectCrane(x: number, z: number) {
  const t = z / 100;
  const leftEdge = 0.08 + 0.22 * t;
  const rightEdge = 0.92 - 0.22 * t;
  const xRatio = leftEdge + (x / 100) * (rightEdge - leftEdge);
  const scale = 1.0 - 0.35 * t;
  return { xRatio, scale };
}

// 山積みアイテム：中央の床に重なって積まれた絵文字群。
// 初期マウントで一度だけ生成し、リザルトを閉じるたびにシャッフル。
type HeapItem = {
  key: string;
  emoji: string;
  dx: number; // 中心からの横ずれ (px 換算: -60..60)
  dy: number; // 中心からの縦ずれ
  rot: number; // 回転
  size: number; // rem
  z: number; // 奥行きで重なる順
};

function buildHeap(seed: number): HeapItem[] {
  // 12〜16 個ほど積む。ITEM_EMOJI からランダム選択。
  const keys = Object.keys(ITEM_EMOJI);
  const count = 14;
  const items: HeapItem[] = [];
  // 疑似乱数（seed を変えるごとに違う配置に）
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < count; i++) {
    const itemId = keys[Math.floor(rand() * keys.length)];
    items.push({
      key: `${seed}-${i}`,
      emoji: ITEM_EMOJI[itemId] ?? "❓",
      // 横はまんべんなく、縦は下に行くほど詰まる感じに
      dx: (rand() - 0.5) * 130,
      dy: -rand() * 60,
      rot: (rand() - 0.5) * 40,
      size: 2.6 + rand() * 1.0,
      z: i,
    });
  }
  // 上から積み上がる感じに dy 降順で並べる（手前のものほど画面下）
  items.sort((a, b) => a.dy - b.dy);
  return items;
}

export function CraneClient({ initialKidId, kids }: Props) {
  const [kidId, setKidId] = useState<string | null>(initialKidId);
  const [craneX, setCraneX] = useState(50);
  const [craneZ, setCraneZ] = useState(50);
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [error, setError] = useState<string | null>(null);
  const [coinBalance, setCoinBalance] = useState(
    initialKidId
      ? kids.find((k) => k.id === initialKidId)?.coinBalance ?? 0
      : 0,
  );
  const [heapSeed, setHeapSeed] = useState(1);
  const heap = useMemo(() => buildHeap(heapSeed), [heapSeed]);

  // 持ち上げ中アイテムの絵文字配列（grabbing 以降で見える）。
  // 同じ絵文字が複数並ぶこともある（同種アイテムが複数当たった場合）。
  const [carriedEmojis, setCarriedEmojis] = useState<string[]>([]);
  // 落下中フラグ（drop アニメーションを発火）
  const [falling, setFalling] = useState(false);

  // 子の切替時に残高を取り直す
  useEffect(() => {
    if (!kidId) return;
    const k = kids.find((x) => x.id === kidId);
    if (k) setCoinBalance(k.coinBalance);
  }, [kidId, kids]);

  const selectedKid = kidId ? kids.find((k) => k.id === kidId) ?? null : null;
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
    setFalling(false);
    setCarriedEmojis([]);

    // 運命判定：落ちるか、落ちないか。落ちる場合はどのフェーズで落とすか。
    const willDrop = Math.random() < DROP_CHANCE;
    const dropPhase: "raise" | "move" | null = willDrop
      ? Math.random() < 0.5
        ? "raise"
        : "move"
      : null;
    const didCatch = !willDrop;

    // === DROPPING ===
    setPhase("dropping");
    await wait(T.drop);

    // === GRABBING ===
    setPhase("grabbing");
    // 結果を取得（didCatch 確定）
    const result = await playCraneGame(selectedKid.id, didCatch);
    if (!result.success) {
      setError(result.error);
      setPhase("idle");
      return;
    }
    setCoinBalance(result.newCoinBalance);
    // サーバから返ってきた items（itemId ごとに集約済み）を Prize[] に展開する。
    // 同じ itemId が複数取れた場合は emoji を count 回ぶん carriedEmojis に並べる。
    const prizes: Prize[] = result.items.map((it) => ({
      itemId: it.itemId,
      itemName: it.itemName,
      itemType: it.itemType,
      count: it.count,
      totalQuantity: it.totalQuantity,
      emoji: ITEM_EMOJI[it.itemId] ?? "🎁",
    }));
    const emojis: string[] = prizes.flatMap((p) =>
      Array.from({ length: p.count }, () => p.emoji),
    );
    setCarriedEmojis(emojis);
    await wait(T.grab);

    // === RAISING ===
    setPhase("raising");
    if (dropPhase === "raise") {
      // 上昇途中で落とす：raise の半分でつるん…
      await wait(T.raise / 2);
      setFalling(true);
      await wait(T.fall);
      setCarriedEmojis([]);
      setFalling(false);
      setOutcome({ kind: "dropped", prizes });
      setPhase("show");
      return;
    }
    await wait(T.raise);

    // === MOVING_TO_EXIT ===
    setPhase("moving_to_exit");
    setCraneX(OUTLET.x);
    setCraneZ(OUTLET.z);
    if (dropPhase === "move") {
      // 移動途中で落とす：move の半分でつるん…
      await wait(T.move / 2);
      setFalling(true);
      await wait(T.fall);
      setCarriedEmojis([]);
      setFalling(false);
      setOutcome({ kind: "dropped", prizes });
      setPhase("show");
      return;
    }
    await wait(T.move);

    // === RELEASE ===
    setPhase("release");
    await wait(T.release);

    // === SHOW ===
    setCarriedEmojis([]);
    setOutcome({ kind: "caught", prizes });
    setPhase("show");
  };

  const closeResult = () => {
    setOutcome(null);
    setPhase("idle");
    setCraneX(50);
    setCraneZ(50);
    setCarriedEmojis([]);
    setFalling(false);
    setHeapSeed((s) => s + 1);
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

  const cranePos = projectCrane(craneX, craneZ);

  return (
    <main className="min-h-screen bg-gradient-to-b from-fuchsia-100 via-pink-100 to-amber-100 px-4 py-6">
      <style>{CSS_KEYFRAMES}</style>

      <div className="mx-auto max-w-2xl space-y-5">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href={`/kids/${selectedKid.id}`}
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

            <PlayArea
              heap={heap}
              cranePos={cranePos}
              craneX={craneX}
              craneZ={craneZ}
              phase={phase}
              carriedEmojis={carriedEmojis}
              falling={falling}
            />

            {/* フッタ装飾 */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-fuchsia-700 ring-1 ring-fuchsia-300">
                🪙 1かい {CRANE_COST}
              </div>
              <div className="rounded-xl bg-rose-100 px-3 py-2 text-[10px] font-extrabold text-rose-700 ring-1 ring-rose-300">
                {DROP_CHANCE * 100}% で とちゅう おち！？
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
            <p className="mt-3 text-center text-xs font-bold text-fuchsia-600/80">
              {phase === "dropping" && "⬇️ アームが おりていくよ…"}
              {phase === "grabbing" && "✊ つかむ！"}
              {phase === "raising" && "⬆️ もちあげちゅう…"}
              {phase === "moving_to_exit" && "🛒 とりだしぐちへ うんぱん…"}
              {phase === "release" && "🎁 おとす！"}
            </p>
          )}
        </section>

        <p className="text-center text-xs text-fuchsia-700/70">
          ✨ ガチャより いい アイテムが でるよ。でも 5かいに 1かいくらい とちゅうで おとすかも… ✨
        </p>
      </div>

      {outcome && <ResultModal outcome={outcome} onClose={closeResult} />}
    </main>
  );
}

// ────────── プレイエリア ──────────
function PlayArea({
  heap,
  cranePos,
  craneX,
  craneZ,
  phase,
  carriedEmojis,
  falling,
}: {
  heap: HeapItem[];
  cranePos: { xRatio: number; scale: number };
  craneX: number;
  craneZ: number;
  phase: Phase;
  carriedEmojis: string[];
  falling: boolean;
}) {
  // ケーブルの上端（プレイエリア上端からの位置）。
  const CABLE_TOP_PERCENT = 8;

  // フェーズごとの「アームの降下量」と transition 時間。
  // ARM_DESCEND.* は CSS 文字列（"min(48vh, 360px)" 等）。
  const armDescent =
    phase === "dropping" || phase === "grabbing"
      ? ARM_DESCEND.deep
      : phase === "release"
        ? ARM_DESCEND.release
        : ARM_DESCEND.rest;

  const armTransitionMs =
    phase === "dropping"
      ? T.drop
      : phase === "raising"
        ? T.raise
        : phase === "release"
          ? T.release
          : 450;

  // 上下移動の cubic-bezier。ためを作って「ぐぐっ」と落ちる感じ。
  const armEasing = "cubic-bezier(.55,.06,.36,1)";

  // 横移動の transition（取り出し口への横スライド用）。
  const carriageTransition =
    phase === "moving_to_exit"
      ? `left ${T.move}ms cubic-bezier(.4,0,.2,1), transform ${T.move}ms`
      : "left 0.45s, transform 0.45s";

  // ケーブルとアームで同じ降下量・同じ transition を使う。
  const armVerticalTransition = `transform ${armTransitionMs}ms ${armEasing}, left ${T.move}ms cubic-bezier(.4,0,.2,1)`;
  const cableVerticalTransition = `height ${armTransitionMs}ms ${armEasing}, left ${T.move}ms cubic-bezier(.4,0,.2,1)`;

  return (
    <div className="relative aspect-[5/6] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-amber-50 to-amber-200 shadow-inner">
      {/* 奥の壁ハイライト */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(125,184,255,0.25) 0%, rgba(125,184,255,0.10) 25%, transparent 40%)",
        }}
      />
      {/* 台形の床 */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(217,119,6,0.45), rgba(245,158,11,0.25) 35%, transparent 60%)",
          clipPath: "polygon(6% 100%, 94% 100%, 72% 30%, 28% 30%)",
        }}
      />

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

      {/* 山積みアイテム：中央の床に集中 */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: "50%",
          bottom: "8%",
          transform: "translateX(-50%)",
        }}
      >
        {heap.map((it) => (
          <span
            key={it.key}
            aria-hidden
            className="absolute select-none drop-shadow"
            style={{
              left: `${it.dx}px`,
              bottom: `${it.dy}px`,
              transform: `translate(-50%, 0) rotate(${it.rot}deg)`,
              fontSize: `${it.size}rem`,
              zIndex: it.z,
            }}
          >
            {it.emoji}
          </span>
        ))}
        {/* 山の影 */}
        <span
          aria-hidden
          className="absolute -bottom-2 left-1/2 -z-10 block h-4 w-44 -translate-x-1/2 rounded-full bg-amber-900/30 blur"
        />
      </div>

      {/* 上部レール */}
      <div className="absolute inset-x-3 top-3 h-2 rounded-full bg-gradient-to-b from-slate-700 to-slate-500 shadow" />

      {/* キャリッジ（レールに沿って X だけ動く）*/}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${cranePos.xRatio * 100}%`,
          top: `${CABLE_TOP_PERCENT - 2}%`,
          transform: `translate(-50%, 0) scale(${cranePos.scale})`,
          transformOrigin: "top center",
          transition: carriageTransition,
          zIndex: 25,
        }}
      >
        <div className="h-3 w-16 rounded-md bg-gradient-to-b from-slate-700 to-slate-900 shadow-lg" />
      </div>

      {/* ケーブル（カバーから伸び縮みする紐）。高さを armDescent と連動。 */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${cranePos.xRatio * 100}%`,
          top: `${CABLE_TOP_PERCENT}%`,
          width: "3px",
          height: armDescent,
          background:
            "linear-gradient(to bottom, #475569, #334155 30%, #1e293b)",
          transform: "translateX(-50%)",
          transition: cableVerticalTransition,
          zIndex: 28,
          boxShadow: "0 0 2px rgba(0,0,0,0.4)",
        }}
      />

      {/* アーム本体（ツメ＋掴んだアイテム）。translateY で確実に降下。 */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${cranePos.xRatio * 100}%`,
          top: `${CABLE_TOP_PERCENT}%`,
          // X方向は中央寄せ、Y方向は armDescent ぶんだけ降ろす。
          transform: `translate(-50%, 0) translateY(${armDescent})`,
          transition: armVerticalTransition,
          zIndex: 30,
        }}
      >
        <div
          className="relative flex h-10 w-12 items-end justify-center"
          style={{
            transform: `scale(${cranePos.scale})`,
            transformOrigin: "top center",
            transition: "transform 0.45s",
          }}
        >
          {/* 左ツメ */}
          <span
            className="absolute -left-1 bottom-0 block h-7 w-2 rounded-b-md bg-gradient-to-b from-slate-500 to-slate-800"
            style={{
              transform:
                phase === "grabbing" ||
                phase === "raising" ||
                phase === "moving_to_exit"
                  ? "rotate(15deg)"
                  : "rotate(42deg)",
              transformOrigin: "top center",
              transition: "transform 0.4s",
            }}
          />
          {/* 右ツメ */}
          <span
            className="absolute -right-1 bottom-0 block h-7 w-2 rounded-b-md bg-gradient-to-b from-slate-500 to-slate-800"
            style={{
              transform:
                phase === "grabbing" ||
                phase === "raising" ||
                phase === "moving_to_exit"
                  ? "rotate(-15deg)"
                  : "rotate(-42deg)",
              transformOrigin: "top center",
              transition: "transform 0.4s",
            }}
          />
          {/* 本体（ツメの軸） */}
          <span className="block h-3 w-7 rounded-b-md bg-slate-700 shadow" />

          {/* 持ち上げ中のアイテム：ツメの内側にぶらさがる。
              複数取れたときは少しずつ位置をずらして房状に重ねる。 */}
          {carriedEmojis.length > 0 && !falling && (
            <div
              className="absolute left-1/2 top-4 -translate-x-1/2 select-none"
              style={{
                transition: "transform 0.4s, opacity 0.4s",
                transform:
                  phase === "release"
                    ? "translate(-50%, 32px) scale(0.85)"
                    : "translate(-50%, 0) scale(1)",
                opacity: phase === "release" ? 0.3 : 1,
              }}
            >
              {carriedEmojis.map((emoji, i) => {
                // 中央を 0 として、左右に少しずつずらして並べる。
                const offset =
                  carriedEmojis.length === 1
                    ? 0
                    : (i - (carriedEmojis.length - 1) / 2) * 14;
                return (
                  <span
                    key={i}
                    aria-hidden
                    className="absolute left-1/2 top-0 text-4xl drop-shadow"
                    style={{
                      transform: `translate(calc(-50% + ${offset}px), ${i * 3}px) rotate(${(i - (carriedEmojis.length - 1) / 2) * 6}deg)`,
                    }}
                  >
                    {emoji}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 落下中アイテム：アームの位置から床へ。複数あればそれぞれ少しずつずれて落ちる。 */}
      {falling && carriedEmojis.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-40"
          style={{
            left: `${cranePos.xRatio * 100}%`,
            top: `${CABLE_TOP_PERCENT}%`,
            transform: `translate(-50%, 0) translateY(${armDescent})`,
          }}
        >
          {carriedEmojis.map((emoji, i) => {
            const offset =
              carriedEmojis.length === 1
                ? 0
                : (i - (carriedEmojis.length - 1) / 2) * 18;
            return (
              <span
                key={i}
                className="absolute left-1/2 top-0 block text-4xl drop-shadow-lg"
                style={{
                  transform: `translateX(calc(-50% + ${offset}px))`,
                  animation: `fall-from-arm ${T.fall + i * 80}ms cubic-bezier(.5,0,.8,1) forwards`,
                }}
              >
                {emoji}
              </span>
            );
          })}
        </div>
      )}
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
  outcome,
  onClose,
}: {
  outcome:
    | { kind: "caught"; prizes: Prize[] }
    | { kind: "dropped"; prizes: Prize[] };
  onClose: () => void;
}) {
  const isCaught = outcome.kind === "caught";
  const prizes = outcome.prizes;
  // 合計個数（同種が複数あるケースで「3こ ゲット！」と賑やかに見せる）
  const totalCount = prizes.reduce((s, p) => s + p.count, 0);
  const isMulti = totalCount > 1;

  // 成功時のみ紙吹雪。複数取れた時は派手めに撃つ。
  useEffect(() => {
    if (!isCaught) return;
    let cancelled = false;
    (async () => {
      const mod = await import("canvas-confetti");
      if (cancelled) return;
      const palette = [
        "#fda4af",
        "#fcd34d",
        "#a7f3d0",
        "#bae6fd",
        "#ddd6fe",
        "#fbcfe8",
      ];
      mod.default({
        particleCount: isMulti ? 280 : 180,
        spread: isMulti ? 130 : 100,
        origin: { y: 0.55 },
        colors: palette,
        zIndex: 9999,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [isCaught, isMulti]);

  return (
    <div
      role="dialog"
      aria-live="polite"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm touch-manipulation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`mx-4 max-w-sm rounded-[2rem] p-1 shadow-2xl ${
          isCaught
            ? "bg-gradient-to-br from-yellow-200 via-pink-200 to-violet-200"
            : "bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300"
        }`}
      >
        <div className="rounded-[1.7rem] bg-white px-6 py-10 text-center">
          {isCaught ? (
            <>
              <p className="text-sm font-extrabold tracking-[0.3em] text-fuchsia-500">
                {isMulti ? `✨ ${totalCount}こ まとめてゲット ✨` : "✨ ゲット ✨"}
              </p>
              {/* 絵文字の見せ方：1個なら大きく1個、複数なら横並びで表示。 */}
              <div className="relative my-4 flex flex-wrap items-center justify-center gap-2">
                {prizes.map((p, i) => (
                  <span
                    key={`${p.itemId}-${i}`}
                    aria-hidden
                    className={`relative drop-shadow-lg animate-bounce ${
                      isMulti ? "text-6xl" : "text-8xl"
                    }`}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    {p.emoji}
                    {p.count > 1 && (
                      <span className="absolute -right-2 -bottom-1 rounded-full bg-fuchsia-500 px-2 py-0.5 text-xs font-extrabold text-white shadow">
                        ×{p.count}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <ul className="space-y-1 text-base font-black text-fuchsia-700">
                {prizes.map((p) => (
                  <li key={p.itemId} className="flex items-center justify-center gap-2">
                    <span>{p.itemName}</span>
                    {p.count > 1 && (
                      <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-extrabold text-fuchsia-700">
                        × {p.count}
                      </span>
                    )}
                    {p.totalQuantity !== null && (
                      <span className="text-xs font-bold text-fuchsia-500/80">
                        （そうこ {p.totalQuantity}）
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-base font-bold text-fuchsia-500">
                を ゲットしたよ！
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold tracking-[0.3em] text-slate-500 animate-pulse">
                💧 とちゅう おち 💧
              </p>
              <div className="relative my-4 flex flex-wrap items-center justify-center gap-2">
                {prizes.map((p, i) => (
                  <span
                    key={`${p.itemId}-${i}`}
                    aria-hidden
                    className={`relative opacity-60 grayscale drop-shadow-lg ${
                      isMulti ? "text-6xl" : "text-8xl"
                    }`}
                    style={{ animation: `shake 0.4s linear 3` }}
                  >
                    {p.emoji}
                    {p.count > 1 && (
                      <span className="absolute -right-2 -bottom-1 rounded-full bg-slate-500 px-2 py-0.5 text-xs font-extrabold text-white shadow">
                        ×{p.count}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <ul className="space-y-0.5 text-base font-black text-slate-700">
                {prizes.map((p) => (
                  <li key={p.itemId}>
                    {p.itemName}
                    {p.count > 1 && (
                      <span className="ml-1 text-xs font-extrabold text-slate-500">
                        × {p.count}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-bold text-slate-600">
                {isMulti
                  ? "ああっ！ まとめて おちちゃった…"
                  : "ああっ！ とちゅうで おちちゃった…"}
              </p>
              <p className="mt-1 text-xs text-rose-500">
                ※ コインだけ なくなったよ（ざんねん…）
              </p>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`mt-6 rounded-full px-6 py-2 text-sm font-extrabold text-white shadow transition hover:brightness-110 ${
              isCaught ? "bg-fuchsia-500" : "bg-slate-500"
            }`}
          >
            {isCaught ? "やったー！" : "もう いっかい！"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────── キーフレーム ──────────
// 落下中アイテムが「アームの位置」から「下にスポーン」していく演出。
// 親 div が transform: translate(-50%, 0) translateY(armDescent) で位置決め済みなので、
// この span 自身は translateY のみで下方向にずれる。
const CSS_KEYFRAMES = `
  @keyframes fall-from-arm {
    0% { transform: translateY(0) rotate(0); opacity: 1; }
    70% { transform: translateY(220px) rotate(0); opacity: 1; }
    85% { transform: translateY(205px) rotate(-15deg); opacity: 1; }
    100% { transform: translateY(218px) rotate(12deg); opacity: 0.55; }
  }
  @keyframes shake {
    0% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    50% { transform: translateX(8px); }
    75% { transform: translateX(-6px); }
    100% { transform: translateX(0); }
  }
`;
