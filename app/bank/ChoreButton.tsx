"use client";

import { useTransition } from "react";
import { giveChoreCoins } from "./actions";

type Props = {
  userId: string;
  userName: string;
};

export function ChoreButton({ userId, userName }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await giveChoreCoins(userId);
        });
      }}
      className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-emerald-400 active:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
      aria-label={`${userName} に +100 コイン（お手伝い）を付与する`}
    >
      {isPending ? "付与中…" : "＋100 コイン（お手伝い）"}
    </button>
  );
}
