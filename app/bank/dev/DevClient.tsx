"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { resetTestUser } from "../actions";

type Props = {
  testUser: { id: string; name: string; coinBalance: number };
};

export function DevClient({ testUser }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resetDone, setResetDone] = useState(false);

  const handleReset = () => {
    startTransition(async () => {
      await resetTestUser();
      setResetDone(true);
      setTimeout(() => setResetDone(false), 2000);
    });
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 px-4 py-10">
      <div className="mx-auto max-w-md space-y-6">
        {/* ヘッダー */}
        <div className="text-center">
          <p className="text-4xl">🧪</p>
          <h1 className="mt-2 text-2xl font-extrabold text-amber-300">
            DEV モード
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            コイン無制限・回数無制限のテスト用アカウント
          </p>
        </div>

        {/* テストユーザー情報 */}
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-amber-200">ユーザー名</span>
            <span className="font-extrabold text-amber-100">{testUser.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-amber-200">コイン残高</span>
            <span className="font-mono font-extrabold text-emerald-300">
              {testUser.coinBalance.toLocaleString()} 🪙
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-amber-200">制限</span>
            <span className="text-xs font-bold text-sky-300">
              ✅ コイン消費なし　✅ 回数制限なし
            </span>
          </div>
        </div>

        {/* 注意書き */}
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 space-y-1">
          <p className="font-bold">⚠️ DEVモードの仕様</p>
          <p>・ガチャ・クレーンゲームでコインを消費しません</p>
          <p>・アクティブ狩りの1日3回制限がありません</p>
          <p>・クエスト申請・承認は通常どおり動作します</p>
          <p>・Bank の残高一覧には表示されません</p>
        </div>

        {/* ボタン群 */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => router.push(`/kids?kid=${testUser.id}`)}
            className="w-full rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 py-4 text-lg font-extrabold text-white shadow-xl transition hover:brightness-110 active:scale-[0.97]"
          >
            🎮 テストユーザーで遊ぶ
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="w-full rounded-2xl border border-slate-600 bg-slate-800 py-3 text-sm font-bold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            {resetDone ? "✅ リセット完了！" : isPending ? "リセット中…" : "🔄 コイン・スタミナをリセット（99999枚に戻す）"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/bank")}
            className="w-full rounded-2xl border border-slate-700 bg-transparent py-3 text-sm font-bold text-slate-400 transition hover:text-slate-200"
          >
            ← 銀行画面に戻る
          </button>
        </div>
      </div>
    </main>
  );
}
