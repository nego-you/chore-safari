"use client";

// 出走どうぶつを2匹えらんで、Gemini に熱血実況をストリーミング生成させる。

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

type AnimalOption = {
  animalId: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  description: string;
  count: number; // 図鑑に何匹いるか
};

type Props = {
  animals: AnimalOption[];
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

export function RaceClient({ animals }: Props) {
  const [aId, setAId] = useState<string>(animals[0]?.animalId ?? "");
  const [bId, setBId] = useState<string>(animals[1]?.animalId ?? "");
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const a = animals.find((x) => x.animalId === aId);
  const b = animals.find((x) => x.animalId === bId);
  const canStart = !!a && !!b && a.animalId !== b.animalId && !streaming;

  // アンマウント時に途中のストリームを中断
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const handleStart = async () => {
    if (!a || !b) return;
    setError(null);
    setText("");
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

      // ストリームは完走したが本文が空 or サーバが [実況エラー] を流した場合のフォロー。
      if (!buf.trim()) {
        setError(
          "AI からの実況が空でした。サーバログ（docker compose logs web）と /api/race の GET 診断を確認してください。",
        );
      } else if (buf.includes("[実況エラー]")) {
        setError(
          "AI 側でエラーが発生しました。実況本文に詳細が含まれています。",
        );
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(
        e instanceof Error ? e.message : "実況の生成に失敗しました",
      );
    } finally {
      setStreaming(false);
    }
  };

  // 同じ動物を両側に選んだら片方を差し替える
  useEffect(() => {
    if (aId && aId === bId) {
      const other = animals.find((x) => x.animalId !== aId);
      if (other) setBId(other.animalId);
    }
  }, [aId, bId, animals]);

  if (animals.length < 2) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-100 via-orange-100 to-amber-100 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-5xl">🔥🏟️🔥</p>
          <h1 className="text-2xl font-extrabold text-rose-700">
            レース きじょうへ ようこそ！
          </h1>
          <p className="rounded-3xl bg-white/80 p-6 text-sm text-rose-700 shadow ring-1 ring-rose-200">
            出走させる どうぶつが まだ たりません。
            <br />
            さきに <Link className="font-bold underline" href="/kids/safari">サファリ</Link> で 2ひき いじょう つかまえてきてね！
          </p>
          <Link
            href="/kids"
            className="inline-block rounded-full bg-white/90 px-5 py-2 text-sm font-bold text-rose-700 shadow ring-1 ring-rose-200"
          >
            ← ポータルへ もどる
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-100 via-orange-100 to-amber-100 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href="/kids"
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-rose-700 shadow ring-1 ring-rose-200 transition hover:bg-white"
          >
            ← ポータルへ
          </Link>
          <p className="text-sm font-bold text-rose-700/80">
            ねっけつ レース きじょう
          </p>
        </div>

        {/* タイトル */}
        <section className="rounded-[2rem] bg-gradient-to-br from-rose-400 via-orange-400 to-amber-400 p-1 shadow-2xl">
          <div className="rounded-[1.75rem] bg-white/95 p-6 text-center">
            <p className="text-5xl">🔥🏟️🔥</p>
            <h1 className="mt-2 text-3xl font-black text-rose-700 sm:text-4xl">
              レース きじょう
            </h1>
            <p className="mt-1 text-sm text-rose-600/80">
              つかまえた どうぶつを 2ひき えらんで しょうぶ！
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AnimalPicker
                label="🅰️ 1ごう"
                accent="from-rose-100 to-orange-100 text-rose-900 ring-rose-300"
                animals={animals}
                value={aId}
                onChange={setAId}
                selected={a}
              />
              <AnimalPicker
                label="🅱️ 2ごう"
                accent="from-amber-100 to-yellow-100 text-amber-900 ring-amber-300"
                animals={animals}
                value={bId}
                onChange={setBId}
                selected={b}
                excludeId={aId}
              />
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              className={`mt-6 w-full rounded-2xl px-4 py-5 text-2xl font-black tracking-wide text-white shadow-lg transition active:scale-[0.98] ${
                canStart
                  ? "bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:brightness-110"
                  : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
              }`}
            >
              {streaming ? "🔥 じっきょうちゅう… 🔥" : "🔥 レーススタート！ 🔥"}
            </button>

            {error && (
              <p className="mt-3 text-sm font-bold text-rose-600">{error}</p>
            )}
          </div>
        </section>

        {/* 実況テキスト */}
        <CommentaryBoard
          a={a}
          b={b}
          text={text}
          streaming={streaming}
        />

        <p className="text-center text-xs text-rose-700/70">
          ※ じっきょうは AI（Gemini）が そのつど かんがえているよ
        </p>
      </div>
    </main>
  );
}

