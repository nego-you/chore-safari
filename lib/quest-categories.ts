// クエストカテゴリの表示メタ。
// 値定義（許容値・正規化・バリデーション）は app/bank/actions.ts 側に置き、
// このファイルはあくまで「画面でどう見せるか」だけを集約する。
//
//   CHORE : おてつだい（オレンジ／ピンク）
//   STUDY : おべんきょう（青／緑）
//   LIFE  : せいかつ（黄／薄黄）

import { type QuestCategory, QUEST_CATEGORIES } from "@/app/bank/actions";

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

export { QUEST_CATEGORIES };
export type { QuestCategory };
