"use client";

// /kids/[kidId]/safari — 2D サファリフィールド。
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
import { buyTrap, checkTrap, craftTrap, resolveTrap, setTrap } from "../../actions";
import { TRAP_COST, TRAP_RECIPES, type TrapRecipe } from "../../config";
import { useSafariStore } from "@/store/useSafariStore";
import { QuizGate } from "../QuizGate";
import { DayEndScreen } from "../DayEndScreen";

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

// ✨ SSR 最強王シリーズの animalId 一覧
const SSR_ANIMAL_IDS = new Set([
  "tyrannosaurus",
  "hercules_beetle",
  "lion_king",
  "megalodon",
]);
function isSSRAnimal(animal: { animalId: string; rarity: Rarity }): boolean {
  return animal.rarity === "LEGENDARY" && SSR_ANIMAL_IDS.has(animal.animalId);
}

type KidLite = { id: string; name: string; coinBalance: number };

// UserTool の TRAP 型のみが渡ってくる。itemId → toolId に切替済み。
type UserToolRow = {
  toolId: string;
  toolName: string;
  emoji: string;
  quantity: number;
};

type Animal = {
  id: string;
  animalId: string;
  name: string;
  genericName: string;
  specificName: string;
  emoji: string;
  rarity: Rarity;
  description: string;
  imageUrl: string | null;
  isExtinct: boolean;
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

type Props = {
  initialKidId: string | null;
  kids: KidLite[];
  ownedTraps: UserToolRow[];  // UserTool (type=TRAP) のみ
  activeTraps: TrapDTO[];
  // アクティブ狩り（BOW/SPEAR）の本日残り回数。
  huntStaminaRemaining?: number | null;
  huntStaminaLimit?: number;
  // 罠設置の本日残り回数（一本道化 2026-06-12 で上限新設）。
  trapStaminaRemaining?: number | null;
  trapStaminaLimit?: number;
  // 毎日無料の罠枠：今回 底上げが発生したか（バナー表示用）。
  freeTrapGranted?: boolean;
  freeTrapName?: string | null;
  // ガチャの罠パーツ（SharedInventoryItem）の所持数。ワナづくりUI の活性判定に使う。
  partInventory?: Record<string, number>;
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
const SSR_LABEL = "✨ SSR ✨";

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

// 罠の見た目を Tool.toolId で出し分ける（旧 SharedInventoryItem.itemId から移行済み）
const TRAP_EMOJI: Record<string, string> = {
  pitfall:      "🕳️",
  leghold:      "🪤",
  snare_net:    "🕸️",
  deadfall_trap: "🪨",
  bamboo_trap:  "🎋",
  cage_trap:    "🧺",
};
function trapVisual(toolId: string): string {
  return TRAP_EMOJI[toolId] ?? "🪤";
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

  /* ✨ SSR 専用演出 ────────────────── */

  /* 画面全体がぐわっと揺れる */
  @keyframes ssr-screen-shake {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    10% { transform: translate(-6px, -4px) rotate(-1deg); }
    20% { transform: translate(8px, 6px) rotate(1deg); }
    30% { transform: translate(-8px, 4px) rotate(-0.5deg); }
    40% { transform: translate(6px, -6px) rotate(0.5deg); }
    50% { transform: translate(-4px, 8px) rotate(-1deg); }
    60% { transform: translate(8px, -4px) rotate(1deg); }
    70% { transform: translate(-6px, 2px) rotate(-0.5deg); }
    80% { transform: translate(4px, 6px) rotate(0.5deg); }
    90% { transform: translate(-2px, -4px) rotate(-0.3deg); }
  }
  .ssr-shake { animation: ssr-screen-shake 0.7s cubic-bezier(.36,.07,.19,.97) 2; }

  /* 金色オーラがぐるぐる回るグラデ背景 */
  @keyframes ssr-gold-rotate {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .ssr-gold-bg {
    background: linear-gradient(
      135deg,
      #ff6b00 0%,
      #ffd700 18%,
      #ff4500 35%,
      #ffc200 50%,
      #ff6b00 65%,
      #ffe066 80%,
      #ff6b00 100%
    );
    background-size: 400% 400%;
    animation: ssr-gold-rotate 2s ease infinite;
  }

  /* SSR テキストが光り輝く */
  @keyframes ssr-text-glow {
    0%, 100% { text-shadow: 0 0 10px #ffd700, 0 0 20px #ffd700, 0 0 40px #ff8800; }
    50% { text-shadow: 0 0 20px #fff, 0 0 40px #ffd700, 0 0 80px #ff4500, 0 0 100px #ff4500; }
  }
  .ssr-text-glow { animation: ssr-text-glow 1s ease-in-out infinite; }

  /* SSR 動物アイコンがズームイン */
  @keyframes ssr-zoom-bounce {
    0% { transform: scale(0) rotate(-20deg); opacity: 0; }
    50% { transform: scale(1.3) rotate(5deg); opacity: 1; }
    70% { transform: scale(0.9) rotate(-3deg); }
    85% { transform: scale(1.1) rotate(2deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  .ssr-zoom-bounce { animation: ssr-zoom-bounce 0.9s cubic-bezier(.34,1.56,.64,1) both; }



  /* SSRバッジがぴかぴか点滅 */
  @keyframes ssr-badge-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.08); }
  }
  .ssr-badge { animation: ssr-badge-pulse 0.9s ease-in-out infinite; }
`;

export function SafariClient({
  initialKidId,
  kids,
  ownedTraps,
  activeTraps: initialTraps,
  huntStaminaRemaining = null,
  huntStaminaLimit = 3,
  trapStaminaRemaining = null,
  trapStaminaLimit = 3,
  freeTrapGranted = false,
  freeTrapName = null,
  partInventory = {},
}: Props) {
  const [kidId, setKidId] = useState<string | null>(initialKidId);
  const [trapTools, setTrapTools] = useState<UserToolRow[]>(ownedTraps);
  const [traps, setTraps] = useState<TrapDTO[]>(initialTraps);
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

  // ── 一本道化（2026-06-12）────────────────────────────────────
  // 罠設置の本日残り回数（DB 値ミラー。設置成功でサーバ確定値に更新）
  const [trapRemaining, setTrapRemaining] = useState<number | null>(
    trapStaminaRemaining,
  );
  // クイズゲート：座標確定後「クイズに正解したら設置」の待機状態
  const [quizPlacement, setQuizPlacement] = useState<
    { trapItemId: string; baitItemId: string; posX: number; posY: number } | null
  >(null);
  // 罠ショップ（コインで基本罠を買う）
  const [buying, setBuying] = useState(false);
  // ワナづくり（素材／パーツ → 罠）
  const [crafting, setCrafting] = useState(false);
  const [partInv, setPartInv] = useState<Record<string, number>>(partInventory);
  // 毎日無料の罠枠バナー
  const [showFreeBanner, setShowFreeBanner] = useState(freeTrapGranted);
  const coins = useSafariStore((s) => s.coins);
  const syncCoins = useSafariStore((s) => s.syncCoins);
  const inventory = useSafariStore((s) => s.inventory);
  const consumeInventory = useSafariStore((s) => s.consumeInventory);
  const addToInventory = useSafariStore((s) => s.addToInventory);

  const [, startTransition] = useTransition();

  useEffect(() => setTrapTools(ownedTraps), [ownedTraps]);
  useEffect(() => setTraps(initialTraps), [initialTraps]);
  useEffect(() => setPartInv(partInventory), [partInventory]);

  const selectedKid = kidId ? kids.find((k) => k.id === kidId) ?? null : null;
  const myTraps = useMemo(
    () => traps.filter((t) => t.userId === kidId),
    [traps, kidId],
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
  const handleSetTrap = (trapItemId: string) => {
    if (!selectedKid) return;
    setPendingPlacement({ trapItemId, baitItemId: trapItemId });
  };

  const cancelPlacement = () => setPendingPlacement(null);

  // フィールド上のタップ位置が確定したら、まずクイズゲートへ。
  // 「学びを冒険の鍵にする」：クイズに正解しないと罠は仕掛けられない。
  const confirmPlacement = (posX: number, posY: number) => {
    if (!selectedKid || !pendingPlacement) return;
    const { trapItemId, baitItemId } = pendingPlacement;
    setPendingPlacement(null);
    setQuizPlacement({ trapItemId, baitItemId, posX, posY });
  };

  // クイズ正解後に実際のサーバ呼び出しを行う。
  const executePlacement = (placement: {
    trapItemId: string;
    baitItemId: string;
    posX: number;
    posY: number;
  }) => {
    if (!selectedKid) return;
    const { trapItemId, baitItemId, posX, posY } = placement;
    startTransition(async () => {
      const r = await setTrap(selectedKid.id, trapItemId, baitItemId, posX, posY);
      if (!r.success) {
        alert(r.error);
        if (r.limitReached) setTrapRemaining(0);
        return;
      }
      setTrapRemaining(r.trapStamina.remaining);
      // 消費後の道具残数で楽観的更新（toolId でマッチ）
      setTrapTools((prev) =>
        prev.map((t) => {
          const u = r.updatedInventory.find((x) => x.itemId === t.toolId);
          return u ? { ...t, quantity: u.quantity } : t;
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
            genericName: "？？？",
            specificName: "？？？",
            emoji: "❓",
            // 難易度ヒント用に「ホンモノのレアリティ」を保持する
            rarity: r.trap.targetRarity,
            description: "なにか やってくるかも？",
            imageUrl: null,
            isExtinct: false,
          },
        },
      ]);
    });
  };

  // ── 罠ショップ：コインで基本罠を買う（クラフト工房の代替・一本道化）──
  const handleBuyTrap = () => {
    if (!selectedKid || buying) return;
    setBuying(true);
    startTransition(async () => {
      try {
        const r = await buyTrap(selectedKid.id);
        if (!r.success) {
          alert(r.error);
          return;
        }
        syncCoins(r.newCoinBalance);
        setTrapTools((prev) => {
          const exists = prev.some((t) => t.toolId === r.trap.toolId);
          if (exists) {
            return prev.map((t) =>
              t.toolId === r.trap.toolId ? { ...t, quantity: r.trap.quantity } : t,
            );
          }
          return [
            ...prev,
            {
              toolId: r.trap.toolId,
              toolName: r.trap.toolName,
              emoji: r.trap.emoji,
              quantity: r.trap.quantity,
            },
          ];
        });
      } finally {
        setBuying(false);
      }
    });
  };

  // ── ワナづくり：集めた素材／パーツ → 罠（死んだ導線の再接続）──
  const handleCraftTrap = (recipeId: string) => {
    if (!selectedKid || crafting) return;
    const recipe = TRAP_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;

    // 在庫チェック（material=Zustand在庫 / part=SharedInventoryItem ミラー）
    const stock = recipe.source === "material" ? inventory : partInv;
    const lack = recipe.ingredients.find(
      (ing) => (stock[ing.itemId] ?? 0) < ing.qty,
    );
    if (lack) {
      alert(`${recipe.source === "material" ? "そざい" : "パーツ"}が たりないよ（${lack.emoji}${lack.name}）`);
      return;
    }

    setCrafting(true);
    // material はクライアントで先に消費（楽観）。失敗時はロールバックする。
    const consumed: typeof recipe.ingredients = [];
    if (recipe.source === "material") {
      for (const ing of recipe.ingredients) {
        if (consumeInventory(ing.itemId, ing.qty)) consumed.push(ing);
      }
    }

    startTransition(async () => {
      try {
        const r = await craftTrap(selectedKid.id, recipe.id);
        if (!r.success) {
          for (const ing of consumed) addToInventory(ing.itemId, ing.qty);
          alert(r.error);
          return;
        }
        // part は楽観的に在庫を減算（サーバ側で消費済み）
        if (recipe.source === "part") {
          setPartInv((prev) => {
            const next = { ...prev };
            for (const ing of recipe.ingredients) {
              next[ing.itemId] = (next[ing.itemId] ?? 0) - ing.qty;
            }
            return next;
          });
        }
        // 罠の所持数を更新（buyTrap と同じパターン）
        setTrapTools((prev) => {
          const exists = prev.some((t) => t.toolId === r.trap.toolId);
          if (exists) {
            return prev.map((t) =>
              t.toolId === r.trap.toolId
                ? { ...t, quantity: r.trap.quantity }
                : t,
            );
          }
          return [
            ...prev,
            {
              toolId: r.trap.toolId,
              toolName: r.trap.toolName,
              emoji: r.trap.emoji,
              quantity: r.trap.quantity,
            },
          ];
        });
      } finally {
        setCrafting(false);
      }
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

  // ── きょうの罠が上限 & 回収待ちの罠もない → おしまい画面 ──────────
  // （最後の罠の結果モーダル表示中は出さない＝捕獲の祝福を先に見せる）
  const trapQuotaExhausted = trapRemaining !== null && trapRemaining <= 0;
  if (trapQuotaExhausted && myTraps.length === 0 && !result && !gameTrap) {
    return (
      <main className="min-h-[calc(100vh-var(--header-h,52px))]">
        <DayEndScreen
          kidId={selectedKid.id}
          message="きょうの ワナは もう おしまい！"
          subMessage="また あした、げんじつの おてつだいで がんばろう！"
        />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-var(--header-h,52px))] bg-gradient-to-b from-sky-200 via-emerald-100 to-amber-50 px-4 py-4 md:px-8 md:py-6">
      <style>{FIELD_KEYFRAMES}</style>

      <div className="mx-auto max-w-3xl md:max-w-5xl space-y-4 md:space-y-6">
        {/* ページタイトル + きょうの残り回数 */}
        <div className="flex items-center justify-center gap-3">
          <p className="text-center text-sm font-bold text-emerald-700/80">🦁 罠スタイル</p>
          {trapRemaining !== null && (
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-extrabold ring-1 ${
                trapRemaining > 0
                  ? "bg-amber-50 text-amber-700 ring-amber-300"
                  : "bg-slate-100 text-slate-400 ring-slate-300"
              }`}
            >
              🪤 きょうの ワナ のこり {trapRemaining}/{trapStaminaLimit}
            </span>
          )}
        </div>

        {/* 毎日無料の罠枠バナー（0コインでも遊べる保険） */}
        {showFreeBanner && (
          <button
            type="button"
            onClick={() => setShowFreeBanner(false)}
            className="block w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-lime-400 px-4 py-3 text-center text-sm font-extrabold text-emerald-950 shadow ring-2 ring-emerald-200 transition active:scale-[0.99]"
          >
            🎁 きょうの むりょうワナ「{freeTrapName ?? "おとしあな"}」を もらったよ！（タップで とじる）
          </button>
        )}

        {/* 上限到達バナー（回収待ちの罠がある場合のみここに来る） */}
        {trapQuotaExhausted && (
          <p className="rounded-2xl bg-indigo-900/90 px-4 py-3 text-center text-sm font-bold text-amber-200">
            🌙 きょうの ワナは おしまい！ しかけた ワナの ようすだけ みられるよ
          </p>
        )}

        {/* サファリフィールド */}
        <SafariField
          traps={myTraps}
          onCatchAppeared={openGame}
          isPlacingMode={isPlacingMode}
          onPlace={confirmPlacement}
          onCancelPlace={cancelPlacement}
        />

        {/* もちもの（仕掛けるフォーム）＋ 罠ショップ ＋ ワナづくり */}
        <Pouch
          traps={trapTools}
          onSubmit={handleSetTrap}
          canPlace={!trapQuotaExhausted}
          coins={coins}
          buying={buying}
          onBuy={handleBuyTrap}
          recipes={TRAP_RECIPES}
          materialInv={inventory}
          partInv={partInv}
          crafting={crafting}
          onCraft={handleCraftTrap}
        />


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

      {/* クイズゲート：正解したら罠を設置（一本道化） */}
      {quizPlacement && (
        <QuizGate
          title="ワナを しかける まえの ものしりクイズ！"
          subtitle="せいかいすると ワナを しかけられるよ"
          onPass={() => {
            const placement = quizPlacement;
            setQuizPlacement(null);
            if (placement) executePlacement(placement);
          }}
          onCancel={() => setQuizPlacement(null)}
        />
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
      className={`relative aspect-[4/5] md:aspect-[16/9] w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-sky-300 via-emerald-300 to-emerald-500 shadow-2xl ring-4 ring-white ${
        isPlacingMode ? "cursor-crosshair" : ""
      }`}
    >
      {/* 空グラデ */}
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-sky-200/90 via-sky-100/40 to-transparent" />
      {/* 太陽と雲 */}
      <span aria-hidden className="absolute right-6 top-4 text-5xl md:text-7xl drop-shadow">
        ☀️
      </span>
      <span aria-hidden className="absolute left-8 top-6 text-3xl md:text-5xl opacity-90">
        ☁️
      </span>
      <span aria-hidden className="absolute left-1/2 top-12 text-2xl md:text-4xl opacity-80">
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
        className={`block text-6xl md:text-8xl drop-shadow-lg select-none ${
          appeared ? "trap-rustle" : ""
        }`}
        style={{ filter: appeared ? "drop-shadow(0 0 6px #fde68a)" : undefined }}
      >
        {visual}
      </span>

      {/* 吹き出し / 通知 */}
      {appeared ? (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1 md:px-5 md:py-2 text-xs md:text-sm font-extrabold text-white shadow-lg ring-2 ring-rose-200 trap-glow bubble-float">
          ！ タップして キャッチ！
        </span>
      ) : (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 md:px-4 md:py-1 text-[11px] md:text-sm font-bold text-emerald-800 shadow ring-1 ring-emerald-200 bubble-float">
          ⏳ あと {remaining} びょう
        </span>
      )}
    </button>
  );
}

// ────────── もちもの（罠を仕掛けるフォーム・1本化） ──────────
// UserTool (type=TRAP) の toolId / toolName / emoji / quantity を受け取る。
// 一本道化（2026-06-12）：クラフト工房の代わりにコインで基本罠を買える。
function Pouch({
  traps,
  onSubmit,
  canPlace,
  coins,
  buying,
  onBuy,
  recipes,
  materialInv,
  partInv,
  crafting,
  onCraft,
}: {
  traps: UserToolRow[];
  onSubmit: (trapToolId: string) => void;
  canPlace: boolean;
  coins: number;
  buying: boolean;
  onBuy: () => void;
  recipes: readonly TrapRecipe[];
  materialInv: Record<string, number>;
  partInv: Record<string, number>;
  crafting: boolean;
  onCraft: (recipeId: string) => void;
}) {
  const firstAvailable = traps.find((t) => t.quantity > 0)?.toolId ?? "";
  const [trapId, setTrapId] = useState(firstAvailable);

  // インベントリ更新時：選択中のものが 0 個になったら次の在庫アイテムに切り替え
  useEffect(() => {
    const cur = traps.find((t) => t.toolId === trapId);
    if (!trapId || !cur || cur.quantity <= 0) {
      setTrapId(traps.find((t) => t.quantity > 0)?.toolId ?? "");
    }
  }, [traps, trapId]);

  const selectedQty = traps.find((t) => t.toolId === trapId)?.quantity ?? 0;
  const canSubmit = !!trapId && selectedQty > 0 && canPlace;
  const canBuy = coins >= TRAP_COST && !buying;
  // 上位ワナ（かごわな・バネわな）を使うと SSR 出現率アップ
  const isRare = trapId === "cage_trap" || trapId === "leghold";

  return (
    <section className="rounded-3xl bg-white/95 p-3 shadow-lg ring-2 ring-emerald-200">
      <div className="flex items-center justify-between gap-2 pb-2">
        <p className="flex items-center gap-1 text-xs font-extrabold text-emerald-800">
          🎒 つかう ワナ
        </p>
        {isRare && (
          <p className="text-[10px] font-bold text-amber-600 animate-pulse">
            ✨ レア！ SSR どうぶつが でやすいよ
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[10rem] flex-1 text-[11px] font-bold text-amber-800">
          🛠️ ワナを えらぶ
          <select
            value={trapId}
            onChange={(e) => setTrapId(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-amber-300 bg-amber-50 px-2 py-1.5 text-sm font-bold text-amber-900 focus:border-amber-500 focus:outline-none"
          >
            {traps.length === 0 && <option value="">ワナが ないよ（コインで かおう！）</option>}
            {traps.map((t) => (
              <option key={t.toolId} value={t.toolId} disabled={t.quantity <= 0}>
                {t.emoji} {t.toolName} ×{t.quantity}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => onSubmit(trapId)}
          disabled={!canSubmit}
          className={`h-[42px] shrink-0 rounded-xl px-4 text-base font-black text-white shadow transition active:scale-[0.97] ${
            canSubmit
              ? "bg-gradient-to-r from-emerald-500 via-lime-500 to-yellow-500 hover:brightness-110"
              : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
          }`}
        >
          🪤 ばしょを えらぶ！
        </button>
      </div>

      {/* ── 罠ショップ（お手伝い → コイン → 罠 → 図鑑 の原則ルート）── */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/70 px-3 py-2">
        <p className="text-[11px] font-bold leading-relaxed text-amber-800">
          🛒 ワナが たりない？ おてつだいで ためた コインで かえるよ！
          <br />
          <span className="text-[10px] text-amber-600">
            ✨ レアわなは「うんぱんミッション」クリアで もらえる
          </span>
        </p>
        <button
          type="button"
          onClick={onBuy}
          disabled={!canBuy}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black text-white shadow transition active:scale-[0.97] ${
            canBuy
              ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110"
              : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
          }`}
        >
          {buying ? "かいものちゅう…" : `🕳️ おとしあなを かう（🪙${TRAP_COST}）`}
        </button>
      </div>

      {/* ── ワナづくり（あつめた そざい・パーツ → ワナ）── */}
      <div className="mt-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/70 px-3 py-2">
        <p className="pb-1 text-[11px] font-bold text-emerald-800">
          🔨 そざいで ワナを つくる
          <span className="ml-1 text-[10px] text-emerald-600">
            （クレーンの そざい・ガチャの パーツ から）
          </span>
        </p>
        <div className="flex flex-col gap-1.5">
          {recipes.map((r) => {
            const stock = r.source === "material" ? materialInv : partInv;
            const canMake =
              !crafting &&
              r.ingredients.every((ing) => (stock[ing.itemId] ?? 0) >= ing.qty);
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-2 py-1.5"
              >
                <div className="min-w-0 flex-1 text-[11px] font-bold text-emerald-900">
                  <span className="text-sm">
                    {r.outputEmoji} {r.outputName}
                  </span>
                  {r.rare && (
                    <span className="ml-1 text-[9px] font-black text-amber-600">
                      ✨レア
                    </span>
                  )}
                  <span className="block text-[10px] font-medium text-slate-500">
                    {r.ingredients
                      .map(
                        (ing) =>
                          `${ing.emoji}${ing.name}×${ing.qty}（もち${stock[ing.itemId] ?? 0}）`,
                      )
                      .join(" ＋ ")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onCraft(r.id)}
                  disabled={!canMake}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-black text-white shadow transition active:scale-[0.97] ${
                    canMake
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110"
                      : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
                  }`}
                >
                  つくる
                </button>
              </div>
            );
          })}
        </div>
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
      <div className="mx-4 w-full max-w-md md:max-w-xl rounded-[2rem] bg-gradient-to-br from-rose-300 via-amber-200 to-emerald-200 p-1 shadow-2xl">
        <div className="rounded-[1.7rem] bg-white p-6 md:p-10">
          <p className="text-center text-sm md:text-base font-extrabold tracking-widest text-rose-600">
            🎯 タイミング キャッチ 🎯
          </p>
          <p className={`mt-2 text-center text-base md:text-xl ${hint.className}`}>
            {hint.text}
          </p>
          <p className={`mt-0.5 text-center text-xs md:text-sm ${hint.className}`}>
            {hint.subText}
          </p>
          <p className="mt-2 text-center text-[11px] md:text-sm text-slate-500">
            みどりの ゾーンで「キャッチ！」を おすと だいせいこう
          </p>

          <div className="relative mt-5 h-12 md:h-16 overflow-hidden rounded-full bg-slate-100 shadow-inner">
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
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-4 py-5 md:py-7 text-2xl md:text-3xl font-black text-white shadow-lg transition active:scale-[0.98] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
  const [revealed, setReveal] = useState(false);
  const style = RARITY_STYLE[result.animal.rarity];
  const isCaught = result.kind === "caught";
  const isSSR = isCaught && isSSRAnimal(result.animal);
  const genericName = result.animal.genericName || result.animal.name;
  const specificName = result.animal.specificName || result.animal.name;
  const isExtinct = result.animal.isExtinct;

  useEffect(() => {
    if (!isCaught) return;
    let cancelled = false;
    (async () => {
      const mod = await import("canvas-confetti");
      if (cancelled) return;
      if (isSSR) {
        const goldPalette = ["#ffd700", "#ff8800", "#fff0a0", "#ff4500", "#ffe066", "#ffffff"];
        mod.default({ particleCount: 250, spread: 120, origin: { y: 0.5 }, colors: goldPalette, zIndex: 9999, startVelocity: 50 });
        setTimeout(() => {
          if (cancelled) return;
          mod.default({ particleCount: 150, spread: 80, origin: { y: 0.6, x: 0.2 }, colors: goldPalette, zIndex: 9999 });
          mod.default({ particleCount: 150, spread: 80, origin: { y: 0.6, x: 0.8 }, colors: goldPalette, zIndex: 9999 });
        }, 400);
      } else {
        const palette = ["#fda4af", "#fcd34d", "#a7f3d0", "#bae6fd", "#ddd6fe", "#fbcfe8"];
        mod.default({ particleCount: 180, spread: 100, origin: { y: 0.55 }, colors: palette, zIndex: 9999 });
      }
    })();
    return () => { cancelled = true; };
  }, [isCaught, isSSR]);

  // ── SSR 捕獲：激アツ専用モーダル ──────────────────
  if (isSSR) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center touch-manipulation"
        style={{ background: "rgba(0,0,0,0.75)" }}
      >
        <div
          className="ssr-shake mx-4 w-full max-w-sm rounded-[2rem] p-1.5 shadow-2xl"
          style={{
            background: "linear-gradient(135deg,#ff6b00,#ffd700,#ff4500,#ffc200,#ff6b00,#ffe066)",
            backgroundSize: "400% 400%",
            animation: "ssr-screen-shake 0.7s cubic-bezier(.36,.07,.19,.97) 2, ssr-gold-rotate 2s ease infinite",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative overflow-hidden rounded-[1.65rem] px-5 py-8 text-center"
            style={{ background: "radial-gradient(ellipse at center, #1a0a00 0%, #2d1200 40%, #0a0400 100%)" }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {(["fire","bolt","star","boom","spark","fire2","bolt2","star2"] as const).map((_, i) => {
                const FIRE_ICONS = ["🔥","⚡","🌟","💥","✨","🔥","⚡","🌟"];
                return (
                  <span key={i} className="absolute text-2xl" style={{ left: `${10 + i * 12}%`, top: `${5 + (i % 3) * 15}%`, animation: `float-bubble ${(1.2 + i * 0.15).toFixed(2)}s ease-in-out infinite`, animationDelay: `${(i * 0.18).toFixed(2)}s`, opacity: 0.8 }}>
                    {FIRE_ICONS[i]}
                  </span>
                );
              })}
            </div>

            <div className="relative z-10">
              <p className="ssr-text-glow text-3xl font-black tracking-widest" style={{ color: "#ffd700" }}>
                ⚡ SSR ゲット！！！ ⚡
              </p>
              <p className="mt-1 text-xs font-bold text-orange-300 tracking-widest">～ 最強王あらわる ～</p>
            </div>

            <div className="relative z-10 my-5 flex items-center justify-center">
              <span aria-hidden className="absolute text-[8rem] opacity-30 blur-lg" style={{ filter: "drop-shadow(0 0 30px #ffd700)" }}>{result.animal.emoji}</span>
              <span aria-hidden className="ssr-zoom-bounce relative text-[7rem] drop-shadow-lg" style={{ filter: "drop-shadow(0 0 20px #ff8800) drop-shadow(0 0 40px #ffd700)" }}>{result.animal.emoji}</span>
            </div>

            <div className="relative z-10">
              {!revealed ? (
                <>
                  <p className="text-2xl font-black" style={{ color: "#ffd700", textShadow: "0 2px 8px #ff4500" }}>
                    {genericName} を つかまえた！！
                  </p>
                  <p className="mt-2 text-xs text-orange-200">正体は…？</p>
                  <button type="button" onClick={() => setReveal(true)} className="relative z-10 mt-4 rounded-full px-7 py-3 text-base font-black text-black shadow-lg transition hover:brightness-110 active:scale-95" style={{ background: "linear-gradient(90deg,#ffd700,#fff0a0,#ffd700)", boxShadow: "0 0 20px #ffd700" }}>
                    🔍 しょうたいを あかせ！
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-bold text-orange-300 tracking-widest">正体は…</p>
                  <p className="mt-1 text-xl font-black leading-tight" style={{ color: "#ffd700", textShadow: "0 2px 8px #ff4500" }}>{specificName}</p>
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <p className="ssr-badge inline-block rounded-full px-4 py-1 text-sm font-black" style={{ background: "linear-gradient(90deg, #ff6b00, #ffd700, #ff4500)", color: "#fff", boxShadow: "0 0 12px #ffd700" }}>{SSR_LABEL}</p>
                    {isExtinct && <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-gray-300">💀絶滅種</span>}
                  </div>
                  {result.animal.imageUrl && <img src={result.animal.imageUrl} alt={specificName} className="mx-auto mt-3 h-24 w-24 rounded-xl object-cover ring-2 ring-yellow-400" />}
                  <p className="mt-3 text-xs text-amber-200 leading-relaxed text-left">{result.animal.description}</p>
                  <button type="button" onClick={onClose} className="relative z-10 mt-5 rounded-full px-8 py-3 text-base font-black text-white shadow-lg transition hover:brightness-110 active:scale-95" style={{ background: "linear-gradient(90deg, #ff6b00, #ffd700, #ff4500)", boxShadow: "0 0 20px #ffd700" }}>
                    うおおお！さいきょう！！
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 通常 捕獲 / 失敗 モーダル ──────────────────
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm touch-manipulation">
      <div
        onClick={(e) => e.stopPropagation()}
        className={`mx-4 max-w-sm rounded-[2rem] p-1 shadow-2xl ${isCaught ? "bg-gradient-to-br from-emerald-300 via-lime-200 to-yellow-200" : "bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300"}`}
      >
        <div className="rounded-[1.7rem] bg-white px-6 py-10 text-center">
          {isCaught ? (
            <>
              <p className="text-sm font-extrabold tracking-widest text-emerald-600">✨ だいせいこう ✨</p>
              <div className="relative my-4 flex items-center justify-center">
                <span aria-hidden className="absolute text-9xl opacity-20 blur-md">{result.animal.emoji}</span>
                <span aria-hidden className="relative text-8xl drop-shadow-lg animate-bounce">{result.animal.emoji}</span>
              </div>
              {!revealed ? (
                <>
                  <p className={`text-3xl font-black ${style.text}`}>{genericName} を<br />つかまえた！</p>
                  <p className="mt-2 text-sm text-slate-500">正体は…？タップして みてみよう！</p>
                  <button type="button" onClick={() => setReveal(true)} className="mt-5 rounded-full bg-emerald-500 px-7 py-3 text-sm font-extrabold text-white shadow transition hover:brightness-110 active:scale-95">
                    🔍 しょうたいを みる！
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-bold text-slate-400 tracking-widest">正体は…</p>
                  <p className={`mt-1 text-2xl font-black ${style.text}`}>{specificName}</p>
                  <div className="mt-1 flex items-center justify-center gap-2 flex-wrap">
                    <span className={`inline-block rounded-full ${style.bg} px-3 py-0.5 text-xs font-extrabold ${style.text} ring-1 ${style.ring}`}>{RARITY_LABEL[result.animal.rarity]}</span>
                    {isExtinct && <span className="inline-block rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-bold text-gray-200">💀絶滅種</span>}
                  </div>
                  {result.animal.imageUrl && <img src={result.animal.imageUrl} alt={specificName} className="mx-auto mt-3 h-28 w-28 rounded-xl object-cover ring-2 ring-emerald-400 shadow" />}
                  <p className="mt-3 text-sm text-slate-600 text-left leading-relaxed">{result.animal.description}</p>
                  <button type="button" onClick={onClose} className="mt-5 rounded-full bg-emerald-500 px-6 py-2 text-sm font-extrabold text-white shadow transition hover:brightness-110">
                    やったー！図鑑に のったよ！
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold tracking-widest text-slate-500">💨 にげられた…</p>
              <div className="relative my-4 flex items-center justify-center">
                <span aria-hidden className="relative text-8xl drop-shadow-lg opacity-50 grayscale" style={{ animation: "shake 0.4s linear 3" }}>{result.animal.emoji}</span>
              </div>
              <p className="text-2xl font-black text-slate-700">{genericName}</p>
              <p className="mt-3 text-sm text-slate-500">タイミングが ずれちゃった。また あした がんばろう！</p>
              <p className="mt-3 text-[11px] text-rose-500">※ つかった ワナと エサは なくなったよ</p>
              <button type="button" onClick={onClose} className="mt-6 rounded-full bg-slate-500 px-6 py-2 text-sm font-extrabold text-white shadow transition hover:brightness-110">
                つぎは がんばる
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

