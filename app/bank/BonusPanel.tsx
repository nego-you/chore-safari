"use client";

// 🌟 特大達成ボーナスを送るパネル。
// 達成内容（テキスト）と 500〜5000 コインのスライダを入力できる UI。
// 送信時に sendSpecialBonus を呼び、コイン加算 + 通知作成までを一括で行う。

import { useState, useTransition } from "react";
import { sendSpecialBonus } from "./actions";

const MIN = 500;
const MAX = 5000;
const STEP = 100;

type ChildOption = {
  id: string;
  name: string;
};

type Props = {
  children: ChildOption[];
};

export function BonusPanel({ children }: Props) {
  const [targetId, setTargetId] = useState<string>(children[0]?.id ?? "");
  const [amount, setAmount] = useState<number>(1000);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (children.length === 0) {
    return <p className="text-sm text-amber-100/80">対象の子供がいません。</p>;
  }

  const handleSubmit = () => {
    setError(null);
    setSuccess(null);
    if (!reason.trim()) {
      setError("達成内容を入力してください");
      return;
    }
    if (amount < MIN || amount > MAX) {
      setError(`ボーナス額は ${MIN}〜${MAX} の範囲で入力してください`);
      return;
    }
    startTransition(async () => {
      try {
        const name = children.find((c) => c.id === targetId)?.name ?? "";
        await sendSpecialBonus(targetId, reason.trim(), amount);
        setSuccess(
          `🌟 ${name} に ${amount} コインのボーナスを贈りました！（子供ポータルで通知が出ます）`,
        );
        setReason("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "ボーナス付与に失敗しました");
      }
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
              aria-pressed={selected}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                selected
                  ? "border-amber-300 bg-amber-200/10 text-amber-100 shadow-inner"
                  : "border-amber-400/30 bg-transparent text-amber-100/70 hover:border-amber-300/70 hover:bg-amber-300/10"
              }`}
            >
              <span className="block text-xs uppercase tracking-wider text-amber-200/70">
                {selected ? "受賞者" : "選択"}
              </span>
              {child.name}
            </button>
          );
        })}
      </div>

      <label className="block text-sm text-amber-100/90">
        達成内容
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例：算数オリンピック予選通過 / そろばん3級合格"
          rows={2}
          className="mt-1 w-full rounded-lg border border-amber-300/30 bg-black/30 px-3 py-2 text-sm text-amber-50 placeholder-amber-200/40 focus:border-amber-200 focus:outline-none"
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-amber-100">
          <span className="text-sm">ボーナス額</span>
          <span className="font-mono text-2xl font-extrabold tracking-tight">
            {amount.toLocaleString()} <span className="text-base">コイン</span>
          </span>
        </div>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full accent-amber-400"
        />
        <div className="flex justify-between text-xs text-amber-200/60">
          <span>{MIN.toLocaleString()}</span>
          <span>{MAX.toLocaleString()}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-4 py-4 text-lg font-extrabold text-amber-950 shadow-lg shadow-amber-900/40 transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "送信中…" : "🌟 特大達成ボーナスを送る"}
      </button>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {success && <p className="text-sm text-emerald-300">{success}</p>}

      <p className="text-xs text-amber-200/60">
        ※ {MIN.toLocaleString()}〜{MAX.toLocaleString()} コインの範囲で付与できます。達成内容は履歴に残ります。
      </p>
    </div>
  );
}
