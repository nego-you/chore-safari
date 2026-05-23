// /kids/[kidId] — ナビゲーション中に表示されるローディングUI。
// next/link でのクライアント遷移中、Server Component のデータ取得が完了するまで
// この画面が表示される。「無反応」に見える問題を解消する。

export default function KidPageLoading() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-sky-100 via-pink-50 to-yellow-50">
      {/* アニメーションスピナー */}
      <div
        className="h-16 w-16 rounded-full border-4 border-sky-200 border-t-sky-500 animate-spin"
        role="status"
        aria-label="よみこみちゅう"
      />
      <p className="text-lg font-extrabold text-sky-700 animate-pulse">
        よみこみちゅう…
      </p>
    </div>
  );
}
