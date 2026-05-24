"use client";

// 博物倉庫クライアント。
// セクション:
//   1) 図鑑コンプリート率 + ステージ別 達成度（リンク先 = 既存の /dictionary）
//   2) わたしの どうぶつ（年齢表示・殿堂入りUI・報酬ダイアログ）
//   3) 共有インベントリ（エサ / 罠パーツ）
//   4) 道具 一覧（歴史的背景つき。タップで詳細モーダル）

import Link from "next/link";
import { useState, useTransition } from "react";
import { claimGraduationReward } from "../actions";
import type { GraduationRewardResult } from "../actions";

type StageProgress = {
  stageId: string;
  name: string;
  emoji: string;
  caught: number;
  total: number;
};

type InventoryItem = {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  itemType: "FOOD" | "TRAP_PART";
};

type ToolEntry = {
  id: string;
  toolId: string;
  name: string;
  emoji: string;
  description: string;
  historicalContext: string;
  type: "TRAP" | "BOW" | "SPEAR";
  successRateBonus: number;
  inventoryItemId: string | null;
  consumable: boolean;
};

type MyAnimalEntry = {
  id: string;
  caughtAt: string;
  expiresAt: string | null;
  isAlive: boolean;
  isGraduated: boolean;
  rewardClaimed: boolean;
  ageInYears: number;
  animal: {
    id: string;
    animalId: string;
    specificName: string;
    genericName: string;
    emoji: string;
    rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
    lifespanYears: number;
  };
};

