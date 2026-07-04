"use client";

// app/kids/[kidId]/logistics/LogisticsMissionsClient.tsx
// うんぱんミッション（一本道化 2026-06-12）
//
// 旧「物流センター」（画面内で完結するエサ配送ミニゲーム）を廃止し、
// **現実のモノの運搬おてつだい**（親が Bank で LOGISTICS カテゴリとして登録）を
// 申請する特別なクエスト枠として再定義した画面。
//   - 「洗濯物を2階に運ぶ」「読んだ絵本を片付ける」などを親が設定
//   - 子供が実際に運んだら「やったよ！」で申請 → 親が承認
//   - 承認されるとコインに加えて【レアわな】が1個もらえる
//     （レア罠はここでしか入手できない＝ゲーム進行上いちばん価値の高い行動）

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitQuest } from "@/features/quest/actions";

type Mission = {
  id: string;
  title: string;
  description: string | null;
  rewardCoins: number;
  emoji: string;
};

type SubmissionLite = {
  questId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export function LogisticsMissionsClient({
  kid,
  missions,
  submissions,
}: {
  kid: { id: string; name: string };
  missions: Mission[];
  submissions: SubmissionLite[];
}) {
  // 申請中（PENDING）の questId 集合。申請成功時に楽観的に追加する。
  const [pendingIds, setPendingIds] = useState<Set<string>>(
    () =>
      new Set(
        submissions.filter((s) => s.status === "PENDING").map((s) => s.questId),
      ),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleSubmit = (mission: Mission) => {
    if (busyId || pendingIds.has(mission.id)) return;
    setBusyId(mission.id);
    startTransition(async () => {
      try {
        const r = await submitQuest(kid.id, mission.id);
        if (!r.success) {
          alert(r.error);
          return;
        }
        setPendingIds((prev) => new Set(prev).add(mission.id));
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <main className="min-h-[calc(100vh-var(--header-h,52px))] bg-gradient-to-b from-teal-100 via-cyan-50 to-sky-100 px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-3xl md:max-w-4xl space-y-4 md:space-y-6">
        {/* ヘッダー */}
        <header className="rounded-3xl bg-white/90 p-4 md:p-6 shadow-lg ring-2 ring-teal-200 text-center">
          <p className="text-4xl md:text-5xl" aria-hidden>
            📦
          </p>
          <h1 className="mt-1 text-xl md:text-3xl font-black text-teal-800">
            うんぱんミッション
          </h1>
          <p className="mt-2 text-xs md:text-sm font-bold leading-relaxed text-teal-700/90">
            おうちの なかで モノを はこぶ おてつだいだよ。
            <br />
            ほんとうに はこんだら「やったよ！」を おしてね。
          </p>
          <p className="mt-2 inline-block rounded-full bg-amber-100 px-4 py-1.5 text-[11px] md:text-sm font-extrabold text-amber-700 ring-1 ring-amber-300">
            クリアすると 🪙コイン ＋ ✨レアわな（かごわな）が もらえる！
          </p>
        </header>

        {/* ミッション一覧 */}
        {missions.length === 0 ? (
          <div className="rounded-3xl bg-white/90 p-8 text-center shadow ring-2 ring-teal-100">
            <p className="text-4xl" aria-hidden>
              🦥
            </p>
            <p className="mt-2 text-sm font-bold text-slate-600">
              いまは ミッションが ないよ。
              <br />
              おうちのひとに「うんぱんミッション」を つくってもらおう！
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {missions.map((m) => {
              const isPending = pendingIds.has(m.id);
              const isBusy = busyId === m.id;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-3xl bg-white/95 p-4 shadow-lg ring-2 ring-teal-200"
                >
                  <div className="flex h-14 w-14 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-200 to-cyan-200 text-3xl md:text-4xl">
                    {m.emoji || "📦"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm md:text-lg font-black text-slate-800">
                      {m.title}
                    </p>
                    {m.description && (
                      <p className="mt-0.5 text-[11px] md:text-sm font-bold text-slate-500">
                        {m.description}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] md:text-sm font-extrabold text-amber-600">
                      🪙 {m.rewardCoins} コイン ＋ ✨レアわな
                    </p>
                  </div>
                  {isPending ? (
                    <span className="shrink-0 rounded-xl bg-sky-100 px-3 py-2 text-center text-[11px] md:text-sm font-extrabold leading-tight text-sky-600 ring-1 ring-sky-300">
                      おうちのひとの
                      <br />
                      かくにんまち…
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSubmit(m)}
                      className={`shrink-0 rounded-2xl px-4 py-3 text-sm md:text-base font-black text-white shadow transition active:scale-[0.96] ${
                        isBusy
                          ? "cursor-wait bg-gray-300 text-gray-500 shadow-none"
                          : "bg-gradient-to-r from-teal-500 to-emerald-500 hover:brightness-110"
                      }`}
                    >
                      {isBusy ? "おくってるよ…" : "✋ やったよ！"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* もどる */}
        <div className="text-center">
          <Link
            href={`/kids/${kid.id}`}
            className="inline-block rounded-2xl bg-white/90 px-6 py-2.5 text-sm font-extrabold text-teal-700 shadow ring-2 ring-teal-200 transition hover:bg-white"
          >
            🗺️ マップへ もどる
          </Link>
        </div>
      </div>
    </main>
  );
}
