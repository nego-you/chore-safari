// /kids/[kidId]/guild — クエストギルド（ハブ）。
// クエスト・クラフト・レース・クレーンなど「コインを稼ぐ／使う」系の入口を集約。

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

export default async function GuildPage({ params }: { params: Params }) {
  const { kidId } = await params;

  const [kid, pendingCount, activeQuestCount] = await Promise.all([
    prisma.user.findFirst({
      where: { id: kidId, role: "CHILD" },
      select: { id: true, name: true, coinBalance: true },
    }),
    prisma.questSubmission.count({
      where: { userId: kidId, status: "PENDING" },
    }),
    prisma.quest.count({ where: { isActive: true } }),
  ]);

  if (!kid) notFound();

  const reading = NAME_READING[kid.name] ?? kid.name;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-100 via-orange-100 to-rose-100 px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href={`/kids/${kid.id}`}
            className="rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-amber-800 shadow ring-1 ring-amber-200 transition hover:bg-white active:scale-95"
          >
            ← ワールドマップ
          </Link>
          <p className="text-sm font-extrabold text-amber-700/80 tracking-widest">
            🏰 クエスト ギルド
          </p>
        </div>

        {/* ヒーロー */}
        <section className="rounded-[2rem] bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-1 shadow-xl ring-4 ring-white">
          <div className="rounded-[1.7rem] bg-white/95 px-6 py-6 text-center backdrop-blur">
            <p className="text-5xl drop-shadow" aria-hidden>🏰⚔️📜</p>
            <h1 className="mt-1 text-2xl font-black text-amber-800">
              ようこそ、{reading} よ
            </h1>
            <p className="mt-1 text-xs font-bold text-amber-700/80">
              ギルドには {activeQuestCount} 件の おしごとが あるよ
              {pendingCount > 0 && `（${pendingCount} 件 しんさちゅう）`}
            </p>
            <p className="mt-3 inline-flex items-baseline gap-1 rounded-full bg-amber-100 px-4 py-1 text-amber-900 shadow-inner">
              <span className="font-mono text-2xl font-black">
                {kid.coinBalance.toLocaleString()}
              </span>
              <span className="text-xs font-bold">コイン 🪙</span>
            </p>
          </div>
        </section>

        {/* 主要クエストへの導線 */}
        <section className="grid grid-cols-1 gap-3">
          <GuildLink
            href={`/kids/${kid.id}/quests`}
            emoji="📜"
            title="クエスト ボード"
            subtitle="おてつだい・がくしゅう クエストを うける"
            note={
              pendingCount > 0
                ? `🔔 ${pendingCount}件 しんさまち`
                : `${activeQuestCount}件 ぼしゅうちゅう`
            }
            tone="from-amber-200 to-orange-200 text-amber-900"
          />
          <GuildLink
            href={`/kids/${kid.id}/craft`}
            emoji="🛠️"
            title="クラフト 工房"
            subtitle="そざいを くみあわせて 道具を つくる"
            note="新しい 道具で 狩りが ゆうりに"
            tone="from-violet-200 to-pink-200 text-violet-900"
          />
          <GuildLink
            href={`/kids/${kid.id}/race`}
            emoji="🏟️"
            title="サファリ レース"
            subtitle="つかまえた どうぶつで しょうぶ"
            note="AI じっきょう つき"
            tone="from-rose-200 to-orange-200 text-rose-900"
          />
          <GuildLink
            href={`/kids/${kid.id}/crane`}
            emoji="🕹️"
            title="クレーン ゲーム"
            subtitle="まえうしろ ひだりみぎ で アイテム ゲット"
            note="豪華 ドロップ"
            tone="from-fuchsia-200 to-violet-200 text-fuchsia-900"
          />
        </section>

        <p className="text-center text-[11px] font-bold text-amber-600/70 tracking-widest">
          🏰 ギルドで コインを かせいで サファリへ 🏰
        </p>
      </div>
    </main>
  );
}

function GuildLink({
  href,
  emoji,
  title,
  subtitle,
  note,
  tone,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  note: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-3xl bg-gradient-to-br ${tone} p-1 shadow-lg ring-1 ring-white transition hover:brightness-105 active:scale-[0.99]`}
    >
      <div className="flex items-center gap-4 rounded-[1.4rem] bg-white/85 px-5 py-4 backdrop-blur">
        <span className="text-4xl shrink-0" aria-hidden>
          {emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-black leading-tight">{title}</p>
          <p className="text-xs font-bold text-slate-600 mt-0.5">{subtitle}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{note}</p>
        </div>
        <span className="text-xl text-slate-500 shrink-0" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}
