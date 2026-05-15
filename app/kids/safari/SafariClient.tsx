"use client";

// /kids/safari — 2D サファリフィールド。
// バックエンド：setTrap / checkTrap / resolveTrap はそのまま使う。
// UI は「業務リスト」をやめて、緑のフィールドに罠オブジェクトを散らす没入型に。

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
  appearsAt: string;
  posX: number;
  posY: number;
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

// 罠の見た目を罠アイテム種別で出し分ける
const TRAP_EMOJI: Record<string, string> = {
  rope: "🌿",
  wood: "📦",
  net: "🪤",
  sturdy_trap: "🪤",
  hunter_net: "🥅",
};
function trapVisual(itemId: string): string {
  return TRAP_EMOJI[itemId] ?? "🌿";
}

// 罠 id から決定論的に画面上の位置を出す（リロードしても同じ場所）。
function positionFromId(id: string): { left: number; top: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const a = Math.abs(hash);
  const b = Math.abs(hash >> 8);
  // フィールド内に収まるよう 12〜88% の範囲に。
  const left = 12 + (a % 76);
  const top = 18 + (b % 64);
  return { left, top };
}

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

// ────────── タイミングゲーム設定 ──────────
// 緑ゾーン幅は固定。スピードはレアリティで可変。
const GAME_GREEN_MIN = 35;
const GAME_GREEN_MAX = 65;

// レアリティ → 1往復にかかる ms（小さいほど高速）
const CYCLE_BY_RARITY: Record<Rarity, number> = {
  COMMON: 2800,   // ゆっくり（叶泰くんでも当てやすい）
  RARE: 2000,
  EPIC: 1400,
  LEGENDARY: 1000, // 超高速
};

// レアリティ → モーダルで出す難易度ヒント
const HINT_BY_RARITY: Record<
  Rarity,
  { text: string; subText: string; className: string }
> = {
  COMMON: {
    text: "ふつうの けはい…",
    subText: "おちついて タップ！",
    className: "text-emerald-600",
  },
  RARE: {
    text: "なんだか はやい けはい…！",
    subText: "あなどれない…！",
    className: "text-sky-600",
  },
  EPIC: {
    text: "やばい、すごく はやいぞ！",
    subText: "しゅうちゅう！",
    className: "text-fuchsia-600 font-extrabold",
  },
  LEGENDARY: {
    text: "！！ でんせつの けはい ！！",
    subText: "ぜったい にがすな！",
    className: "text-amber-600 font-black animate-pulse",
  },
};

