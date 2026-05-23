"use client";

// コンプリート図鑑 UI。
// 未捕獲: シルエット(filter:brightness(0)) + 名前「？？？」+ 解説非表示
// 捕獲済み: カラー絵文字/画像 + specificName + 解説 + 絶滅バッジ

import Link from "next/link";
import { useMemo, useState } from "react";

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

type CaptureStat = {
  userId: string;
  userName: string;
  count: number;
};

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
  habitat?: string;
  era?: string;
  location?: string;
  // 現実の平均寿命（年）
  lifespanYears?: number;
  // 家族の誰か1人でも捕まえていれば true（家族共通図鑑）
  caught: boolean;
  // 子供ごとの捕獲回数（年上から）
  captureStats: CaptureStat[];
  // 家族全体での累計捕獲回数
  totalCount: number;
};

type Props = {
  kidId: string;
  kidName: string;
  animals: AnimalEntry[];
  familySize: number;
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

// ── 世界地図 コンポーネント ─────────────────────────────────────────
// location 文字列に部分一致するリージョンをハイライト表示する簡易SVG地図。
const WORLD_REGIONS: Array<{
  id: string;
  label: string;
  keywords: string[];
  path: string;
  cx: number;
  cy: number;
}> = [
  {
    id: "africa",
    label: "アフリカ",
    keywords: ["アフリカ"],
    path: "M 175,95 L 185,90 L 205,92 L 215,105 L 210,130 L 195,148 L 180,145 L 168,130 L 165,112 Z",
    cx: 190, cy: 120,
  },
  {
    id: "europe",
    label: "ヨーロッパ",
    keywords: ["ヨーロッパ", "イギリス", "フランス", "ドイツ"],
    path: "M 155,55 L 175,52 L 190,58 L 188,72 L 175,78 L 158,74 L 150,65 Z",
    cx: 170, cy: 65,
  },
  {
    id: "eurasia",
    label: "ユーラシア",
    keywords: ["ユーラシア", "シベリア", "ロシア"],
    path: "M 190,42 L 280,40 L 295,55 L 285,72 L 240,75 L 192,70 L 185,58 Z",
    cx: 240, cy: 57,
  },
  {
    id: "asia",
    label: "アジア",
    keywords: ["アジア", "ちゅうごく", "にほん", "インド", "ちゅうとう", "ちゅうきんとう"],
    path: "M 250,65 L 310,62 L 325,80 L 315,105 L 285,110 L 260,100 L 248,82 Z",
    cx: 288, cy: 87,
  },
  {
    id: "americas",
    label: "アメリカ",
    keywords: ["アメリカ", "なんアメリカ", "きたアメリカ", "アマゾン", "なんべい", "きたべい"],
    path: "M 60,55 L 105,52 L 110,75 L 100,115 L 80,130 L 60,120 L 48,90 L 52,68 Z",
    cx: 80, cy: 90,
  },
  {
    id: "ocean",
    label: "かいよう",
    keywords: ["かいよう", "うみ", "たいへいよう", "大西洋", "インド洋", "深海"],
    path: "M 120,130 L 145,135 L 140,150 L 120,148 Z",
    cx: 360, cy: 150,
  },
  {
    id: "world",
    label: "せかい",
    keywords: ["せかい", "世界各地", "せかいかくち", "ぜんせかい"],
    path: "",
    cx: 200, cy: 100,
  },
];

function WorldMap({ location }: { location?: string }) {
  if (!location) return null;

  const loc = location.toLowerCase();
  const matchAll = WORLD_REGIONS.some(
    (r) => r.id === "world" && r.keywords.some((k) => loc.includes(k.toLowerCase())),
  );

  const highlighted = new Set(
    WORLD_REGIONS
      .filter((r) => r.keywords.some((k) => loc.includes(k.toLowerCase())))
      .map((r) => r.id),
  );

  return (
    <div className="mt-3 rounded-2xl bg-slate-800/60 p-3 ring-1 ring-white/10">
      <p className="mb-1 text-[10px] font-extrabold tracking-widest text-slate-400">
        🌍 せかい ちず
      </p>
      <p className="mb-2 text-[11px] text-amber-300 font-bold">{location}</p>
      <svg
        viewBox="0 0 400 180"
        className="w-full rounded-xl"
        style={{ background: "linear-gradient(180deg,#0a2540 0%,#0f3460 100%)" }}
        aria-label={`地図: ${location}`}
      >
        {/* 海の背景 */}
        <rect x="0" y="0" width="400" height="180" fill="#0f3460" rx="8" />

        {/* 大陸シルエット（全体を薄く） */}
        {WORLD_REGIONS.filter((r) => r.path).map((r) => {
          const isHit = matchAll || highlighted.has(r.id);
          return (
            <g key={r.id}>
              <path
                d={r.path}
                fill={isHit ? "#f59e0b" : "#1e4a7a"}
                stroke={isHit ? "#fcd34d" : "#2d6aa0"}
                strokeWidth={isHit ? 1.5 : 0.8}
                style={{
                  filter: isHit ? "drop-shadow(0 0 6px #fbbf24)" : "none",
                  transition: "fill 0.3s",
                }}
              />
              {isHit && (
                <text
                  x={r.cx}
                  y={r.cy + 4}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="bold"
                  fill="#1a0a00"
                >
                  {r.label}
                </text>
              )}
            </g>
          );
        })}

        {/* 世界各地ハイライト時は全大陸をぼんやり光らせる */}
        {matchAll && (
          <text x="200" y="172" textAnchor="middle" fontSize="8" fill="#fcd34d" fontWeight="bold">
            ✨ せかいかくちに いたよ！
          </text>
        )}

        {/* ピン：ハイライト地域の中心 */}
        {!matchAll && WORLD_REGIONS.filter((r) => r.path && highlighted.has(r.id)).map((r) => (
          <g key={`pin-${r.id}`}>
            <circle cx={r.cx} cy={r.cy} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.2" />
            <line
              x1={r.cx} y1={r.cy - 5}
              x2={r.cx} y2={r.cy - 12}
              stroke="#ef4444" strokeWidth="1.5"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── 年代タイムライン コンポーネント ───────────────────────────────────
const ERA_MILESTONES = [
  { label: "きょうりゅう", pos: 2,  full: "きょうりゅうじだい" },
  { label: "こおり",       pos: 15, full: "こおりのじだい（ひょうがき）" },
  { label: "きゅうせっき", pos: 32, full: "きゅうせっきじだい" },
  { label: "じょうもん",   pos: 50, full: "じょうもんじだい" },
  { label: "こだい",       pos: 65, full: "こだい" },
  { label: "ちゅうせい",   pos: 80, full: "ちゅうせい" },
  { label: "きんだい",     pos: 90, full: "きんだい" },
  { label: "いま",         pos: 98, full: "げんだい" },
];

function eraToPosition(era: string): number {
  const e = era.toLowerCase();
  if (e.includes("きょうりゅう") || e.includes("白亜") || e.includes("恐竜")) return 2;
  if (e.includes("こおり") || e.includes("ひょうがき") || e.includes("氷河")) return 16;
  if (e.includes("50まん") || e.includes("30まん") || e.includes("旧石器") || e.includes("きゅうせっき")) return 33;
  if (e.includes("9まん") || e.includes("5まん") || e.includes("3まん") || e.includes("1まん") || e.includes("じょうもん") || e.includes("縄文")) return 52;
  if (e.includes("5000") || e.includes("こだい") || e.includes("古代")) return 65;
  if (e.includes("ちゅうせい") || e.includes("中世") || e.includes("2500") || e.includes("1000")) return 80;
  if (e.includes("きんだい") || e.includes("近代") || e.includes("1700") || e.includes("1800") || e.includes("1900")) return 90;
  if (e.includes("げんだい") || e.includes("現代") || e.includes("いま") || e.includes("いまも")) return 98;
  return 50; // default: 中間
}

function EraTimeline({ era }: { era?: string }) {
  if (!era) return null;
  const pos = eraToPosition(era);

  return (
    <div className="mt-3 rounded-2xl bg-slate-800/60 p-3 ring-1 ring-white/10">
      <p className="mb-1 text-[10px] font-extrabold tracking-widest text-slate-400">
        ⏳ ねんだい タイムライン
      </p>
      <p className="mb-2 text-[11px] text-amber-300 font-bold">{era}</p>

      {/* タイムラインバー */}
      <div className="relative mx-1">
        {/* 軸 */}
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-sky-900 via-indigo-700 to-emerald-600" />

        {/* マイルストーンのティック */}
        {ERA_MILESTONES.map((m) => (
          <div
            key={m.label}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${m.pos}%`, transform: "translateX(-50%)" }}
          >
            <div className="h-2 w-0.5 bg-white/30" />
          </div>
        ))}

        {/* 現在位置ピン */}
        <div
          className="absolute -top-1.5 flex flex-col items-center"
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        >
          <div
            className="h-5 w-5 rounded-full border-2 border-amber-300 bg-amber-500 shadow-lg"
            style={{ filter: "drop-shadow(0 0 4px #fbbf24)" }}
          />
        </div>
      </div>

      {/* ラベル行 */}
      <div className="relative mt-3 h-6">
        {ERA_MILESTONES.map((m) => (
          <span
            key={m.label}
            className={`absolute text-[8px] font-bold leading-none ${
              Math.abs(eraToPosition(m.full) - pos) < 10
                ? "text-amber-300"
                : "text-slate-500"
            }`}
            style={{
              left: `${m.pos}%`,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* 端ラベル */}
      <div className="mt-1 flex justify-between text-[8px] text-slate-500">
        <span>← おおむかし</span>
        <span>いま →</span>
      </div>
    </div>
  );
}

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

          {/* じゅみょう */}
          {animal.lifespanYears !== undefined && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 ring-1 ring-amber-400/40">
              <span className="text-base" aria-hidden>⌛</span>
              <span className="text-[12px] font-extrabold text-amber-300">
                {animal.lifespanYears >= 999
                  ? "じゅみょう：ふろうふし（えいえんのいのち）"
                  : `じゅみょう：やく ${animal.lifespanYears} ねん`}
              </span>
            </div>
          )}

          {animal.habitat && (
            <p className="mt-2 text-[11px] text-slate-400 text-left">
              <span className="font-bold text-slate-300">🌿 すみか：</span>
              {animal.habitat}
            </p>
          )}

          {/* 🌍 世界地図 */}
          {animal.location && <WorldMap location={animal.location} />}

          {/* ⏳ 年代タイムライン */}
          {animal.era && <EraTimeline era={animal.era} />}

          {/* 🌟 家族の捕獲スタッツ */}
          <div className="mt-4 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 text-left">
            <p className="text-[10px] font-extrabold tracking-widest text-slate-400">
              👨‍👩‍👧‍👦 だれが つかまえた？
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              かぞく ごうけい {animal.totalCount} かい
            </p>
            <div className="mt-2 space-y-1.5">
              {animal.captureStats.map((s) => {
                const yomi = NAME_READING[s.userName] ?? s.userName;
                const hasCount = s.count > 0;
                return (
                  <div
                    key={s.userId}
                    className={`flex items-center gap-2 ${
                      hasCount ? "" : "opacity-40"
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-300 min-w-[5rem]">
                      {yomi}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full ${
                          hasCount
                            ? "bg-gradient-to-r from-amber-400 to-rose-400"
                            : "bg-slate-600"
                        }`}
                        style={{
                          width: `${Math.min(100, s.count * 25)}%`,
                        }}
                      />
                    </div>
                    <span
                      className={`text-xs font-extrabold tabular-nums min-w-[3rem] text-right ${
                        hasCount ? "text-amber-300" : "text-slate-500"
                      }`}
                    >
                      {s.count} かい
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

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
      className={`group relative flex flex-col items-center gap-1 rounded-2xl p-3 ring-1 text-left transition hover:scale-105 active:scale-95 ${
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

      {/* 🌟 家族の累計捕獲回数 */}
      {animal.totalCount > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-amber-900 shadow ring-2 ring-slate-900">
          ×{animal.totalCount}
        </span>
      )}
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
    <div className="min-h-[calc(100vh-52px)] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* コンプリート進捗バー（ページ上部に配置） */}
      <div className="mx-auto max-w-2xl px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xs font-extrabold text-white">
            📖 {kidReading} の どうぶつ図鑑
          </h1>
          <p className="text-xs font-black text-white">
            {caughtCount}
            <span className="text-slate-400 font-normal text-[10px]"> / {totalCount}</span>
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

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
