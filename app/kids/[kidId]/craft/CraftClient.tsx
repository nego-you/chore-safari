"use client";

// クラフト画面クライアント本体。
// 素材（UserMaterial）を消費して道具（UserTool）を作る。
// レシピカードを TRAP / SPEAR / BOW / WEAPON タブで分類。

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Recipe } from "@/lib/recipes";
import { craftItem } from "../../actions";

type MaterialRow = {
  materialId: string;
  materialName: string;
  emoji: string;
  quantity: number;
};

type ToolRow = {
  toolId: string;
  toolName: string;
  emoji: string;
  toolType: "TRAP" | "BOW" | "SPEAR" | "WEAPON";
  quantity: number;
};

type Props = {
  kidId: string;
  kidName: string;
  recipes: Recipe[];
  materials: MaterialRow[];
  ownedTools: ToolRow[];
};

type Toast = { message: string; ok: boolean };
type Tab = "TRAP" | "SPEAR" | "BOW" | "WEAPON";

const TAB_LABELS: Record<Tab, string> = {
  TRAP:   "🪤 パッシブわな",
  SPEAR:  "🗡️ とうしゃぶき",
  BOW:    "🏹 ゆみ",
  WEAPON: "🔪 ナイフ・じゅう",
};

const TOOL_TYPE_BADGE: Record<Tab, string> = {
  TRAP:   "bg-amber-100 text-amber-800 ring-amber-300",
  SPEAR:  "bg-sky-100 text-sky-800 ring-sky-300",
  BOW:    "bg-violet-100 text-violet-800 ring-violet-300",
  WEAPON: "bg-rose-100 text-rose-800 ring-rose-300",
};

