"use client";

// /kids/safari のクライアント本体。
// 1) どの子か（URL の ?kid= で初期化、未指定なら選択画面）
// 2) わな・エサを えらぶ → たんけんする
// 3) 捕獲ポップアップ + かぞくのどうぶつずかん

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { exploreSafari } from "../actions";

type KidLite = { id: string; name: string; coinBalance: number };
type Inv = {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  itemType: "FOOD" | "TRAP_PART";
};
type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
type Animal = {
  id: string;
  animalId: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  description: string;
  imageUrl: string | null;
};
type CatchEntry = {
  id: string;
  animal: Animal;
  caughtBy: { id: string; name: string };
  caughtAt: string; // ISO
};

type Props = {
  initialKidId: string | null;
  kids: KidLite[];
  inventory: Inv[];
  catches: CatchEntry[];
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "ふつう",
  RARE: "レア",
  EPIC: "すごレア",
  LEGENDARY: "でんせつ",
};

const RARITY_STYLE: Record<Rarity, { bg: string; text: string; ring: string }> =
  {
    COMMON: {
      bg: "bg-slate-100",
      text: "text-slate-700",
      ring: "ring-slate-300",
    },
    RARE: {
      bg: "bg-sky-100",
      text: "text-sky-700",
      ring: "ring-sky-300",
    },
    EPIC: {
      bg: "bg-fuchsia-100",
      text: "text-fuchsia-700",
      ring: "ring-fuchsia-300",
    },
    LEGENDARY: {
      bg: "bg-gradient-to-br from-yellow-200 to-amber-300",
      text: "text-amber-900",
      ring: "ring-amber-400",
    },
  };