function AnimalPicker({
  label,
  accent,
  animals,
  value,
  onChange,
  selected,
  excludeId,
}: {
  label: string;
  accent: string;
  animals: AnimalOption[];
  value: string;
  onChange: (v: string) => void;
  selected: AnimalOption | undefined;
  excludeId?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl bg-gradient-to-br ${accent.split(" ").filter((c) => c.startsWith("from-") || c.startsWith("to-")).join(" ")} p-4 ring-2 ${accent.split(" ").find((c) => c.startsWith("ring-")) ?? ""}`}
    >
      <p className="text-xs font-extrabold">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-2 border-white bg-white/90 px-3 py-2 text-base font-bold text-rose-900 focus:outline-none"
      >
        {animals
          .filter((x) => x.animalId !== excludeId)
          .map((x) => (
            <option key={x.animalId} value={x.animalId}>
              {x.emoji} {x.name}（{RARITY_LABEL[x.rarity]}）
            </option>
          ))}
      </select>
      {selected && (
        <div className="flex items-center gap-3 rounded-xl bg-white/70 p-3">
          <span className="text-4xl drop-shadow" aria-hidden>
            {selected.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-base font-black">{selected.name}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${RARITY_PILL[selected.rarity]}`}
              >
                {RARITY_LABEL[selected.rarity]}
              </span>
            </div>
            <p className="text-[11px] opacity-80">{selected.description}</p>
            <p className="mt-1 text-[10px] opacity-60">
              ずかんに ×{selected.count} ひき
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentaryBoard({
  a,
  b,
  text,
  streaming,
}: {
  a: AnimalOption | undefined;
  b: AnimalOption | undefined;
  text: string;
  streaming: boolean;
}) {
  return (
    <section
      aria-live="polite"
      className="rounded-3xl bg-slate-900 p-1 shadow-2xl ring-2 ring-amber-400"
    >
      <div className="rounded-[1.4rem] bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 p-6">
        {/* 出走表示 */}
        <div className="mb-4 flex items-center justify-center gap-3 text-3xl">
          <span aria-hidden>{a?.emoji ?? "❓"}</span>
          <span className="text-amber-400" aria-hidden>VS</span>
          <span aria-hidden>{b?.emoji ?? "❓"}</span>
        </div>

        {/* チャット風 実況パネル */}
        <div className="rounded-2xl bg-white/95 p-5 shadow-inner">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl" aria-hidden>🎙️</span>
            <p className="text-sm font-extrabold text-rose-700">
              AI じっきょうしゃ
            </p>
            {streaming && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-white" />
                LIVE
              </span>
            )}
          </div>
          <pre
            className="max-h-96 min-h-[8rem] w-full overflow-y-auto whitespace-pre-wrap break-words font-sans text-base leading-relaxed text-slate-800"
          >
            {text || (
              <span className="text-slate-400">
                {streaming
                  ? "実況をじゅんびちゅう…"
                  : "「レーススタート！」を おすと、AI が じっきょうを はじめるよ。"}
              </span>
            )}
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-rose-500 align-middle" />
            )}
          </pre>
        </div>
      </div>
    </section>
  );
}
