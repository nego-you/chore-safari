"use client";

// app/kids/[kidId]/DayEndScreen.tsx — 「きょうの ぶんは おしまい」画面（一本道化 2026-06-12）
//
// 1日の上限（狩り・罠設置など）に達したときに明示的に出す全画面。
// 「ハマりすぎない健康的な距離感」（docs/DESIGN_PRINCIPLES.md 2）：
// ダラダラと画面を見続ける状態をシステム側でやさしくシャットアウトする。

import Link from "next/link";

export function DayEndScreen({
  kidId,
  message = "きょうの ぶんは もう おしまい！",
  subMessage = "また あした、げんじつで がんばろう！",
}: {
  kidId: string;
  message?: string;
  subMessage?: string;
}) {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-indigo-950 via-indigo-900 to-violet-900 p-8 text-center">
      <div className="text-7xl md:text-8xl" aria-hidden>
        🌙
      </div>
      <div>
        <p className="text-xl md:text-3xl font-black leading-relaxed text-amber-200">
          {message}
        </p>
        <p className="mt-3 text-sm md:text-lg font-bold text-indigo-200">
          {subMessage}
        </p>
      </div>
      <div className="flex items-center gap-2 text-3xl" aria-hidden>
        <span>💤</span>
        <span>🦁</span>
        <span>🐘</span>
        <span>🦒</span>
        <span>💤</span>
      </div>
      <p className="max-w-xs text-xs md:text-sm leading-relaxed text-indigo-300">
        どうぶつたちも やすんでいるよ。
        <br />
        おてつだいや うんぱんミッションは あしたも まってるからね！
      </p>
      <Link
        href={`/kids/${kidId}`}
        className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-8 py-3 text-base font-black text-white shadow-lg transition hover:brightness-110 active:scale-[0.97]"
      >
        🗺️ マップへ もどる
      </Link>
    </div>
  );
}
