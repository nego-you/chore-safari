"use client";

// 親管理画面のペナルティパネル。
// マスタ（Penalty テーブル）から取得した一覧を表示し、選んだ子供に適用する。
// target_users が空のペナルティは「全員」用で、誰にでも適用可能。

import { useEffect, useState, useTransition } from "react";
import { applyPenaltyMaster } from "./actions";

type ChildOption = { id: string; name: string };

type PenaltyDTO = {
  id: string;
  title: string;
  description: string | null;
  coinAmount: number;
  emoji: string;
  targetUserIds: string[]; // 空=全員
};

type Props = {
  children: ChildOption[];
  penalties: PenaltyDTO[];
};

export function PenaltyPanel({ children, penalties }: Props) {
  const [isPending, startTransition] = useTransition();
  const [pendingPenaltyId, setPendingPenaltyId] = useState<string | null>(null);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lastApplied) return;
    const t = setTimeout(() => setLastApplied(null), 4000);
    return () => clearTimeout(t);
  }, [lastApplied]);

  if (children.length === 0) {
    return (
      <p className="text-sm text-rose-200/80">
        対象の子供が登録されていません。
      </p>
    );
  }

  if (penalties.length === 0) {
    return (
      <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
        ペナルティが登録されていません。
        <a
          href="/bank/penalties"
          className="ml-2 underline hover:text-rose-200"
        >
          ペナルティ管理マスタ →
        </a>
      </p>
    );
  }

  const apply = (penalty: PenaltyDTO, child: ChildOption) => {
    if (
      !window.confirm(
        `${child.name} から「${penalty.title}」(-${penalty.coinAmount} コイン) を適用します。よろしいですか？`,
      )
    ) {
      return;
    }
    setPendingPenaltyId(penalty.id + ":" + child.id);
    setError(null);
    startTransition(async () => {
      const r = await applyPenaltyMaster(penalty.id, child.id);
      setPendingPenaltyId(null);
      if (!r.success) {
        setError(r.error ?? "適用に失敗しました");
        return;
      }
      setLastApplied(
        `🚨 ${child.name} に「${penalty.title}」(-${penalty.coinAmount}) を適用しました`,
      );
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {penalties.map((p) => {
          const candidates =
            p.targetUserIds.length > 0
              ? children.filter((c) => p.targetUserIds.includes(c.id))
              : children;
          const isGlobal = p.targetUserIds.length === 0;
          return (
            <article
              key={p.id}
              className="rounded-xl border border-rose-400/30 bg-rose-950/40 p-3 shadow-inner"
            >
              <header className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-rose-100">{p.title}</p>
                    <span className="rounded-full bg-rose-900/60 px-2 py-0.5 text-[10px] font-extrabold text-rose-100">
                      -{p.coinAmount} コイン
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isGlobal
                          ? "bg-slate-700/60 text-slate-200"
                          : "bg-rose-700/60 text-rose-50"
                      }`}
                    >
                      {isGlobal
                        ? "全員用"
                        : `専用：${candidates.map((c) => c.name).join("・")}`}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-0.5 text-xs text-rose-200/70">
                      {p.description}
                    </p>
                  )}
                </div>
              </header>

              {/* 対象候補のボタン群 */}
              <div className="mt-3 flex flex-wrap gap-2">
                {candidates.map((c) => {
                  const busy =
                    isPending && pendingPenaltyId === p.id + ":" + c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => apply(p, c)}
                      disabled={isPending}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow transition active:scale-95 ${
                        busy
                          ? "bg-rose-400 cursor-wait"
                          : "bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
                      }`}
                    >
                      {busy ? "適用中…" : `🚨 ${c.name} に適用`}
                    </button>
                  );
                })}
                {candidates.length === 0 && (
                  <p className="text-xs text-rose-200/60">
                    （対象の子供が見つかりません）
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      {lastApplied && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {lastApplied}
        </p>
      )}

      <p className="text-[11px] text-rose-200/60">
        ※ ペナルティの追加・編集・削除は{" "}
        <a
          href="/bank/penalties"
          className="underline hover:text-rose-200"
        >
          ペナルティ管理マスタ
        </a>{" "}
        から
      </p>
    </div>
  );
}
