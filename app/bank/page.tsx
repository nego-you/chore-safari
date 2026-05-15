// 親用の管理画面 (/bank)
// Server Component で DB から子供一覧を取得し、各操作 UI を組み立てる。

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { calculateAge, formatBirthDate } from "@/lib/age";
import { ChoreButton } from "./ChoreButton";
import { PenaltyPanel } from "./PenaltyPanel";
import { BonusPanel } from "./BonusPanel";
import { QuestReviewPanel } from "./QuestReviewPanel";

export const dynamic = "force-dynamic";

export default async function BankPage() {
  const [children, pendingSubmissions, penalties] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CHILD" },
      orderBy: { birthDate: "asc" },
    }),
    prisma.questSubmission.findMany({
      where: { status: "PENDING" },
      orderBy: { submittedAt: "asc" },
      include: {
        quest: true,
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.penalty.findMany({
      where: { isActive: true },
      orderBy: [{ coinAmount: "asc" }, { createdAt: "asc" }],
      include: { targetUsers: { select: { id: true } } },
    }),
  ]);

  const penaltyItems = penalties.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    coinAmount: p.coinAmount,
    emoji: p.emoji,
    targetUserIds: p.targetUsers.map((u) => u.id),
  }));

  const childOptions = children.map((c) => ({ id: c.id, name: c.name }));
  const totalBalance = children.reduce((sum, c) => sum + c.coinBalance, 0);

  const reviewItems = pendingSubmissions.map((s) => ({
    id: s.id,
    questId: s.questId,
    questTitle: s.quest.title,
    questEmoji: s.quest.emoji,
    rewardCoins: s.quest.rewardCoins,
    userId: s.userId,
    userName: s.user.name,
    submittedAt: s.submittedAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 text-slate-100">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/80">
          Chore Safari · Parent Console
        </p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">🏦 銀行（親用管理画面）</h1>
        <p className="text-sm text-slate-300">
          子供たちのコインを付与・没収します。残高合計：
          <span className="ml-1 font-mono text-emerald-300">
            {totalBalance.toLocaleString()}
          </span>{" "}
          コイン
        </p>

        {/* マスタ画面へのナビ */}
        <nav className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/bank/quests"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            📋 クエスト管理マスタ
          </Link>
          <Link
            href="/bank/penalties"
            className="inline-flex items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20"
          >
            🚨 ペナルティ管理マスタ
          </Link>
        </nav>
      </header>

      {/* 子供カード一覧 */}
      <section aria-labelledby="children-heading" className="space-y-4">
        <h2 id="children-heading" className="text-xl font-bold">
          子供たちの残高
        </h2>
        {children.length === 0 ? (
          <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">
            子供データがまだありません。
            <br />
            <code className="rounded bg-black/40 px-1 text-xs">npm run db:seed</code>{" "}
            を実行してください。
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => {
              const age = calculateAge(child.birthDate);
              return (
                <article
                  key={child.id}
                  className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-slate-900/60 p-5 shadow-md shadow-emerald-900/20"
                >
                  <div>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-2xl font-extrabold">{child.name}</h3>
                      <span className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-xs text-emerald-200">
                        {age} 歳
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      生年月日：{formatBirthDate(child.birthDate)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-black/40 p-4 text-center">
                    <p className="text-xs uppercase tracking-widest text-emerald-300/70">
                      残高
                    </p>
                    <p className="font-mono text-3xl font-extrabold text-emerald-200">
                      {child.coinBalance.toLocaleString()}
                      <span className="ml-1 text-base font-normal text-emerald-300/70">
                        コイン
                      </span>
                    </p>
                  </div>

                  <ChoreButton userId={child.id} userName={child.name} />
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ペナルティセクション（目立つ色で配置） */}
      <section
        aria-labelledby="penalty-heading"
        className="rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-950/60 to-rose-900/30 p-6 shadow-lg shadow-rose-900/30"
      >
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden className="text-3xl">🚨</span>
          <div>
            <h2 id="penalty-heading" className="text-2xl font-extrabold text-rose-100">
              ペナルティ（喧嘩用）
            </h2>
            <p className="text-sm text-rose-200/70">
              選んだ子供から 50 コインを没収します。
            </p>
          </div>
        </div>
        <PenaltyPanel children={childOptions} penalties={penaltyItems} />
      </section>

      {/* 特大達成ボーナス（UI 枠） */}
      <section
        aria-labelledby="bonus-heading"
        className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-950/40 to-yellow-900/20 p-6 shadow-lg shadow-amber-900/20"
      >
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden className="text-3xl">🌟</span>
          <div>
            <h2 id="bonus-heading" className="text-2xl font-extrabold text-amber-100">
              特大達成ボーナスを送る
            </h2>
            <p className="text-sm text-amber-200/70">
              テスト満点・昇級など、特別な達成に対して 500〜5000 コインを付与します。
            </p>
          </div>
        </div>
        <BonusPanel children={childOptions} />
      </section>

      {/* クエスト検品（承認待ち一覧） */}
      <section
        aria-labelledby="quest-review-heading"
        className="rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-950/60 to-slate-900/30 p-6 shadow-lg shadow-sky-900/20"
      >
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden className="text-3xl">📥</span>
          <div className="flex-1">
            <h2
              id="quest-review-heading"
              className="text-2xl font-extrabold text-sky-100"
            >
              クエスト検品（承認待ち）
            </h2>
            <p className="text-sm text-sky-200/70">
              子供から届いた「やったよ！」を確認して、承認 / 差し戻しを決めてください。
            </p>
          </div>
          <span className="rounded-full border border-sky-300/40 px-2 py-0.5 text-xs font-bold text-sky-200">
            {reviewItems.length} 件
          </span>
        </div>
        <QuestReviewPanel submissions={reviewItems} />
      </section>
    </main>
  );
}