function NameRuby({ name }: { name: string }) {
  const yomi = NAME_READING[name];
  if (!yomi) return <>{name}</>;
  return (
    <ruby>
      {name}
      <rt className="text-[0.4em] tracking-widest">{yomi}</rt>
    </ruby>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export function SafariClient({
  initialKidId,
  kids,
  inventory,
  catches,
}: Props) {
  const [kidId, setKidId] = useState<string | null>(initialKidId);
  const [inv, setInv] = useState<Inv[]>(inventory);
  const [catchList, setCatchList] = useState<CatchEntry[]>(catches);

  const foods = useMemo(
    () => inv.filter((i) => i.itemType === "FOOD"),
    [inv],
  );
  const traps = useMemo(
    () => inv.filter((i) => i.itemType === "TRAP_PART"),
    [inv],
  );

  const firstAvailableFood = foods.find((f) => f.quantity > 0)?.itemId ?? "";
  const firstAvailableTrap = traps.find((t) => t.quantity > 0)?.itemId ?? "";

  const [trapId, setTrapId] = useState<string>(firstAvailableTrap);
  const [foodId, setFoodId] = useState<string>(firstAvailableFood);

  // 在庫が変わって今選んでいるアイテムが 0 になったら、別の在庫アイテムに切り替える。
  useEffect(() => {
    if (!trapId || (inv.find((i) => i.itemId === trapId)?.quantity ?? 0) <= 0) {
      const next = inv.find((i) => i.itemType === "TRAP_PART" && i.quantity > 0);
      setTrapId(next?.itemId ?? "");
    }
    if (!foodId || (inv.find((i) => i.itemId === foodId)?.quantity ?? 0) <= 0) {
      const next = inv.find((i) => i.itemType === "FOOD" && i.quantity > 0);
      setFoodId(next?.itemId ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv]);

  // props が更新（revalidate 経由）されたら state を同期。
  useEffect(() => setInv(inventory), [inventory]);
  useEffect(() => setCatchList(catches), [catches]);

  const [popup, setPopup] = useState<Animal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!popup) return;
    const id = setTimeout(() => setPopup(null), 4000);
    return () => clearTimeout(id);
  }, [popup]);

  const selectedKid = kidId ? kids.find((k) => k.id === kidId) ?? null : null;

  const canExplore =
    !!selectedKid &&
    !!trapId &&
    !!foodId &&
    !isPending &&
    (inv.find((i) => i.itemId === trapId)?.quantity ?? 0) > 0 &&
    (inv.find((i) => i.itemId === foodId)?.quantity ?? 0) > 0;

  const handleExplore = () => {
    if (!selectedKid) return;
    setError(null);
    startTransition(async () => {
      const result = await exploreSafari(selectedKid.id, trapId, foodId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      // 在庫を更新
      setInv((prev) =>
        prev.map((i) => {
          const u = result.updatedInventory.find(
            (x) => x.itemId === i.itemId,
          );
          return u ? { ...i, quantity: u.quantity } : i;
        }),
      );
      // 図鑑にエントリを追加（先頭）
      setCatchList((prev) => [
        {
          id: `tmp-${Date.now()}`,
          animal: result.animal,
          caughtBy: { id: selectedKid.id, name: result.caughtByName },
          caughtAt: result.caughtAt,
        },
        ...prev,
      ]);
      setPopup(result.animal);
    });
  };

  // ── キッド未選択 ─────────────────────────────
  if (!selectedKid) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-100 via-yellow-50 to-sky-100 px-4 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-3xl">🌿🦁🌿</p>
          <h1 className="mt-2 text-3xl font-extrabold text-emerald-800 sm:text-4xl">
            だれが サファリへ いく？
          </h1>
          <p className="mt-3 text-sm text-emerald-700/80">
            あそぶこを えらんでね
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {kids.map((kid) => (
              <button
                key={kid.id}
                type="button"
                onClick={() => setKidId(kid.id)}
                className="rounded-3xl bg-white px-6 py-6 text-2xl font-extrabold text-emerald-800 shadow-lg ring-2 ring-emerald-200 transition hover:-translate-y-1 hover:ring-emerald-400 active:translate-y-0"
              >
                <NameRuby name={kid.name} />
              </button>
            ))}
          </div>

          <Link
            href="/kids"
            className="mt-10 inline-block text-sm font-bold text-emerald-700 underline"
          >
            ← こども ポータルへ もどる
          </Link>
        </div>
      </main>
    );
  }

  // ── 探索画面 ────────────────────────────────
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-100 via-yellow-50 to-sky-100 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link
            href={`/kids?kid=${selectedKid.id}`}
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-emerald-700 shadow ring-1 ring-emerald-200 transition hover:bg-white"
          >
            ← ポータルへ
          </Link>
          <p className="text-sm font-bold text-emerald-700/80">サファリ たんけん</p>
        </div>

        {/* 探索パネル */}
        <section className="rounded-[2rem] bg-gradient-to-br from-emerald-300 via-lime-200 to-yellow-200 p-1 shadow-xl">
          <div className="rounded-[1.75rem] bg-white/95 p-6">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-black text-emerald-800 sm:text-3xl">
              <span aria-hidden>🌳</span> サファリへ いこう！ <span aria-hidden>🌳</span>
            </h1>
            <p className="mt-1 text-center text-sm text-emerald-700/80">
              <NameRuby name={selectedKid.name} /> ちゃんが たんけん するよ
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* わな */}
              <label className="block">
                <span className="block text-sm font-extrabold text-amber-800">
                  🛠️ つかう わな
                </span>
                <select
                  value={trapId}
                  onChange={(e) => setTrapId(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-base font-bold text-amber-900 focus:border-amber-500 focus:outline-none"
                >
                  {traps.length === 0 && <option value="">わなが ないよ</option>}
                  {traps.map((t) => (
                    <option
                      key={t.itemId}
                      value={t.itemId}
                      disabled={t.quantity <= 0}
                    >
                      {t.itemName} ×{t.quantity}
                    </option>
                  ))}
                </select>
              </label>

              {/* エサ */}
              <label className="block">
                <span className="block text-sm font-extrabold text-rose-700">
                  🍱 つかう エサ
                </span>
                <select
                  value={foodId}
                  onChange={(e) => setFoodId(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-base font-bold text-rose-900 focus:border-rose-500 focus:outline-none"
                >
                  {foods.length === 0 && <option value="">エサが ないよ</option>}
                  {foods.map((f) => (
                    <option
                      key={f.itemId}
                      value={f.itemId}
                      disabled={f.quantity <= 0}
                    >
                      {f.itemName} ×{f.quantity}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={handleExplore}
              disabled={!canExplore}
              className={`mt-6 w-full rounded-2xl px-4 py-5 text-2xl font-black tracking-wide text-white shadow-lg transition active:scale-[0.98] ${
                canExplore
                  ? "bg-gradient-to-r from-emerald-500 via-lime-500 to-yellow-500 hover:brightness-110"
                  : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
              }`}
            >
              {isPending ? "たんけんちゅう…" : "🌿 たんけんする！ 🌿"}
            </button>

            {error && (
              <p className="mt-3 text-center text-sm font-bold text-rose-500">
                {error}
              </p>
            )}
            <p className="mt-3 text-center text-xs text-emerald-700/70">
              わな と エサ を 1こずつ つかって どうぶつを さがすよ
            </p>
          </div>
        </section>

        {/* 図鑑 */}
        <Zukan catches={catchList} />

        <p className="text-center text-xs text-emerald-700/70">
          ✨ つかまえた どうぶつは ずっと きろくに のこるよ ✨
        </p>
      </div>

      {popup && <SafariPopup animal={popup} onClose={() => setPopup(null)} />}
    </main>
  );
}

// ───────────── どうぶつずかん ─────────────
function Zukan({ catches }: { catches: CatchEntry[] }) {
  // animalId ごとにまとめる：合計捕獲数 / もっとも最近 / すべての捕獲者
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        animal: Animal;
        total: number;
        latest: CatchEntry;
        history: CatchEntry[];
      }
    >();
    for (const c of catches) {
      const key = c.animal.animalId;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { animal: c.animal, total: 1, latest: c, history: [c] });
      } else {
        cur.total += 1;
        cur.history.push(c);
        if (c.caughtAt > cur.latest.caughtAt) cur.latest = c;
      }
    }
    // rarity の希少さ順 + 最新捕獲時刻でソート
    const rarityRank: Record<Rarity, number> = {
      LEGENDARY: 0,
      EPIC: 1,
      RARE: 2,
      COMMON: 3,
    };
    return [...map.values()].sort((a, b) => {
      const dr = rarityRank[a.animal.rarity] - rarityRank[b.animal.rarity];
      if (dr !== 0) return dr;
      return b.latest.caughtAt.localeCompare(a.latest.caughtAt);
    });
  }, [catches]);

  return (
    <section
      aria-labelledby="zukan-heading"
      className="rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-emerald-200 backdrop-blur"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="text-3xl" aria-hidden>📖</span>
        <div>
          <h2
            id="zukan-heading"
            className="text-2xl font-extrabold text-emerald-800"
          >
            かぞくの どうぶつずかん
          </h2>
          <p className="text-xs text-emerald-700/80">
            これまでに つかまえた どうぶつたち（{catches.length} ひき）
          </p>
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-2xl bg-emerald-50 p-4 text-center text-sm text-emerald-700">
          まだ なにも つかまえてないよ。
          <br />
          たんけんに でかけよう！
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {grouped.map((g) => {
            const style = RARITY_STYLE[g.animal.rarity];
            return (
              <li
                key={g.animal.animalId}
                className={`relative rounded-2xl ${style.bg} p-4 ring-2 ${style.ring}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-5xl drop-shadow" aria-hidden>
                    {g.animal.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-lg font-black ${style.text}`}>
                        {g.animal.name}
                      </p>
                      <span
                        className={`rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-extrabold ${style.text}`}
                      >
                        {RARITY_LABEL[g.animal.rarity]}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs ${style.text} opacity-80`}>
                      {g.animal.description}
                    </p>
                    <p className={`mt-2 text-xs font-bold ${style.text}`}>
                      ぜんぶで <span className="font-mono">×{g.total}</span> ひき
                    </p>
                    <p className={`mt-1 text-[11px] ${style.text} opacity-80`}>
                      さいきん：
                      <NameRuby name={g.latest.caughtBy.name} />
                      が {formatDate(g.latest.caughtAt)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ───────────── 捕獲ポップアップ ─────────────
function SafariPopup({
  animal,
  onClose,
}: {
  animal: Animal;
  onClose: () => void;
}) {
  const style = RARITY_STYLE[animal.rarity];
  const isLegendary = animal.rarity === "LEGENDARY";
  return (
    <div
      role="dialog"
      aria-live="polite"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div
        className={`mx-4 max-w-sm rounded-[2rem] p-1 shadow-2xl ${
          isLegendary
            ? "bg-gradient-to-br from-yellow-300 via-amber-300 to-pink-300"
            : "bg-gradient-to-br from-emerald-300 via-lime-200 to-sky-200"
        }`}
      >
        <div className="rounded-[1.7rem] bg-white px-6 py-10 text-center">
          <p
            className={`text-sm font-extrabold tracking-widest ${
              isLegendary ? "text-amber-600 animate-pulse" : "text-emerald-600"
            }`}
          >
            {isLegendary ? "✨ でんせつ ✨" : "🌟 ゲット 🌟"}
          </p>
          <div className="relative my-4 flex items-center justify-center">
            <span aria-hidden className="absolute text-9xl opacity-20 blur-md">
              {animal.emoji}
            </span>
            <span
              aria-hidden
              className="relative text-8xl drop-shadow-lg animate-bounce"
            >
              {animal.emoji}
            </span>
          </div>
          <p className={`text-3xl font-black ${style.text}`}>{animal.name}</p>
          <p
            className={`mt-1 inline-block rounded-full ${style.bg} px-3 py-0.5 text-xs font-extrabold ${style.text} ring-1 ${style.ring}`}
          >
            {RARITY_LABEL[animal.rarity]}
          </p>
          <p className="mt-3 text-sm text-slate-600">{animal.description}</p>
          <p className="mt-4 text-base font-bold text-emerald-700">
            を つかまえた！
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-full bg-emerald-500 px-6 py-2 text-sm font-extrabold text-white shadow transition hover:brightness-110"
          >
            やったー！
          </button>
        </div>
      </div>
    </div>
  );
}
