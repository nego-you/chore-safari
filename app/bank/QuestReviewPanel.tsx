"use client";

// /bank のクエスト検品パネル。
// PENDING の申請を一覧で表示し、行ごとに 承認(OK) / 差し戻し(NG) ボタンを置く。

import { useEffect, useState, useTransition } from "react";
import { approveQuest, rejectQuest } from "./actions";

type Submission = {
  id: string;
  questId: string;
  questTitle: string;
  questEmoji: string;
  rewardCoins: number;
  userId: string;
  userName: string;
  submittedAt: string; // ISO
};

type Props = {
  submissions: Submission[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export function QuestReviewPanel({ submissions: initial }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // 親 page.tsx が revalidate された場合に同期。
  useEffect(() => setSubmissions(initial), [initial]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleApprove = (sub: Submission) => {
    setErrorById((p) => ({ ...p, [sub.id]: "" }));
    setPendingId(sub.id);
    startTransition(async () => {
      const r = await approveQuest(sub.id);
      setPendingId(null);
      if (!r.success) {
        setErrorById((p) => ({ ...p, [sub.id]: r.error }));
        return;
      }
      setSubmissions((p) => p.filter((s) => s.id !== sub.id));
      setToast(
        `✅ ${sub.userName} の「${sub.questTitle}」を承認しました（+${sub.rewardCoins} コイン）`,
      );
    });
  };

  const handleReject = (sub: Submission) => {
    if (
      !window.confirm(
        `${sub.userName} の「${sub.questTitle}」を差し戻します。よろしいですか？`,
      )
    ) {
      return;
    }
    setErrorById((p) => ({ ...p, [sub.id]: "" }));
    setPendingId(sub.id);
    startTransition(async () => {
      const r = await rejectQuest(sub.id);
      setPendingId(null);
      if (!r.success) {
        setErrorById((p) => ({ ...p, [sub.id]: r.error }));
        return;
      }
      setSubmissions((p) => p.filter((s) => s.id !== sub.id));
      setToast(`↩️ ${sub.userName} の「${sub.questTitle}」を差し戻しました`);
    });
  };

  if (submissions.length === 0) {
    return (
      <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        承認待ちの申請はありません。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-sky-400/30 bg-slate-900/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-sky-300/80">
            <tr>
              <th className="px-3 py-2 text-left">子供</th>
              <th className="px-3 py-2 text-left">クエスト</th>
              <th className="px-3 py-2 text-right">報酬</th>
              <th className="px-3 py-2 text-left">申請日時</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-400/10 text-slate-100">
            {submissions.map((s) => {
              const isBusy = pendingId === s.id;
              return (
                <tr key={s.id} className="align-top">
                  <td className="px-3 py-3 font-bold">{s.userName}</td>
                  <td className="px-3 py-3">
                    <span className="mr-1" aria-hidden>{s.questEmoji}</span>
                    {s.questTitle}
                    {errorById[s.id] && (
                      <p className="mt-1 text-xs text-rose-300">
                        {errorById[s.id]}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-amber-200">
                    +{s.rewardCoins}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">
                    {formatDate(s.submittedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(s)}
                        disabled={isBusy}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-400 active:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isBusy ? "処理中…" : "承認 OK"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(s)}
                        disabled={isBusy}
                        className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        差し戻し NG
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {toast && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {toast}
        </p>
      )}
    </div>
  );
}
