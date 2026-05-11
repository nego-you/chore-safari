// Chore Safari クラフトレシピ（BOM = Bill of Materials）。
// "1つの完成品 = 複数の素材アイテム × 必要数" を宣言的に定義する。
// サーバアクション (craftItem) とクライアント UI の双方が同じ定義を参照する。

export type ItemTypeLite = "FOOD" | "TRAP_PART";

export type RecipeMaterial = {
  itemId: string;       // shared_inventory.item_id と一致すること
  itemName: string;     // 表示用キャッシュ
  quantity: number;     // 1回のクラフトで消費する個数
};

export type Recipe = {
  id: string;                       // レシピ識別子（craftItem の引数）
  name: string;                     // 完成品の表示名
  emoji: string;                    // 完成品の見た目絵文字
  description: string;              // カードに出す説明文
  materials: RecipeMaterial[];      // 必要素材
  resultItemId: string;             // 完成品の shared_inventory.item_id
  resultItemName: string;           // 完成品 itemName
  resultItemType: ItemTypeLite;     // 完成品の区分
  resultQuantity: number;           // 1回のクラフトでできる個数（既定1）
};

export const RECIPES: Recipe[] = [
  {
    id: "sturdy_trap",
    name: "じょうぶなワナ",
    emoji: "🪤",
    description: "きのいたとロープを くみあわせた がんじょうな ワナ。おおきな どうぶつにも まけないよ",
    materials: [
      { itemId: "wood", itemName: "きのいた", quantity: 2 },
      { itemId: "rope", itemName: "ロープ", quantity: 1 },
    ],
    resultItemId: "sturdy_trap",
    resultItemName: "じょうぶなワナ",
    resultItemType: "TRAP_PART",
    resultQuantity: 1,
  },
  {
    id: "premium_food",
    name: "とっきゅうのエサ",
    emoji: "🍱",
    description: "おにくに きのみを そえた プレミアム エサ。レアな どうぶつが よりつくかも",
    materials: [
      { itemId: "meat", itemName: "おにく", quantity: 2 },
      { itemId: "berry", itemName: "きのみ", quantity: 1 },
    ],
    resultItemId: "premium_food",
    resultItemName: "とっきゅうのエサ",
    resultItemType: "FOOD",
    resultQuantity: 1,
  },
  {
    id: "hunter_net",
    name: "ハンターネット",
    emoji: "🥅",
    description: "ロープと あみを かさねて つくる おおもの用 ネット",
    materials: [
      { itemId: "rope", itemName: "ロープ", quantity: 2 },
      { itemId: "net", itemName: "あみ", quantity: 1 },
    ],
    resultItemId: "hunter_net",
    resultItemName: "ハンターネット",
    resultItemType: "TRAP_PART",
    resultQuantity: 1,
  },
  {
    id: "mixed_food",
    name: "ミックスごはん",
    emoji: "🍲",
    description: "おさかなと きのみを あわせた えいようまんてんの ごはん",
    materials: [
      { itemId: "fish", itemName: "おさかな", quantity: 1 },
      { itemId: "berry", itemName: "きのみ", quantity: 1 },
    ],
    resultItemId: "mixed_food",
    resultItemName: "ミックスごはん",
    resultItemType: "FOOD",
    resultQuantity: 1,
  },
];

// 素材として登場する itemId 一覧（在庫取得時のクエリ最適化に使う）。
export function collectMaterialItemIds(): string[] {
  const set = new Set<string>();
  for (const r of RECIPES) {
    for (const m of r.materials) set.add(m.itemId);
  }
  return [...set];
}

export function findRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}
