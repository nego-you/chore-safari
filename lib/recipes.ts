// Chore Safari クラフトレシピ（BOM = Bill of Materials）。
// 2026-05-18 大改修: 素材（UserMaterial）→ 道具（UserTool）方式に全面刷新。
//   "1つの完成道具 = 複数の素材 × 必要数" を宣言的に定義する。
//   サーバアクション (craftItem) とクライアント UI の双方が同じ定義を参照する。

export type RecipeMaterial = {
  materialId: string;   // Material.materialId と一致すること
  materialName: string; // 表示用キャッシュ
  emoji: string;
  quantity: number;     // 1回のクラフトで消費する個数
};

export type Recipe = {
  id: string;                    // レシピ識別子 = 完成道具の toolId
  name: string;                  // 完成品の表示名
  emoji: string;                 // 完成品の見た目絵文字
  description: string;           // カードに出す説明文
  materials: RecipeMaterial[];   // 必要素材
  resultToolId: string;          // 完成品の Tool.toolId
  resultToolName: string;        // 完成品 name
  resultToolType: "TRAP" | "BOW" | "SPEAR" | "WEAPON";
  resultQuantity: number;        // 1回のクラフトでできる個数（既定1）
};

export const RECIPES: Recipe[] = [
  // ──────── TRAP（パッシブ罠）× 6 ────────
  {
    id: "pitfall",
    name: "にくいり おとしあな",
    emoji: "🕳️",
    description: "ふかい アナの なかに おにくを おいて どうぶつを おびきよせる わな！",
    materials: [
      { materialId: "wood_branch", materialName: "きのえだ", emoji: "🪵", quantity: 2 },
      { materialId: "stone",       materialName: "いし",     emoji: "🪨", quantity: 1 },
    ],
    resultToolId: "pitfall",
    resultToolName: "にくいり おとしあな",
    resultToolType: "TRAP",
    resultQuantity: 1,
  },
  {
    id: "leghold",
    name: "バネワナ（トラバサミ）",
    emoji: "🪤",
    description: "バネで あしを はさむ わな。ちゅうがたの どうぶつを ぴたっと つかまえるよ！",
    materials: [
      { materialId: "sturdy_rope",  materialName: "じょうぶな イト", emoji: "🪢", quantity: 2 },
      { materialId: "iron_shard",   materialName: "てつの かけら",   emoji: "⚙️", quantity: 1 },
    ],
    resultToolId: "leghold",
    resultToolName: "バネワナ（トラバサミ）",
    resultToolType: "TRAP",
    resultQuantity: 1,
  },
  {
    id: "snare_net",
    name: "さかないり あみワナ",
    emoji: "🕸️",
    description: "うえから バサッと おとす あみワナ。さかなの においで おびきよせるよ。",
    materials: [
      { materialId: "sturdy_rope",  materialName: "じょうぶな イト", emoji: "🪢", quantity: 2 },
      { materialId: "wood_branch",  materialName: "きのえだ",         emoji: "🪵", quantity: 1 },
    ],
    resultToolId: "snare_net",
    resultToolName: "さかないり あみワナ",
    resultToolType: "TRAP",
    resultQuantity: 1,
  },
  {
    id: "deadfall_trap",
    name: "おもりわな（デッドフォール）",
    emoji: "🪨",
    description: "おもい いわが どさっと おちてくる わな。えさを つつくと おちるよ！",
    materials: [
      { materialId: "stone",        materialName: "いし",     emoji: "🪨", quantity: 3 },
      { materialId: "wood_branch",  materialName: "きのえだ", emoji: "🪵", quantity: 1 },
    ],
    resultToolId: "deadfall_trap",
    resultToolName: "おもりわな（デッドフォール）",
    resultToolType: "TRAP",
    resultQuantity: 1,
  },
  {
    id: "bamboo_trap",
    name: "たけスプリングわな",
    emoji: "🎋",
    description: "たけのバネで ぴょーんと つかまえる わな。かるくて じょうぶ！",
    materials: [
      { materialId: "wood_branch",  materialName: "きのえだ",         emoji: "🪵", quantity: 3 },
      { materialId: "sturdy_rope",  materialName: "じょうぶな イト", emoji: "🪢", quantity: 1 },
    ],
    resultToolId: "bamboo_trap",
    resultToolName: "たけスプリングわな",
    resultToolType: "TRAP",
    resultQuantity: 1,
  },
  {
    id: "cage_trap",
    name: "カゴわな",
    emoji: "🧺",
    description: "はいると ドアが しまる カゴワナ。どうぶつを きずつけずに つかまえるよ！",
    materials: [
      { materialId: "wood_branch",  materialName: "きのえだ",         emoji: "🪵", quantity: 2 },
      { materialId: "iron_shard",   materialName: "てつの かけら",   emoji: "⚙️", quantity: 2 },
    ],
    resultToolId: "cage_trap",
    resultToolName: "カゴわな",
    resultToolType: "TRAP",
    resultQuantity: 1,
  },

  // ──────── SPEAR（投槍器）× 4 ────────
  {
    id: "atlatl",
    name: "アトラトル（とうそうき）",
    emoji: "🏹",
    description: "てこの ちからで やりを ものすごい いきおいで とばす どうぐ！",
    materials: [
      { materialId: "wood_branch", materialName: "きのえだ", emoji: "🪵", quantity: 2 },
      { materialId: "stone",       materialName: "いし",     emoji: "🪨", quantity: 1 },
    ],
    resultToolId: "atlatl",
    resultToolName: "アトラトル（とうそうき）",
    resultToolType: "SPEAR",
    resultQuantity: 1,
  },
  {
    id: "harpoon",
    name: "もり（ぎょか用銛）",
    emoji: "🔱",
    description: "かえしつきの さきで うみの いきものも にがさない ぶき！",
    materials: [
      { materialId: "iron_shard",  materialName: "てつの かけら",   emoji: "⚙️", quantity: 2 },
      { materialId: "sturdy_rope", materialName: "じょうぶな イト", emoji: "🪢", quantity: 1 },
    ],
    resultToolId: "harpoon",
    resultToolName: "もり（ぎょか用銛）",
    resultToolType: "SPEAR",
    resultQuantity: 1,
  },
  {
    id: "javelin",
    name: "やり（ジャベリン）",
    emoji: "🗡️",
    description: "まっすぐ とおくへ なげる シンプルな ぶき。どんな どうぶつも ねらえるよ。",
    materials: [
      { materialId: "wood_branch", materialName: "きのえだ", emoji: "🪵", quantity: 3 },
      { materialId: "stone",       materialName: "いし",     emoji: "🪨", quantity: 1 },
    ],
    resultToolId: "javelin",
    resultToolName: "やり（ジャベリン）",
    resultToolType: "SPEAR",
    resultQuantity: 1,
  },
  {
    id: "blowgun",
    name: "ふきや（吹き矢）",
    emoji: "💨",
    description: "おとを たてずに しずかに ねらえる ぶき。フッ！と ふくだけ！",
    materials: [
      { materialId: "wood_branch",  materialName: "きのえだ",         emoji: "🪵", quantity: 2 },
      { materialId: "sturdy_rope",  materialName: "じょうぶな イト", emoji: "🪢", quantity: 1 },
    ],
    resultToolId: "blowgun",
    resultToolName: "ふきや（吹き矢）",
    resultToolType: "SPEAR",
    resultQuantity: 1,
  },

  // ──────── BOW（弓）× 3 ────────
  {
    id: "longbow",
    name: "ながゆみ（ロングボウ）",
    emoji: "🏹",
    description: "ながい もくせいの ゆみ。200m さきも ねらえるよ！",
    materials: [
      { materialId: "wood_branch",  materialName: "きのえだ",         emoji: "🪵", quantity: 3 },
      { materialId: "sturdy_rope",  materialName: "じょうぶな イト", emoji: "🪢", quantity: 2 },
    ],
    resultToolId: "longbow",
    resultToolName: "ながゆみ（ロングボウ）",
    resultToolType: "BOW",
    resultQuantity: 1,
  },
  {
    id: "crossbow",
    name: "クロスボウ（いしゆみ）",
    emoji: "⚔️",
    description: "引き金を ひくだけで ほっしゃできる ちから いらずの とびどうぐ！",
    materials: [
      { materialId: "wood_branch",  materialName: "きのえだ",         emoji: "🪵", quantity: 2 },
      { materialId: "iron_shard",   materialName: "てつの かけら",   emoji: "⚙️", quantity: 2 },
      { materialId: "sturdy_rope",  materialName: "じょうぶな イト", emoji: "🪢", quantity: 1 },
    ],
    resultToolId: "crossbow",
    resultToolName: "クロスボウ（いしゆみ）",
    resultToolType: "BOW",
    resultQuantity: 1,
  },
  {
    id: "compound_bow",
    name: "ふくごうゆみ（コンパウンドボウ）",
    emoji: "🎯",
    description: "かっしゃと ケーブルで かるく ひける、もっとも つよい ゆみ！",
    materials: [
      { materialId: "wood_branch",  materialName: "きのえだ",         emoji: "🪵", quantity: 2 },
      { materialId: "iron_shard",   materialName: "てつの かけら",   emoji: "⚙️", quantity: 3 },
      { materialId: "sturdy_rope",  materialName: "じょうぶな イト", emoji: "🪢", quantity: 2 },
    ],
    resultToolId: "compound_bow",
    resultToolName: "ふくごうゆみ（コンパウンドボウ）",
    resultToolType: "BOW",
    resultQuantity: 1,
  },

  // ──────── WEAPON（刃物・銃）× 4 ────────
  {
    id: "flint_knife",
    name: "せっきの ナイフ",
    emoji: "🪨",
    description: "いしを わって つくった おおむかしの ナイフ！ けものを さばくのに つかうよ。",
    materials: [
      { materialId: "stone", materialName: "いし", emoji: "🪨", quantity: 3 },
    ],
    resultToolId: "flint_knife",
    resultToolName: "せっきの ナイフ",
    resultToolType: "WEAPON",
    resultQuantity: 1,
  },
  {
    id: "survival_knife",
    name: "サバイバルナイフ",
    emoji: "🔪",
    description: "ギザギザの は で き も きれる げんだいの ナイフ！ えものに すばやく ちかづくよ。",
    materials: [
      { materialId: "stone",      materialName: "いし",           emoji: "🪨", quantity: 1 },
      { materialId: "iron_shard", materialName: "てつの かけら", emoji: "⚙️", quantity: 2 },
    ],
    resultToolId: "survival_knife",
    resultToolName: "サバイバルナイフ",
    resultToolType: "WEAPON",
    resultQuantity: 1,
  },
  {
    id: "arquebus",
    name: "むかしの じゅう（ひなわじゅう）",
    emoji: "🔫",
    description: "かやくの ちからで タマを とばす ぶき。うつまでに じかんが かかるけど とても つよい！",
    materials: [
      { materialId: "iron_shard",  materialName: "てつの かけら", emoji: "⚙️", quantity: 3 },
      { materialId: "gunpowder",   materialName: "かやく",         emoji: "💥", quantity: 2 },
      { materialId: "wood_branch", materialName: "きのえだ",       emoji: "🪵", quantity: 1 },
    ],
    resultToolId: "arquebus",
    resultToolName: "むかしの じゅう（ひなわじゅう）",
    resultToolType: "WEAPON",
    resultQuantity: 1,
  },
  {
    id: "hunting_rifle",
    name: "ハンターの じゅう（りょうじゅう）",
    emoji: "🎯",
    description: "とおくの えものを せいかくに ねらえる すごい じゅう！",
    materials: [
      { materialId: "iron_shard",  materialName: "てつの かけら", emoji: "⚙️", quantity: 4 },
      { materialId: "gunpowder",   materialName: "かやく",         emoji: "💥", quantity: 3 },
      { materialId: "wood_branch", materialName: "きのえだ",       emoji: "🪵", quantity: 1 },
    ],
    resultToolId: "hunting_rifle",
    resultToolName: "ハンターの じゅう（りょうじゅう）",
    resultToolType: "WEAPON",
    resultQuantity: 1,
  },
];

// レシピで登場する materialId の一覧（クラフトページのデータ取得に使う）。
export function collectMaterialIds(): string[] {
  const set = new Set<string>();
  for (const r of RECIPES) {
    for (const m of r.materials) set.add(m.materialId);
  }
  return [...set];
}

export function findRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

// 後方互換エイリアス（旧コードが collectMaterialItemIds() を呼ぶ場合）。
export const collectMaterialItemIds = collectMaterialIds;
