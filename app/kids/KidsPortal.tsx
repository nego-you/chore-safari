"use client";

// 子供用ポータルのクライアント本体。
// だれがあそぶ？選択 → 選択後ビュー（コイン残高 + ガチャ + 共有インベントリ）の2画面構成。
// ガチャ実行後は children / inventory をローカル state でその場更新し、リロード不要にする。

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { playGacha } from "./actions";
import { GACHA_COST } from "./config";

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
  itemType: "FOOD" | "TRAP_PART";
};

type Props = {
  children: ChildLite[];
  inventory: InventoryItem[];
};

// 子の名前にふりがなを振る用の辞書（暫定推定。実際の読みは親が後で訂正できる）。
const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

// 表示順 = 年上から。美琴=アザラシ / 幸仁=ハムスター / 叶泰=ラッコ。
const KID_THEMES: Array<{
  emoji: string;
  bg: string;
  ring: string;
  text: string;
}> = [
  {
    // 美琴：アザラシ（うみのいきもの → 水色系）
    emoji: "🦭",
    bg: "bg-gradient-to-br from-sky-300 to-cyan-300",
    ring: "ring-sky-300",
    text: "text-sky-900",
  },
  {
    // 幸仁：ハムスター（ふんわり → クリーム/ピーチ）
    emoji: "🐹",
    bg: "bg-gradient-to-br from-yellow-200 to-pink-200",
    ring: "ring-amber-300",
    text: "text-amber-900",
  },
  {
    // 叶泰：ラッコ（うみ＋もふもふ → 茶色＋ティール）
    emoji: "🦦",
    bg: "bg-gradient-to-br from-amber-300 to-teal-300",
    ring: "ring-teal-300",
    text: "text-amber-900",
  },
];

