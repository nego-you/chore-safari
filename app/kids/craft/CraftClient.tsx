"use client";

// クラフト画面のクライアント本体。レシピカードを並べて、足りているレシピだけ
// 「これをつくる！」ボタンを有効化する。成功時はその場で在庫表示を更新。

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Recipe } from "@/lib/recipes";
import { craftItem } from "../actions";

type Inv = {
  itemId: string;
  itemName: string;
  quantity: number;
  itemType: "FOOD" | "TRAP_PART";
};

type Props = {
  recipes: Recipe[];
  inventory: Inv[];
};

// レシピでよく使う素材／完成品の絵文字。未知のものは ❓。
const ITEM_EMOJI: Record<string, string> = {
  meat: "🍖",
  fish: "🐟",
  berry: "🍓",
  rope: "🪢",
  wood: "🪵",
  net: "🕸️",
  sturdy_trap: "🪤",
  premium_food: "🍱",
  hunter_net: "🥅",
  mixed_food: "🍲",
};

function emojiFor(itemId: string): string {
  return ITEM_EMOJI[itemId] ?? "❓";
}

type Toast = {
  itemId: string;
  itemName: string;
  emoji: string;
};

export function CraftClient({ recipes, inventory }: Props) {
  const [inv, setInv] = useState<Inv[]>(inventory);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingRecipeId, setPendingRecipeId] = useState<string | null>(null);
  const [errorByRecipe, setErrorByRecipe] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // props が更新（revalidate 後）されたら state を同期。
  useEffect(() => setInv(inventory), [inventory]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const qtyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of inv) m.set(i.itemId, i.quantity);
    return m;
  }, [inv]);

  const handleCraft = (recipe: Recipe) => {
    setErrorByRecipe((prev) => ({ ...prev, [recipe.id]: "" }));
    setPendingRecipeId(recipe.id);
    startTransition(async () => {
      const result = await craftItem(recipe.id);
      setPendingRecipeId(null);
      if (!result.success) {
        setErrorByRecipe((prev) => ({ ...prev, [recipe.id]: result.error }));
        return;
      }
      // 楽観的更新：素材を減らし、完成品を反映。
      setInv((prev) => {
        const map = new Map<string, Inv>();
        for (const i of prev) map.set(i.itemId, { ...i });
        // 素材
        for (const u of result.updatedInventory) {
          const cur = map.get(u.itemId);
          if (cur) map.set(u.itemId, { ...cur, quantity: u.quantity });
        }
        // 完成品
        const existing = map.get(result.product.itemId);
        if (existing) {
          map.set(result.product.itemId, {
            ...existing,
            quantity: result.product.totalQuantity,
          });
        } else {
          map.set(result.product.itemId, {
            itemId: result.product.itemId,
            itemName: result.product.itemName,
            quantity: result.product.totalQuantity,
            itemType: result.product.itemType,
          });
        }
        return [...map.values()];
      });

      setToast({
        itemId: result.product.itemId,
        itemName: result.product.itemName,
        emoji: emojiFor(result.product.itemId),
      });
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-100 via-pink-50 to-amber-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href="/kids"
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-violet-700 shadow ring-1 ring-violet-200 transition hover:bg-white"
          >
            ← ポータルへ
          </Link>
          <p className="text-sm font-bold text-violet-700/80">クラフト こうぼう</p>
        </div>

        {/* タイトル */}
        <section className="rounded-[2rem] bg-gradient-to-br from-violet-300 via-pink-200 to-amber-200 p-1 shadow-xl">
          <div className="rounded-[1.75rem] bg-white/95 p-6 text-center">
            <p className="text-4xl">🛠️✨🧰</p>
            <h1 className="mt-2 text-3xl font-black text-violet-700 sm:text-4xl">
              アイテムを つくる！
            </h1>
            <p className="mt-1 text-sm text-violet-600/80">
              そうこの アイテムを くみあわせて あたらしい どうぐを つくろう
            </p>
          </div>
        </section>

        {/* レシピカード一覧 */}
        <section aria-labelledby="recipes-heading" className="space-y-4">
          <h2 id="recipes-heading" className="text-xl font-extrabold text-violet-800">
            レシピ
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recipes.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                qtyMap={qtyMap}
                producedQty={qtyMap.get(r.resultItemId) ?? 0}
                onCraft={() => handleCraft(r)}
                isPending={isPending && pendingRecipeId === r.id}
                disabledByOther={isPending && pendingRecipeId !== r.id}
                error={errorByRecipe[r.id]}
              />
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-violet-700/70">
          ✨ つくった アイテムは みんなの そうこに しまわれるよ ✨
        </p>
      </div>

      {toast && <SuccessToast toast={toast} onClose={() => setToast(null)} />}
    </main>
  );
}

function RecipeCard({
  recipe,
  qtyMap,
  producedQty,
  onCraft,
  isPending,
  disabledByOther,
  error,
}: {
  recipe: Recipe;
  qtyMap: Map<string, number>;
  producedQty: number;
  onCraft: () => void;
  isPending: boolean;
  disabledByOther: boolean;
  error?: string;
}) {
  const canCraft =
    !disabledByOther &&
    !isPending &&
    recipe.materials.every(
      (m) => (qtyMap.get(m.itemId) ?? 0) >= m.quantity,
    );

  return (
    <article className="flex flex-col gap-4 rounded-3xl bg-white/95 p-5 shadow-lg ring-2 ring-violet-200">
      {/* 完成品 */}
      <header className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 p-4 ring-1 ring-violet-200">
        <span className="text-5xl drop-shadow" aria-hidden>
          {ITEM_EMOJI[recipe.resultItemId] ?? recipe.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-violet-800">{recipe.name}</p>
          <p className="text-xs text-violet-700/80">{recipe.description}</p>
          <p className="mt-1 text-[11px] font-bold text-violet-700/70">
            いま そうこに ×{producedQty} ／ つくると +
            {recipe.resultQuantity}
          </p>
        </div>
      </header>

      {/* 素材 */}
      <div>
        <p className="mb-1 text-xs font-extrabold text-violet-700">
          ひつようなもの
        </p>
        <ul className="space-y-1.5">
          {recipe.materials.map((m) => {
            const have = qtyMap.get(m.itemId) ?? 0;
            const ok = have >= m.quantity;
            return (
              <li
                key={m.itemId}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ring-1 ${
                  ok
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-rose-50 text-rose-700 ring-rose-200"
                }`}
              >
                <span aria-hidden className="text-xl">
                  {emojiFor(m.itemId)}
                </span>
                <span className="flex-1">{m.itemName}</span>
                <span className="font-mono">
                  {ok ? "✓" : "✗"} {have}/{m.quantity}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ボタン */}
      <button
        type="button"
        onClick={onCraft}
        disabled={!canCraft}
        className={`w-full rounded-2xl px-4 py-3 text-lg font-black tracking-wide text-white shadow-lg transition active:scale-[0.98] ${
          canCraft
            ? "bg-gradient-to-r from-violet-500 via-pink-500 to-amber-500 hover:brightness-110"
            : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
        }`}
      >
        {isPending ? "つくってる…" : "🛠️ これを つくる！"}
      </button>

      {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
    </article>
  );
}

function SuccessToast({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-live="polite"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="mx-4 max-w-sm rounded-[2rem] bg-gradient-to-br from-violet-300 via-pink-200 to-amber-200 p-1 shadow-2xl">
        <div className="rounded-[1.7rem] bg-white px-6 py-10 text-center">
          <p className="text-sm font-extrabold tracking-widest text-violet-500">
            ✨ かんせい ✨
          </p>
          <div className="relative my-4 flex items-center justify-center">
            <span aria-hidden className="absolute text-9xl opacity-20 blur-md">
              {toast.emoji}
            </span>
            <span
              aria-hidden
              className="relative text-8xl drop-shadow-lg animate-bounce"
            >
              {toast.emoji}
            </span>
          </div>
          <p className="text-3xl font-black text-violet-700">
            {toast.itemName}
          </p>
          <p className="mt-2 text-base font-bold text-violet-500">
            が かんせい した！
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-full bg-violet-500 px-6 py-2 text-sm font-extrabold text-white shadow transition hover:brightness-110"
          >
            やったー！
          </button>
        </div>
      </div>
    </div>
  );
}
