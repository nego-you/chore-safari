"use client";

// アクティブ狩りのクライアント。
// フロー:
//   1) ステージを選ぶ
//   2) 道具（弓 / 投槍器）を選ぶ
//   3) ゲージ式タイミングミニゲームで命中判定
//   4) 結果（捕獲成功 or 逃げられた）を表示。歴史的背景も合わせて出す。

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { startActiveHunt, resolveActiveHunt } from "../../../actions";

type ToolEntry = {
  id: string;
  toolId: string;
  name: string;
  emoji: string;
  description: string;
  historicalContext: string;
  type: "BOW" | "SPEAR";
  successRateBonus: number;
  inventoryItemId: string | null;
  consumable: boolean;
};

type StageEntry = {
  id: string;
  stageId: string;
  name: string;
  emoji: string;
  description: string;
  animalCount: number;
};

type InventoryRow = { itemId: string; quantity: number; itemName: string };

type AnimalLite = {
  id: string;
  animalId: string;
  name: string;
  genericName: string;
  specificName: string;
  emoji: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  description: string;
  imageUrl: string | null;
  isExtinct: boolean;
};

type ActiveHunt = {
  id: string;
  huntType: "BOW" | "SPEAR";
  toolName: string;
  toolEmoji: string;
  targetAnimal: AnimalLite;
  sweetSpotWidth: number; // 0〜1
};

