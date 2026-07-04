// /bank/penalties — ペナルティマスタ管理画面。
// クエスト管理画面と同じスタイルで、親が没収項目を CRUD する。

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PenaltyMasterClient } from "./PenaltyMasterClient";

export const dynamic = "force-dynamic";

export default async function PenaltyMasterPage() {
  const [penalties, kids] = await Promise.all([
    prisma.penalty.findMany({
      orderBy: [{ coinAmount: "asc" }, { createdAt: "asc" }],
      include: {
        targetUsers: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "CHILD" },
      orderBy: { birthDate: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = penalties.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    coinAmount: p.coinAmount,
    emoji: p.emoji,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    targetUserIds: p.targetUsers.map((u) => u.id),
    targetUserNames:
      p.targetUsers.length > 0
        ? p.targetUsers.map((u) => u.name).join(", ")
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
          <p className="text-xs uppercase tracking-[0.3em] text-rose-300/80">
            Parent Console · Penalty Master
          </p>
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          🚨 ペナルティ管理マスタ
        </h1>
        <p className="text-sm text-slate-300">
          <code className="rounded bg-black/40 px-1">/bank</code>{" "}
          のペナルティパネルから選んで適用できる「没収項目」を管理します。対象を「全員」にも特定の子だけにも設定できます。
        </p>
      </header>

      <PenaltyMasterClient initialRows={rows} kids={kids} />
    </main>
  );
}