type Props = {
  kidId: string;
  kidName: string;
  caughtCount: number;
  totalCount: number;
  stageProgress: StageProgress[];
  inventory: InventoryItem[];
  tools: ToolEntry[];
  myAnimals: MyAnimalEntry[];
  nowIso: string;
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

const TOOL_TYPE_LABEL: Record<ToolEntry["type"], string> = {
  TRAP: "パッシブ罠",
  BOW: "アクティブ・弓",
  SPEAR: "アクティブ・投擲",
};

const TOOL_TYPE_BG: Record<ToolEntry["type"], string> = {
  TRAP: "from-amber-200 to-orange-200 text-amber-900",
  BOW: "from-emerald-200 to-teal-200 text-emerald-900",
  SPEAR: "from-sky-200 to-indigo-200 text-sky-900",
};

const RARITY_STYLE: Record<MyAnimalEntry["animal"]["rarity"], string> = {
  COMMON: "from-slate-700/80 to-slate-800/90 ring-slate-500",
  RARE: "from-sky-800/80 to-blue-900/90 ring-sky-400",
  EPIC: "from-fuchsia-800/80 to-purple-900/90 ring-fuchsia-400",
  LEGENDARY: "from-amber-700/80 to-yellow-800/90 ring-amber-400",
};

// ─── 卒業報酬ダイアログ ───────────────────────────────────────────────
function GraduationDialog({
  ca,
  kidId,
  onClose,
  onClaimed,
}: {
  ca: MyAnimalEntry;
  kidId: string;
  onClose: () => void;
  onClaimed: (result: GraduationRewardResult) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const animalName = ca.animal.genericName || ca.animal.specificName;
  const coins = ca.animal.lifespanYears * 10;

  function handleClaim() {
    startTransition(async () => {
      const result = await claimGraduationReward(ca.id, kidId);
      onClaimed(result);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[2rem] bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-400 p-1 shadow-2xl ring-4 ring-yellow-200"
      >
        <div className="rounded-[1.75rem] bg-white px-6 py-8 text-center">
          <p className="text-6xl drop-shadow" aria-hidden>
            {ca.animal.emoji}
          </p>
          <p className="mt-3 text-[10px] font-extrabold tracking-widest text-amber-600">
            ✨ じゅみょうを まっとうしたよ ✨
          </p>
          <p className="mt-2 text-lg font-black text-slate-800 leading-snug">
            {animalName}は じゅみょうを まっとうして、
            <br />
            しぜんに かえっていったよ。
          </p>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            さいごに
            <span className="font-extrabold text-amber-600">「今まで おせわ してくれて ありがとう」</span>
            の おくりものを くれたよ！
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 ring-1 ring-amber-300">
            <span className="text-2xl" aria-hidden>🪙</span>
            <span className="text-xl font-black text-amber-700">
              +{coins} コイン
            </span>
          </div>

          {ca.rewardClaimed ? (
            <p className="mt-4 text-xs text-slate-400">もう うけとったよ</p>
          ) : (
            <button
              type="button"
              onClick={handleClaim}
              disabled={isPending}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {isPending ? "うけとり中…" : "🎁 おくりものを うけとる！"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-full bg-slate-100 px-6 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 受取完了トースト ───────────────────────────────────────────────
function ClaimedToast({
  result,
  onClose,
}: {
  result: GraduationRewardResult & { success: true };
  onClose: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-amber-400 px-6 py-3 text-sm font-black text-amber-900 shadow-xl ring-2 ring-amber-200"
      onClick={onClose}
    >
      🪙 +{result.coinsAwarded} コイン もらったよ！
    </div>
  );
}

export function WarehouseClient({
  kidId,
  kidName,
  caughtCount,
  totalCount,
  stageProgress,
  inventory,
  tools,
  myAnimals,
  nowIso: _nowIso,
}: Props) {
  const reading = NAME_READING[kidName] ?? kidName;
  const progressPct = totalCount > 0 ? Math.round((caughtCount / totalCount) * 100) : 0;
  const [selectedTool, setSelectedTool] = useState<ToolEntry | null>(null);
  const [graduationTarget, setGraduationTarget] = useState<MyAnimalEntry | null>(null);
  const [claimedResult, setClaimedResult] = useState<(GraduationRewardResult & { success: true }) | null>(null);

  const trapParts = inventory.filter((i) => i.itemType === "TRAP_PART");

  function handleAnimalTap(ca: MyAnimalEntry) {
    if (ca.isGraduated) {
      setGraduationTarget(ca);
    }
  }

  function handleClaimed(result: GraduationRewardResult) {
    setGraduationTarget(null);
    if (result.success) {
      setClaimedResult(result);
      setTimeout(() => setClaimedResult(null), 3000);
    }
  }

  return (
    <main className="min-h-[calc(100vh-52px)] bg-gradient-to-b from-sky-100 via-indigo-50 to-violet-100 px-4 py-4">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ヒーロー：コンプリート率 */}
        <section className="rounded-[2rem] bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-400 p-1 shadow-xl ring-4 ring-white">
          <div className="rounded-[1.7rem] bg-white/95 px-6 py-6 text-center backdrop-blur">
            <p className="text-5xl drop-shadow" aria-hidden>📖🔭🦒</p>
            <h1 className="mt-1 text-xl font-black text-indigo-800">
              {reading} の 博物 倉庫
            </h1>
            <p className="mt-3 text-[11px] font-bold text-indigo-500 tracking-widest">
              コンプリート
            </p>
            <p className="mt-0.5 font-mono text-4xl font-black tracking-tight text-indigo-800">
              {caughtCount}
              <span className="text-2xl text-indigo-400 font-normal"> / {totalCount}</span>
            </p>

            <div className="mt-3 mx-auto max-w-md">
              <div className="h-3 overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[10px] font-bold text-indigo-500">
                {progressPct}%
              </p>
            </div>
          </div>
        </section>

        {/* ステージ別 達成度 */}
        <section className="rounded-3xl bg-white/85 p-5 shadow ring-1 ring-indigo-200">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-indigo-800">
            <span aria-hidden>🌍</span> ステージ 達成度
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stageProgress.map((s) => {
              const pct = s.total > 0 ? Math.round((s.caught / s.total) * 100) : 0;
              return (
                <Link
                  key={s.stageId}
                  href={`/kids/${kidId}/dictionary`}
                  className="block rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50 p-3 ring-1 ring-indigo-100 transition hover:scale-[1.02] active:scale-95"
                >
                  <p className="text-2xl" aria-hidden>{s.emoji}</p>
                  <p className="text-xs font-extrabold text-indigo-800">{s.name}</p>
                  <p className="text-[10px] text-indigo-500 mt-0.5">
                    {s.caught} / {s.total} ひき
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-indigo-100">
                    <div
                      className="h-full rounded-full bg-indigo-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
          <Link
            href={`/kids/${kidId}/dictionary`}
            className="mt-4 block rounded-full bg-indigo-500 px-4 py-2 text-center text-sm font-extrabold text-white shadow transition hover:brightness-110 active:scale-95"
          >
            📖 図鑑を ひらく →
          </Link>
        </section>

        {/* わたしの どうぶつ（年齢・殿堂入りリスト） */}
        <section className="rounded-3xl bg-white/85 p-5 shadow ring-1 ring-indigo-200">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-indigo-800">
            <span aria-hidden>🌿</span> わたしの どうぶつ
          </h2>
          <p className="text-[11px] text-indigo-500 mt-0.5">
            つかまえた どうぶつと いっしょに いよう
          </p>
          {myAnimals.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">まだ どうぶつを つかまえていないよ。サファリへ いこう！</p>
          ) : (
            <div className="mt-3 space-y-2">
              {myAnimals.map((ca) => {
                const isLegendary = ca.animal.lifespanYears >= 999;

                return (
                  <button
                    key={ca.id}
                    type="button"
                    onClick={() => handleAnimalTap(ca)}
                    disabled={!ca.isGraduated}
                    className={`relative w-full text-left flex items-center gap-3 rounded-2xl p-3 ring-2 transition ${
                      ca.isGraduated
                        ? "bg-gradient-to-br from-yellow-700/60 to-amber-800/70 ring-yellow-400 opacity-80 shadow-lg shadow-yellow-900/40 hover:opacity-100 active:scale-95 cursor-pointer"
                        : `bg-gradient-to-br ${RARITY_STYLE[ca.animal.rarity]} cursor-default`
                    }`}
                  >
                    {/* 絵文字 */}
                    <span
                      className="text-4xl shrink-0"
                      aria-hidden
                      style={ca.isGraduated ? { filter: "drop-shadow(0 0 8px #fbbf24)" } : undefined}
                    >
                      {ca.animal.emoji}
                    </span>

                    {/* 名前・状態 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 leading-tight">
                        {ca.animal.genericName}
                      </p>
                      <p className="text-sm font-extrabold text-white leading-tight line-clamp-1">
                        {ca.animal.specificName}
                      </p>

                      {ca.isGraduated ? (
                        // 寿命を全うした場合
                        <p className="mt-0.5 text-[11px] font-extrabold text-yellow-300 flex items-center gap-1">
                          <span>✨</span>
                          <span>
                            {ca.rewardClaimed
                              ? "しぜんに かえりました（殿堂入り）"
                              : "しぜんに かえりました（タップしてみて！）"}
                          </span>
                        </p>
                      ) : isLegendary ? (
                        // 伝説（不老不死）
                        <p className="mt-0.5 text-[11px] font-extrabold text-amber-300 flex items-center gap-1">
                          <span>♾️</span>
                          <span>えいえんに いっしょ！</span>
                        </p>
                      ) : (
                        // 生存中：年齢表示
                        <p className="mt-0.5 text-[11px] font-extrabold text-emerald-300 flex items-center gap-1">
                          <span>🌱</span>
                          <span>
                            いま {ca.ageInYears} さい（じゅみょう：{ca.animal.lifespanYears} ねん）
                          </span>
                        </p>
                      )}
                    </div>

                    {/* 捕獲日 */}
                    <div className="shrink-0 text-right">
                      <p className="text-[9px] text-slate-500">つかまえた日</p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {new Date(ca.caughtAt).toLocaleDateString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    {/* 殿堂入りバッジ（未受取なら光る） */}
                    {ca.isGraduated && !ca.rewardClaimed && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] shadow ring-2 ring-white animate-pulse">
                        🎁
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 道具一覧 */}
        <section className="rounded-3xl bg-white/85 p-5 shadow ring-1 ring-indigo-200">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-indigo-800">
            <span aria-hidden>🛠️</span> 狩 の 道具
          </h2>
          <p className="text-[11px] text-indigo-500 mt-0.5">
            道具の名前を タップで 歴史と 効果を 表示
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTool(t)}
                className={`text-left rounded-2xl bg-gradient-to-br ${TOOL_TYPE_BG[t.type]} p-3 ring-1 ring-white/60 transition hover:scale-[1.02] active:scale-95`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-3xl shrink-0" aria-hidden>{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black leading-tight">{t.name}</p>
                    <p className="text-[10px] mt-0.5 opacity-80">
                      {TOOL_TYPE_LABEL[t.type]} ／ 命中 +{Math.round(t.successRateBonus * 100)}%
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 共有倉庫（罠パーツ） */}
        <section className="rounded-3xl bg-white/85 p-5 shadow ring-1 ring-indigo-200">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-indigo-800">
            <span aria-hidden>📦</span> 共有 倉庫
          </h2>
          <p className="text-[11px] text-indigo-500 mt-0.5">
            かぞくみんなで つかう ワナと そざい
          </p>

          <div className="mt-3">
            {trapParts.length === 0 ? (
              <p className="text-xs text-amber-500">まだ なにもないよ</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {trapParts.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>

        <p className="text-center text-[11px] font-bold text-indigo-500/70 tracking-widest">
          📦 知識は 力なり 📦
        </p>
      </div>

      {/* 道具詳細モーダル */}
      {selectedTool && (
        <ToolDetailModal tool={selectedTool} onClose={() => setSelectedTool(null)} />
      )}

      {/* 卒業報酬ダイアログ */}
      {graduationTarget && (
        <GraduationDialog
          ca={graduationTarget}
          kidId={kidId}
          onClose={() => setGraduationTarget(null)}
          onClaimed={handleClaimed}
        />
      )}

      {/* 受取完了トースト */}
      {claimedResult && (
        <ClaimedToast
          result={claimedResult}
          onClose={() => setClaimedResult(null)}
        />
      )}
    </main>
  );
}

function ItemCard({ item }: { item: InventoryItem }) {
  const emoji = ITEM_EMOJI[item.itemId] ?? "❓";
  const has = item.quantity > 0;
  return (
    <div
      className={`relative flex flex-col items-center gap-1 rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50 p-2 ring-1 ring-indigo-100 ${
        has ? "" : "opacity-40 grayscale"
      }`}
    >
      <span className="text-2xl" aria-hidden>{emoji}</span>
      <span className="text-[10px] font-extrabold text-slate-700 text-center leading-tight">
        {item.itemName}
      </span>
      <span className="absolute -right-1 -top-1 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-indigo-500 px-1.5 py-0 text-[10px] font-extrabold text-white shadow">
        ×{item.quantity}
      </span>
    </div>
  );
}

function ToolDetailModal({
  tool,
  onClose,
}: {
  tool: ToolEntry;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-[2rem] bg-gradient-to-br ${TOOL_TYPE_BG[tool.type]} p-1 shadow-2xl`}
      >
        <div className="rounded-[1.75rem] bg-white px-6 py-7">
          <div className="flex items-start gap-3">
            <span className="text-5xl" aria-hidden>{tool.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-widest text-slate-500">
                {TOOL_TYPE_LABEL[tool.type]}
              </p>
              <h3 className="text-xl font-black text-slate-800 leading-tight">
                {tool.name}
              </h3>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                命中 +{Math.round(tool.successRateBonus * 100)}%
                {tool.consumable ? " ／ 消費型" : " ／ 再使用可"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-extrabold tracking-widest text-slate-500">
              🛠️ 効果
            </p>
            <p className="mt-1 text-sm text-slate-700 leading-relaxed">
              {tool.description}
            </p>
          </div>

          <div className="mt-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="text-[10px] font-extrabold tracking-widest text-amber-700">
              📜 歴史的 背景
            </p>
            <p className="mt-1 text-sm text-amber-900 leading-relaxed">
              {tool.historicalContext}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-full bg-slate-800 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}