type Props = {
  kidId: string;
  kidName: string;
  tools: ToolEntry[];
  stages: StageEntry[];
  inventory: InventoryRow[];
  noTools: boolean;
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

const RARITY_LABEL: Record<AnimalLite["rarity"], string> = {
  COMMON: "ふつう",
  RARE: "レア",
  EPIC: "すごレア",
  LEGENDARY: "でんせつ",
};

const RARITY_TONE: Record<AnimalLite["rarity"], string> = {
  COMMON: "from-slate-200 to-slate-300 text-slate-800",
  RARE: "from-sky-200 to-blue-300 text-sky-900",
  EPIC: "from-fuchsia-200 to-purple-300 text-fuchsia-900",
  LEGENDARY: "from-amber-200 via-yellow-300 to-orange-300 text-amber-900",
};

export function HuntClient({ kidId, kidName, tools, stages, inventory, noTools }: Props) {
  const reading = NAME_READING[kidName] ?? kidName;

  const [selectedStage, setSelectedStage] = useState<StageEntry | null>(
    stages[0] ?? null,
  );
  const [selectedTool, setSelectedTool] = useState<ToolEntry | null>(null);
  const [activeHunt, setActiveHunt] = useState<ActiveHunt | null>(null);
  const [result, setResult] = useState<
    | { kind: "caught"; animal: AnimalLite; tool: { name: string; historicalContext: string } }
    | { kind: "escaped"; animal: AnimalLite }
    | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // 道具を選んで「狩る」を押した時の流れ
  const handleStartHunt = (tool: ToolEntry) => {
    if (!selectedStage) {
      setErrorMsg("ステージを えらんでね");
      return;
    }
    setErrorMsg(null);
    setSelectedTool(tool);
    startTransition(async () => {
      const r = await startActiveHunt(kidId, tool.id, selectedStage.id);
      if (!r.success) {
        setErrorMsg(r.error);
        setSelectedTool(null);
        return;
      }
      setActiveHunt({
        id: r.hunt.id,
        huntType: r.hunt.huntType,
        toolName: r.hunt.toolName,
        toolEmoji: r.hunt.toolEmoji,
        targetAnimal: r.hunt.targetAnimal,
        sweetSpotWidth: r.hunt.sweetSpotWidth,
      });
    });
  };

  const handleResolve = useCallback(
    (precision: number) => {
      if (!activeHunt) return;
      const hunt = activeHunt;
      setActiveHunt(null);
      startTransition(async () => {
        const r = await resolveActiveHunt(hunt.id, precision);
        if (!r.success) {
          setErrorMsg(r.error);
          setSelectedTool(null);
          return;
        }
        if (r.caught) {
          setResult({
            kind: "caught",
            animal: r.animal,
            tool: {
              name: selectedTool?.name ?? hunt.toolName,
              historicalContext: selectedTool?.historicalContext ?? "",
            },
          });
        } else {
          setResult({ kind: "escaped", animal: r.animal });
        }
        setSelectedTool(null);
      });
    },
    [activeHunt, selectedTool],
  );

  const closeResult = () => {
    setResult(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-100 via-teal-100 to-sky-100 px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href={`/kids/${kidId}/safari`}
            className="rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-emerald-800 shadow ring-1 ring-emerald-200 transition hover:bg-white active:scale-95"
          >
            ← サファリへ
          </Link>
          <p className="text-sm font-extrabold text-emerald-700/80 tracking-widest">
            🏹 アクティブ 狩り
          </p>
        </div>

        {/* ヒーロー */}
        <section className="rounded-[2rem] bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 p-1 shadow-xl ring-4 ring-white">
          <div className="rounded-[1.7rem] bg-white/95 px-6 py-5 text-center backdrop-blur">
            <p className="text-4xl drop-shadow" aria-hidden>🏹🎯🐾</p>
            <h1 className="mt-1 text-xl font-black text-emerald-800">
              {reading} の 狩り
            </h1>
            <p className="mt-1 text-[11px] font-bold text-emerald-700/80">
              ステージと 道具を えらんで、ゲージで タイミングを あわせよう
            </p>
          </div>
        </section>

        {noTools && (
          <div className="rounded-2xl bg-yellow-100 px-4 py-3 text-sm font-bold text-yellow-900 ring-1 ring-yellow-300">
            ⚠️ 弓・投槍器の データが ありません。
            <code className="ml-1 rounded bg-yellow-200 px-1">npm run db:seed</code>{" "}
            を実行してね。
          </div>
        )}

        {/* ステージ選択 */}
        <section className="rounded-3xl bg-white/85 p-5 shadow ring-1 ring-emerald-200">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-emerald-800">
            <span aria-hidden>🌍</span> ステージを えらぶ
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {stages.map((s) => {
              const isSelected = selectedStage?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStage(s)}
                  className={`rounded-2xl p-2 ring-2 transition active:scale-95 ${
                    isSelected
                      ? "bg-gradient-to-br from-emerald-300 to-teal-300 ring-emerald-500 shadow"
                      : "bg-slate-50 ring-transparent hover:bg-slate-100"
                  }`}
                >
                  <p className="text-2xl" aria-hidden>{s.emoji}</p>
                  <p className="text-[10px] font-extrabold leading-tight text-slate-700">
                    {s.name}
                  </p>
                  <p className="text-[9px] text-slate-500">{s.animalCount}種</p>
                </button>
              );
            })}
          </div>
          {selectedStage && (
            <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-[11px] text-emerald-900 leading-relaxed">
              {selectedStage.description}
            </p>
          )}
        </section>

        {/* 道具選択 */}
        <section className="rounded-3xl bg-white/85 p-5 shadow ring-1 ring-emerald-200">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-emerald-800">
            <span aria-hidden>🛠️</span> 道具を かまえる
          </h2>
          {tools.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              使える 道具が ありません。クラフトで つくろう。
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tools.map((t) => {
                const stockRow = t.inventoryItemId
                  ? inventory.find((i) => i.itemId === t.inventoryItemId)
                  : null;
                const stock = stockRow?.quantity ?? null;
                const disabled =
                  (t.consumable && stock !== null && stock < 1) || activeHunt !== null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleStartHunt(t)}
                    disabled={disabled}
                    className={`text-left rounded-2xl p-3 ring-2 transition active:scale-95 ${
                      disabled
                        ? "bg-slate-100 ring-slate-200 opacity-50 cursor-not-allowed"
                        : t.type === "BOW"
                          ? "bg-gradient-to-br from-emerald-100 to-teal-100 ring-emerald-300 hover:scale-[1.02]"
                          : "bg-gradient-to-br from-sky-100 to-indigo-100 ring-sky-300 hover:scale-[1.02]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-4xl shrink-0" aria-hidden>{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black leading-tight text-slate-800">
                          {t.name}
                        </p>
                        <p className="text-[10px] font-bold text-slate-600 mt-0.5">
                          {t.type === "BOW" ? "弓" : "投擲"} ／ 命中 +{Math.round(t.successRateBonus * 100)}%
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                          {t.description}
                        </p>
                        {t.consumable && stockRow && (
                          <p className="text-[9px] text-amber-700 mt-1">
                            素材: {stockRow.itemName} ×{stock}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {errorMsg && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
              {errorMsg}
            </p>
          )}
        </section>

        <p className="text-center text-[11px] font-bold text-emerald-600/70 tracking-widest">
          🏹 タイミングが すべて 🏹
        </p>
      </div>

      {/* ゲージミニゲーム */}
      {activeHunt && (
        <GaugeMinigame
          hunt={activeHunt}
          onResolve={handleResolve}
        />
      )}

      {/* 結果モーダル */}
      {result && <ResultModal result={result} onClose={closeResult} />}
    </main>
  );
}

// ─────────────────────────────────────────
// ゲージ式タイミングミニゲーム
//   横バー（0〜100%）の中央付近に「スイートスポット」（緑帯）があり、
//   インジケータが左右に往復する。タップで停止 → スイートスポットからの
//   距離で precision（0.0〜1.0）を計算して onResolve に渡す。
// ─────────────────────────────────────────
function GaugeMinigame({
  hunt,
  onResolve,
}: {
  hunt: ActiveHunt;
  onResolve: (precision: number) => void;
}) {
  // sweetSpotWidth: 0.05〜0.45。中央(0.5)を中心に対称配置する。
  const sweetHalf = hunt.sweetSpotWidth / 2;
  const sweetMin = 0.5 - sweetHalf;
  const sweetMax = 0.5 + sweetHalf;

  // レアリティと huntType でゲージ速度を決定
  const rarityMs: Record<AnimalLite["rarity"], number> = {
    COMMON: 2400,
    RARE: 1800,
    EPIC: 1200,
    LEGENDARY: 900,
  };
  const cycleMs = rarityMs[hunt.targetAnimal.rarity];

  const [indicator, setIndicator] = useState(0); // 0〜1
  const [stopped, setStopped] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    const tick = (now: number) => {
      if (stopped) return;
      const elapsed = (now - startRef.current) % cycleMs;
      const phase = (elapsed / cycleMs) * 2; // 0〜2
      // 三角波: 0→1→0
      const v = phase < 1 ? phase : 2 - phase;
      setIndicator(v);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cycleMs, stopped]);

  const handleStop = () => {
    if (stopped) return;
    setStopped(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // スイートスポット内なら高 precision
    let precision: number;
    if (indicator >= sweetMin && indicator <= sweetMax) {
      // 中心(0.5) からの距離を 0〜1 にマップ → 1 - dist
      const dist = Math.abs(indicator - 0.5) / sweetHalf; // 0〜1
      precision = 1 - dist * 0.3; // 中心ぴったりで 1.0、端で 0.7
    } else {
      // 外れ。スイートスポット端からの距離で 0〜0.6
      const distOut = indicator < sweetMin ? sweetMin - indicator : indicator - sweetMax;
      precision = Math.max(0, 0.6 - distOut * 1.0);
    }

    // 800ms 後に親に渡す（演出の余韻）
    setTimeout(() => onResolve(precision), 800);
  };

  // SPEAR と BOW でビジュアル差をつける
  const isBow = hunt.huntType === "BOW";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-[2rem] bg-gradient-to-br from-emerald-300 via-teal-300 to-sky-300 p-1 shadow-2xl">
        <div className="rounded-[1.75rem] bg-slate-900 px-6 py-7 text-center text-white">
          <p className="text-[10px] font-bold tracking-[0.3em] text-emerald-300">
            {isBow ? "🏹 弓を 引け" : "🔱 投擲 用意"}
          </p>
          <h3 className="mt-1 text-lg font-black text-white">
            {hunt.toolEmoji} {hunt.toolName}
          </h3>

          {/* 動物の影 */}
          <div className="mt-4 mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-900/50 ring-2 ring-emerald-400/30">
            <span
              aria-hidden
              className="text-6xl"
              style={{ filter: "brightness(0)", opacity: 0.85 }}
            >
              {hunt.targetAnimal.emoji}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-emerald-300/80">
            ？？？ の けはい
            <span className="ml-1 rounded-full bg-emerald-700/50 px-1.5 py-0 text-[9px] font-bold">
              {RARITY_LABEL[hunt.targetAnimal.rarity]}
            </span>
          </p>

          {/* ゲージ本体 */}
          <div className="mt-6 relative h-10 rounded-full bg-slate-700 overflow-hidden ring-2 ring-slate-600">
            {/* スイートスポット */}
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-70"
              style={{
                left: `${sweetMin * 100}%`,
                width: `${(sweetMax - sweetMin) * 100}%`,
              }}
            />
            {/* 中心マーク */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80"
              style={{ left: "50%" }}
            />
            {/* インジケータ */}
            <div
              className={`absolute top-0 bottom-0 w-1.5 rounded-full ${
                stopped ? "bg-yellow-300 shadow-[0_0_12px_4px_rgba(250,204,21,0.6)]" : "bg-white shadow"
              }`}
              style={{
                left: `calc(${indicator * 100}% - 3px)`,
                transition: stopped ? "none" : undefined,
              }}
            />
          </div>

          {/* タップボタン */}
          <button
            type="button"
            onClick={handleStop}
            disabled={stopped}
            className={`mt-6 w-full rounded-2xl px-5 py-5 text-xl font-black tracking-wide text-white shadow-lg transition active:scale-95 ${
              stopped
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : isBow
                  ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110"
                  : "bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 hover:brightness-110"
            }`}
          >
            {stopped ? "判定中…" : isBow ? "🏹 射る！" : "🔱 投げる！"}
          </button>

          <p className="mt-3 text-[10px] text-emerald-300/70 leading-relaxed">
            緑のゾーンで タップで 命中！中央に 近いほど 確実だよ
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 結果モーダル
// ─────────────────────────────────────────
function ResultModal({
  result,
  onClose,
}: {
  result:
    | { kind: "caught"; animal: AnimalLite; tool: { name: string; historicalContext: string } }
    | { kind: "escaped"; animal: AnimalLite };
  onClose: () => void;
}) {
  const isCaught = result.kind === "caught";
  const animal = result.animal;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-[2rem] bg-gradient-to-br ${RARITY_TONE[animal.rarity]} p-1 shadow-2xl`}
      >
        <div className="rounded-[1.75rem] bg-white px-6 py-7 text-center">
          <p className="text-[10px] font-bold tracking-[0.4em] text-slate-500">
            {isCaught ? "✨ 命中 ✨" : "💨 のがした 💨"}
          </p>

          {isCaught ? (
            <div className="mt-3 flex items-center justify-center">
              <span className="text-7xl drop-shadow-lg">{animal.emoji}</span>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-center">
              <span
                className="text-7xl"
                style={{ filter: "brightness(0)", opacity: 0.6 }}
              >
                {animal.emoji}
              </span>
            </div>
          )}

          <p className="mt-2 text-[11px] font-bold text-slate-500">
            {animal.genericName}
          </p>
          <p className="text-xl font-black text-slate-800 leading-tight">
            {isCaught ? animal.specificName : "？？？"}
          </p>

          <div className="mt-2 flex justify-center gap-1 flex-wrap">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {RARITY_LABEL[animal.rarity]}
            </span>
            {isCaught && animal.isExtinct && (
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-gray-200">
                💀 絶滅種
              </span>
            )}
          </div>

          {isCaught ? (
            <>
              <p className="mt-4 text-sm text-slate-700 leading-relaxed text-left">
                {animal.description}
              </p>
              {result.tool.historicalContext && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200 text-left">
                  <p className="text-[10px] font-extrabold text-amber-700 tracking-widest">
                    📜 {result.tool.name} の 歴史
                  </p>
                  <p className="mt-1 text-[11px] text-amber-900 leading-relaxed">
                    {result.tool.historicalContext}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              タイミングが ずれて 逃げられた…！もういちど ちょうせん！
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-full bg-slate-800 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-95"
          >
            {isCaught ? "やったー！" : "つぎは 当てる"}
          </button>
        </div>
      </div>
    </div>
  );
}
