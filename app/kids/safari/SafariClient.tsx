"use client";

// 罠を仕掛けて待つ非同期サファリ。
// 1. 罠とエサを選んで setTrap → ActiveTrap が PLACED で作られる
// 2. クライアントで appears_at までカウントダウン、過ぎたら自動 checkTrap で APPEARED に
// 3. 「どうぶつが きた！」ボタンでタイミングゲームを開始
// 4. resolveTrap(id, isSuccess) で CAUGHT / ESCAPED

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { checkTrap, resolveTrap, setTrap } from "../actions";

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

type KidLite = { id: string; name: string; coinBalance: number };

type Inv = {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  itemType: "FOOD" | "TRAP_PART";
};

type Animal = {
  id: string;
  animalId: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  description: string;
  imageUrl: string | null;
};

type TrapDTO = {
  id: string;
  userId: string;
  trapItemId: string;
  baitItemId: string;
  status: "PLACED" | "APPEARED";
  placedAt: string;
  appearsAt: string; // ISO
  targetAnimal: Animal;
};

type CatchEntry = {
  id: string;
  animal: Animal;
  caughtBy: { id: string; name: string };
  caughtAt: string;
};

type Props = {
  initialKidId: string | null;
  kids: KidLite[];
  inventory: Inv[];
  activeTraps: TrapDTO[];
  catches: CatchEntry[];
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "ふつう",
  RARE: "レア",
  EPIC: "すごレア",
  LEGENDARY: "でんせつ",
};

