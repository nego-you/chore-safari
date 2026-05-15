// /bank/quests — クエストマスタ管理画面。
// 親（PARENT 想定）がクエストを自由に CRUD できる WMS 風 UI。

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { QuestMasterClient } from "./QuestMasterClient";

export const dynamic = "force-dynamic";

export default async function QuestMasterPage() {
  const [quests, kids] = await Promise.all([
    prisma.quest.findMany({
      orderBy: [{ rewardCoins: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { submissions: true } },
        targetUsers: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "CHILD" },
      orderBy: { birthDate: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = quests.map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    rewardCoins: q.rewardCoins,
    emoji: q.emoji,
    isActive: q.isActive,
    // DB は String カラム。許容値外はクライアント側で CHORE に丸める。
    category: q.category,
    submissionCount: q._count.submissions,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    targetUserIds: q.targetUsers.map((u) => u.id),
    targetUserNames:
      q.targetUsers.length > 0
        ? q.targetUsers.map((u) => u.name).join(", ")
        : "全員",
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-slate-100">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <Link
            href="/bank"
            className="rounded-full border border-slate-600/50 bg-slate-900/60 px-3 py-1 text-xs font-bold text-slate-300 transition hover:bg-slate-800"
          >
            ← 銀行ホーム
          </Link>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
            Parent Console · Quest Master
          </p>
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          📋 クエスト管理マスタ
        </h1>
        <p className="text-sm text-slate-300">
          子供が <code className="rounded bg-black/40 px-1">/kids/quests</code>{" "}
          で挑戦できるクエストを登録・編集・削除します。報酬コインと説明文を含めて変更すると即時で子供側に反映されます。
        </p>
      </header>

      <QuestMasterClient initialRows={rows} kids={kids} />
    </main>
  );
}
