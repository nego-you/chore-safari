"use client";

// /kids/[kidId] — Server Component がエラーを投げた際の Error Boundary。
// これがないとエラー時にナビゲーションがロード状態のまま止まってしまう。
// "use client" が必要（Next.js App Router の仕様）。

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function KidPageError({ error, reset }: Props) {
  const router = useRouter();

  useEffect(() => {
    // サーバー側エラーをコンソールに残す（デバッグ用）
    console.error("[KidPage] render error:", error);
  }, [error]);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-sky-100 via-pink-50 to-yellow-50 px-6 text-center">
      <p className="text-6xl">😵</p>
      <h1 className="text-2xl font-extrabold text-sky-800">
        よみこみに しっぱいしたよ
      </h1>
      <p className="text-sm text-sky-600/80 max-w-xs">
        インターネットがつながっているか かくにん して、もう一度 ためしてね。
      </p>
      {/* digest はサーバーログと突き合わせるための識別子 */}
      {error.digest && (
        <p className="text-[10px] text-slate-400 font-mono">
          ref: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-sky-500 px-6 py-3 text-base font-extrabold text-white shadow transition hover:brightness-110 active:scale-95"
        >
          もう一度 よむ
        </button>
        <button
          type="button"
          onClick={() => router.push("/kids")}
          className="rounded-full border-2 border-sky-300 bg-white px-6 py-3 text-base font-extrabold text-sky-700 shadow transition hover:bg-sky-50 active:scale-95"
        >
          ← もどる
        </button>
      </div>
    </div>
  );
}
