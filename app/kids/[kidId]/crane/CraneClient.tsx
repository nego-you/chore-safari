"use client";

// UFOキャッチャー仕様クレーンゲーム（コイン投入フェーズ + クラフト素材景品版）
// ステートマシン:
//   WAIT_COIN（初期）→「🪙 100コイ��をいれる」ボタン → spendCoins(100) → IDLE
//   IDLE → MOVING_RIGHT（右押し）→ WAITING_DEPTH（右離し）
//   → MOVING_DEPTH（奥押し）→ DROPPING（奥離し・自動降下）
//   → GRABBING → RETURNING → SHOW → WAIT_COIN（次のラウンドへ）
//
// 景品はクラフト工房で使え��素材（wood / stone / iron / thread / gunpowder）。
// ゲット成功時は addToInventory(materialId, 1) でストアに追加。
// API エラー時は addCoins(CRANE_COST) でコイン返還。

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playCraneGame } from "../../actions";
import { CRANE_COST } from "../../config";
import { useSafariStore } from "@/store/useSafariStore";

// ── 型 ──────────────────────────────────────────────────────────────────
type Kid = { id: string; name: string; coinBalance: number };
type Props = { initialKidId: string | null; kids: Kid[] };

type MachineState =
  | "WAIT_COIN"      // コイン投入待ち（初期 / ラウンド間）
  | "IDLE"           // 投入済み・操作待ち
  | "MOVING_RIGHT"
  | "WAITING_DEPTH"
  | "MOVING_DEPTH"
  | "DROPPING"
  | "GRABBING"
  | "RETURNING"
  | "SHOW";

// ── クラフト素材テーブル ─────────────────────────────────────────────────
const CRAFT_MATERIALS = [
  { id: "wood",      emoji: "🪵", name: "きのえだ" },
  { id: "stone",     emoji: "🪨", name: "いし"     },
  { id: "iron",      emoji: "🔩", name: "てつ"     },
  { id: "thread",    emoji: "🧶", name: "いと"     },
  { id: "gunpowder", emoji: "🧨", name: "かやく"   },
] as const;

type CraftMaterial = (typeof CRAFT_MATERIALS)[number];

const MATERIAL_EMOJI: Record<string, string> = Object.fromEntries(
  CRAFT_MATERIALS.map((m) => [m.id, m.emoji]),
);

function pickMaterial(): CraftMaterial {
  return CRAFT_MATERIALS[Math.floor(Math.random() * CRAFT_MATERIALS.length)];
}

type Prize = {
  materialId: string;
  name: string;
  emoji: string;
};

type Outcome =
  | { kind: "caught"; prize: Prize }
  | { kind: "dropped"; prize: Prize }
  | null;

// ── 定数 ────────────────────────────────────────────────────────────────
const X_START = 8;
const X_END   = 88;
const CABLE_TOP = 7;
const CABLE_EXTENDED = "min(46vh, 255px)";
const DROP_CHANCE = 0.2;

const MS = {
  moveX:        4000,
  depthInMs:    1200,
  depthOutMs:    400,
  moveY:        1500,
  grab:         1200,
  retract:       700,
  returnX:      1800,
  dropping:      700,
  fall:          850,
} as const;

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

// ── ��ーティリティ ────────────────────────────────────────────────────
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

// ── ヒー���生成（山積みアイテム：クラフト素材絵文字） ───────────────────
type HeapItem = {
  key: string; emoji: string;
  dx: number; dy: number; rot: number; size: number; z: number;
};

function buildHeap(seed: number): HeapItem[] {
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const items: HeapItem[] = Array.from({ length: 30 }, (_, i) => ({
    key: `${seed}-${i}`,
    emoji: CRAFT_MATERIALS[Math.floor(rand() * CRAFT_MATERIALS.length)].emoji,
    dx: (rand() - 0.5) * 220,
    dy: -rand() * 90,
    rot: (rand() - 0.5) * 50,
    size: 2.2 + rand() * 1.4,
    z: i,
  }));
  items.sort((a, b) => a.dy - b.dy);
  return items;
}

