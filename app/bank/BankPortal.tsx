"use client";

// 親用Bank管理画面のポータル。
// 4タブ（残高・ペナルティ・ボーナス・クエスト検品）を h-screen に収める。

import Link from "next/link";
import { useState } from "react";
import { ChoreButton } from "./ChoreButton";
import { PenaltyPanel } from "./PenaltyPanel";
import { BonusPanel } from "./BonusPanel";
import { QuestReviewPanel } from "./QuestReviewPanel";

type ChildData = {
  id: string;
  name: string;
  age: number;
  birthDateFormatted: string;
  coinBalance: number;
};

type PenaltyDTO = {
  id: string;
  title: string;
  description: string | null;
  coinAmount: number;
  emoji: string;
  targetUserIds: string[];
};

type SubmissionDTO = {
  id: string;
  questId: string;
  questTitle: string;
  questEmoji: string;
  rewardCoins: number;
  userId: string;
  userName: string;
  submittedAt: string;
};

type Props = {
  children: ChildData[];
  totalBalance: number;
  penaltyItems: PenaltyDTO[];
  reviewItems: SubmissionDTO[];
};

type TabId = "balance" | "penalty" | "bonus" | "review";

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "balance", label: "残高", emoji: "💰" },
  { id: "penalty", label: "ペナルティ", emoji: "🚨" },
  { id: "bonus", label: "ボーナス", emoji: "🌟" },
  { id: "review", label: "検品", emoji: "📥" },
];

export function BankPortal({
  children,
  totalBalance,
  penaltyItems,
  reviewItems,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("balance");

  const childOptions = children.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-900 text-slate-100">
      {/* ── ヘッダー ── */}
      <header className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-700/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/70 leading-none">
              Chore Safari · Parent Console
            </p>
            <h1 className="text-xl font-extrabold leading-tight">
              🏦 銀行（親用管理画面）
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              残高合計：
              <span className="font-mono text-emerald-300 font-bold ml-1">
                {totalBalance.toLocaleString()}
              </span>{" "}
              コイン
            </p>
          </div>
          <nav className="flex flex-col gap-1 shrink-0">
            <Link
              href="/bank/quests"
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-500/20 whitespace-nowrap"
            >
              📋 クエスト管理マスタ
            </Link>
            <Link
              href="/bank/penalties"
              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-200 transition hover:bg-rose-500/20 whitespace-nowrap"
            >
              🚨 ペナルティ管理マスタ
            </Link>
          </nav>
        </div>
      </header>

      {/* ── タブバー ── */}
      <div className="shrink-0 flex border-b border-slate-700/60 bg-slate-800/50">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold transition-colors ${
                active
                  ? "text-emerald-300 border-b-2 border-emerald-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="text-base leading-none">{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── タブコンテンツ（スクロール可） ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {activeTab === "balance" && (
          <section className="p-4">
            <h2 className="text-base font-bold text-slate-300 mb-3">
              子供たちの残高
            </h2>
            {children.length === 0 ? (
              <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100 text-sm">
                子供データがまだありません。
                <br />
                <code className="rounded bg-black/40 px-1 text-xs">
                  npm run db:seed
                </code>{" "}
                を実行してください。
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {children.map((child) => (
                  <article
                    key={child.id}
                    className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-slate-900/60 p-4 shadow-md"
                  >
                    <div>
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-xl font-extrabold">{child.name}</h3>
                        <span className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-xs text-emerald-200">
                          {child.age} 歳
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        生年月日：{child.birthDateFormatted}
                      </p>
                    </div>
                    <div className="rounded-xl bg-black/40 p-3 text-center">
                      <p className="text-xs uppercase tracking-widest text-emerald-300/70">
                        残高
                      </p>
                      <p className="font-mono text-2xl font-extrabold text-emerald-200">
                        {child.coinBalance.toLocaleString()}
                        <span className="ml-1 text-sm font-normal text-emerald-300/70">
                          コイン
                        </span>
                      </p>
                    </div>
                    <ChoreButton userId={child.id} userName={child.name} />
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "penalty" && (
          <section className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span aria-hidden className="text-2xl">🚨</span>
              <div>
                <h2 className="text-base font-extrabold text-rose-100">
                  ペナルティ（喧嘩用）
                </h2>
                <p className="text-xs text-rose-200/70">
                  選んだ子供からコインを没収します。
                </p>
              </div>
            </div>
            <PenaltyPanel children={childOptions} penalties={penaltyItems} />
          </section>
        )}

        {activeTab === "bonus" && (
          <section className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span aria-hidden className="text-2xl">🌟</span>
              <div>
                <h2 className="text-base font-extrabold text-amber-100">
                  特大達成ボーナスを送る
                </h2>
                <p className="text-xs text-amber-200/70">
                  テスト満点・昇級など、特別な達成に 500〜5000 コインを付与。
                </p>
              </div>
            </div>
            <BonusPanel children={childOptions} />
          </section>
        )}

        {activeTab === "review" && (
          <section className="p-4">
            <div className="mb-3 flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-2xl">📥</span>
                <div>
                  <h2 className="text-base font-extrabold text-sky-100">
                    クエスト検品（承認待ち）
                  </h2>
                  <p className="text-xs text-sky-200/70">
                    子供の「やったよ！」を承認 / 差し戻し
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-sky-300/40 px-2 py-0.5 text-xs font-bold text-sky-200">
                {reviewItems.length} 件
              </span>
            </div>
            <QuestReviewPanel submissions={reviewItems} />
          </section>
        )}
      </div>
    </div>
  );
}