const ITEM_EMOJI: Record<string, string> = {
  meat: "🍖",
  fish: "🐟",
  berry: "🍓",
  rope: "🪢",
  wood: "🪵",
  net: "🕸️",
  // クラフト完成品
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

type GachaPopup = {
  itemId: string;
  itemName: string;
  itemType: "FOOD" | "TRAP_PART";
};

export function KidsPortal({ children, inventory }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [childList, setChildList] = useState<ChildLite[]>(children);
  const [inventoryList, setInventoryList] =
    useState<InventoryItem[]>(inventory);
  const [popup, setPopup] = useState<GachaPopup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // props が更新されたら（revalidate 後の再描画など）state を同期し直す。
  useEffect(() => setChildList(children), [children]);
  useEffect(() => setInventoryList(inventory), [inventory]);

  // ポップアップは 3.5 秒で自動的に閉じる。
  useEffect(() => {
    if (!popup) return;
    const id = setTimeout(() => setPopup(null), 3500);
    return () => clearTimeout(id);
  }, [popup]);

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

  const foods = inventoryList.filter((i) => i.itemType === "FOOD");
  const trapParts = inventoryList.filter((i) => i.itemType === "TRAP_PART");

  const handleGacha = () => {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await playGacha(selected.id);
      if (!result.success) {
        setError(result.error);
        return;
      }

      // 子のコイン残高を更新
      setChildList((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, coinBalance: result.newCoinBalance }
            : c,
        ),
      );

      // 倉庫の数量を更新（既存なら +1、無ければ追加）
      setInventoryList((prev) => {
        const idx = prev.findIndex((i) => i.itemId === result.item.itemId);
        if (idx === -1) {
          return [
            ...prev,
            {
              // サーバ生成 ID が手元に無いので、UI 用の一時 ID。次回 revalidate で本物に置換される。
              id: `tmp-${result.item.itemId}`,
              itemId: result.item.itemId,
              itemName: result.item.itemName,
              quantity: result.item.totalQuantity,
              itemType: result.item.itemType,
            },
          ];
        }
        return prev.map((i, k) =>
          k === idx ? { ...i, quantity: result.item.totalQuantity } : i,
        );
      });

      setPopup({
        itemId: result.item.itemId,
        itemName: result.item.itemName,
        itemType: result.item.itemType,
      });
    });
  };

  // ── だれがあそぶ？画面 ──────────────────────────
  if (!selected) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-sky-100 via-pink-50 to-yellow-50 px-4 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-3xl">🎪</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-wide text-sky-800 sm:text-5xl">
            だれが あそぶ？
          </h1>
          <p className="mt-3 text-base text-sky-700/80">
            じぶんの なまえを タッチしてね
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {childList.map((child, i) => {
              const theme = themeFor(i);
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setSelectedId(child.id)}
                  className={`group relative flex flex-col items-center justify-center gap-3 rounded-3xl ${theme.bg} px-6 py-8 shadow-xl shadow-sky-200/40 ring-4 ring-white transition hover:-translate-y-1 hover:ring-offset-2 hover:${theme.ring} active:translate-y-0`}
                  aria-label={`${child.name} ではじめる`}
                >
                  <span className="text-6xl drop-shadow" aria-hidden>
                    {theme.emoji}
                  </span>
                  <span
                    className={`text-3xl font-extrabold ${theme.text}`}
                  >
                    <NameRuby name={child.name} />
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-sky-700">
                    {child.coinBalance.toLocaleString()} コイン
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-10 text-xs text-sky-500/70">
            ※ おとなのひとは <code className="rounded bg-white/70 px-1">/bank</code> から つかえるよ
          </p>
        </div>
      </main>
    );
  }

  // ── 選択後の画面 ─────────────────────────────
  const theme = themeFor(selectedIndex);
  const canGacha = selected.coinBalance >= GACHA_COST && !isPending;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 via-pink-50 to-yellow-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* ヘッダー：もどるボタン */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSelectedId(null);
            }}
            className="rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-sky-700 shadow ring-1 ring-sky-200 transition hover:bg-white active:scale-95"
          >
            ← べつのこ
          </button>
          <p className="text-sm font-bold text-sky-700/80">こども ポータル</p>
        </div>

        {/* 名前 + コイン残高ヒーロー */}
        <section
          className={`rounded-[2rem] ${theme.bg} px-6 py-10 text-center shadow-xl ring-4 ring-white`}
        >
          <p className="text-7xl drop-shadow" aria-hidden>
            {theme.emoji}
          </p>
          <h1
            className={`mt-2 text-4xl font-extrabold sm:text-5xl ${theme.text}`}
          >
            <NameRuby name={selected.name} />
          </h1>
          <p className="mt-6 text-sm font-bold text-white/90">
            きみの コイン
          </p>
          <p className="mt-1 font-mono text-6xl font-black tracking-tight text-white drop-shadow sm:text-7xl">
            {selected.coinBalance.toLocaleString()}
            <span className="ml-2 text-2xl">🪙</span>
          </p>
        </section>

        {/* サファリへ いく */}
        <Link
          href={`/kids/safari?kid=${selected.id}`}
          className="block rounded-3xl bg-gradient-to-br from-emerald-300 via-lime-300 to-yellow-300 p-1 shadow-xl transition hover:brightness-110 active:scale-[0.99]"
        >
          <div className="flex items-center gap-4 rounded-[1.4rem] bg-white/90 px-5 py-4 backdrop-blur">
            <span className="text-5xl" aria-hidden>🌿🦁🌿</span>
            <div className="flex-1">
              <p className="text-xl font-black text-emerald-700">
                サファリへ いく！
              </p>
              <p className="text-xs text-emerald-600/80">
                わな と エサで どうぶつを つかまえよう
              </p>
            </div>
            <span className="text-2xl text-emerald-600" aria-hidden>→</span>
          </div>
        </Link>

        {/* レース きじょうへ */}
        <Link
          href="/kids/race"
          className="block rounded-3xl bg-gradient-to-br from-rose-400 via-orange-400 to-amber-400 p-1 shadow-xl transition hover:brightness-110 active:scale-[0.99]"
        >
          <div className="flex items-center gap-4 rounded-[1.4rem] bg-white/90 px-5 py-4 backdrop-blur">
            <span className="text-5xl" aria-hidden>🔥🏟️🔥</span>
            <div className="flex-1">
              <p className="text-xl font-black text-rose-700">
                レース きじょうへ！
              </p>
              <p className="text-xs text-rose-600/80">
                つかまえた どうぶつで しょうぶ！ AI じっきょうつき
              </p>
            </div>
            <span className="text-2xl text-rose-600" aria-hidden>→</span>
          </div>
        </Link>

        {/* アイテムを つくる */}
        <Link
          href="/kids/craft"
          className="block rounded-3xl bg-gradient-to-br from-violet-300 via-pink-200 to-amber-200 p-1 shadow-xl transition hover:brightness-110 active:scale-[0.99]"
        >
          <div className="flex items-center gap-4 rounded-[1.4rem] bg-white/90 px-5 py-4 backdrop-blur">
            <span className="text-5xl" aria-hidden>🛠️✨🧰</span>
            <div className="flex-1">
              <p className="text-xl font-black text-violet-700">
                アイテムを つくる！
              </p>
              <p className="text-xs text-violet-600/80">
                そざいを くみあわせて あたらしい どうぐを クラフト
              </p>
            </div>
            <span className="text-2xl text-violet-600" aria-hidden>→</span>
          </div>
        </Link>

        {/* ガチャボタン */}
        <section
          aria-labelledby="gacha-heading"
          className="rounded-3xl bg-gradient-to-br from-fuchsia-200 via-purple-200 to-sky-200 p-1 shadow-xl"
        >
          <div className="rounded-[1.4rem] bg-white/90 p-5 text-center backdrop-blur">
            <h2
              id="gacha-heading"
              className="flex items-center justify-center gap-2 text-xl font-extrabold text-fuchsia-700"
            >
              <span aria-hidden>🎁</span> アイテムガチャ
            </h2>
            <p className="mt-1 text-sm text-fuchsia-600/80">
              なにが でるか おたのしみ！
            </p>

            <button
              type="button"
              onClick={handleGacha}
              disabled={!canGacha}
              className={`mt-4 w-full rounded-2xl px-4 py-5 text-xl font-black tracking-wide text-white shadow-lg transition active:scale-[0.98] sm:text-2xl ${
                canGacha
                  ? "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-sky-500 hover:brightness-110"
                  : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
              }`}
            >
              {isPending
                ? "ガチャちゅう…"
                : `アイテムをゲットする！（1かい ${GACHA_COST} コイン）`}
            </button>

            {!canGacha && selected.coinBalance < GACHA_COST && (
              <p className="mt-3 text-sm font-bold text-rose-500">
                コインが まだ {GACHA_COST - selected.coinBalance} まい たりないよ
              </p>
            )}
            {error && (
              <p className="mt-3 text-sm font-bold text-rose-500">{error}</p>
            )}
          </div>
        </section>

        {/* みんなのそうこ */}
        <section
          aria-labelledby="warehouse-heading"
          className="rounded-3xl bg-white/80 p-6 shadow-lg ring-1 ring-sky-200 backdrop-blur"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="text-4xl" aria-hidden>📦</span>
            <div>
              <h2
                id="warehouse-heading"
                className="text-2xl font-extrabold text-sky-800"
              >
                みんなの そうこ
              </h2>
              <p className="text-xs text-sky-600/80">
                かぞくみんなで つかう どうぐばこだよ
              </p>
            </div>
          </div>

          {/* エサのコーナー */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-rose-600">
              <span aria-hidden>🍱</span> エサ
            </h3>
            {foods.length === 0 ? (
              <p className="text-sm text-rose-400">まだ なにもないよ</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {foods.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    accent="from-rose-100 to-pink-100 ring-rose-200 text-rose-900"
                    pillClass="bg-rose-500"
                    highlight={popup?.itemId === item.itemId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* わなパーツのコーナー */}
          <div className="mt-6 space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-amber-700">
              <span aria-hidden>🛠️</span> わなパーツ
            </h3>
            {trapParts.length === 0 ? (
              <p className="text-sm text-amber-500">まだ なにもないよ</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {trapParts.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    accent="from-amber-100 to-orange-100 ring-amber-200 text-amber-900"
                    pillClass="bg-amber-600"
                    highlight={popup?.itemId === item.itemId}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <p className="text-center text-xs text-sky-500/70">
          ✨ もっと あそべる ようになるよ おたのしみに ✨
        </p>
      </div>

      {popup && <GachaPopup popup={popup} onClose={() => setPopup(null)} />}
    </main>
  );
}

function ItemCard({
  item,
  accent,
  pillClass,
  highlight,
}: {
  item: InventoryItem;
  accent: string;
  pillClass: string;
  highlight: boolean;
}) {
  const emoji = ITEM_EMOJI[item.itemId] ?? "❓";
  const has = item.quantity > 0;
  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br ${accent} px-3 py-4 ring-2 transition ${
        has ? "" : "opacity-50 grayscale"
      } ${highlight ? "scale-105 ring-4 ring-yellow-400 shadow-yellow-300/60 shadow-lg" : ""}`}
    >
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <span className="text-sm font-extrabold">{item.itemName}</span>
      <span
        className={`absolute -right-1 -top-1 inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-sm font-extrabold text-white shadow ${pillClass}`}
      >
        ×{item.quantity}
      </span>
    </div>
  );
}

function GachaPopup({
  popup,
  onClose,
}: {
  popup: GachaPopup;
  onClose: () => void;
}) {
  const emoji = ITEM_EMOJI[popup.itemId] ?? "🎁";
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="ガチャけっか"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="mx-4 max-w-sm rounded-[2rem] bg-gradient-to-br from-yellow-200 via-pink-200 to-sky-200 p-1 shadow-2xl">
        <div className="rounded-[1.7rem] bg-white px-6 py-10 text-center">
          <p className="text-sm font-extrabold tracking-widest text-fuchsia-500">
            ✨ ゲット ✨
          </p>
          <div className="relative my-4 flex items-center justify-center">
            <span
              aria-hidden
              className="absolute text-9xl opacity-20 blur-md"
            >
              {emoji}
            </span>
            <span
              aria-hidden
              className="relative text-8xl drop-shadow-lg animate-bounce"
            >
              {emoji}
            </span>
          </div>
          <p className="text-3xl font-black text-fuchsia-700">
            {popup.itemName}
          </p>
          <p className="mt-2 text-base font-bold text-fuchsia-500">
            を ゲットしたよ！
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
