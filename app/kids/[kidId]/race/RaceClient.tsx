"use client";

// Gemini による熱血実況ストリーミング + Zustand コインベット統合

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSafariStore } from "@/store/useSafariStore";

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

type AnimalOption = {
  animalId: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  description: string;
  count: number;
};

type Props = {
  animals: AnimalOption[];
  kidId?: string | null;
};

const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "ふつう",
  RARE: "レア",
  EPIC: "すごレア",
  LEGENDARY: "でんせつ",
};

const RARITY_PILL: Record<Rarity, string> = {
  COMMON: "bg-slate-200 text-slate-700",
  RARE: "bg-sky-200 text-sky-800",
  EPIC: "bg-fuchsia-200 text-fuchsia-800",
  LEGENDARY: "bg-amber-200 text-amber-900",
};

const BET_OPTIONS = [0, 10, 30, 50, 100] as const;

export function RaceClient({ animals, kidId = null }: Props) {
  const [aId, setAId] = useState<string>(animals[0]?.animalId ?? "");
  const [bId, setBId] = useState<string>(animals[1]?.animalId ?? "");
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [betAmount, setBetAmount] = useState<number>(0);
  const [betOn, setBetOn] = useState<"A" | "B" | null>(null);
  const [raceResult, setRaceResult] = useState<{ winner: "A" | "B"; earnedCoins: number } | null>(null);

  const coins     = useSafariStore((s) => s.coins);
  const addCoins  = useSafariStore((s) => s.addCoins);
  const spendCoins = useSafariStore((s) => s.spendCoins);

  const a = animals.find((x) => x.animalId === aId);
  const b = animals.find((x) => x.animalId === bId);
  const canStart = !!a && !!b && a.animalId !== b.animalId && !streaming
    && (betAmount === 0 || betOn !== null)
    && coins >= betAmount;

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleStart = async () => {
    if (!a || !b) return;
    setError(null);
    setText("");
    setRaceResult(null);

    if (betAmount > 0) {
      const ok = spendCoins(betAmount);
      if (!ok) { setError("コインが足りないよ！"); return; }
    }
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/race", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animals: [
            { name: a.name, description: a.description, rarity: a.rarity },
            { name: b.name, description: b.description, rarity: b.rarity },
          ],
        }),
      });

      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        setText(buf);
      }

      if (!buf.trim()) {
        setError("AI からの実況が空でした。");
      } else if (buf.includes("[実況エラー]")) {
        setError("AI 側でエラーが発生しました。実況本文に詳細が含まれています。");
      } else {
        const aWins = a && buf.includes(a.name) && b
          ? buf.lastIndexOf(a.name) > buf.lastIndexOf(b.name)
          : Math.random() < 0.5;
        const winner: "A" | "B" = aWins ? "A" : "B";

        let earnedCoins = 0;
        if (betAmount > 0 && betOn !== null) {
          if (betOn === winner) {
            earnedCoins = betAmount * 2;
            addCoins(earnedCoins);
          }
        }
        setRaceResult({ winner, earnedCoins });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        if (betAmount > 0) addCoins(betAmount);
        return;
      }
      if (betAmount > 0) addCoins(betAmount);
      setError(e instanceof Error ? e.message : "実況の生成に失敗しました");
    } finally {
      setStreaming(false);
    }
  };

  useEffect(() => {
    if (aId && aId === bId) {
      const other = animals.find((x) => x.animalId !== aId);
      if (other) setBId(other.animalId);
    }
  }, [aId, bId, animals]);

  if (animals.length < 2) {
    return (
      <main className="min-h-[calc(100vh-52px)] bg-gradient-to-b from-rose-100 via-orange-100 to-amber-100 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-5xl">🔥🏟️🔥</p>
          <h1 className="text-2xl font-extrabold text-rose-700">レース きじょうへ ようこそ！</h1>
          <p className="rounded-3xl bg-white/80 p-6 text-sm text-rose-700 shadow ring-1 ring-rose-200">
            出走させる どうぶつが まだ たりません。<br />
            さきに <Link className="font-bold underline" href="/kids/safari">サファリ</Link> で 2ひき いじょう つかまえてきてね！
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-52px)] bg-gradient-to-b from-rose-100 via-orange-100 to-amber-100 px-4 py-4">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="rounded-[2rem] bg-gradient-to-br from-rose-400 via-orange-400 to-amber-400 p-1 shadow-2xl">
          <div className="rounded-[1.75rem] bg-white/95 p-6 text-center">
            <p className="text-5xl">🔥🏟️🔥</p>
            <h1 className="mt-2 text-3xl font-black text-rose-700 sm:text-4xl">レース きじょう</h1>
            <p className="mt-1 text-sm text-rose-600/80">つかまえた どうぶつを 2ひき えらんで しょうぶ！</p>

            {/* コイン残高 */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 ring-2 ring-amber-300">
              <span className="text-xl" aria-hidden>🪙</span>
              <span className="text-lg font-black text-amber-700">{coins.toLocaleString()} コイン</span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AnimalPicker label="🅰️ 1ごう" accent="from-rose-100 to-orange-100 text-rose-900 ring-rose-300"
                animals={animals} value={aId} onChange={setAId} selected={a} />
              <AnimalPicker label="🅱️ 2ごう" accent="from-amber-100 to-yellow-100 text-amber-900 ring-amber-300"
                animals={animals} value={bId} onChange={setBId} selected={b} excludeId={aId} />
            </div>

            {/* ベット UI */}
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 ring-2 ring-violet-300 text-left space-y-3">
              <p className="text-sm font-extrabold text-violet-700">🎰 コインをかける？</p>
              <div className="flex flex-wrap gap-2">
                {BET_OPTIONS.map((amt) => (
                  <button key={amt} type="button"
                    onClick={() => { setBetAmount(amt); if (amt === 0) setBetOn(null); }}
                    disabled={streaming}
                    className={`rounded-xl px-3 py-1.5 text-sm font-black transition ${
                      betAmount === amt ? "bg-violet-500 text-white shadow-md" : "bg-white text-violet-700 ring-1 ring-violet-300 hover:bg-violet-100"
                    } ${streaming ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {amt === 0 ? "かけない" : `${amt} コイン`}
                  </button>
                ))}
              </div>

              {betAmount > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-violet-600">どっちが かつ？</p>
                  <div className="flex gap-3">
                    {(["A", "B"] as const).map((side) => {
                      const animal = side === "A" ? a : b;
                      return (
                        <button key={side} type="button" onClick={() => setBetOn(side)} disabled={streaming}
                          className={`flex-1 rounded-xl py-2 px-3 text-sm font-black transition ring-2 ${
                            betOn === side ? "bg-violet-500 text-white ring-violet-500 shadow-md" : "bg-white text-violet-800 ring-violet-300 hover:bg-violet-100"
                          } ${streaming ? "opacity-50 cursor-not-allowed" : ""}`}>
                          {animal?.emoji ?? "?"} {animal?.name ?? "-"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {betAmount > 0 && betOn && (
                <p className="text-xs text-violet-500">
                  {betAmount} コイン かけて {betOn === "A" ? a?.name : b?.name} を おうえん！
                  かったら {betAmount * 2} コイン もらえる！
                </p>
              )}
              {betAmount > 0 && coins < betAmount && (
                <p className="text-xs font-bold text-rose-600">コインが たりないよ！</p>
              )}
            </div>

            <button type="button" onClick={handleStart} disabled={!canStart}
              className={`mt-6 w-full rounded-2xl px-4 py-5 text-2xl font-black tracking-wide text-white shadow-lg transition active:scale-[0.98] ${
                canStart ? "bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:brightness-110" : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
              }`}>
              {streaming ? "🔥 じっきょうちゅう… 🔥" : "🔥 レーススタート！ 🔥"}
            </button>

            {error && <p className="mt-3 text-sm font-bold text-rose-600">{error}</p>}
          </div>
        </section>

        <CommentaryBoard a={a} b={b} text={text} streaming={streaming} />

        {raceResult && !streaming && (
          <section className={`rounded-3xl p-1 shadow-xl ring-2 ${
            raceResult.earnedCoins > 0
              ? "bg-gradient-to-br from-amber-400 to-yellow-400 ring-amber-400"
              : betAmount > 0
              ? "bg-gradient-to-br from-slate-400 to-slate-500 ring-slate-400"
              : "bg-gradient-to-br from-sky-400 to-cyan-400 ring-sky-400"
          }`}>
            <div className="rounded-[1.4rem] bg-white/95 p-6 text-center space-y-2">
              {betAmount === 0 ? (
                <>
                  <p className="text-4xl">{raceResult.winner === "A" ? a?.emoji : b?.emoji}</p>
                  <p className="text-xl font-black text-slate-800">{raceResult.winner === "A" ? a?.name : b?.name} の かち！</p>
                </>
              ) : raceResult.earnedCoins > 0 ? (
                <>
                  <p className="text-5xl animate-bounce">🎉</p>
                  <p className="text-2xl font-black text-amber-700">あたり！</p>
                  <p className="text-base text-amber-600">
                    {raceResult.winner === "A" ? a?.name : b?.name} が かって
                    <span className="font-black"> +{raceResult.earnedCoins} コイン</span> ゲット！
                  </p>
                </>
              ) : (
                <>
                  <p className="text-5xl">😢</p>
                  <p className="text-2xl font-black text-slate-600">はずれ…</p>
                  <p className="text-sm text-slate-500">{raceResult.winner === "A" ? a?.name : b?.name} が かったよ。つぎは がんばれ！</p>
                </>
              )}
              <button type="button"
                onClick={() => { setRaceResult(null); setText(""); setBetOn(null); }}
                className="mt-3 rounded-xl bg-slate-100 px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 active:scale-95 transition">
                もう一度あそぶ
              </button>
            </div>
          </section>
        )}

        <p className="text-center text-xs text-rose-700/70">
          ※ じっきょうは AI（Gemini）が そのつど かんがえているよ
        </p>
      </div>
    </main>
  );
}

function AnimalPicker({ label, accent, animals, value, onChange, selected, excludeId }: {
  label: string; accent: string; animals: AnimalOption[]; value: string;
  onChange: (v: string) => void; selected: AnimalOption | undefined; excludeId?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-2xl bg-gradient-to-br ${accent.split(" ").filter((c) => c.startsWith("from-") || c.startsWith("to-")).join(" ")} p-4 ring-2 ${accent.split(" ").find((c) => c.startsWith("ring-")) ?? ""}`}>
      <p className="text-xs font-extrabold">{label}</p>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-2 border-white bg-white/90 px-3 py-2 text-base font-bold text-rose-900 focus:outline-none">
        {animals.filter((x) => x.animalId !== excludeId).map((x) => (
          <option key={x.animalId} value={x.animalId}>{x.emoji} {x.name}（{RARITY_LABEL[x.rarity]}）</option>
        ))}
      </select>
      {selected && (
        <div className="flex items-center gap-3 rounded-xl bg-white/70 p-3">
          <span className="text-4xl drop-shadow" aria-hidden>{selected.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-base font-black">{selected.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${RARITY_PILL[selected.rarity]}`}>{RARITY_LABEL[selected.rarity]}</span>
            </div>
            <p className="text-[11px] opacity-80">{selected.description}</p>
            <p className="mt-1 text-[10px] opacity-60">ずかんに ×{selected.count} ひき</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentaryBoard({ a, b, text, streaming }: {
  a: AnimalOption | undefined; b: AnimalOption | undefined; text: string; streaming: boolean;
}) {
  return (
    <section aria-live="polite" className="rounded-3xl bg-slate-900 p-1 shadow-2xl ring-2 ring-amber-400">
      <div className="rounded-[1.4rem] bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 p-6">
        <div className="mb-4 flex items-center justify-center gap-3 text-3xl">
          <span aria-hidden>{a?.emoji ?? "?"}</span>
          <span className="text-amber-400" aria-hidden>VS</span>
          <span aria-hidden>{b?.emoji ?? "?"}</span>
        </div>
        <div className="rounded-2xl bg-white/95 p-5 shadow-inner">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl" aria-hidden>🎙️</span>
            <p className="text-sm font-extrabold text-rose-700">AI じっきょうしゃ</p>
            {streaming && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-white" />LIVE
              </span>
            )}
          </div>
          <pre className="max-h-96 min-h-[8rem] w-full overflow-y-auto whitespace-pre-wrap break-words font-sans text-base leading-relaxed text-slate-800">
            {text || (
              <span className="text-slate-400">
                {streaming ? "実況をじゅんびちゅう…" : "「レーススタート！」を おすと、AI が じっきょうを はじめるよ。"}
              </span>
            )}
            {streaming && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-rose-500 align-middle" />}
          </pre>
        </div>
      </div>
    </section>
  );
}