// ── ���インコンポーネント ──────────────────────────────────────────────
export function CraneClient({ initialKidId, kids }: Props) {
  const [kidId, setKidId] = useState<string | null>(initialKidId);
  const selectedKid = kidId ? kids.find((k) => k.id === kidId) ?? null : null;

  // ── マシンステート ────────────────────────────────────────────────
  const [mState,        setMState]        = useState<MachineState>("WAIT_COIN");
  const [craneX,        setCraneX]        = useState(X_START);
  const [xTransition,   setXTransition]   = useState("none");
  const [isDepth,       setIsDepth]       = useState(false);
  const [cableExtended, setCableExtended] = useState(false);
  const [clawClosed,    setClawClosed]    = useState(false);
  const [carriedEmojis, setCarriedEmojis] = useState<string[]>([]);
  const [falling,       setFalling]       = useState(false);
  const [fallingAtX,    setFallingAtX]    = useState(X_START);
  const [outcome,       setOutcome]       = useState<Outcome>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [heapSeed,      setHeapSeed]      = useState(1);
  const heap = useMemo(() => buildHeap(heapSeed), [heapSeed]);

  // ── Zustand ストア ────────────────────────────────────────────────
  const coins          = useSafariStore((s) => s.coins);
  const spendCoins     = useSafariStore((s) => s.spendCoins);
  const addCoins       = useSafariStore((s) => s.addCoins);
  const syncCoins      = useSafariStore((s) => s.syncCoins);
  const addToInventory = useSafariStore((s) => s.addToInventory);

  const moveStartRef = useRef(0);
  const busyRef      = useRef(false);

  // MOVING_RIGHT: 右端に達したら自動で WAITING_DEPTH へ
  useEffect(() => {
    if (mState !== "MOVING_RIGHT") return;
    const t = setTimeout(() => {
      setXTransition("none");
      setMState("WAITING_DEPTH");
    }, MS.moveX + 60);
    return () => clearTimeout(t);
  }, [mState]);

  // ── 🪙 コイン投入ボタン ───────────────────────────────────────────
  const handleInsertCoin = useCallback(() => {
    if (mState !== "WAIT_COIN") return;
    const ok = spendCoins(CRANE_COST);
    if (!ok) {
      setError(`コインが たりないよ！（あと ${CRANE_COST - coins} まい ひつよう）`);
      return;
    }
    setError(null);
    setMState("IDLE");
  }, [mState, spendCoins, coins]);

  // ── ➡️ ボタン押し（右��動開始） ──────────────────────────────────
  const handleRightDown = useCallback(() => {
    if (mState !== "IDLE") return;
    moveStartRef.current = Date.now();
    setXTransition(`left ${MS.moveX}ms linear`);
    setCraneX(X_END);
    setMState("MOVING_RIGHT");
  }, [mState]);

  // ── ➡️ ボタン離し（右移動停止 → WAITING_DEPTH） ──────────────────
  const handleRightUp = useCallback(() => {
    if (mState !== "MOVING_RIGHT") return;
    const elapsed  = Date.now() - moveStartRef.current;
    const progress = Math.min(1, elapsed / MS.moveX);
    const currentX = X_START + progress * (X_END - X_START);
    setXTransition("none");
    setCraneX(currentX);
    setMState("WAITING_DEPTH");
  }, [mState]);

  // ── ドロップシーケンス ────────────────────────────────────────────
  // コインは WAIT_COIN フェーズで既に spendCoins 済み。
  // API エラー時は addCoins(CRANE_COST) で返還す��。
  const runDropSequence = useCallback(
    async (capturedCraneX: number, kid: Kid) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setError(null);
      setFalling(false);
      setCarriedEmojis([]);

      const willDrop = Math.random() < DROP_CHANCE;
      const didCatch = !willDrop;

      // 今ラウンドの景品（クラフト素材）を事前に決定
      const material = pickMaterial();
      const prize: Prize = {
        materialId: material.id,
        name:       material.name,
        emoji:      material.emoji,
      };

      let reachedShow = false;

      try {
        // ① DROPPING: ケーブル降下
        setMState("DROPPING");
        setCableExtended(true);
        setCarriedEmojis([material.emoji]);
        await wait(MS.moveY);

        // ② GRABBING: ツ��を閉じて API 呼び出し
        setMState("GRABBING");
        setClawClosed(true);
        const grabStart = Date.now();

        let result: Awaited<ReturnType<typeof playCraneGame>>;
        try {
          result = await playCraneGame(kid.id, didCatch);
        } catch (apiErr) {
          console.error("[CraneGame] playCraneGame threw:", apiErr);
          // コイン返還（投入済みなので）
          addCoins(CRANE_COST);
          setError("つうしん エラーが おきたよ。コイ���を かえすね");
          return;
        }

        if (!result.success) {
          console.error("[CraneGame] API returned failure:", result.error);
          addCoins(CRANE_COST);
          setError((result.error ?? "エラーが発生したよ") + "（コインを かえすね）");
          return;
        }

        // DB 確定値でストアを同期
        syncCoins(result.newCoinBalance ?? 0);

        const grabRemaining = MS.grab - (Date.now() - grabStart);
        if (grabRemaining > 0) await wait(grabRemaining);

        // ③ RETURNING
        setMState("RETURNING");
        setCableExtended(false);
        setIsDepth(false);
        setXTransition(`left ${MS.returnX}ms cubic-bezier(.4,0,.2,1)`);
        setCraneX(X_START);

        if (willDrop) {
          const dropDelay = Math.round(MS.returnX * 0.4);
          await wait(dropDelay);
          setFallingAtX(capturedCraneX + (X_START - capturedCraneX) * 0.4);
          setClawClosed(false);
          setFalling(true);
          await wait(MS.fall);
          setCarriedEmojis([]);
          setFalling(false);
          await wait(MS.returnX - dropDelay + 100);
          setXTransition("none");
          reachedShow = true;
          setOutcome({ kind: "dropped", prize });
          setMState("SHOW");
        } else {
          await wait(Math.max(MS.retract, MS.returnX) + 100);
          setClawClosed(false);
          await wait(MS.dropping);
          setXTransition("none");
          setCarriedEmojis([]);
          // ゲット成功 → インベントリに追加
          addToInventory(material.id, 1);
          reachedShow = true;
          setOutcome({ kind: "caught", prize });
          setMState("SHOW");
        }
      } catch (e) {
        console.error("[CraneGame] unexpected error:", e);
        addCoins(CRANE_COST);
        setError("エラーが発生したよ。コインを かえすね");
      } finally {
        busyRef.current = false;
        if (!reachedShow) {
          setCableExtended(false);
          setClawClosed(false);
          setCarriedEmojis([]);
          setIsDepth(false);
          setFalling(false);
          setXTransition("none");
          setCraneX(X_START);
          setMState("WAIT_COIN");
        }
      }
    },
    [addCoins, syncCoins, addToInventory],
  );

  // ── ⬆️ ボタン押し（奥移動開始） ──────────────────────────────────
  const handleDepthDown = useCallback(() => {
    if (mState !== "WAITING_DEPTH") return;
    setIsDepth(true);
    setMState("MOVING_DEPTH");
  }, [mState]);

  // ── ⬆️ ボタン離し（自動降下トリガー）────────────────────────────
  // ���インは投入済みなので残高��ェックは不要
  const handleDepthUp = useCallback(() => {
    if (mState !== "MOVING_DEPTH" || !selectedKid) return;
    runDropSequence(craneX, selectedKid);
  }, [mState, selectedKid, craneX, runDropSequence]);

  // ── リセット（SHOW → WAIT_COIN） ──────────────────────────────────
  const closeResult = () => {
    setOutcome(null);
    setMState("WAIT_COIN");   // ��ラウンドはコイン投入から
    setCraneX(X_START);
    setXTransition("none");
    setCableExtended(false);
    setClawClosed(false);
    setCarriedEmojis([]);
    setFalling(false);
    setIsDepth(false);
    setHeapSeed((s) => s + 1);
  };

  // ── キッド未��択 ──────────────────────────────────────────────────
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
            ← こど��� ポー��ルへ もどる
          </Link>
        </div>
      </main>
    );
  }

  // ── ボタン有効状態 ────────────────────────────────────────────────
  const canAfford           = coins >= CRANE_COST;
  const isPlayPhase         = mState !== "WAIT_COIN" && mState !== "SHOW";
  const rightBtnInteractive = mState === "IDLE" || mState === "MOVING_RIGHT";
  const rightBtnHeld        = mState === "MOVING_RIGHT";
  const depthBtnInteractive = mState === "WAITING_DEPTH" || mState === "MOVING_DEPTH";
  const depthBtnHeld        = mState === "MOVING_DEPTH";

  const STATUS: Partial<Record<MachineState, string>> = {
    IDLE:          "➡️ ボタンを おし��� ��レーンを うごかそう！",
    MOVING_RIGHT:  "➡️ ボタンを はなすと とまるよ！",
    WAITING_DEPTH: "⬆️ ボタンを おして 奥に うごかそう！",
    MOVING_DEPTH:  "⬆️ ボタンを はなすと アー��が おちるよ！",
    DROPPING:      "⬇️ アームが おりていくよ…",
    GRABBING:      "✊ ぐっ��� ���かんだ！",
    RETURNING:     "⬆️ もちあげて もどってるよ…",
  };

  return (
    <main className="min-h-[calc(100vh-52px)] bg-gradient-to-b from-fuchsia-100 via-pink-100 to-amber-100 px-4 py-4">
      <style>{CSS_KEYFRAMES}</style>
      <div className="mx-auto max-w-2xl space-y-5">

        {/* ページタイトル */}
        <p className="text-center text-sm font-bold text-fuchsia-700/80">🎯 クレーンゲーム</p>

        {/* 筐体 */}
        <section className="rounded-[2rem] bg-gradient-to-br from-pink-300 via-fuchsia-300 to-violet-300 p-2 shadow-2xl">
          <div className="rounded-[1.7rem] bg-gradient-to-br from-pink-200 to-violet-200 p-3 ring-4 ring-white">
            <div className="mb-2 text-center">
              <p className="inline-block rounded-full bg-white px-4 py-1 text-sm font-black text-fuchsia-700 shadow">
                🎯 CHORE SAFARI CRANE 🎯
              </p>
            </div>

            <PlayArea
              heap={heap}
              craneX={craneX}
              xTransition={xTransition}
              isDepth={isDepth}
              cableExtended={cableExtended}
              clawClosed={clawClosed}
              mState={mState}
              carriedEmojis={carriedEmojis}
              falling={falling}
              fallingAtX={fallingAtX}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-fuchsia-700 ring-1 ring-fuchsia-300">
                🪙 1かい {CRANE_COST} コイン
              </div>
              <div className="rounded-xl bg-rose-100 px-3 py-2 text-[10px] font-extrabold text-rose-700 ring-1 ring-rose-300">
                {DROP_CHANCE * 100}% で と��ゅう おち！？
              </div>
            </div>
          </div>
        </section>

        {/* ──��� 操作パネル ──────────────────────────────────────────── */}
        <section className="rounded-3xl bg-white/90 p-5 shadow-lg ring-2 ring-fuchsia-200">

          {/* ── WAIT_COIN：コイン投入 UI ── */}
          {mState === "WAIT_COIN" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-xs font-bold text-fuchsia-600/70 tracking-widest">
                ── コ��ンを いれてね ──
              </p>
              <button
                type="button"
                onClick={handleInsertCoin}
                disabled={!canAfford}
                className={[
                  "w-full max-w-xs rounded-3xl py-5 text-2xl font-black shadow-xl transition active:scale-95",
                  canAfford
                    ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white hover:brightness-110 ring-4 ring-amber-300/60"
                    : "cursor-not-allowed bg-gray-200 text-gray-400 shadow-none",
                ].join(" ")}
              >
                🪙 {CRANE_COST} コインを いれる
              </button>
              {canAfford ? (
                <p className="text-xs font-bold text-fuchsia-500/70">
                  いま {coins} コイン もっ���るよ
                </p>
              ) : (
                <p className="text-sm font-bold text-rose-500">
                  コインが たりないよ！（あと {CRANE_COST - coins} まい ひつよう）
                </p>
              )}
              {error && (
                <p className="text-sm font-bold text-rose-500">{error}</p>
              )}
            </div>
          )}

          {/* ── IDLE 以降：クレーン操作 2 ボタン ── */}
          {isPlayPhase && (
            <>
              <div className="flex items-center justify-center gap-8">

                {/* ➡️ 右ボタン */}
                <button
                  type="button"
                  onPointerDown={handleRightDown}
                  onPointerUp={handleRightUp}
                  onPointerLeave={handleRightUp}
                  disabled={!rightBtnInteractive}
                  aria-label="右にうごかす"
                  style={{ touchAction: "none" }}
                  className={[
                    "flex h-28 w-36 select-none flex-col items-center justify-center gap-1 rounded-3xl text-5xl font-black shadow-xl transition active:scale-[0.92]",
                    rightBtnHeld
                      ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-4 ring-amber-300/70"
                      : rightBtnInteractive
                        ? "bg-gradient-to-br from-fuchsia-400 to-violet-500 text-white hover:brightness-110"
                        : "cursor-not-allowed bg-gray-200 text-gray-400 shadow-none",
                  ].join(" ")}
                >
                  ➡️
                  <span className="text-xs font-extrabold leading-none">
                    {rightBtnHeld ? "はなして！" : "みぎへ"}
                  </span>
                </button>

                {/* ⬆️ 奥ボタン */}
                <button
                  type="button"
                  onPointerDown={handleDepthDown}
                  onPointerUp={handleDepthUp}
                  onPointerLeave={handleDepthUp}
                  disabled={!depthBtnInteractive}
                  aria-label="奥にうごかして アームをおとす"
                  style={{ touchAction: "none" }}
                  className={[
                    "flex h-28 w-36 select-none flex-col items-center justify-center gap-1 rounded-3xl text-5xl font-black shadow-xl transition active:scale-[0.92]",
                    depthBtnHeld
                      ? "bg-gradient-to-br from-rose-400 to-pink-500 text-white ring-4 ring-rose-300/70"
                      : depthBtnInteractive
                        ? "bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white hover:brightness-110"
                        : "cursor-not-allowed bg-gray-200 text-gray-400 shadow-none",
                  ].join(" ")}
                >
                  ⬆️
                  <span className="text-xs font-extrabold leading-none">
                    {depthBtnHeld ? "はなして！" : "おくへ"}
                  </span>
                </button>
              </div>

              {error && (
                <p className="mt-4 text-center text-sm font-bold text-rose-500">{error}</p>
              )}
              {!error && STATUS[mState] && (
                <p className="mt-3 min-h-[1.25rem] text-center text-xs font-bold text-fuchsia-600/80">
                  {STATUS[mState]}
                </p>
              )}
            </>
          )}
        </section>

        {/* 景品ヒント */}
        <div className="rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-fuchsia-200">
          <p className="text-center text-[11px] font-bold text-fuchsia-600/70 mb-2">
            🎁 ゲットで���る クラフト素材
          </p>
          <div className="flex justify-center gap-4">
            {CRAFT_MATERIALS.map((m) => (
              <div key={m.id} className="flex flex-col items-center gap-0.5">
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[9px] font-bold text-fuchsia-700/70">{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-fuchsia-700/70">
          ��� クラフト工房で そうびが つくれるよ！ でも {DROP_CHANCE * 100}% で とちゅう おとすかも… ✨
        </p>
      </div>

      {outcome && <ResultModal outcome={outcome} onClose={closeResult} />}
    </main>
  );
}

// ── PlayArea ──────────────────────────────────────────────────────────
function PlayArea({
  heap,
  craneX,
  xTransition,
  isDepth,
  cableExtended,
  clawClosed,
  mState,
  carriedEmojis,
  falling,
  fallingAtX,
}: {
  heap: HeapItem[];
  craneX: number;
  xTransition: string;
  isDepth: boolean;
  cableExtended: boolean;
  clawClosed: boolean;
  mState: MachineState;
  carriedEmojis: string[];
  falling: boolean;
  fallingAtX: number;
}) {
  const depthTransform = isDepth
    ? "translateX(-50%) translateY(-18px) scale(0.88)"
    : "translateX(-50%) translateY(0px) scale(1)";

  const depthDur = `${isDepth ? MS.depthInMs : MS.depthOutMs}ms`;
  const combinedTransition =
    xTransition === "none"
      ? `transform ${depthDur} ease`
      : `${xTransition}, transform ${depthDur} ease`;

  return (
    <div className="relative aspect-[5/6] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-amber-50 to-amber-200 shadow-inner">

      {/* 奥の壁グラデーション */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(125,184,255,0.25) 0%, rgba(125,184,255,0.10) 25%, transparent 40%)",
        }}
      />

      {/* 台形の床 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(217,119,6,0.45), rgba(245,158,11,0.25) 35%, transparent 60%)",
          clipPath: "polygon(6% 100%, 94% 100%, 72% 30%, 28% 30%)",
        }}
      />

      {/* 取り出し口 */}
      <div
        className="absolute rounded-tl-xl rounded-tr-2xl border-2 border-amber-700/60 bg-gradient-to-b from-slate-900/30 to-slate-900/60"
        style={{ left: "4%", bottom: "0%", width: "20%", height: "16%" }}
      >
        <p className="absolute inset-x-0 -top-5 text-center text-[10px] font-extrabold text-amber-800">
          とりだしぐち
        </p>
      </div>

      {/* 山積み素材 */}
      <div
        className="pointer-events-none absolute"
        style={{ left: "50%", bottom: "8%", transform: "translateX(-50%)" }}
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
        <span
          aria-hidden
          className="absolute -bottom-2 left-1/2 -z-10 block h-4 w-44 -translate-x-1/2 rounded-full bg-amber-900/30 blur"
        />
      </div>

      {/* 上��レ���ル */}
      <div className="absolute inset-x-3 top-3 h-2 rounded-full bg-gradient-to-b from-slate-700 to-slate-500 shadow" />

      {/* ─��� ��レーングループ ── */}
      <div
        className="pointer-events-none absolute flex flex-col items-center"
        style={{
          left: `${craneX}%`,
          top: `${CABLE_TOP}%`,
          transform: depthTransform,
          transition: combinedTransition,
          zIndex: 25,
        }}
      >
        <div className="h-3 w-16 rounded-md bg-gradient-to-b from-slate-700 to-slate-900 shadow-lg" />

        <div
          style={{
            width: "3px",
            height: cableExtended ? CABLE_EXTENDED : "0px",
            background: "linear-gradient(to bottom, #475569, #334155 30%, #1e293b)",
            transition: cableExtended
              ? `height ${MS.moveY}ms cubic-bezier(.55,.06,.36,1)`
              : `height ${MS.retract}ms ease-in`,
            boxShadow: "0 0 2px rgba(0,0,0,0.4)",
          }}
        />

        <div className="relative flex h-10 w-12 items-end justify-center">
          <span
            className="absolute -left-1 bottom-0 block h-7 w-2 rounded-b-md bg-gradient-to-b from-slate-500 to-slate-800"
            style={{
              transform: clawClosed ? "rotate(15deg)" : "rotate(42deg)",
              transformOrigin: "top center",
              transition: "transform 0.4s cubic-bezier(.34,1.56,.64,1)",
            }}
          />
          <span
            className="absolute -right-1 bottom-0 block h-7 w-2 rounded-b-md bg-gradient-to-b from-slate-500 to-slate-800"
            style={{
              transform: clawClosed ? "rotate(-15deg)" : "rotate(-42deg)",
              transformOrigin: "top center",
              transition: "transform 0.4s cubic-bezier(.34,1.56,.64,1)",
            }}
          />
          <span className="block h-3 w-7 rounded-b-md bg-slate-700 shadow" />

          {carriedEmojis.length > 0 && !falling && (
            <div
              className="absolute left-1/2 top-4 -translate-x-1/2 select-none"
              style={{
                transition: "opacity 0.4s",
                opacity: mState === "SHOW" ? 0 : 1,
              }}
            >
              {carriedEmojis.map((emoji, i) => {
                const spread = carriedEmojis.length - 1;
                const offset = spread === 0 ? 0 : (i - spread / 2) * 14;
                return (
                  <span
                    key={i}
                    aria-hidden
                    className="absolute left-1/2 top-0 text-4xl drop-shadow"
                    style={{
                      transform: `translate(calc(-50% + ${offset}px), ${i * 3}px) rotate(${(i - spread / 2) * 6}deg)`,
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

      {/* 落下中アイテム */}
      {falling && carriedEmojis.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-40"
          style={{
            left: `${fallingAtX}%`,
            top: `${CABLE_TOP}%`,
            transform: "translateX(-50%)",
          }}
        >
          {carriedEmojis.map((emoji, i) => {
            const spread = carriedEmojis.length - 1;
            const offset = spread === 0 ? 0 : (i - spread / 2) * 18;
            return (
              <span
                key={i}
                className="absolute left-1/2 top-0 block text-4xl drop-shadow-lg"
                style={{
                  transform: `translateX(calc(-50% + ${offset}px))`,
                  animation: `fall-from-arm ${MS.fall + i * 80}ms cubic-bezier(.5,0,.8,1) forwards`,
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

// ── 結果モーダル ──────────────────────────────────────────────────────
function ResultModal({
  outcome,
  onClose,
}: {
  outcome: NonNullable<Outcome>;
  onClose: () => void;
}) {
  const isCaught = outcome.kind === "caught";
  const prize    = outcome.prize;

  useEffect(() => {
    if (!isCaught) return;
    let cancelled = false;
    (async () => {
      const mod = await import("canvas-confetti");
      if (cancelled) return;
      mod.default({
        particleCount: 180,
        spread: 100,
        origin: { y: 0.55 },
        colors: ["#fda4af", "#fcd34d", "#a7f3d0", "#bae6fd", "#ddd6fe", "#fbcfe8"],
        zIndex: 9999,
      });
    })();
    return () => { cancelled = true; };
  }, [isCaught]);

  return (
    <div
      role="dialog"
      aria-live="polite"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm touch-manipulation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`mx-4 w-full max-w-sm rounded-[2rem] p-1 shadow-2xl ${
          isCaught
            ? "bg-gradient-to-br from-yellow-200 via-pink-200 to-violet-200"
            : "bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300"
        }`}
      >
        <div className="rounded-[1.7rem] bg-white px-6 py-10 text-center">
          {isCaught ? (
            <>
              <p className="text-sm font-extrabold tracking-[0.3em] text-fuchsia-500">
                ✨ ゲット ✨
              </p>
              <div className="relative my-5 flex items-center justify-center">
                <span
                  aria-hidden
                  className="text-9xl drop-shadow-lg animate-bounce"
                >
                  {prize.emoji}
                </span>
              </div>
              <p className="text-2xl font-black text-fuchsia-800">
                「{prize.emoji} {prize.name}」
              </p>
              <p className="mt-1 text-base font-bold text-fuchsia-600">
                を ゲットしたよ！
              </p>
              <p className="mt-3 rounded-xl bg-fuchsia-50 px-4 py-2 text-xs font-bold text-fuchsia-500 ring-1 ring-fuchsia-200">
                🎒 リュックに いれた���！ クラフト工房で つかってね
              </p>
            </>
          ) : (
            <>
              <p className="animate-pulse text-sm font-extrabold tracking-[0.3em] text-slate-500">
                💧 とちゅう おち 💧
              </p>
              <div className="relative my-5 flex items-center justify-center">
                <span
                  aria-hidden
                  className="text-9xl opacity-50 grayscale drop-shadow-lg"
                  style={{ animation: "shake 0.4s linear 3" }}
                >
                  {prize.emoji}
                </span>
              </div>
              <p className="text-xl font-black text-slate-700">
                「{prize.emoji} {prize.name}」
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                あ�����！ とちゅうで おちちゃった…
              </p>
              <p className="mt-2 text-xs text-rose-500">
                ※ コインだけ なくなったよ（ざ�������…）
              </p>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`mt-7 w-full rounded-full py-3 text-base font-extrabold text-white shadow transition hover:brightness-110 active:scale-95 ${
              isCaught ? "bg-fuchsia-500" : "bg-slate-500"
            }`}
          >
            {isCaught ? "やったー！ 🎉" : "もう いっかい！"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── キーフレーム ──────────────────────────────────────────────────────
const CSS_KEYFRAMES = `
  @keyframes fall-from-arm {
    0%   { transform: translateY(0) rotate(0deg);        opacity: 1; }
    70%  { transform: translateY(220px) rotate(0deg);    opacity: 1; }
    85%  { transform: translateY(205px) rotate(-15deg);  opacity: 1; }
    100% { transform: translateY(218px) rotate(12deg);   opacity: 0.55; }
  }
  @keyframes shake {
    0%   { transform: translateX(0); }
    25%  { transform: translateX(-8px); }
    50%  { transform: translateX(8px); }
    75%  { transform: translateX(-6px); }
    100% { transform: translateX(0); }
  }
`;

// MATERIAL_EMOJI は buildHeap 内で使用済み（未使用警告抑制）
void MATERIAL_EMOJI;
