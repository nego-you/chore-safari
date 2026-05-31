"use client";

// 子供用ポータルのクライアント本体。
// 2026-05-17 改修:
//   「だれがあそぶ？」ピッカー → 選択後は「ワールドマップ」UI に。
// 2026-05-20 改修:
//   SpokeCard 式のメニューを WorldMapPortal（インタラクティブ地図UI）へ全面差替え。
//   幸仁のアイコンを 🐷 → 🐹 に修正。

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorldMapPortal } from "./WorldMapPortal";
import {
  getUnreadBonusNotifications,
  markBonusRead,
  getUnreadPenaltyNotifications,
  markPenaltyRead,
} from "./actions";

type ChildLite = {
  id: string;
  name: string;
  coinBalance: number;
};

type InventoryItem = {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  itemType: "FOOD" | "TRAP_PART" | "MATERIAL"; // DB enum ItemType に一致
};

type BonusNotification = {
  id: string;
  userId: string;
  reason: string;
  coinAmount: number;
  createdAt: string; // ISO
};

type PenaltyNotification = {
  id: string;
  userId: string;
  reason: string;
  coinAmount: number;
  createdAt: string; // ISO
};

type Props = {
  children: ChildLite[];
  // 後方互換のため受け取るが、ワールドマップ画面では使わない。
  // 倉庫の中身は /kids/[kidId]/warehouse 側で再取得する。
  inventory: InventoryItem[];
  initialSelectedId?: string | null;
  initialNotifications?: BonusNotification[];
  initialPenalties?: PenaltyNotification[];
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

// 表示順 = 年上から。美琴=アザラシ / 幸仁=ハムスター / 叶泰=ラッコ。
// ※ 幸仁のアイコンを 🐷(ブタ) → 🐹(ハムスター) に修正 (2026-05-20)
const KID_THEMES: Array<{
  emoji: string;
  bg: string;
  ring: string;
  text: string;
  // ピッカー画面で使う背景グラデーション
  mapBg: string;
}> = [
  {
    emoji: "🦭",
    bg: "bg-gradient-to-br from-sky-300 to-cyan-300",
    ring: "ring-sky-300",
    text: "text-sky-900",
    mapBg: "from-sky-200 via-cyan-100 to-emerald-100",
  },
  {
    emoji: "🐹",
    bg: "bg-gradient-to-br from-pink-200 to-rose-200",
    ring: "ring-pink-300",
    text: "text-rose-900",
    mapBg: "from-pink-100 via-rose-100 to-emerald-100",
  },
  {
    emoji: "🦦",
    bg: "bg-gradient-to-br from-amber-300 to-teal-300",
    ring: "ring-teal-300",
    text: "text-amber-900",
    mapBg: "from-teal-100 via-amber-100 to-emerald-100",
  },
];

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

export function KidsPortal({
  children,
  inventory: _inventory,
  initialSelectedId = null,
  initialNotifications = [],
  initialPenalties = [],
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [childList, setChildList] = useState<ChildLite[]>(children);

  // ── ボーナス通知 ──────────────────────────────────────
  const [notifications, setNotifications] =
    useState<BonusNotification[]>(initialNotifications);
  const [activeBonus, setActiveBonus] = useState<BonusNotification | null>(null);

  // ── ペナルティ通知 ────────────────────────────────────
  const [penalties, setPenalties] =
    useState<PenaltyNotification[]>(initialPenalties);
  const [activePenalty, setActivePenalty] = useState<PenaltyNotification | null>(null);

  useEffect(() => setChildList(children), [children]);
  // initialNotifications / initialPenalties は初回のみ使用
  // 毎回新しいオブジェクトが渡されるため、dependency から外す
  useEffect(() => {
    setNotifications(initialNotifications);
  }, []); // 初回のみ
  useEffect(() => {
    setPenalties(initialPenalties);
  }, []); // 初回のみ

  // ボーナス通知：選択中の子に未読があれば表示
  useEffect(() => {
    if (activeBonus || !selectedId) return;
    const next = notifications.find((n) => n.userId === selectedId);
    if (next) setActiveBonus(next);
  }, [selectedId, notifications, activeBonus]);

  // ペナルティ通知：ボーナスを先に処理し終えてから表示（重なり防止）
  useEffect(() => {
    if (activeBonus || activePenalty || !selectedId) return;
    const next = penalties.find((n) => n.userId === selectedId);
    if (next) setActivePenalty(next);
  }, [selectedId, penalties, activeBonus, activePenalty]);

  // 15秒ごとにポーリング（ボーナス・ペナルティ両方）
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [freshBonus, freshPenalty] = await Promise.all([
          getUnreadBonusNotifications(selectedId),
          getUnreadPenaltyNotifications(selectedId),
        ]);
        if (!cancelled) {
          setNotifications((prev) => {
            const known = new Set(prev.map((n) => n.id));
            const merged = [...prev];
            for (const n of freshBonus) if (!known.has(n.id)) merged.push(n);
            return merged;
          });
          setPenalties((prev) => {
            const known = new Set(prev.map((n) => n.id));
            const merged = [...prev];
            for (const n of freshPenalty) if (!known.has(n.id)) merged.push(n);
            return merged;
          });
        }
      } catch {
        /* ignore */
      }
    };
    const handle = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [selectedId]);

  const handleAckBonus = async () => {
    const current = activeBonus;
    if (!current) return;
    setActiveBonus(null);
    setNotifications((prev) => prev.filter((n) => n.id !== current.id));
    try {
      await markBonusRead(current.id);
    } catch {
      /* ignore */
    }
  };

  const handleAckPenalty = async () => {
    const current = activePenalty;
    if (!current) return;
    setActivePenalty(null);
    setPenalties((prev) => prev.filter((n) => n.id !== current.id));
    try {
      await markPenaltyRead(current.id);
    } catch {
      /* ignore */
    }
  };

  const themeFor = useMemo(
    () => (index: number) => KID_THEMES[index % KID_THEMES.length],
    [],
  );

  const selected = selectedId
    ? childList.find((c) => c.id === selectedId) ?? null
    : null;
  const selectedIndex = selectedId
    ? childList.findIndex((c) => c.id === selectedId)
    : -1;

  // ── だれがあそぶ？画面 ──────────────────────────
  if (!selected) {
    return (
      <main className="h-screen overflow-hidden bg-gradient-to-b from-sky-100 via-pink-50 to-yellow-50 px-4 py-4 flex flex-col justify-center">
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="text-3xl leading-none md:text-5xl">🎪</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-wide text-sky-800 sm:text-4xl md:text-5xl">
            だれが あそぶ？
          </h1>
          <p className="mt-1 text-sm text-sky-700/80 md:text-base md:mt-2">
            じぶんの なまえを タッチしてね
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-8 md:mt-10">
            {childList.map((child, i) => {
              const theme = themeFor(i);
              return (
                <Link
                  key={child.id}
                  href={`/kids/${child.id}`}
                  className={`group relative flex flex-col items-center justify-center gap-3 rounded-3xl ${theme.bg} px-6 py-8 md:py-14 shadow-xl shadow-sky-200/40 ring-4 ring-white transition hover:-translate-y-1 hover:ring-offset-2 hover:${theme.ring} active:translate-y-0`}
                  aria-label={`${child.name} ではじめる`}
                >
                  <span className="text-5xl drop-shadow md:text-9xl" aria-hidden>
                    {theme.emoji}
                  </span>
                  <span className={`text-2xl font-extrabold md:text-4xl ${theme.text}`}>
                    <NameRuby name={child.name} />
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-sky-700 md:text-sm md:px-4 md:py-1.5 md:right-4 md:top-4">
                    {child.coinBalance.toLocaleString()} コイン
                  </span>
                </Link>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-sky-500/70 md:text-sm">
            ※ おとなのひとは <code className="rounded bg-white/70 px-1">/bank</code> から つかえるよ
          </p>
        </div>
      </main>
    );
  }

  // ── 選択後：インタラクティブ・ワールドマップ ──────────────
  return (
    <>
      <WorldMapPortal
        children={childList}
        selectedId={selected.id}
        onBack={() => setSelectedId(null)}
      />
      {activeBonus && (
        <BonusCelebrationModal bonus={activeBonus} onAck={handleAckBonus} />
      )}
      {!activeBonus && activePenalty && (
        <PenaltyWarningModal penalty={activePenalty} onAck={handleAckPenalty} />
      )}
    </>
  );
}

// ───────────── 特大達成ボーナス祝賀モーダル ─────────────
function BonusCelebrationModal({
  bonus,
  onAck,
}: {
  bonus: BonusNotification;
  onAck: () => void;
}) {
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    (async () => {
      const mod = await import("canvas-confetti");
      const confetti = mod.default;
      if (cancelled) return;
      const palette = [
        "#fda4af",
        "#fcd34d",
        "#fde68a",
        "#a7f3d0",
        "#bae6fd",
        "#ddd6fe",
        "#fbcfe8",
        "#fef08a",
      ];
      confetti({
        particleCount: 220,
        spread: 110,
        startVelocity: 55,
        origin: { x: 0.5, y: 0.5 },
        colors: palette,
        scalar: 1.2,
        zIndex: 9999,
      });
      timers.push(
        setTimeout(() => {
          confetti({
            particleCount: 120,
            angle: 60,
            spread: 70,
            origin: { x: 0, y: 0.7 },
            colors: palette,
            zIndex: 9999,
          });
        }, 180),
      );
      timers.push(
        setTimeout(() => {
          confetti({
            particleCount: 120,
            angle: 120,
            spread: 70,
            origin: { x: 1, y: 0.7 },
            colors: palette,
            zIndex: 9999,
          });
        }, 360),
      );
      const end = Date.now() + 2000;
      const rain = () => {
        if (cancelled) return;
        confetti({
          particleCount: 14,
          startVelocity: 25,
          spread: 360,
          ticks: 90,
          origin: {
            x: Math.random(),
            y: Math.random() * 0.4,
          },
          colors: palette,
          scalar: 0.9,
          zIndex: 9999,
        });
        if (Date.now() < end) {
          timers.push(setTimeout(rain, 220));
        }
      };
      rain();
    })();
    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [bonus.id]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
      onClick={onAck}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-pink-300/40 via-amber-200/40 to-sky-300/40 backdrop-blur-md touch-manipulation"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-10 select-none text-[14rem] opacity-30 blur-[1px] animate-pulse"
      >
        ✨
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -right-12 select-none text-[14rem] opacity-30 blur-[1px] animate-pulse"
      >
        🌟
      </span>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 w-full max-w-lg md:max-w-2xl rounded-[2.25rem] bg-gradient-to-br from-yellow-200 via-pink-200 to-sky-200 p-1 shadow-[0_30px_80px_rgba(244,114,182,0.45)]"
      >
        <div className="rounded-[2rem] bg-white/95 px-6 py-10 md:px-12 md:py-14 text-center">
          <p className="text-sm md:text-base font-extrabold tracking-[0.4em] text-fuchsia-500 animate-pulse">
            ✨ おしらせ ✨
          </p>
          <div className="relative mt-5 flex items-center justify-center">
            <span
              aria-hidden
              className="absolute text-[10rem] md:text-[14rem] opacity-20 blur-md"
            >
              🌟
            </span>
            <span
              aria-hidden
              className="relative text-9xl md:text-[10rem] drop-shadow-[0_8px_20px_rgba(251,191,36,0.5)] animate-bounce"
            >
              🌟
            </span>
          </div>
          <h1 className="mt-4 bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-500 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-4xl md:text-5xl">
            {bonus.reason}
          </h1>
          <p className="mt-2 text-2xl md:text-3xl font-extrabold text-rose-500">
            たっせい おめでとう！！
          </p>
          <div className="mt-6 inline-flex items-baseline gap-2 rounded-3xl bg-gradient-to-br from-amber-200 to-yellow-300 px-6 py-3 md:px-10 md:py-5 shadow-inner ring-2 ring-amber-300">
            <span className="font-mono text-5xl font-black tracking-tight text-amber-900 sm:text-6xl md:text-7xl">
              {bonus.coinAmount.toLocaleString()}
            </span>
            <span className="text-xl md:text-2xl font-extrabold text-amber-800">
              コイン
            </span>
            <span className="text-3xl md:text-4xl" aria-hidden>
              🪙
            </span>
          </div>
          <p className="mt-3 text-base md:text-xl font-extrabold text-fuchsia-500">
            ゲット！
          </p>
          <button
            type="button"
            onClick={onAck}
            className="mt-8 w-full rounded-full bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-500 px-8 py-4 md:py-6 text-xl md:text-2xl font-black text-white shadow-lg transition hover:brightness-110 active:scale-95"
          >
            ありがとう！
          </button>
          <p className="mt-2 text-[10px] md:text-xs text-slate-500">
            つぎは きをつけよう！
          </p>
        </div>
      </div>
    </div>
  );
}


// ───────────── ペナルティ警告モーダル ─────────────
function PenaltyWarningModal({
  penalty,
  onAck,
}: {
  penalty: PenaltyNotification;
  onAck: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-rose-950/60 backdrop-blur-sm touch-manipulation"
    >
      {/* 背景デコ */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-8 -left-8 select-none text-[12rem] opacity-10 blur-sm"
      >
        🚨
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-10 select-none text-[12rem] opacity-10 blur-sm"
      >
        ⚡
      </span>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 w-full max-w-sm md:max-w-xl rounded-[2rem] bg-gradient-to-b from-rose-800 to-slate-800 p-px shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="rounded-[calc(2rem-1px)] bg-slate-900 px-6 py-8 md:px-10 md:py-12 text-center">
          {/* アイコン */}
          <div className="relative mx-auto mb-1 flex h-24 w-24 md:h-36 md:w-36 items-center justify-center">
            <span
              aria-hidden
              className="absolute text-[5rem] md:text-[7rem] opacity-20 blur-md"
            >
              🚨
            </span>
            <span
              aria-hidden
              className="relative text-[4.5rem] md:text-[6rem] drop-shadow-[0_4px_12px_rgba(239,68,68,0.6)]"
            >
              🚨
            </span>
          </div>

          {/* タイトル */}
          <p className="text-[11px] md:text-sm font-extrabold tracking-[0.35em] text-rose-400 uppercase">
            ペナルティ はっせい…
          </p>
          <h1 className="mt-2 text-2xl font-black leading-snug text-rose-100 sm:text-3xl md:text-4xl">
            コインが へって<br />しまった！
          </h1>

          {/* 理由 */}
          <div className="mx-auto mt-5 max-w-xs md:max-w-sm rounded-2xl border border-rose-700/50 bg-rose-950/60 px-4 py-3 md:px-6 md:py-4">
            <p className="text-[11px] md:text-sm font-bold tracking-widest text-rose-400/80 mb-1">
              りゆう
            </p>
            <p className="text-lg md:text-xl font-extrabold leading-snug text-rose-100">
              {penalty.reason}
            </p>
          </div>

          {/* 没収額 */}
          <div className="mt-4 inline-flex items-baseline gap-1.5 rounded-full border border-rose-700/60 bg-rose-950/80 px-5 py-2.5 md:px-8 md:py-4">
            <span className="font-mono text-4xl font-black tabular-nums text-rose-300 sm:text-5xl md:text-6xl">
              {penalty.coinAmount.toLocaleString()}
            </span>
            <span className="text-lg md:text-xl font-extrabold text-rose-400">
              コイン
            </span>
            <span className="text-2xl md:text-3xl" aria-hidden>😢</span>
          </div>
          <p className="mt-1.5 text-sm md:text-base font-bold text-rose-400/80">
            ぼっしゅうされました
          </p>

          {/* 確認ボタン */}
          <button
            type="button"
            onClick={onAck}
            className="mt-7 w-full rounded-full bg-gradient-to-r from-rose-700 to-slate-600 px-8 py-3.5 md:py-5 text-lg md:text-xl font-black text-white shadow-lg transition hover:brightness-110 active:scale-95"
          >
            ごめんなさい…
          </button>
          <p className="mt-2 text-[10px] md:text-xs text-slate-500">
            つぎは きをつけよう！
          </p>
        </div>
      </div>
    </div>
  );
}
