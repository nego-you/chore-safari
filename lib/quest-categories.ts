// クエストカテゴリの定義・正規化・表示メタを集約する真の定義元。
//
// `actions.ts` 側はサーバアクション専用ファイル（"use server"）のため、
// 非関数の export（配列定数や型のランタイム値）はクライアントから普通に
// import できない（Next.js が Server Action 参照に変換してしまう）。
// そのため値定義は必ずこのファイルに置く。

//   CHORE : おてつだい（オレンジ／ピンク）
//   STUDY : おべんきょう（青／緑）
//   LIFE  : せいかつ（黄／薄黄）

export const QUEST_CATEGORIES = ["CHORE", "STUDY", "LIFE"] as const;
export type QuestCategory = (typeof QUEST_CATEGORIES)[number];
export const QUEST_CATEGORY_DEFAULT: QuestCategory = "CHORE";

// DB の生値（String 列）を許容値に丸める。許容値外や非文字列は CHORE に倒す。
export function normalizeCategory(value: unknown): QuestCategory {
  if (typeof value !== "string") return QUEST_CATEGORY_DEFAULT;
  const upper = value.trim().toUpperCase();
  return (QUEST_CATEGORIES as readonly string[]).includes(upper)
    ? (upper as QuestCategory)
    : QUEST_CATEGORY_DEFAULT;
}

export type QuestCategoryMeta = {
  key: QuestCategory;
  shortLabel: string; // 親画面のバッジやセレクトに使う短いラベル
  kidsLabel: string;  // 子供画面のセクション見出しに使う、ひらがな多めのラベル
  emoji: string;
  // 親画面の一覧バッジ用クラス（背景・文字・枠）
  badgeClass: string;
  // 親画面のフォームでラジオボタンの「選択中」を示すクラス
  formActiveClass: string;
  // 子供画面のセクション全体（カードグループ）の背景クラス
  kidsSectionBgClass: string;
  // 子供画面のセクション見出しのクラス
  kidsHeadingClass: string;
};

const META: Record<QuestCategory, QuestCategoryMeta> = {
  CHORE: {
    key: "CHORE",
    shortLabel: "おてつだい",
    kidsLabel: "おてつだい",
    emoji: "🧹",
    badgeClass:
      "bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/40",
    formActiveClass:
      "bg-orange-500/20 text-orange-100 ring-2 ring-orange-400",
    kidsSectionBgClass:
      "bg-gradient-to-br from-orange-100 via-amber-100 to-pink-100 ring-2 ring-orange-200",
    kidsHeadingClass: "text-orange-700",
  },
  STUDY: {
    key: "STUDY",
    shortLabel: "おべんきょう",
    kidsLabel: "おべんきょう",
    emoji: "📚",
    badgeClass:
      "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/40",
    formActiveClass:
      "bg-sky-500/20 text-sky-100 ring-2 ring-sky-400",
    kidsSectionBgClass:
      "bg-gradient-to-br from-sky-100 via-emerald-50 to-emerald-100 ring-2 ring-sky-200",
    kidsHeadingClass: "text-sky-700",
  },
  LIFE: {
    key: "LIFE",
    shortLabel: "せいかつ",
    kidsLabel: "せいかつ",
    emoji: "☀️",
    badgeClass:
      "bg-yellow-400/20 text-yellow-100 ring-1 ring-yellow-400/40",
    formActiveClass:
      "bg-yellow-400/25 text-yellow-50 ring-2 ring-yellow-300",
    kidsSectionBgClass:
      "bg-gradient-to-br from-yellow-100 via-amber-100 to-yellow-50 ring-2 ring-yellow-200",
    kidsHeadingClass: "text-amber-700",
  },
};

export function questCategoryMeta(key: QuestCategory): QuestCategoryMeta {
  return META[key];
}

// 子供画面で表示する並び順。おべんきょう→おてつだい→せいかつ。
// （プロンプトの並び順に合わせている。必要ならここを差し替えるだけで全体が変わる。）
export const QUEST_CATEGORY_ORDER: readonly QuestCategory[] = [
  "STUDY",
  "CHORE",
  "LIFE",
] as const;
