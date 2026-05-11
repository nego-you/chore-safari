// Chore Safari - クラフト レシピ（BOM）定義。
//
// サーバアクション (`craftItem`) と /kids/craft の UI で共有する純データ。
// material_item_ids には shared_inventory.item_id を指定する。
// result_item_id も shared_inventory.item_id にマップされ、初回クラフト時に
// upsert で新規レコードとして作成される（itemType は result.itemType を使用）。

export type ItemType = "FOOD" | "TRAP_PART";

export type RecipeMaterial = {
  itemId: string;
  itemName: string;
  quantity: number;
};

export type RecipeResult = {
  itemId: string;
  itemName: string;
  itemType: ItemType;
  // 1 回のクラフトで生まれる数（基本は 1）。
  quantity: number;
  emoji: string;
};

export type Recipe = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  materials: RecipeMaterial[];
  result: RecipeResult;
};

// 公開レシピ一覧。順番がそのまま UI 表示順。
export const RECIPES: Recipe[] = [
  {
    id: "strong_trap",
    name: "じょうぶなワナ",
    description: "きのいたと ロープで がっしりさせた、まちぶせ用の ワナ",
    emoji: "🪤",
    materials: [
      { itemId: "wood", itemName: "きのいた", quantity: 2 },
      { itemId: "rope", itemName: "ロープ", quantity: 1 },
    ],
    result: {
      itemId: "strong_trap",
      itemName: "じょうぶなワナ",
      itemType: "TRAP_PART",
      quantity: 1,
      emoji: "🪤",
    },
  },
  {
    id: "premium_food",
    name: "とっきゅうのエサ",
    description: "おにくと きのみを まぜた、どうぶつ よびよせ とくべつメニュー",
    emoji: "🍱",
    materials: [
      { itemId: "meat", itemName: "おにく", quantity: 2 },
      { itemId: "berry", itemName: "きのみ", quantity: 1 },
    ],
    result: {
      itemId: "premium_food",
      itemName: "とっきゅうのエサ",
      itemType: "FOOD",
      quantity: 1,
      emoji: "🍱",
    },
  },
  {
    id: "big_net",
    name: "おおきな あみ",
    description: "ロープと あみと きのいたを くみあわせた、おおきな ほかくあみ",
    emoji: "🥅",
    materials: [
      { itemId: "net", itemName: "あみ", quantity: 1 },
      { itemId: "rope", itemName: "ロープ", quantity: 2 },
      { itemId: "wood", itemName: "きのいた", quantity: 1 },
    ],
    result: {
      itemId: "big_net",
      itemName: "おおきな あみ",
      itemType: "TRAP_PART",
      quantity: 1,
      emoji: "🥅",
    },
  },
  {
    id: "fruit_sushi",
    name: "フルーツずし",
    description: "おさかなと きのみで つくった、いつもより すこし たべごたえ ある エサ",
    emoji: "🍣",
    materials: [
      { itemId: "fish", itemName: "おさかな", quantity: 2 },
      { itemId: "berry", itemName: "きのみ", quantity: 1 },
    ],
    result: {
      itemId: "fruit_sushi",
      itemName: "フルーツずし",
      itemType: "FOOD",
      quantity: 1,
      emoji: "🍣",
    },
  },
];

// id → recipe の引き当て用マップ。
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(
  RECIPES.map((r) => [r.id, r]),
);
