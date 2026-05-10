"use client";

import { useState, useTransition } from "react";
import { applyPenalty } from "./actions";

type ChildOption = {
  id: string;
  name: string;
};

type Props = {
  children: ChildOption[];
};

export function PenaltyPanel({ children }: Props) {
  const [targetId, setTargetId] = useState<string>(children[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [lastApplied, setLastApplied] = useState<string | null>(null);

  if (children.length === 0) {
    return (
      <p className="text-sm text-rose-200/80">
        対象の子供が登録されていません。
      </p>
    );
  }

  const handleApply = () => {
    if (!targetId) return;
    if (
      !window.confirm(
        `${children.find((c) => c.id === targetId)?.name ?? "選択中"} から 50 コインを没収します。よろしいですか？`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const name = children.find((c) => c.id === targetId)?.name ?? "";
      await applyPenalty(targetId, reason);
      setLastApplied(`${name} から -50 コイン没収しました`);
      setReason("");
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {children.map((child) => {
          const selected = child.id === targetId;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => setTargetId(child.id)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                selected
                  ? "border-rose-300 bg-rose-100/10 text-rose-100 shadow-inner"
                  : "border-rose-500/30 bg-transparent text-rose-100/80 hover:border-rose-300/60 hover:bg-rose-500/10"
              }`}
              aria-pressed={selected}
            >
              <span className="block text-xs uppercase tracking-wider text-rose-200/70">
                {selected ? "ターゲット" : "選択"}
              </span>
              {child.name}
            </button>
          );
        })}
      </div>

      <label className="block text-sm text-rose-100/80">
        理由（任意）
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例：弟と喧嘩した"
          className="mt-1 w-full rounded-lg border border-rose-400/30 bg-black/30 px-3 py-2 text-sm text-rose-50 placeholder-rose-200/40 focus:border-rose-300 focus:outline-none"
        />
      </label>

      <button
        type="button"
        onClick={handleApply}
        disabled={isPending}
        className="w-full rounded-xl bg-rose-600 px-4 py-4 text-lg font-extrabold text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 active:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-400"
      >
        {isPending ? "没収中…" : "🚨 ペナルティ（-50 コイン）"}
      </button>

      {lastApplied && (
        <p className="text-sm text-rose-200/90">{lastApplied}</p>
      )}
    </div>
  );
}