// ────────── キーフレーム（フィールド用） ──────────
const FIELD_KEYFRAMES = `
  @keyframes rustle {
    0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
    15% { transform: translate(calc(-50% - 4px), -50%) rotate(-10deg); }
    30% { transform: translate(calc(-50% + 4px), -50%) rotate(8deg); }
    45% { transform: translate(calc(-50% - 3px), -50%) rotate(-7deg); }
    60% { transform: translate(calc(-50% + 3px), -50%) rotate(6deg); }
    75% { transform: translate(calc(-50% - 2px), -50%) rotate(-4deg); }
  }
  .trap-rustle { animation: rustle 0.35s ease-in-out infinite; }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.5); }
    50% { box-shadow: 0 0 16px 8px rgba(244, 63, 94, 0.45); }
  }
  .trap-glow { animation: glow 1s ease-in-out infinite; }

  @keyframes float-bubble {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  .bubble-float { animation: float-bubble 1.6s ease-in-out infinite; }

  @keyframes pop-in {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    60% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }
  .trap-pop-in { animation: pop-in 0.45s cubic-bezier(.34,1.56,.64,1) both; }

  @keyframes shake {
    0% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    50% { transform: translateX(8px); }
    75% { transform: translateX(-6px); }
    100% { transform: translateX(0); }
  }
`;

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

  // 配置モード：「しかける！」を押した直後、フィールドタップ待ちの状態。
  const [pendingPlacement, setPendingPlacement] = useState<
    { trapItemId: string; baitItemId: string } | null
  >(null);
  const isPlacingMode = pendingPlacement !== null;

  const [, startTransition] = useTransition();

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

  // ── PLACED の罠を appears_at で自動 APPEARED 化 ──
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

  // しかける！ボタン → 配置モードに入るだけ。座標を待つ。
  const handleSetTrap = (trapItemId: string, baitItemId: string) => {
    if (!selectedKid) return;
    setPendingPlacement({ trapItemId, baitItemId });
  };

  const cancelPlacement = () => setPendingPlacement(null);

  // フィールド上のタップ位置が確定したらサーバ呼び出し。
  const confirmPlacement = (posX: number, posY: number) => {
    if (!selectedKid || !pendingPlacement) return;
    const { trapItemId, baitItemId } = pendingPlacement;
    setPendingPlacement(null);
    startTransition(async () => {
      const r = await setTrap(selectedKid.id, trapItemId, baitItemId, posX, posY);
      if (!r.success) {
        alert(r.error);
        return;
      }
      setInv((prev) =>
        prev.map((i) => {
          const u = r.updatedInventory.find((x) => x.itemId === i.itemId);
          return u ? { ...i, quantity: u.quantity } : i;
        }),
      );
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
          posX: r.trap.posX,
          posY: r.trap.posY,
          targetAnimal: {
            id: "secret",
            animalId: "secret",
            name: "？？？",
            emoji: "❓",
            // 難易度ヒント用に「ホンモノのレアリティ」を保持する
            rarity: r.trap.targetRarity,
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
    setTraps((prev) => prev.filter((t) => t.id !== trap.id));
    if (r.caught) {
      setCatches((prev) => [
        {
          id: `tmp-${Date.now()}`,
          animal: r.animal,
          caughtBy: { id: trap.userId, name: selectedKid?.name ?? "" },
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
    <main className="min-h-screen bg-gradient-to-b from-sky-200 via-emerald-100 to-amber-50 px-4 py-6">
      <style>{FIELD_KEYFRAMES}</style>

      <div className="mx-auto max-w-3xl space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href={`/kids?kid=${selectedKid.id}`}
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-emerald-700 shadow ring-1 ring-emerald-200 transition active:scale-95"
          >
            ← ポータルへ
          </Link>
          <p className="text-sm font-bold text-emerald-700/80">
            🌿 サファリ フィールド 🌿
          </p>
          <p className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-emerald-700">
            <NameRuby name={selectedKid.name} />
          </p>
        </div>

        {/* サファリフィールド */}
        <SafariField
          traps={myTraps}
          onCatchAppeared={openGame}
          isPlacingMode={isPlacingMode}
          onPlace={confirmPlacement}
          onCancelPlace={cancelPlacement}
        />

        {/* もちもの（仕掛けるフォーム） */}
        <Pouch foods={foods} traps={trapsInv} onSubmit={handleSetTrap} />

        {/* かぞくのどうぶつずかん */}
        <Zukan catches={catches} />
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

// ────────── サファリフィールド ──────────
type Decoration = {
  emoji: string;
  x: number;
  y: number;
  size: number;
  z: number; // CSS z-index 用
};

function generateDecorations(): Decoration[] {
  const pool: Array<{ emoji: string; min: number; max: number }> = [
    { emoji: "🌲", min: 2.5, max: 4.5 },
    { emoji: "🌳", min: 2.5, max: 4.5 },
    { emoji: "🌴", min: 2.5, max: 4 },
    { emoji: "🌿", min: 1.5, max: 2.5 },
    { emoji: "🌷", min: 1.4, max: 2 },
    { emoji: "🌼", min: 1.4, max: 2 },
    { emoji: "🍄", min: 1.4, max: 2 },
  ];
  const items: Decoration[] = [];
  // 16 個ほど散らす
  for (let i = 0; i < 16; i++) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    items.push({
      emoji: p.emoji,
      x: Math.random() * 95 + 2,
      y: Math.random() * 88 + 6,
      size: p.min + Math.random() * (p.max - p.min),
      z: Math.floor(p.min),
    });
  }
  return items;
}

function SafariField({
  traps,
  onCatchAppeared,
  isPlacingMode,
  onPlace,
  onCancelPlace,
}: {
  traps: TrapDTO[];
  onCatchAppeared: (trap: TrapDTO) => void;
  isPlacingMode: boolean;
  onPlace: (posX: number, posY: number) => void;
  onCancelPlace: () => void;
}) {
  // 装飾は初回マウント時にだけ生成（毎更新で動くと目が痛い）
  const decorations = useMemo(generateDecorations, []);
  const fieldRef = useRef<HTMLElement>(null);

  const handleFieldClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!isPlacingMode || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onPlace(x, y);
  };

  return (
    <section
      ref={fieldRef}
      onClick={handleFieldClick}
      className={`relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-sky-300 via-emerald-300 to-emerald-500 shadow-2xl ring-4 ring-white ${
        isPlacingMode ? "cursor-crosshair" : ""
      }`}
    >
      {/* 空グラデ */}
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-sky-200/90 via-sky-100/40 to-transparent" />
      {/* 太陽と雲 */}
      <span aria-hidden className="absolute right-6 top-4 text-5xl drop-shadow">
        ☀️
      </span>
      <span aria-hidden className="absolute left-8 top-6 text-3xl opacity-90">
        ☁️
      </span>
      <span aria-hidden className="absolute left-1/2 top-12 text-2xl opacity-80">
        ☁️
      </span>
      {/* 遠景の山 */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-[28%] h-[18%]"
        style={{
          background:
            "linear-gradient(180deg, rgba(132,170,134,0.6) 0%, rgba(132,170,134,0) 100%)",
          clipPath:
            "polygon(0 100%, 10% 30%, 22% 60%, 35% 10%, 50% 55%, 62% 25%, 78% 65%, 92% 20%, 100% 70%, 100% 100%)",
        }}
      />

      {/* 地面の手前ハイライト */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "linear-gradient(to top, rgba(132, 204, 22, 0.4) 0%, rgba(132, 204, 22, 0) 100%)",
        }}
      />

      {/* 草・木の装飾 */}
      {decorations.map((d, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute pointer-events-none select-none drop-shadow"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            transform: "translate(-50%, -50%)",
            fontSize: `${d.size}rem`,
            zIndex: d.z,
          }}
        >
          {d.emoji}
        </span>
      ))}

      {/* 罠オブジェクト */}
      {traps.map((trap) => (
        <FieldTrap
          key={trap.id}
          trap={trap}
          onCatchAppeared={onCatchAppeared}
        />
      ))}

      {/* ヒントテキスト */}
      {traps.length === 0 && !isPlacingMode && (
        <div className="absolute inset-x-0 bottom-5 z-30 text-center">
          <p className="inline-block rounded-full bg-white/85 px-4 py-2 text-sm font-extrabold text-emerald-700 shadow ring-1 ring-emerald-200">
            ↓「もちもの」から ワナを しかけよう！
          </p>
        </div>
      )}

      {/* 配置モード：上部バナー + 取り消し */}
      {isPlacingMode && (
        <>
          {/* 半透明オーバーレイで「いまタップ待ち」感を演出 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30 bg-yellow-200/15"
          />
          <div className="absolute inset-x-0 top-3 z-40 flex justify-center px-3">
            <div className="rounded-full bg-rose-500 px-4 py-2 text-sm font-extrabold text-white shadow-lg ring-2 ring-white animate-bounce">
              👆 フィールドを タップして、ワナを おく ばしょを きめてね！
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancelPlace();
            }}
            className="absolute right-3 top-16 z-40 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-rose-700 shadow ring-1 ring-rose-300 hover:bg-rose-50"
          >
            ✕ やめる
          </button>
        </>
      )}
    </section>
  );
}

// ────────── フィールド上の罠オブジェクト ──────────
function FieldTrap({
  trap,
  onCatchAppeared,
}: {
  trap: TrapDTO;
  onCatchAppeared: (trap: TrapDTO) => void;
}) {
  // 子供がタップした座標をそのまま使う（pos_x / pos_y は %）
  const pos = { left: trap.posX, top: trap.posY };
  const visual = trapVisual(trap.trapItemId);
  const now = Date.now();
  const remaining = Math.max(
    0,
    Math.ceil((new Date(trap.appearsAt).getTime() - now) / 1000),
  );
  const appeared = trap.status === "APPEARED" || remaining === 0;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (appeared) onCatchAppeared(trap);
      }}
      disabled={!appeared}
      aria-label={
        appeared ? "どうぶつが きた！キャッチ" : "ワナを セットちゅう"
      }
      className="trap-pop-in absolute z-20 flex flex-col items-center"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span
        aria-hidden
        className={`block text-6xl drop-shadow-lg select-none ${
          appeared ? "trap-rustle" : ""
        }`}
        style={{ filter: appeared ? "drop-shadow(0 0 6px #fde68a)" : undefined }}
      >
        {visual}
      </span>

      {/* 吹き出し / 通知 */}
      {appeared ? (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1 text-xs font-extrabold text-white shadow-lg ring-2 ring-rose-200 trap-glow bubble-float">
          ！ タップして キャッチ！
        </span>
      ) : (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-emerald-800 shadow ring-1 ring-emerald-200 bubble-float">
          ⏳ あと {remaining} びょう
        </span>
      )}
    </button>
  );
}

// ────────── もちもの（罠を仕掛けるフォーム） ──────────
function Pouch({
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
    <section className="rounded-3xl bg-white/95 p-3 shadow-lg ring-2 ring-emerald-200">
      <div className="flex items-center justify-between gap-2 pb-2">
        <p className="flex items-center gap-1 text-xs font-extrabold text-emerald-800">
          🎒 もちもの
        </p>
        <p className="text-[10px] text-emerald-700/70">
          えらんで「しかける！」
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[8rem] flex-1 text-[11px] font-bold text-amber-800">
          🛠️ ワナ
          <select
            value={trapId}
            onChange={(e) => setTrapId(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-amber-300 bg-amber-50 px-2 py-1.5 text-sm font-bold text-amber-900 focus:border-amber-500 focus:outline-none"
          >
            {traps.length === 0 && <option value="">わなが ないよ</option>}
            {traps.map((t) => (
              <option key={t.itemId} value={t.itemId} disabled={t.quantity <= 0}>
                {ITEM_EMOJI[t.itemId] ?? "❓"} {t.itemName} ×{t.quantity}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[8rem] flex-1 text-[11px] font-bold text-rose-700">
          🍱 エサ
          <select
            value={baitId}
            onChange={(e) => setBaitId(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-rose-300 bg-rose-50 px-2 py-1.5 text-sm font-bold text-rose-900 focus:border-rose-500 focus:outline-none"
          >
            {foods.length === 0 && <option value="">エサが ないよ</option>}
            {foods.map((f) => (
              <option key={f.itemId} value={f.itemId} disabled={f.quantity <= 0}>
                {ITEM_EMOJI[f.itemId] ?? "❓"} {f.itemName} ×{f.quantity}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => onSubmit(trapId, baitId)}
          disabled={!canSubmit}
          className={`h-[42px] shrink-0 rounded-xl px-4 text-base font-black text-white shadow transition active:scale-[0.97] ${
            canSubmit
              ? "bg-gradient-to-r from-emerald-500 via-lime-500 to-yellow-500 hover:brightness-110"
              : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
          }`}
        >
          🪤 しかける ばしょを えらぶ！
        </button>
      </div>
    </section>
  );
}

// ────────── タイミングゲームモーダル（不変） ──────────
function TimingGameModal({
  trap,
  onResolve,
  onCancel,
}: {
  trap: TrapDTO;
  onResolve: (hit: boolean) => void;
  onCancel: () => void;
}) {
  // 罠に紐づいた動物のレアリティで難易度（スピード）を変える。
  const rarity = trap.targetAnimal.rarity;
  const cycleMs = CYCLE_BY_RARITY[rarity];
  const hint = HINT_BY_RARITY[rarity];

  const [pos, setPos] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const posRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = (t - startRef.current) % cycleMs;
      const phase = elapsed / cycleMs; // 0..1
      // cosine ease-in-out: 0 → 1 → 0、端で少しゆっくり、中央で速い。
      // さらに、レアリティが高いほど微小ジッターを乗せて読みにくくする。
      const base = (1 - Math.cos(phase * Math.PI * 2)) / 2; // 0..1..0 smooth
      const jitterAmp =
        rarity === "EPIC" ? 1.5 : rarity === "LEGENDARY" ? 3.0 : 0;
      const jitter =
        jitterAmp > 0 ? Math.sin(elapsed * 0.018) * jitterAmp : 0;
      const v = Math.max(0, Math.min(100, base * 100 + jitter));
      posRef.current = v;
      setPos(v);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cycleMs, rarity]);

  const handleCatch = useCallback(() => {
    if (evaluating) return;
    setEvaluating(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const captured = posRef.current;
    const hit = captured >= GAME_GREEN_MIN && captured <= GAME_GREEN_MAX;
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
          <p className={`mt-2 text-center text-base ${hint.className}`}>
            {hint.text}
          </p>
          <p className={`mt-0.5 text-center text-xs ${hint.className}`}>
            {hint.subText}
          </p>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            みどりの ゾーンで「キャッチ！」を おすと だいせいこう
          </p>

          <div className="relative mt-5 h-12 overflow-hidden rounded-full bg-slate-100 shadow-inner">
            <div
              className="absolute top-0 h-full bg-gradient-to-b from-emerald-300 to-emerald-400"
              style={{
                left: `${GAME_GREEN_MIN}%`,
                width: `${GAME_GREEN_MAX - GAME_GREEN_MIN}%`,
              }}
            />
            <div
              className="absolute top-0 h-full"
              style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
            >
              <div className="h-full w-2 rounded-full bg-rose-600 shadow-md" />
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-base">
                🎯
              </div>
            </div>
            <div
              className="absolute top-0 h-full border-x-2 border-emerald-700/60"
              style={{
                left: `${GAME_GREEN_MIN}%`,
                width: `${GAME_GREEN_MAX - GAME_GREEN_MIN}%`,
                pointerEvents: "none",
              }}
            />
          </div>

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

  useEffect(() => {
    if (!isCaught) return;
    let cancelled = false;
    (async () => {
      const mod = await import("canvas-confetti");
      if (cancelled) return;
      const palette = [
        "#fda4af", "#fcd34d", "#a7f3d0", "#bae6fd", "#ddd6fe", "#fbcfe8",
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
              <p className={`text-3xl font-black ${style.text}`}>{result.animal.name}</p>
              <p className={`mt-1 inline-block rounded-full ${style.bg} px-3 py-0.5 text-xs font-extrabold ${style.text} ring-1 ${style.ring}`}>
                {RARITY_LABEL[result.animal.rarity]}
              </p>
              <p className="mt-3 text-sm text-slate-600">{result.animal.description}</p>
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
              <p className="text-2xl font-black text-slate-700">{result.animal.name}</p>
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
              isCaught ? "bg-emerald-500" : "bg-slate-500"
            }`}
          >
            {isCaught ? "やったー！" : "つぎは がんばる"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────── かぞくのどうぶつずかん ──────────
function Zukan({ catches }: { catches: CatchEntry[] }) {
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { animal: Animal; total: number; latest: CatchEntry }
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
      LEGENDARY: 0, EPIC: 1, RARE: 2, COMMON: 3,
    };
    return [...map.values()].sort((a, b) => {
      const dr = rank[a.animal.rarity] - rank[b.animal.rarity];
      if (dr !== 0) return dr;
      return b.latest.caughtAt.localeCompare(a.latest.caughtAt);
    });
  }, [catches]);

  return (
    <section className="rounded-3xl bg-white/90 p-4 shadow-lg ring-1 ring-emerald-200 backdrop-blur">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-2xl" aria-hidden>📖</span>
        <div>
          <h2 className="text-base font-extrabold text-emerald-800">
            かぞくの どうぶつずかん
          </h2>
          <p className="text-[11px] text-emerald-700/80">
            ぜんぶで {catches.length} ひき
          </p>
        </div>
      </div>
      {grouped.length === 0 ? (
        <p className="rounded-2xl bg-emerald-50 p-3 text-center text-xs text-emerald-700">
          まだ なにも つかまえてないよ。
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {grouped.map((g) => {
            const s = RARITY_STYLE[g.animal.rarity];
            return (
              <li key={g.animal.animalId} className={`rounded-xl ${s.bg} px-3 py-2 ring-1 ${s.ring}`}>
                <div className="flex items-center gap-2">
                  <span className="text-3xl drop-shadow" aria-hidden>
                    {g.animal.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-black ${s.text}`}>{g.animal.name}</p>
                      <span className={`rounded-full bg-white/70 px-1.5 py-0 text-[9px] font-extrabold ${s.text}`}>
                        {RARITY_LABEL[g.animal.rarity]}
                      </span>
                    </div>
                    <p className={`text-[10px] font-bold ${s.text}`}>
                      ×{g.total} · さいきん {formatDate(g.latest.caughtAt)} ·{" "}
                      <NameRuby name={g.latest.caughtBy.name} />
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