const RARITY_STYLE: Record<Rarity, { bg: string; text: string; ring: string }> = {
  COMMON: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-300" },
  RARE: { bg: "bg-sky-100", text: "text-sky-700", ring: "ring-sky-300" },
  EPIC: { bg: "bg-fuchsia-100", text: "text-fuchsia-700", ring: "ring-fuchsia-300" },
  LEGENDARY: {
    bg: "bg-gradient-to-br from-yellow-200 to-amber-300",
    text: "text-amber-900",
    ring: "ring-amber-400",
  },
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

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ────────── タイミングゲーム設定（やさしめ） ──────────
const GAME_CYCLE_MS = 2500; // 1往復にかかる時間（長め＝ゆっくり）
const GAME_GREEN_MIN = 35; // 緑ゾーンの左端（%）
const GAME_GREEN_MAX = 65; // 緑ゾーンの右端（%）

export function SafariClient({
  initialKidId,
  kids,
  inventory,
  activeTraps: initialTraps,
  catches: initialCatches,
}: Props) {
  const [kidId, setKidId] = useState<string | null>(initialKidId);
  const [inv, setInv] = useState<Inv[]>(inventory);
  const [traps, setTraps] = useState<TrapDTO[]>(initialTraps);
  const [catches, setCatches] = useState<CatchEntry[]>(initialCatches);

  const [gameTrap, setGameTrap] = useState<TrapDTO | null>(null);
  const [result, setResult] = useState<
    | { kind: "caught"; animal: Animal }
    | { kind: "escaped"; animal: Animal }
    | null
  >(null);

  const [, startTransition] = useTransition();

  // props が更新されたら同期。
  useEffect(() => setInv(inventory), [inventory]);
  useEffect(() => setTraps(initialTraps), [initialTraps]);
  useEffect(() => setCatches(initialCatches), [initialCatches]);

  const selectedKid = kidId ? kids.find((k) => k.id === kidId) ?? null : null;
  const myTraps = useMemo(
    () => traps.filter((t) => t.userId === kidId),
    [traps, kidId],
  );

  const foods = useMemo(() => inv.filter((i) => i.itemType === "FOOD"), [inv]);
  const trapsInv = useMemo(
    () => inv.filter((i) => i.itemType === "TRAP_PART"),
    [inv],
  );

  // ── PLACED の罠を自動チェック（appears_at を過ぎたら checkTrap） ──
  useEffect(() => {
    if (!kidId) return;
    let cancelled = false;
    const tick = async () => {
      const now = Date.now();
      const due = myTraps.filter(
        (t) => t.status === "PLACED" && now >= new Date(t.appearsAt).getTime(),
      );
      for (const trap of due) {
        const r = await checkTrap(trap.id);
        if (cancelled) return;
        if (r.success && r.status === "APPEARED") {
          setTraps((prev) =>
            prev.map((tt) =>
              tt.id === trap.id ? { ...tt, status: "APPEARED" } : tt,
            ),
          );
        }
      }
    };
    const handle = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [kidId, myTraps]);

  // ── 1秒ごとの再描画でカウントダウン更新 ──
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleSetTrap = (trapItemId: string, baitItemId: string) => {
    if (!selectedKid) return;
    startTransition(async () => {
      const r = await setTrap(selectedKid.id, trapItemId, baitItemId);
      if (!r.success) {
        alert(r.error);
        return;
      }
      // ローカル在庫を減らし、罠リストに新規を追加。
      setInv((prev) =>
        prev.map((i) => {
          const u = r.updatedInventory.find((x) => x.itemId === i.itemId);
          return u ? { ...i, quantity: u.quantity } : i;
        }),
      );
      // 仕掛けた直後は targetAnimal は隠したいが、内部 state には保持しておく必要がある。
      // サーバ側は include していないが、UI 上の演出はカウントダウンと「？？？」の表示で済む。
      // 仮の placeholder animal を入れておく。
      setTraps((prev) => [
        ...prev,
        {
          id: r.trap.id,
          userId: r.trap.userId,
          trapItemId: r.trap.trapItemId,
          baitItemId: r.trap.baitItemId,
          status: r.trap.status,
          placedAt: r.trap.placedAt,
          appearsAt: r.trap.appearsAt,
          targetAnimal: {
            id: "secret",
            animalId: "secret",
            name: "？？？",
            emoji: "❓",
            rarity: "COMMON",
            description: "なにか やってくるかも？",
            imageUrl: null,
          },
        },
      ]);
    });
  };

  const openGame = (trap: TrapDTO) => {
    if (trap.status !== "APPEARED") return;
    setGameTrap(trap);
  };

  const finishGame = async (hit: boolean) => {
    if (!gameTrap) return;
    const trap = gameTrap;
    setGameTrap(null);

    const r = await resolveTrap(trap.id, hit);
    if (!r.success) {
      alert(r.error);
      return;
    }
    // 罠リストから外す
    setTraps((prev) => prev.filter((t) => t.id !== trap.id));
    if (r.caught) {
      setCatches((prev) => [
        {
          id: `tmp-${Date.now()}`,
          animal: r.animal,
          caughtBy: {
            id: trap.userId,
            name: selectedKid?.name ?? "",
          },
          caughtAt: r.caughtAt,
        },
        ...prev,
      ]);
      setResult({ kind: "caught", animal: r.animal });
    } else {
      setResult({ kind: "escaped", animal: r.animal });
    }
  };

  // ── キッド未選択 ─────────────────────────────
  if (!selectedKid) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-100 via-yellow-50 to-sky-100 px-4 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-3xl">🌿🦁🌿</p>
          <h1 className="mt-2 text-3xl font-extrabold text-emerald-800 sm:text-4xl">
            だれが サファリへ いく？
          </h1>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {kids.map((kid) => (
              <button
                key={kid.id}
                type="button"
                onClick={() => setKidId(kid.id)}
                className="rounded-3xl bg-white px-6 py-6 text-2xl font-extrabold text-emerald-800 shadow-lg ring-2 ring-emerald-200 transition active:scale-95 hover:ring-emerald-400"
              >
                <NameRuby name={kid.name} />
              </button>
            ))}
          </div>
          <Link
            href="/kids"
            className="mt-10 inline-block text-sm font-bold text-emerald-700 underline"
          >
            ← こども ポータルへ もどる
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-100 via-yellow-50 to-sky-100 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href={`/kids?kid=${selectedKid.id}`}
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-emerald-700 shadow ring-1 ring-emerald-200 transition active:scale-95"
          >
            ← ポータルへ
          </Link>
          <p className="text-sm font-bold text-emerald-700/80">サファリ たんけん</p>
        </div>

        {/* タイトル */}
        <section className="rounded-[2rem] bg-gradient-to-br from-emerald-300 via-lime-200 to-yellow-200 p-1 shadow-xl">
          <div className="rounded-[1.75rem] bg-white/95 p-5 text-center">
            <p className="text-4xl">🌿🦁🌿</p>
            <h1 className="mt-1 text-2xl font-black text-emerald-700 sm:text-3xl">
              ワナを しかけよう！
            </h1>
            <p className="mt-1 text-xs text-emerald-600/80">
              <NameRuby name={selectedKid.name} /> ちゃんが たんけん するよ
            </p>
          </div>
        </section>

        {/* 仕掛けるフォーム */}
        <SetTrapPanel
          foods={foods}
          traps={trapsInv}
          onSubmit={handleSetTrap}
        />

        {/* 仕掛け中のワナ */}
        <ActiveTrapsList traps={myTraps} onCatch={openGame} />

        {/* かぞくのどうぶつずかん */}
        <Zukan catches={catches} />

        <p className="text-center text-xs text-emerald-700/70">
          ✨ いちど しかけたら しばらく まってね。どうぶつが きたら タップ！ ✨
        </p>
      </div>

      {gameTrap && (
        <TimingGameModal
          trap={gameTrap}
          onResolve={finishGame}
          onCancel={() => setGameTrap(null)}
        />
      )}
      {result && (
        <ResultModal result={result} onClose={() => setResult(null)} />
      )}
    </main>
  );
}

// ────────── 罠を仕掛けるフォーム ──────────
function SetTrapPanel({
  foods,
  traps,
  onSubmit,
}: {
  foods: Inv[];
  traps: Inv[];
  onSubmit: (trapItemId: string, baitItemId: string) => void;
}) {
  const firstTrap = traps.find((t) => t.quantity > 0)?.itemId ?? "";
  const firstFood = foods.find((f) => f.quantity > 0)?.itemId ?? "";
  const [trapId, setTrapId] = useState(firstTrap);
  const [baitId, setBaitId] = useState(firstFood);

  useEffect(() => {
    if (!trapId || (traps.find((t) => t.itemId === trapId)?.quantity ?? 0) <= 0) {
      setTrapId(traps.find((t) => t.quantity > 0)?.itemId ?? "");
    }
  }, [traps, trapId]);
  useEffect(() => {
    if (!baitId || (foods.find((f) => f.itemId === baitId)?.quantity ?? 0) <= 0) {
      setBaitId(foods.find((f) => f.quantity > 0)?.itemId ?? "");
    }
  }, [foods, baitId]);

  const canSubmit =
    !!trapId &&
    !!baitId &&
    (traps.find((t) => t.itemId === trapId)?.quantity ?? 0) > 0 &&
    (foods.find((f) => f.itemId === baitId)?.quantity ?? 0) > 0;

  return (
    <section className="rounded-3xl bg-white/95 p-5 shadow ring-2 ring-emerald-200">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-emerald-800">
        <span aria-hidden>🪤</span> ここに ワナを しかける
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-amber-800">
          🛠️ つかう わな
          <select
            value={trapId}
            onChange={(e) => setTrapId(e.target.value)}
            className="mt-1 w-full rounded-2xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-base font-bold text-amber-900 focus:border-amber-500 focus:outline-none"
          >
            {traps.length === 0 && <option value="">わなが ないよ</option>}
            {traps.map((t) => (
              <option key={t.itemId} value={t.itemId} disabled={t.quantity <= 0}>
                {ITEM_EMOJI[t.itemId] ?? "❓"} {t.itemName} ×{t.quantity}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold text-rose-700">
          🍱 つかう エサ
          <select
            value={baitId}
            onChange={(e) => setBaitId(e.target.value)}
            className="mt-1 w-full rounded-2xl border-2 border-rose-300 bg-rose-50 px-3 py-2 text-base font-bold text-rose-900 focus:border-rose-500 focus:outline-none"
          >
            {foods.length === 0 && <option value="">エサが ないよ</option>}
            {foods.map((f) => (
              <option key={f.itemId} value={f.itemId} disabled={f.quantity <= 0}>
                {ITEM_EMOJI[f.itemId] ?? "❓"} {f.itemName} ×{f.quantity}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={() => onSubmit(trapId, baitId)}
        disabled={!canSubmit}
        className={`mt-4 w-full rounded-2xl px-4 py-4 text-xl font-black text-white shadow-lg transition active:scale-[0.98] ${
          canSubmit
            ? "bg-gradient-to-r from-emerald-500 via-lime-500 to-yellow-500 hover:brightness-110"
            : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
        }`}
      >
        🪤 ここにしかける！
      </button>
      <p className="mt-2 text-[11px] text-emerald-700/60">
        ※ ワナと エサは すぐ きえちゃうよ。きをつけて しかけよう
      </p>
    </section>
  );
}

// ────────── 仕掛け中のワナ ──────────
function ActiveTrapsList({
  traps,
  onCatch,
}: {
  traps: TrapDTO[];
  onCatch: (trap: TrapDTO) => void;
}) {
  if (traps.length === 0) {
    return (
      <section className="rounded-3xl bg-white/80 p-5 text-center text-sm text-emerald-700/80 ring-1 ring-emerald-200">
        まだ ワナを しかけていないよ。うえの ボタンから しかけよう！
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-emerald-800">
        <span aria-hidden>⏳</span> しかけてある ワナ（{traps.length}）
      </h2>
      <div className="space-y-2">
        {traps.map((trap) => (
          <TrapCard key={trap.id} trap={trap} onCatch={onCatch} />
        ))}
      </div>
    </section>
  );
}

function TrapCard({
  trap,
  onCatch,
}: {
  trap: TrapDTO;
  onCatch: (trap: TrapDTO) => void;
}) {
  const trapEmoji = ITEM_EMOJI[trap.trapItemId] ?? "🪤";
  const baitEmoji = ITEM_EMOJI[trap.baitItemId] ?? "🍱";
  const now = Date.now();
  const appears = new Date(trap.appearsAt).getTime();
  const remaining = Math.max(0, Math.ceil((appears - now) / 1000));

  if (trap.status === "APPEARED" || remaining === 0) {
    return (
      <article className="overflow-hidden rounded-3xl bg-gradient-to-br from-rose-200 via-yellow-200 to-emerald-200 p-1 shadow-lg">
        <div className="rounded-[1.4rem] bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {trapEmoji}
              {baitEmoji}
            </span>
            <div className="flex-1 text-sm text-emerald-700">
              <p className="font-extrabold text-rose-700 animate-pulse">
                ！ どうぶつが きた！
              </p>
              <p className="text-xs text-emerald-600/80">タップで キャッチ チャレンジ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCatch(trap)}
            className="mt-3 w-full rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-4 py-3 text-lg font-black text-white shadow transition active:scale-[0.98] hover:brightness-110"
          >
            🎯 どうぶつが きた！ キャッチする！
          </button>
        </div>
      </article>
    );
  }

  // PLACED の表示
  return (
    <article className="rounded-2xl bg-white px-4 py-3 shadow ring-1 ring-emerald-200">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {trapEmoji}
          {baitEmoji}
        </span>
        <div className="flex-1 text-sm">
          <p className="font-bold text-emerald-800">どうぶつを まっているよ…</p>
          <p className="mt-0.5 text-xs text-emerald-600/80">
            あと {remaining} びょう
          </p>
        </div>
      </div>
    </article>
  );
}

// ────────── タイミングゲームモーダル ──────────
function TimingGameModal({
  trap,
  onResolve,
  onCancel,
}: {
  trap: TrapDTO;
  onResolve: (hit: boolean) => void;
  onCancel: () => void;
}) {
  const [pos, setPos] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const posRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // 三角波で 0→100→0 を CYCLE_MS で繰り返す。
  useEffect(() => {
    const animate = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = (t - startRef.current) % GAME_CYCLE_MS;
      const phase = elapsed / GAME_CYCLE_MS; // 0..1
      const p = phase < 0.5 ? phase * 2 : 2 - phase * 2; // 0..1..0
      const v = p * 100;
      posRef.current = v;
      setPos(v);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleCatch = useCallback(() => {
    if (evaluating) return;
    setEvaluating(true);
    // RAF 停止して、その瞬間の位置で判定。
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const captured = posRef.current;
    const hit = captured >= GAME_GREEN_MIN && captured <= GAME_GREEN_MAX;
    // 少しだけ間を置いてから結果送信（演出のため）
    setTimeout(() => onResolve(hit), 500);
  }, [evaluating, onResolve]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm touch-manipulation"
    >
      <div className="mx-4 w-full max-w-md rounded-[2rem] bg-gradient-to-br from-rose-300 via-amber-200 to-emerald-200 p-1 shadow-2xl">
        <div className="rounded-[1.7rem] bg-white p-6">
          <p className="text-center text-sm font-extrabold tracking-widest text-rose-600">
            🎯 タイミング キャッチ 🎯
          </p>
          <p className="mt-2 text-center text-xs text-slate-600">
            みどりの ゾーンで「キャッチ！」を おすと だいせいこう
          </p>

          {/* バー */}
          <div className="relative mt-5 h-12 overflow-hidden rounded-full bg-slate-100 shadow-inner">
            {/* 緑ゾーン */}
            <div
              className="absolute top-0 h-full bg-gradient-to-b from-emerald-300 to-emerald-400"
              style={{
                left: `${GAME_GREEN_MIN}%`,
                width: `${GAME_GREEN_MAX - GAME_GREEN_MIN}%`,
              }}
            />
            {/* マーカー */}
            <div
              className="absolute top-0 h-full"
              style={{
                left: `${pos}%`,
                transform: "translateX(-50%)",
                transition: evaluating ? "none" : "none",
              }}
            >
              <div className="h-full w-2 rounded-full bg-rose-600 shadow-md" />
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-base">
                🎯
              </div>
            </div>
            {/* 緑ゾーンのフチ */}
            <div
              className="absolute top-0 h-full border-x-2 border-emerald-700/60"
              style={{
                left: `${GAME_GREEN_MIN}%`,
                width: `${GAME_GREEN_MAX - GAME_GREEN_MIN}%`,
                pointerEvents: "none",
              }}
            />
          </div>

          {/* キャッチボタン */}
          <button
            type="button"
            onClick={handleCatch}
            disabled={evaluating}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-4 py-5 text-2xl font-black text-white shadow-lg transition active:scale-[0.98] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {evaluating ? "けっか はんてい中…" : "🎯 キャッチ！"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={evaluating}
            className="mt-3 w-full rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            あとで（モーダルを とじる）
          </button>

          <p className="mt-3 text-center text-[10px] text-slate-400">
            ワナ: {trap.id.slice(0, 6)}…
          </p>
        </div>
      </div>
    </div>
  );
}

// ────────── 結果モーダル（成功 / 失敗） ──────────
function ResultModal({
  result,
  onClose,
}: {
  result: { kind: "caught"; animal: Animal } | { kind: "escaped"; animal: Animal };
  onClose: () => void;
}) {
  const style = RARITY_STYLE[result.animal.rarity];
  const isCaught = result.kind === "caught";

  // 成功時の紙吹雪
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
        particleCount: 180,
        spread: 100,
        origin: { y: 0.55 },
        colors: palette,
        zIndex: 9999,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [isCaught]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm touch-manipulation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`mx-4 max-w-sm rounded-[2rem] p-1 shadow-2xl ${
          isCaught
            ? "bg-gradient-to-br from-emerald-300 via-lime-200 to-yellow-200"
            : "bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300"
        }`}
      >
        <div className="rounded-[1.7rem] bg-white px-6 py-10 text-center">
          {isCaught ? (
            <>
              <p className="text-sm font-extrabold tracking-widest text-emerald-600">
                ✨ だいせいこう ✨
              </p>
              <div className="relative my-4 flex items-center justify-center">
                <span aria-hidden className="absolute text-9xl opacity-20 blur-md">
                  {result.animal.emoji}
                </span>
                <span aria-hidden className="relative text-8xl drop-shadow-lg animate-bounce">
                  {result.animal.emoji}
                </span>
              </div>
              <p className={`text-3xl font-black ${style.text}`}>
                {result.animal.name}
              </p>
              <p
                className={`mt-1 inline-block rounded-full ${style.bg} px-3 py-0.5 text-xs font-extrabold ${style.text} ring-1 ${style.ring}`}
              >
                {RARITY_LABEL[result.animal.rarity]}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                {result.animal.description}
              </p>
              <p className="mt-4 text-base font-bold text-emerald-700">
                を つかまえた！
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold tracking-widest text-slate-500">
                💨 にげられた…
              </p>
              <div className="relative my-4 flex items-center justify-center">
                <span
                  aria-hidden
                  className="relative text-8xl drop-shadow-lg opacity-50 grayscale"
                  style={{ animation: "shake 0.4s linear 3" }}
                >
                  {result.animal.emoji}
                </span>
              </div>
              <p className="text-2xl font-black text-slate-700">
                {result.animal.name}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                タイミングが ずれちゃった。また あした がんばろう！
              </p>
              <p className="mt-3 text-[11px] text-rose-500">
                ※ つかった ワナと エサは なくなったよ
              </p>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`mt-6 rounded-full px-6 py-2 text-sm font-extrabold text-white shadow transition hover:brightness-110 ${
              isCaught
                ? "bg-emerald-500"
                : "bg-slate-500"
            }`}
          >
            {isCaught ? "やったー！" : "つぎは がんばる"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-6px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// ────────── かぞくのどうぶつずかん ──────────
function Zukan({ catches }: { catches: CatchEntry[] }) {
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        animal: Animal;
        total: number;
        latest: CatchEntry;
      }
    >();
    for (const c of catches) {
      const key = c.animal.animalId;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { animal: c.animal, total: 1, latest: c });
      } else {
        cur.total += 1;
        if (c.caughtAt > cur.latest.caughtAt) cur.latest = c;
      }
    }
    const rank: Record<Rarity, number> = {
      LEGENDARY: 0,
      EPIC: 1,
      RARE: 2,
      COMMON: 3,
    };
    return [...map.values()].sort((a, b) => {
      const dr = rank[a.animal.rarity] - rank[b.animal.rarity];
      if (dr !== 0) return dr;
      return b.latest.caughtAt.localeCompare(a.latest.caughtAt);
    });
  }, [catches]);

  return (
    <section className="rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-emerald-200 backdrop-blur">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-3xl" aria-hidden>📖</span>
        <div>
          <h2 className="text-xl font-extrabold text-emerald-800">
            かぞくの どうぶつずかん
          </h2>
          <p className="text-xs text-emerald-700/80">
            つかまえた どうぶつたち（{catches.length} ひき）
          </p>
        </div>
      </div>
      {grouped.length === 0 ? (
        <p className="rounded-2xl bg-emerald-50 p-3 text-center text-sm text-emerald-700">
          まだ なにも つかまえてないよ。
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {grouped.map((g) => {
            const s = RARITY_STYLE[g.animal.rarity];
            return (
              <li
                key={g.animal.animalId}
                className={`rounded-2xl ${s.bg} p-4 ring-2 ${s.ring}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-5xl drop-shadow" aria-hidden>
                    {g.animal.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-lg font-black ${s.text}`}>
                        {g.animal.name}
                      </p>
                      <span
                        className={`rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-extrabold ${s.text}`}
                      >
                        {RARITY_LABEL[g.animal.rarity]}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs ${s.text} opacity-80`}>
                      {g.animal.description}
                    </p>
                    <p className={`mt-2 text-xs font-bold ${s.text}`}>
                      ぜんぶで <span className="font-mono">×{g.total}</span> ひき
                    </p>
                    <p className={`mt-1 text-[11px] ${s.text} opacity-80`}>
                      さいきん：
                      <NameRuby name={g.latest.caughtBy.name} />
                      が {formatDate(g.latest.caughtAt)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
