"use client";

// /kids/quests のクライアント本体。
// クエストカードを並べ、それぞれの状態（やったよ！/ かくにん中... / OKもらった / もういちど）で
// ボタン表示を切り替える。送信は submitQuest を呼ぶ。

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { submitQuest } from "../actions";

type KidLite = { id: string; name: string; coinBalance: number };

type QuestLite = {
  id: string;
  title: string;
  description: string | null;
  rewardCoins: number;
  emoji: string;
  targetUsers: { id: string }[];
};

type SubmissionLite = {
  id: string;
  questId: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
  reviewedAt: string | null;
};

type Props = {
  initialKidId: string | null;
  kids: KidLite[];
  quests: QuestLite[];
  submissions: SubmissionLite[];
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
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

export function QuestsClient({
  initialKidId,
  kids,
  quests,
  submissions: initialSubmissions,
}: Props) {
  const [kidId, setKidId] = useState<string | null>(initialKidId);
  const [submissions, setSubmissions] =
    useState<SubmissionLite[]>(initialSubmissions);
  const [pendingQuestId, setPendingQuestId] = useState<string | null>(null);
  const [errorByQuest, setErrorByQuest] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  useEffect(() => setSubmissions(initialSubmissions), [initialSubmissions]);

  const selectedKid = kidId ? kids.find((k) => k.id === kidId) ?? null : null;

  // クエストごとに、この子の「最新の」申請を取り出す。
  const latestByQuest = useMemo(() => {
    const map = new Map<string, SubmissionLite>();
    if (!kidId) return map;
    // submissions は submittedAt desc の前提（page.tsx でそうしてある）。
    for (const s of submissions) {
      if (s.userId !== kidId) continue;
      if (!map.has(s.questId)) map.set(s.questId, s);
    }
    return map;
  }, [submissions, kidId]);

  const handleSubmit = (quest: QuestLite) => {
    if (!selectedKid) return;
    setErrorByQuest((prev) => ({ ...prev, [quest.id]: "" }));
    setPendingQuestId(quest.id);
    startTransition(async () => {
      const result = await submitQuest(selectedKid.id, quest.id);
      setPendingQuestId(null);
      if (!result.success) {
        setErrorByQuest((prev) => ({ ...prev, [quest.id]: result.error }));
        return;
      }
      // ローカルに PENDING を1件先頭に追加（楽観的更新）。
      setSubmissions((prev) => [
        {
          id: result.submission.id,
          questId: quest.id,
          userId: selectedKid.id,
          status: "PENDING",
          submittedAt: result.submission.submittedAt,
          reviewedAt: null,
        },
        ...prev,
      ]);
    });
  };

  // ── キッド未選択 ─────────────────────────────
  if (!selectedKid) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-100 via-yellow-50 to-sky-100 px-4 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-3xl">⭐🗺️⭐</p>
          <h1 className="mt-2 text-3xl font-extrabold text-emerald-800 sm:text-4xl">
            だれが クエストに ちょうせん？
          </h1>
          <p className="mt-3 text-sm text-emerald-700/80">
            なまえを タッチしてね
          </p>

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
    <main className="min-h-screen bg-gradient-to-b from-lime-100 via-amber-50 to-pink-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href={`/kids?kid=${selectedKid.id}`}
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-emerald-700 shadow ring-1 ring-emerald-200 transition active:scale-95"
          >
            ← ポータルへ
          </Link>
          <p className="text-sm font-bold text-emerald-700/80">
            クエスト ボード
          </p>
        </div>

        {/* タイトル */}
        <section className="rounded-[2rem] bg-gradient-to-br from-lime-300 via-amber-200 to-pink-200 p-1 shadow-xl">
          <div className="rounded-[1.75rem] bg-white/95 p-6 text-center">
            <p className="text-5xl">⭐🗺️⭐</p>
            <h1 className="mt-2 text-3xl font-black text-emerald-700 sm:text-4xl">
              クエストに ちょうせん！
            </h1>
            <p className="mt-1 text-sm text-emerald-600/80">
              「やったよ！」を おすと、おうちのひとに しんせい が とどくよ
            </p>
            <p className="mt-3 text-xs text-emerald-700/70">
              いま あそんでるのは <NameRuby name={selectedKid.name} /> ちゃん
            </p>
          </div>
        </section>

        {/* クエスト一覧 */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quests.map((q) => {
            const latest = latestByQuest.get(q.id);
            return (
              <QuestCard
                key={q.id}
                quest={q}
                latest={latest}
                isPending={pendingQuestId === q.id}
                error={errorByQuest[q.id]}
                onSubmit={() => handleSubmit(q)}
                selectedKid={selectedKid}
              />
            );
          })}
        </section>

        <p className="text-center text-xs text-emerald-700/70">
          ✨ おうちのひとが OK したら コインが もらえるよ ✨
        </p>
      </div>
    </main>
  );
}

function QuestCard({
  quest,
  latest,
  isPending,
  error,
  onSubmit,
  selectedKid,
}: {
  quest: QuestLite;
  latest: SubmissionLite | undefined;
  isPending: boolean;
  error?: string;
  onSubmit: () => void;
  selectedKid: KidLite;
}) {
  const status = latest?.status ?? null;
  const isAwaiting = status === "PENDING";

  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-white/95 p-5 shadow-lg ring-2 ring-lime-200">
      <header className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-lime-100 to-amber-100 p-4 ring-1 ring-lime-200">
        <span className="text-5xl drop-shadow" aria-hidden>
          {quest.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-emerald-800">{quest.title}</p>
          {quest.description && (
            <p className="text-xs text-emerald-700/80">{quest.description}</p>
          )}
          {quest.targetUsers.some(u => u.id === selectedKid.id) && (
            <p className="mt-1 inline-block rounded-full bg-pink-200 px-2 py-0.5 text-xs font-extrabold text-pink-900">
              🎀 {selectedKid.name}ちゃん専用！ 🎀
            </p>
          )}
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-extrabold text-amber-900">
            +{quest.rewardCoins} コイン 🪙
          </p>
        </div>
      </header>

      {/* 状態表示 */}
      {status === "APPROVED" && (
        <p className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-300">
          ✨ まえに OK もらったよ。また やったら しんせい できるよ
        </p>
      )}
      {status === "REJECTED" && (
        <p className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-300">
          こないだは おなおし になったよ。もういちど ちょうせん！
        </p>
      )}

      {/* ボタン or 待機表示 */}
      {isAwaiting ? (
        <div className="w-full rounded-2xl bg-amber-100 px-4 py-3 text-center text-base font-extrabold text-amber-800 ring-2 ring-amber-300">
          <span className="inline-block animate-pulse">⏳ かくにん中…</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending}
          className={`w-full rounded-2xl px-4 py-3 text-lg font-black tracking-wide text-white shadow-lg transition active:scale-[0.98] ${
            isPending
              ? "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
              : "bg-gradient-to-r from-lime-500 via-emerald-500 to-amber-500 hover:brightness-110"
          }`}
        >
          {isPending ? "おくってる…" : "やったよ！"}
        </button>
      )}

      {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
    </article>
  );
}
