"use client";

// コンプリート図鑑 UI。
// 未捕獲: シルエット(filter:brightness(0)) + 名前「？？？」+ 解説非表示
// 捕獲済み: カラー絵文字/画像 + specificName + 解説 + 絶滅バッジ

import Link from "next/link";
import { useMemo, useState } from "react";

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

type AnimalEntry = {
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
  caught: boolean;
};

type Props = {
  kidId: string;
  kidName: string;
  animals: AnimalEntry[];
};

const RARITY_ORDER: Record<Rarity, number> = {
  LEGENDARY: 0,
  EPIC: 1,
  RARE: 2,
  COMMON: 3,
};

const RARITY_LABEL: Record<Rarity, string> = {
  LEGENDARY: "でんせつ",
  EPIC: "すごレア",
  RARE: "レア",
  COMMON: "ふつう",
};

const RARITY_BG: Record<Rarity, string> = {
  LEGENDARY: "from-yellow-900/60 to-amber-950/80 ring-amber-500",
  EPIC: "from-fuchsia-900/60 to-purple-950/80 ring-fuchsia-500",
  RARE: "from-sky-900/60 to-blue-950/80 ring-sky-500",
  COMMON: "from-slate-800/60 to-slate-900/80 ring-slate-600",
};

const RARITY_BADGE: Record<Rarity, string> = {
  LEGENDARY: "bg-amber-500 text-amber-950",
  EPIC: "bg-fuchsia-500 text-white",
  RARE: "bg-sky-500 text-white",
  COMMON: "bg-slate-500 text-white",
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきひと",
  "叶泰": "かなた",
};

// ── カード詳細モーダル ───────────────────────────────────────────
function AnimalDetailModal({
  animal,
  onClose,
}: {
  animal: AnimalEntry;
  onClose: () => void;
}) {
  const specificName = animal.specificName || animal.name;
  const genericName = animal.genericName || animal.name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-[2rem] bg-gradient-to-br p-1 shadow-2xl ${RARITY_BG[animal.rarity]}`}
      >
        <div className="rounded-[1.75rem] bg-slate-900 px-6 py-8 text-center">
          {/* 絵文字 or 画像 */}
          {animal.imageUrl ? (
            <img
              src={animal.imageUrl}
              alt={specificName}
              className="mx-auto mb-4 h-36 w-36 rounded-2xl object-cover shadow-lg ring-2 ring-white/20"
            />
          ) : (
            <div className="relative mx-auto mb-4 flex h-36 w-36 items-center justify-center">
              <span className="absolute text-[7rem] opacity-20 blur-lg">{animal.emoji}</span>
              <span className="relative text-[6rem] drop-shadow-lg">{animal.emoji}</span>
            </div>
          )}

          {/* 名前 */}
          <p className="text-[11px] font-bold text-slate-400 tracking-widest">{genericName}</p>
          <p className="mt-0.5 text-xl font-black text-white leading-tight">{specificName}</p>

          {/* バッジ群 */}
          <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
            <span className={`rounded-full px-3 py-0.5 text-[10px] font-extrabold ${RARITY_BADGE[animal.rarity]}`}>
              {RARITY_LABEL[animal.rarity]}
            </span>
            {animal.isExtinct && (
              <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-bold text-gray-200">
                💀 絶滅種
              </span>
            )}
          </div>

          {/* 解説 */}
          <p className="mt-4 text-sm text-slate-300 leading-relaxed text-left">
            {animal.description}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-full bg-white/10 px-8 py-2 text-sm font-bold text-white transition hover:bg-white/20"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 動物カード ─────────────────────────────────────────────────
function AnimalCard({
  animal,
  onClick,
}: {
  animal: AnimalEntry;
  onClick: () => void;
}) {
  const specificName = animal.specificName || animal.name;

  if (!animal.caught) {
    // 未捕獲: シルエット表示
    return (
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-slate-800/60 p-3 ring-1 ring-slate-700 select-none">
        <span
          aria-hidden
          className="text-5xl"
          style={{ filter: "brightness(0)", opacity: 0.6 }}
        >
          {animal.emoji}
        </span>
        <p className="text-xs font-bold text-slate-500">？？？</p>
        <p className="text-[9px] text-slate-600">{RARITY_LABEL[animal.rarity]}</p>
      </div>
    );
  }

  // 捕獲済み: カラー表示
  const isSSR =
    animal.rarity === "LEGENDARY" &&
    ["tyrannosaurus", "hercules_beetle", "lion_king", "megalodon", "dragon_king"].includes(animal.animalId);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center gap-1 rounded-2xl p-3 ring-1 text-left transition hover:scale-105 active:scale-95 ${
        isSSR
          ? "ring-amber-500 shadow-lg shadow-amber-900/50"
          : `bg-gradient-to-br ${RARITY_BG[animal.rarity]}`
      }`}
      style={
        isSSR
          ? {
              background:
                "linear-gradient(135deg, #1a0a00 0%, #3d1f00 50%, #1a0a00 100%)",
            }
          : undefined
      }
      aria-label={specificName}
    >
      {/* 絵文字 or 画像 */}
      {animal.imageUrl ? (
        <img
          src={animal.imageUrl}
          alt=""
          aria-hidden
          className="h-12 w-12 rounded-xl object-cover shadow"
        />
      ) : (
        <span
          aria-hidden
          className="text-4xl drop-shadow"
          style={
            isSSR
              ? { filter: "drop-shadow(0 0 6px #ffd700)" }
              : undefined
          }
        >
          {animal.emoji}
        </span>
      )}

      {/* 種名 */}
      <p
        className={`w-full text-center text-[10px] font-black leading-tight line-clamp-2 ${
          isSSR ? "text-amber-300" : "text-white"
        }`}
      >
        {specificName}
      </p>

      {/* バッジ */}
      <div className="flex gap-1 flex-wrap justify-center">
        <span
          className={`rounded-full px-1.5 py-0 text-[8px] font-extrabold ${RARITY_BADGE[animal.rarity]}`}
        >
          {RARITY_LABEL[animal.rarity]}
        </span>
        {animal.isExtinct && (
          <span className="rounded-full bg-gray-700 px-1.5 py-0 text-[8px] font-bold text-gray-300">
            💀
          </span>
        )}
      </div>
    </button>
  );
}