export function CraftClient({
  kidId,
  kidName,
  recipes,
  materials,
  ownedTools,
}: Props) {
  const portalHref = `/kids/${kidId}`;
  const [mats, setMats] = useState<MaterialRow[]>(materials);
  const [tools, setTools] = useState<ToolRow[]>(ownedTools);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorByRecipe, setErrorByRecipe] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<Tab>("TRAP");
  const [isPending, startTransition] = useTransition();

  useEffect(() => setMats(materials), [materials]);
  useEffect(() => setTools(ownedTools), [ownedTools]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // materialId → 所持数
  const matQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const mat of mats) m.set(mat.materialId, mat.quantity);
    return m;
  }, [mats]);

  // toolId → 所持数
  const toolQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tools) m.set(t.toolId, t.quantity);
    return m;
  }, [tools]);

  const handleCraft = (recipe: Recipe) => {
    setErrorByRecipe((prev) => ({ ...prev, [recipe.id]: "" }));
    setPendingId(recipe.id);
    startTransition(async () => {
      const result = await craftItem(recipe.id, kidId);
      setPendingId(null);
      if (!result.success) {
        setErrorByRecipe((prev) => ({ ...prev, [recipe.id]: result.error }));
        return;
      }
      // 素材の楽観的更新
      setMats((prev) =>
        prev.map((m) => {
          const updated = result.updatedMaterials.find(
            (u) => u.materialId === m.materialId,
          );
          return updated ? { ...m, quantity: updated.quantity } : m;
        }),
      );
      // 道具の楽観的更新
      const { toolId, toolName, toolType, totalQuantity } = result.product;
      setTools((prev) => {
        const existing = prev.find((t) => t.toolId === toolId);
        if (existing) {
          return prev.map((t) =>
            t.toolId === toolId ? { ...t, quantity: totalQuantity } : t,
          );
        }
        // 新規取得
        const recipe2 = recipes.find((r) => r.resultToolId === toolId);
        return [
          ...prev,
          {
            toolId,
            toolName,
            toolType,
            emoji: recipe2?.emoji ?? "🛠️",
            quantity: totalQuantity,
          },
        ];
      });
      setToast({ message: `${recipe.emoji} ${recipe.name} を つくった！`, ok: true });
    });
  };

  const tabRecipes = useMemo(
    () => recipes.filter((r) => r.resultToolType === activeTab),
    [recipes, activeTab],
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-yellow-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href={portalHref}
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-amber-700 shadow ring-1 ring-amber-200 transition active:scale-95"
          >
            ← ポータルへ
          </Link>
          <p className="text-sm font-bold text-amber-700/80">
            ⚙️ クラフト こうじょう ⚙️
          </p>
          <p className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
            {kidName}
          </p>
        </div>

        {/* 素材一覧 */}
        <section className="rounded-3xl bg-white/95 p-4 shadow ring-2 ring-amber-200">
          <p className="mb-3 text-xs font-extrabold text-amber-800">
            🪵 もっている そざい（クレーンで あつめよう！）
          </p>
          {mats.length === 0 ? (
            <p className="text-center text-xs text-amber-600">
              まだ そざいが ないよ。クレーンゲームで あつめてね！
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {mats.map((m) => (
                <div
                  key={m.materialId}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold shadow ring-1 ${
                    m.quantity > 0
                      ? "bg-amber-50 ring-amber-200 text-amber-800"
                      : "bg-gray-100 ring-gray-200 text-gray-400"
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span>{m.materialName}</span>
                  <span
                    className={`ml-1 rounded-full px-1.5 text-[10px] font-black ${
                      m.quantity > 0
                        ? "bg-amber-400 text-white"
                        : "bg-gray-300 text-gray-500"
                    }`}
                  >
                    ×{m.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* タブ */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["TRAP", "SPEAR", "BOW", "WEAPON"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold shadow transition active:scale-95 ${
                activeTab === tab
                  ? "bg-amber-500 text-white ring-2 ring-amber-300"
                  : "bg-white/90 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* レシピカード一覧 */}
        <div className="space-y-3">
          {tabRecipes.map((recipe) => {
            const canCraft = recipe.materials.every(
              (m) => (matQty.get(m.materialId) ?? 0) >= m.quantity,
            );
            const isPendingThis = pendingId === recipe.id;
            const errMsg = errorByRecipe[recipe.id];
            const owned = toolQty.get(recipe.resultToolId) ?? 0;

            return (
              <div
                key={recipe.id}
                className="rounded-2xl bg-white/95 p-4 shadow ring-1 ring-amber-100"
              >
                <div className="flex items-start gap-3">
                  <span className="text-4xl shrink-0">{recipe.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-black text-slate-800">
                        {recipe.name}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0 text-[9px] font-extrabold ring-1 ${
                          TOOL_TYPE_BADGE[recipe.resultToolType as Tab]
                        }`}
                      >
                        {TAB_LABELS[recipe.resultToolType as Tab]}
                      </span>
                      {owned > 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0 text-[9px] font-extrabold text-emerald-700 ring-1 ring-emerald-300">
                          ✅ もっている ×{owned}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{recipe.description}</p>

                    {/* 必要素材 */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {recipe.materials.map((mat) => {
                        const have = matQty.get(mat.materialId) ?? 0;
                        const enough = have >= mat.quantity;
                        return (
                          <span
                            key={mat.materialId}
                            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${
                              enough
                                ? "bg-emerald-50 ring-emerald-200 text-emerald-800"
                                : "bg-rose-50 ring-rose-200 text-rose-700"
                            }`}
                          >
                            {mat.emoji} {mat.materialName} ×{mat.quantity}
                            <span className="ml-0.5 text-[9px] opacity-70">
                              （いま{have}）
                            </span>
                          </span>
                        );
                      })}
                    </div>

                    {errMsg && (
                      <p className="mt-1 text-xs font-bold text-rose-600">
                        ⚠️ {errMsg}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCraft(recipe)}
                  disabled={!canCraft || isPendingThis || isPending}
                  className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-black text-white shadow transition active:scale-[0.98] ${
                    canCraft && !isPendingThis
                      ? "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:brightness-110"
                      : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
                  }`}
                >
                  {isPendingThis
                    ? "⚙️ つくっています…"
                    : canCraft
                    ? `⚙️ ${recipe.name} を つくる！`
                    : "そざいが たりない…"}
                </button>
              </div>
            );
          })}
        </div>

        <Link
          href={portalHref}
          className="block text-center text-sm font-bold text-amber-600 underline"
        >
          ← ポータルへ もどる
        </Link>
      </div>

      {/* トースト */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full px-6 py-3 text-sm font-extrabold text-white shadow-xl transition ${
            toast.ok ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
