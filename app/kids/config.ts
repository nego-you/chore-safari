// /kids 配下で共有する設定値。
// "use server" の actions.ts からは async 関数以外を export できないため、
// 定数はここに分離してサーバ/クライアント双方から import できるようにしておく。

export const GACHA_COST = 100;

// クレーンゲームの料金。ガチャより高め＝高級アイテムが出る仕組み。
export const CRANE_COST = 100;

// ─────────────────────────────────────────────────────────────
// 一本道化リフォーム（2026-06-12 / docs/DESIGN_PRINCIPLES.md 準拠）
// ─────────────────────────────────────────────────────────────

// コインで買える基本罠（お手伝い → コイン → 罠 → 図鑑 の原則ルート）。
export const TRAP_COST = 30;
export const SHOP_TRAP_TOOL_ID = "pitfall";

// 罠を仕掛けられる1日の上限回数（アクティブ狩りの HUNT_DAILY_LIMIT=3 とは別カウント）。
export const TRAP_DAILY_LIMIT = 3;

// クエスト申請の1日の上限回数（うんぱんミッション含む全カテゴリ合算）。
export const QUEST_DAILY_SUBMIT_LIMIT = 10;

// 毎日無料でもらえる罠（pitfall）の枠。0コインでも必ず罠を仕掛けられる保険。
// JST で日付が変わるたび、pitfall の所持数を最低この数まで底上げする（積み上がり防止）。
// 設置回数の上限（TRAP_DAILY_LIMIT）は別管理なので、無料枠を増やしても上限3は不変。
export const FREE_TRAP_PER_DAY = 1;
export const FREE_TRAP_TOOL_ID = "pitfall";

// ─────────────────────────────────────────────────────────────
// ワナづくり（まよいの森内）：集めた素材／パーツ → 罠(UserTool) のレシピ。
//   source="material" … クレーン素材（GameInventoryItem／Zustand ミラー・本人が単一書き手）。
//                        消費はクライアント側 consumeInventory で行い、サーバは付与のみ。
//   source="part"     … ガチャの罠パーツ（SharedInventoryItem・サーバ専用）。
//                        消費＋付与をサーバのトランザクションでアトミックに行う。
//   ※ itemId の "wood" は素材(きのえだ)とガチャパーツ(きのいた)で別テーブルのため衝突しない。
//     part レシピでは "wood" を使わず rope/net/sturdy_trap/hunter_net のみ使う。
// ─────────────────────────────────────────────────────────────
export type TrapRecipeIngredient = {
  itemId: string;
  name: string;
  emoji: string;
  qty: number;
};
export type TrapRecipe = {
  id: string;
  source: "material" | "part";
  outputToolId: string;
  outputName: string;
  outputEmoji: string;
  rare?: boolean; // cage_trap / leghold は SSR 出現率アップの「レア罠」
  ingredients: TrapRecipeIngredient[];
};

export const TRAP_RECIPES: readonly TrapRecipe[] = [
  // ── クレーン素材から（クライアントで消費）──
  {
    id: "mat_pitfall",
    source: "material",
    outputToolId: "pitfall",
    outputName: "にくいり おとしあな",
    outputEmoji: "🕳️",
    ingredients: [
      { itemId: "wood", name: "きのえだ", emoji: "🪵", qty: 1 },
      { itemId: "stone", name: "いし", emoji: "🪨", qty: 1 },
    ],
  },
  {
    id: "mat_leghold",
    source: "material",
    outputToolId: "leghold",
    outputName: "バネワナ（トラバサミ）",
    outputEmoji: "🪤",
    rare: true,
    ingredients: [
      { itemId: "iron", name: "てつ", emoji: "🔩", qty: 1 },
      { itemId: "thread", name: "いと", emoji: "🧶", qty: 1 },
    ],
  },
  // ── ガチャの罠パーツから（サーバでアトミック消費）──
  {
    id: "part_snare",
    source: "part",
    outputToolId: "snare_net",
    outputName: "さかないり あみワナ",
    outputEmoji: "🕸️",
    ingredients: [
      { itemId: "rope", name: "ロープ", emoji: "🪢", qty: 2 },
      { itemId: "net", name: "あみ", emoji: "🥅", qty: 1 },
    ],
  },
  {
    id: "part_leghold",
    source: "part",
    outputToolId: "leghold",
    outputName: "バネワナ（トラバサミ）",
    outputEmoji: "🪤",
    rare: true,
    ingredients: [
      { itemId: "sturdy_trap", name: "じょうぶなワナ", emoji: "🧰", qty: 1 },
    ],
  },
  {
    id: "part_cage",
    source: "part",
    outputToolId: "cage_trap",
    outputName: "カゴわな",
    outputEmoji: "🧺",
    rare: true,
    ingredients: [
      { itemId: "hunter_net", name: "ハンターネット", emoji: "🕸️", qty: 1 },
    ],
  },
];

// ワールドマップから隠す施設ピン（プログレッシブ・ディスクロージャー）。
// コード・ページ自体は残置しており、ここから ID を外せばすぐ復活できる。
export const HIDDEN_PIN_IDS: readonly string[] = [
  "craft",   // クラフト工房（画面内完結の作業系）
  "farm",    // 農場
  "ranch",   // 牧場
  "zoo",     // 動物園
  "race",    // カオスレース
  "arcade",  // ゲームセンター（クレーン/早押し/スロット）
  "flow",    // ながれ可視化（一本道化により不要）
];