// ── メイン コンポーネント ──────────────────────────────────────────
export function DictionaryClient({ kidId, kidName, animals }: Props) {
  const [selected, setSelected] = useState<AnimalEntry | null>(null);
  const [filterRarity, setFilterRarity] = useState<Rarity | "ALL">("ALL");

  const kidReading = NAME_READING[kidName] ?? kidName;

  const { caughtCount, totalCount, groups } = useMemo(() => {
    const sorted = [...animals].sort(
      (a, b) =>
        RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] ||
        (a.genericName || a.name).localeCompare(b.genericName || b.name, "ja") ||
        (a.specificName || a.name).localeCompare(b.specificName || b.name, "ja"),
    );

    const filtered =
      filterRarity === "ALL" ? sorted : sorted.filter((a) => a.rarity === filterRarity);

    // rarity でグループ化
    const map = new Map<Rarity, AnimalEntry[]>();
    for (const a of filtered) {
      const list = map.get(a.rarity) ?? [];
      list.push(a);
      map.set(a.rarity, list);
    }

    const rarityOrder: Rarity[] = ["LEGENDARY", "EPIC", "RARE", "COMMON"];
    return {
      caughtCount: animals.filter((a) => a.caught).length,
      totalCount: animals.length,
      groups: rarityOrder.flatMap((r) => {
        const list = map.get(r);
        return list ? [{ rarity: r, list }] : [];
      }),
    };
  }, [animals, filterRarity]);

  const progressPct = totalCount > 0 ? Math.round((caughtCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* ヘッダー */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-900/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href={`/kids/${kidId}`}
            className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
          >
            ← もどる
          </Link>
          <h1 className="text-sm font-extrabold text-white">
            📖 {kidReading} の どうぶつ図鑑
          </h1>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400">コンプリート</p>
            <p className="text-sm font-black text-white">
              {caughtCount} <span className="text-slate-400 font-normal text-xs">/ {totalCount}</span>
            </p>
          </div>
        </div>

        {/* 進捗バー */}
        <div className="mx-auto mt-2 max-w-2xl">
          <div className="h-2 overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-0.5 text-right text-[10px] text-slate-400">{progressPct}%</p>
        </div>
      </header>

      {/* フィルタータブ */}
      <div className="mx-auto max-w-2xl px-4 pt-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["ALL", "LEGENDARY", "EPIC", "RARE", "COMMON"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFilterRarity(r)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                filterRarity === r
                  ? "bg-white text-slate-900 shadow"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              }`}
            >
              {r === "ALL" ? "すべて" : RARITY_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* 図鑑グリッド */}
      <main className="mx-auto max-w-2xl px-4 pb-24">
        {groups.length === 0 ? (
          <p className="mt-16 text-center text-sm text-slate-500">
            どうぶつが いないよ…
          </p>
        ) : (
          groups.map(({ rarity, list }) => (
            <section key={rarity} className="mb-8">
              {/* セクションヘッダー */}
              <div className="mb-3 flex items-center gap-2">
                <span className={`rounded-full px-3 py-0.5 text-xs font-extrabold ${RARITY_BADGE[rarity]}`}>
                  {RARITY_LABEL[rarity]}
                </span>
                <span className="text-[11px] text-slate-400">
                  {list.filter((a) => a.caught).length} / {list.length} ひき
                </span>
              </div>

              {/* グリッド */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {list.map((animal) => (
                  <AnimalCard
                    key={animal.animalId}
                    animal={animal}
                    onClick={() => setSelected(animal)}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {/* コンプリート達成メッセージ */}
        {caughtCount === totalCount && totalCount > 0 && (
          <div className="mt-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 p-4 text-center shadow-lg">
            <p className="text-2xl font-black text-amber-900">🎉 コンプリート！ 🎉</p>
            <p className="mt-1 text-sm font-bold text-amber-800">
              ぜんぶの どうぶつを つかまえたよ！すごい！！
            </p>
          </div>
        )}
      </main>

      {/* 詳細モーダル */}
      {selected && (
        <AnimalDetailModal animal={selected} onClose={() => setSelected(null)} />
      )}

      {/* フッターナビ */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl justify-around px-4 py-2">
          <Link
            href={`/kids/${kidId}`}
            className="flex flex-col items-center gap-0.5 px-4 py-1 text-slate-400 transition hover:text-white"
          >
            <span className="text-xl">🏠</span>
            <span className="text-[10px] font-bold">ホーム</span>
          </Link>
          <Link
            href={`/kids/${kidId}/safari`}
            className="flex flex-col items-center gap-0.5 px-4 py-1 text-slate-400 transition hover:text-white"
          >
            <span className="text-xl">🌿</span>
            <span className="text-[10px] font-bold">サファリ</span>
          </Link>
          <div className="flex flex-col items-center gap-0.5 px-4 py-1 text-white">
            <span className="text-xl">📖</span>
            <span className="text-[10px] font-bold">図鑑</span>
          </div>
        </div>
      </nav>
    </div>
  );
}
