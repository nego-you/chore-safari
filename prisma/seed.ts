// 子供 + 共有インベントリ + Stage / Tool / どうぶつ図鑑マスタの初期データ投入。
//
// 2026-05-17 大規模改修:
//   - Stage（サバンナ・森林・氷河期・深海・恐竜時代・伝説）と
//     Tool（落とし穴・トラバサミ・アトラトル・複合弓 ほか）を追加。
//   - Animal は stageId / habitat / isExtinct を含む 120+ 種を投入。
//   - 全 description は子供向けに ひらがな・カタカナ 中心の 約100字に書き直し。

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ChildSeed = {
  name: string;
  birthDate: string; // YYYY-MM-DD
};

// 生年月日は仮のもの。あとで /bank などから差し替え可能にする予定。
const CHILDREN: ChildSeed[] = [
  { name: "美琴", birthDate: "2018-11-03" },
  { name: "幸仁", birthDate: "2021-03-11" },
  { name: "叶泰", birthDate: "2023-12-19" },
];

type InventorySeed = {
  itemId: string;
  itemName: string;
  itemType: "FOOD" | "TRAP_PART";
  quantity: number;
};

// 共有倉庫の初期アイテム（エサ廃止・罠パーツのみ）。
const INVENTORY: InventorySeed[] = [
  { itemId: "rope",        itemName: "ロープ",         itemType: "TRAP_PART", quantity: 3 },
  { itemId: "wood",        itemName: "きのいた",       itemType: "TRAP_PART", quantity: 2 },
  { itemId: "net",         itemName: "あみ",           itemType: "TRAP_PART", quantity: 1 },
  { itemId: "sturdy_trap", itemName: "じょうぶなワナ", itemType: "TRAP_PART", quantity: 0 },
  { itemId: "hunter_net",  itemName: "ハンターネット", itemType: "TRAP_PART", quantity: 0 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Material マスタ（クレーンゲームドロップ品・クラフト素材）
// ─────────────────────────────────────────────────────────────────────────────
type MaterialSeed = {
  materialId: string;
  name: string;
  emoji: string;
  description: string;
};

const MATERIALS: MaterialSeed[] = [
  {
    materialId: "wood_branch",
    name: "きのえだ",
    emoji: "🪵",
    description: "もりで ひろった じょうぶな えだ。わなや ゆみを つくるのに つかうよ！",
  },
  {
    materialId: "stone",
    name: "いし",
    emoji: "🪨",
    description: "かわらで みつけた するどい いし。ナイフや おもりわなに つかえるよ！",
  },
  {
    materialId: "iron_shard",
    name: "てつの かけら",
    emoji: "⚙️",
    description: "ざっかやで みつけた てつの かけら。じゅうや ナイフを つくるのに ひつようだよ！",
  },
  {
    materialId: "sturdy_rope",
    name: "じょうぶな イト",
    emoji: "🪢",
    description: "ちぎれにくい つよい イト。わなや ゆみの げんに つかうよ！",
  },
  {
    materialId: "gunpowder",
    name: "かやく",
    emoji: "💥",
    description: "じゅうの タマを とばす パワーのもと。あつかいに ちゅうい！",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stage マスタ（生息地カテゴリ）
// ─────────────────────────────────────────────────────────────────────────────
type StageSeed = {
  stageId: string;
  name: string;
  emoji: string;
  description: string;
  sortOrder: number;
};

const STAGES: StageSeed[] = [
  {
    stageId: "savanna",
    name: "サバンナ",
    emoji: "🦁",
    description:
      "アフリカに ひろがる おおきな くさはらの ステージ。ライオン・ゾウ・キリン・チーターなど、ダイナミックな おおきな どうぶつたちが あつまるよ！",
    sortOrder: 10,
  },
  {
    stageId: "forest",
    name: "森林",
    emoji: "🌳",
    description:
      "にほんの さとやまから ヨーロッパの しんりんまで、ふかい もりの ステージ。ウサギ・リス・タヌキ・クマ・オオカミなど、いろんな いきものが ひっそり くらしているよ。",
    sortOrder: 20,
  },
  {
    stageId: "ice_age",
    name: "氷河期",
    emoji: "🧊",
    description:
      "やく 260まんねん まえから 1まんねん まえまで つづいた こおりの じだい。マンモス・サーベルタイガー・ケナガサイなど、さむさに つよい きょだいな どうぶつが いた！",
    sortOrder: 30,
  },
  {
    stageId: "deep_sea",
    name: "深海",
    emoji: "🌊",
    description:
      "ひかりが とどかない みずの ふかさ 200m より したの せかい。ひかる チョウチンアンコウ、きょだいな ダイオウイカ、リュウグウノツカイなど、なぞの いきものが すんでいる！",
    sortOrder: 40,
  },
  {
    stageId: "cretaceous",
    name: "恐竜時代",
    emoji: "🦖",
    description:
      "やく 6600まんねん より まえの ちきゅう。ティラノサウルスや トリケラトプスなど、しじょう さいきょうの きょうりゅうたちが りくと そらと うみを しはいしていた！",
    sortOrder: 50,
  },
  {
    stageId: "mythos",
    name: "伝説",
    emoji: "🐉",
    description:
      "むかしの ひとが かたりついだ、まぼろしの いきものたちの ステージ。ドラゴン・ユニコーン・フェニックス・クラーケンなど、そうぞうりょくが うんだ きゅうきょくの そんざい！",
    sortOrder: 60,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool マスタ（道具）
// ─────────────────────────────────────────────────────────────────────────────
type ToolSeed = {
  toolId: string;
  name: string;
  emoji: string;
  description: string;
  historicalContext: string;
  type: "TRAP" | "BOW" | "SPEAR" | "WEAPON";
  successRateBonus: number;
  inventoryItemId?: string;
  consumable: boolean;
  era: string;
  location: string;
  sortOrder: number;
};

const TOOLS: ToolSeed[] = [
  // ── パッシブ罠（TRAP）× 6 ────────────────────────
  {
    toolId: "pitfall",
    name: "にくいり おとしあな",
    emoji: "🕳️",
    description: "ふかい アナの なかに おにくを おいて、においで どうぶつを おびきよせる わな！ おおきな どうぶつにも まけないよ。",
    historicalContext: "おおむかしの ひとが マンモスみたいな きょだいな どうぶつを つかまえるために つかっていたよ。ちゅうごくの しゅうこうてん いせきから やく 50まんねんまえの あとが みつかっているんだって！",
    type: "TRAP",
    successRateBonus: 0.0,
    inventoryItemId: "wood",
    consumable: true,
    era: "50まんねんまえ（おおむかし）",
    location: "アジア・ヨーロッパ",
    sortOrder: 10,
  },
  {
    toolId: "leghold",
    name: "バネワナ（トラバサミ）",
    emoji: "🪤",
    description: "どうぶつの あしを バネではさむ わな。ちゅうがたの どうぶつを ぴたっと つかまえるよ！",
    historicalContext: "きんぞくせいの バネワナは 1700ねんごろ きたアメリカの けがわ こうえきで ひろまったよ。それよりまえにも きと なわを つかった おなじ しくみの わなが、じょうもんじだいの にほんや シベリアでも つかわれていたんだって。",
    type: "TRAP",
    successRateBonus: 0.1,
    inventoryItemId: "rope",
    consumable: true,
    era: "きんだい（1700ねんごろ）",
    location: "きたアメリカ・ヨーロッパ",
    sortOrder: 20,
  },
  {
    toolId: "snare_net",
    name: "さかないり あみワナ",
    emoji: "🕸️",
    description: "うえから バサッと おとす あみワナ。さかなの においで おびきよせて、ちいさな どうぶつを やさしく つかまえられるよ。",
    historicalContext: "なげあみや おとしあみの はじまりは 1まんねん いじょう まえ。こだい エジプトの かべえにも とりりょう用の あみが かかれているよ。いまでも せいたいがくの ちょうさで つかわれているんだって！",
    type: "TRAP",
    successRateBonus: 0.15,
    inventoryItemId: "net",
    consumable: true,
    era: "1まんねんまえ（じょうもんじだい）",
    location: "アジア・アフリカ",
    sortOrder: 30,
  },
  {
    toolId: "deadfall_trap",
    name: "おもりわな（デッドフォール）",
    emoji: "🪨",
    description: "おもい いわや まるたを じくで つっかえ棒して、えさを つつくと どさっと おちてくる わな！",
    historicalContext: "「デッドフォール」は せかいじゅうで さいも ふるく つかわれた わなのひとつ。やく 3まんねんまえから きたアメリカの せんじゅうみんや じょうもんじんも つかっていたと いわれているよ。",
    type: "TRAP",
    successRateBonus: 0.05,
    inventoryItemId: "wood",
    consumable: true,
    era: "3まんねんまえ（きゅうせっきじだい）",
    location: "きたアメリカ・アジア",
    sortOrder: 35,
  },
  {
    toolId: "bamboo_trap",
    name: "たけスプリングわな",
    emoji: "🎋",
    description: "たけを しならせた バネのちから で どうぶつを ぴょーんと つかまえる わな。かるくて じょうぶ！",
    historicalContext: "アジアの もりで ながいこと つかわれてきた わな。たけは しなやかで つよく、バネとして さいこうなんだって。5000ねんいじょう まえから ちゅうごくや にほんでも つかわれていたよ。",
    type: "TRAP",
    successRateBonus: 0.12,
    inventoryItemId: "rope",
    consumable: true,
    era: "5000ねんまえ（こだい）",
    location: "アジア",
    sortOrder: 38,
  },
  {
    toolId: "cage_trap",
    name: "カゴわな",
    emoji: "🧺",
    description: "どうぶつが はいると ドアが しまる カゴワナ。どうぶつを きずつけずに いきたまま つかまえるよ！",
    historicalContext: "カゴわなは こだい エジプトや メソポタミアで、とりや ちいさな どうぶつを いきたまま つかまえるために つかわれていたよ。5000ねんいじょう まえから つかわれている やさしい わな！",
    type: "TRAP",
    successRateBonus: 0.18,
    inventoryItemId: "net",
    consumable: true,
    era: "5000ねんまえ（こだい）",
    location: "ちゅうとう・アジア",
    sortOrder: 40,
  },

  // ── アクティブ：投擲武器（SPEAR）× 4 ──────────────
  {
    toolId: "atlatl",
    name: "アトラトル（とうそうき）",
    emoji: "🏹",
    description: "やりに「てこ」を くわえて、ものすごい いきおいで とおくに なげる どうぐ！ ちゅうがたの どうぶつを いちげきで しとめられるよ。",
    historicalContext: "アトラトルは いまから やく 3まんねんまえ、ヨーロッパの こうき きゅうせっきじだいに はつめいされた、にんげんさいしょの きかいぶき。てこのげんりで やりの しょくを 2ばい いじょうに ふやして、マンモスや バイソンを かりするために つかわれたよ！",
    type: "SPEAR",
    successRateBonus: 0.25,
    consumable: false,
    era: "3まんねんまえ（こうききゅうせっきじだい）",
    location: "ヨーロッパ・アメリカ",
    sortOrder: 50,
  },
  {
    toolId: "harpoon",
    name: "もり（ぎょか用銛）",
    emoji: "🔱",
    description: "かえしの ついた さきで、つきさした どうぶつが にげられない うみの ぶき。かいよう の いきものにも とどくよ！",
    historicalContext: "もりは やく 9まんねんまえの アフリカ・カタンダ いせきで ほね製の ものが みつかっており、にんげんさいこきゅう の りょうぐと いわれているよ。にほんの じょうもんじだいの かいづかからも こっかくせいの もりが たくさん でてきて、マグロや クジラを とるために つかわれていたんだって！",
    type: "SPEAR",
    successRateBonus: 0.3,
    consumable: false,
    era: "9まんねんまえ（きゅうせっきじだい）",
    location: "アフリカ・アジア",
    sortOrder: 55,
  },
  {
    toolId: "javelin",
    name: "やり（ジャベリン）",
    emoji: "🗡️",
    description: "まっすぐ とおくへ なげる シンプルな ぶき。はじめは きのえだを とがらせた だけ！ どんな どうぶつにも ねらえるよ。",
    historicalContext: "やりは にんげんが つくった さいも ふるい ぶきのひとつ。やく 50まんねんまえの ドイツで はっくつされた もっせいの やりが、いまも せかいさいこの ぼっきの ひとつ。アフリカから ぜんせかいへ ひろまったよ！",
    type: "SPEAR",
    successRateBonus: 0.2,
    consumable: false,
    era: "50まんねんまえ（おおむかし）",
    location: "アフリカ・ヨーロッパ",
    sortOrder: 60,
  },
  {
    toolId: "blowgun",
    name: "ふきや（吹き矢）",
    emoji: "💨",
    description: "ほそい つつの なかに ちいさな ハリを いれて、いきで フッ！と とばす ぶき。おとを たてずに とおくから しずかに ねらえるよ。",
    historicalContext: "ふきやは なんアメリカや アジアの ねったい もりで いまも つかわれているよ。アマゾンの せんじゅうみんは くわの どくを ぬった ハリを つかって、きの うえの サルや とりを かりしていたんだって！",
    type: "SPEAR",
    successRateBonus: 0.22,
    consumable: false,
    era: "げんだい（いまもつかわれている）",
    location: "なんアメリカ・アジア",
    sortOrder: 65,
  },

  // ── アクティブ：飛び道具（BOW）× 3 ────────────────
  {
    toolId: "longbow",
    name: "ながゆみ（ロングボウ）",
    emoji: "🏹",
    description: "ながい もくせいの ゆみ。シンプルだけど つよい！ しゃていは 200m いじょう。レアな どうぶつも ねらえるよ。",
    historicalContext: "ウェールズ・イングランドの ながゆみ（イチイざい）は ちゅうせいヨーロッパの せんじょうを しはいして、1346ねんの クレシーの たたかいでは フランスの きしぐんを くずしたんだって。1ぷんに 10〜12ほん いじょう はなてる そくしゃりょくを ほこる つよいぶき！",
    type: "BOW",
    successRateBonus: 0.2,
    consumable: false,
    era: "ちゅうせい（1200ねんごろ）",
    location: "ヨーロッパ",
    sortOrder: 70,
  },
  {
    toolId: "crossbow",
    name: "クロスボウ（いしゆみ）",
    emoji: "⚔️",
    description: "よこに ゆみを とりつけた ちから いらずの とびどうぐ。引き金を ひくだけで ほっしゃできて、おおものを ねらえるよ！",
    historicalContext: "クロスボウは やく 2500ねんまえに ちゅうごくで はつめいされて、そこから ヨーロッパに つたわったよ。ふつうの ゆみより ちからが いらないのに つよい や を とばせるから、おおぜいの へいしが つかえる かいきてきな ぶき！",
    type: "BOW",
    successRateBonus: 0.32,
    consumable: false,
    era: "2500ねんまえ（こだい）",
    location: "ちゅうごく・ヨーロッパ",
    sortOrder: 75,
  },
  {
    toolId: "compound_bow",
    name: "ふくごうゆみ（コンパウンドボウ）",
    emoji: "🎯",
    description: "かっしゃと ケーブルで ひきを かるくした さいきんの ゆみ。おおきな どうぶつも いちほんで しとめる もっとも つよい ゆみ！",
    historicalContext: "ふくごうゆみは 1966ねんに アメリカの エンジニア ホリー・アレンが とっきょを とった さいしんぶき。ケーブルと かっしゃで ひき重量を はんぶん いかに さげながら、めいちゅうじの うんどうエネルギーは ながゆみの やく 2ばい！ げんだいハンティングの しゅりょくぶき。",
    type: "BOW",
    successRateBonus: 0.4,
    consumable: false,
    era: "げんだい（1966ねん〜）",
    location: "アメリカ",
    sortOrder: 80,
  },

  // ── アクティブ：刃物・銃火器（WEAPON）× 4 ──────────────
  {
    toolId: "flint_knife",
    name: "せっきの ナイフ",
    emoji: "🪨",
    description: "いしを わって つくった おおむかしの ナイフ！ けものを さばくのに つかうよ。かるくて もちやすい！",
    historicalContext: "せっきの ナイフは やく 250まんねん まえから にんげんの そせんが つくりはじめた、もっとも ふるい どうぐの ひとつ。くろいせき（フリント）を たたいて するどい やいばを つくる「うちわり ぎじゅつ」は せかいじゅうで どくりつして はってんしたんだって！",
    type: "WEAPON",
    successRateBonus: 0.1,
    consumable: false,
    era: "250まんねんまえ（せっきじだい）",
    location: "せかいかくち",
    sortOrder: 85,
  },
  {
    toolId: "survival_knife",
    name: "サバイバルナイフ",
    emoji: "🔪",
    description: "ギザギザの は が ついていて、き を きったり も できる げんだいの べんりな ナイフ！ えものに すばやく ちかづいて しとめるよ。",
    historicalContext: "サバイバルナイフの だいめいし「ボウイナイフ」は 1830ねんごろ アメリカの ジム・ボウイが せっけいしたと いわれているよ。だいにじせかいたいせん以降、ぐんたいの サバイバルキットに かならず はいるようになって、アウトドアの てっぱん どうぐに なったんだって！",
    type: "WEAPON",
    successRateBonus: 0.2,
    consumable: false,
    era: "げんだい（1830ねんごろ〜）",
    location: "アメリカ",
    sortOrder: 90,
  },
  {
    toolId: "arquebus",
    name: "むかしの じゅう（ひなわじゅう）",
    emoji: "🔫",
    description: "かやくの ちからで タマを とばす ぶき。うつまでに じかんが かかるけど、とても つよい！ とおくの えものも ねらえるよ。",
    historicalContext: "ひなわじゅうは 15せいきに ヨーロッパで はったつした、はじめての てもち じゅう。ひなわに かや を ともして かやくに てんかする しくみで、せんごくじだいの にほんにも でんらいして 「たねがしまの てっぽう」として ひろまり、ながしのの たたかいで のぶながが つかったよ！",
    type: "WEAPON",
    successRateBonus: 0.35,
    consumable: false,
    era: "15〜17せいき（ちゅうきんせい）",
    location: "ヨーロッパ・アジア",
    sortOrder: 92,
  },
  {
    toolId: "hunting_rifle",
    name: "ハンターの じゅう（りょうじゅう）",
    emoji: "🎯",
    description: "とおくの えものを せいかくに ねらえる すごい じゅう！ スコープで ちいさな どうぶつも ぴったり ねらえるよ。",
    historicalContext: "りょうじゅうは 19せいきから ヨーロッパや アメリカで さかんに つかわれるようになった、ライフリング（みぞきり）ぎじゅつが とくちょうの じゅう。ライフリングで だんがんが らせん かいてんし、めいちゅうせいが ひやくてきに あがったんだって。いまも ぐんたいや ハンターに つかわれているよ！",
    type: "WEAPON",
    successRateBonus: 0.45,
    consumable: false,
    era: "げんだい（19せいき〜）",
    location: "ヨーロッパ・アメリカ",
    sortOrder: 95,
  },
];

type AnimalSeed = {
  animalId: string;
  // ゲームプレイ中の抽象名（例: ゾウ）
  genericName: string;
  // 図鑑に載る詳細な種名（例: アフリカゾウ）
  specificName: string;
  // 後方互換フィールド（specificNameと同じ値でよい）
  name: string;
  emoji: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  // 約100文字の詳細解説（図鑑用、子供向けひらがな中心）
  description: string;
  // 生息地（自由記述）
  habitat: string;
  // どのステージに所属するか
  stageId: string;
  isExtinct?: boolean;
  imageUrl?: string;
};

type QuestSeed = {
  title: string;
  description?: string;
  rewardCoins: number;
  emoji: string;
};

type PenaltySeed = {
  title: string;
  description?: string;
  coinAmount: number;
  emoji: string;
};

const PENALTIES: PenaltySeed[] = [
  { title: "けんか", description: "きょうだい げんかをした", coinAmount: 50, emoji: "🚨" },
  { title: "うそをついた", description: "うそを ついて あやまらなかった", coinAmount: 80, emoji: "🤥" },
  { title: "かたづけない", description: "おもちゃを ちらかしっぱなし", coinAmount: 20, emoji: "🧹" },
  { title: "やくそく やぶり", description: "ねるじかんを まもらなかった", coinAmount: 30, emoji: "⏰" },
];

const QUESTS: QuestSeed[] = [
  { title: "おふろそうじ", description: "おふろを ピカピカに してね", rewardCoins: 50, emoji: "🛁" },
  { title: "ほんを1さつよむ", description: "さいごまで よめたら しんこく", rewardCoins: 30, emoji: "📖" },
  { title: "あさ4時半におきる", description: "アラームを じぶんで とめて おきよう", rewardCoins: 100, emoji: "⏰" },
  { title: "おもちゃをかたづける", description: "リビングの おもちゃを ぜんぶ もとに もどす", rewardCoins: 20, emoji: "🧸" },
  { title: "おはなみずやり", description: "ベランダの おはなに みずを あげる", rewardCoins: 15, emoji: "🌱" },
  { title: "テストでまんてん", description: "がっこうの テスト 100てん", rewardCoins: 300, emoji: "💯" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 図鑑マスタ（本格博物学版・120+ 種）
//   genericName = ゲーム中の抽象名 / specificName = 図鑑の詳細種名
//   description = 子供向けに ひらがな・カタカナ 中心の 約100字（ワクワク感重視）
//   ※ 同じ genericName 内に複数の specificName を含むよう構成。
// ─────────────────────────────────────────────────────────────────────────────
const ANIMALS: AnimalSeed[] = [
  // ══════════════════════════════════════════
  // 🌳 森林ステージ（〜25種）
  // ══════════════════════════════════════════

  // ── うさぎ ──
  { animalId: "rabbit_japanese", genericName: "うさぎ", specificName: "ニホンノウサギ", name: "ニホンノウサギ",
    emoji: "🐰", rarity: "COMMON", stageId: "forest", habitat: "にほんの やまや くさち",
    description: "にほんの やまや もりに すむ ウサギ。ふゆに なると けが まっしろに へんしんして、ゆきげしきに とけこむよ！じそく 50キロで かけぬける しょくぶつ だいすきな スピードスター！" },
  { animalId: "rabbit_european", genericName: "うさぎ", specificName: "アナウサギ", name: "アナウサギ",
    emoji: "🐇", rarity: "COMMON", stageId: "forest", habitat: "ヨーロッパの くさちや のうち",
    description: "ヨーロッパ うまれ。じめんに ふくざつな トンネルを ほって、なかまと いっしょに くらすよ。ペットの ウサギは みんな この こが ごせんぞ。めが よこむきで ほぼ ぐるりと みえる！" },
  { animalId: "rabbit_snow", genericName: "うさぎ", specificName: "ユキウサギ", name: "ユキウサギ",
    emoji: "🐰", rarity: "RARE", stageId: "forest", habitat: "ほっきょくに ちかい さむい くに",
    description: "さむい くにに すむ ウサギ。ふゆは けが まっしろ、なつは ちゃいろに かわる へんしん めいじん！ながい あしで ゆきの うえも ぴょんぴょん。きおんに あわせて かわるよ！" },

  // ── りす ──
  { animalId: "squirrel_japanese", genericName: "りす", specificName: "ニホンリス", name: "ニホンリス",
    emoji: "🐿️", rarity: "COMMON", stageId: "forest", habitat: "ほんしゅう・しこく・きゅうしゅう",
    description: "にほんに しか いない ちいさな リス。あきに ドングリを つちに うめて、ふゆに ほりだして たべるよ。でも わすれちゃう ことも！そこから あたらしい もりが そだつ ふしぎ。" },
  { animalId: "squirrel_flying", genericName: "りす", specificName: "モモンガ", name: "モモンガ",
    emoji: "🐿️", rarity: "RARE", stageId: "forest", habitat: "アジアの しんりん",
    description: "まえあしと うしろあしの あいだに マントみたいな『ひまく』が あるよ！それを ひろげて きから きへ さいだい 100m も グライダーみたいに とぶ ふしぎな リス！" },
  { animalId: "squirrel_red", genericName: "りす", specificName: "キタリス", name: "キタリス",
    emoji: "🐿️", rarity: "COMMON", stageId: "forest", habitat: "ユーラシアの しんようじゅりん",
    description: "ヨーロッパや ロシアの もりに すむ あかちゃいろの リス。みみの さきに ふさふさの けが ぴょんと はえてる！とびうつる ジャンプの きょりは 4m。きの うえの にんじゃ！" },

  // ── しか ──
  { animalId: "deer_japanese", genericName: "しか", specificName: "ニホンジカ", name: "ニホンジカ",
    emoji: "🦌", rarity: "COMMON", stageId: "forest", habitat: "にほん ぜんこくの しんりんと さんち",
    description: "にほん ぜんこくに すむ シカ。オスだけが まいとし はえかわる りっぱな ツノを もつよ。あきに『バン！』と でっかい こえで メスを よぶ。ならこうえんの シカが ゆうめい！" },
  { animalId: "deer_sika_white", genericName: "しか", specificName: "ヤクシカ", name: "ヤクシカ",
    emoji: "🦌", rarity: "RARE", stageId: "forest", habitat: "やくしまの しんりん",
    description: "やくしまに しかいない ちいさな シカ。せかいいさんの もりで くらすよ。たいじゅう 30キロほどで ニホンジカの だいたい はんぶんの サイズ。せかいてきにも きちょうな しか！" },
  { animalId: "moose", genericName: "しか", specificName: "ヘラジカ", name: "ヘラジカ",
    emoji: "🦌", rarity: "EPIC", stageId: "forest", habitat: "きたヨーロッパ・きたアメリカの しんりん",
    description: "シカの なかまで せかいさいだい！おとなの オスは たいじゅう 700キロ オーバーで、ツノの はばも 2m こえる！ヘラのような ツノが かっこいい きたぐにの きょじん！" },

  // ── いのしし ──
  { animalId: "boar_japanese", genericName: "いのしし", specificName: "ニホンイノシシ", name: "ニホンイノシシ",
    emoji: "🐗", rarity: "COMMON", stageId: "forest", habitat: "にほんの やまと さとやま",
    description: "にほんの やまに すむ チャレンジャー！はなが すごく つよくて、じめんを ほって ねっこや むしを みつけるよ。こどもは『ウリぼう』と よばれ、しましま もようが かわいい！" },

  // ── たぬき ──
  { animalId: "raccoon_dog", genericName: "たぬき", specificName: "ホンドタヌキ", name: "ホンドタヌキ",
    emoji: "🦝", rarity: "COMMON", stageId: "forest", habitat: "にほんの さとやま",
    description: "にほんに しか いない タヌキ。イヌの なかまだけど、ふゆに なると ねむりに ちかい じょうたいで すごす ふしぎな くせを もつ。むかしばなしでも おおにんき！" },

  // ── きつね ──
  { animalId: "fox_red", genericName: "きつね", specificName: "キタキツネ", name: "キタキツネ",
    emoji: "🦊", rarity: "RARE", stageId: "forest", habitat: "ほっかいどう・サハリンの しんりん",
    description: "ほっかいどうの ゆきの うえで、ゆきの したを はしる ネズミの おとを みみで キャッチ！ジャンプして つかまえる『マウシング』が とくいな かしこい キツネ！" },
  { animalId: "fox_red_common", genericName: "きつね", specificName: "アカギツネ", name: "アカギツネ",
    emoji: "🦊", rarity: "RARE", stageId: "forest", habitat: "ユーラシア・きたアメリカの ひろい ちいき",
    description: "せかいで いちばん ひろく すんでいる キツネ。あかちゃいろの けと ふさふさの しっぽが きれい！とても かしこくて まちに あらわれる ことも あるよ。" },

  // ── おおかみ ──
  { animalId: "wolf_gray", genericName: "おおかみ", specificName: "タイリクオオカミ", name: "タイリクオオカミ",
    emoji: "🐺", rarity: "RARE", stageId: "forest", habitat: "ユーラシア・きたアメリカの しんりん",
    description: "イヌの ごせんぞ！5～15ぴきの むれで くらす よ。リーダー ふうふの アルファペアが いて、とおぼえで なかまに あいずを おくる かしこい かぞく！" },
  { animalId: "wolf_japanese", genericName: "おおかみ", specificName: "ニホンオオカミ", name: "ニホンオオカミ",
    emoji: "🐺", rarity: "EPIC", stageId: "forest", habitat: "むかしの にほん れっとう",
    description: "むかし にほんに すんでいた せかいで いちばん ちいさな オオカミ。やまの かみさまと して まつる ちいきも あった。1905ねん ならけんで さいごの 1ぴきが きろくされた…", isExtinct: true },

  // ── くま ──
  { animalId: "bear_brown", genericName: "くま", specificName: "ヒグマ", name: "ヒグマ",
    emoji: "🐻", rarity: "RARE", stageId: "forest", habitat: "ほっかいどうの しんりん・かわぞい",
    description: "ほっかいどうに すむ にほん さいだいの りくの どうぶつ！たいじゅう 500キロ オーバーも！あきに サケを たべて、ふゆごもりの まえに たっぷり しぼうを ためる！" },
  { animalId: "bear_black_asia", genericName: "くま", specificName: "ツキノワグマ", name: "ツキノワグマ",
    emoji: "🐻", rarity: "RARE", stageId: "forest", habitat: "ほんしゅう・しこくの さんりん",
    description: "むねに みかづきがたの しろい もようを もつのが なまえの ゆらい。きのぼりが とくいで、ドングリや ハチミツを とりに たかい きにも すいすい のぼる！" },
  { animalId: "bear_kodiak", genericName: "くま", specificName: "コディアックヒグマ", name: "コディアックヒグマ",
    emoji: "🐻", rarity: "EPIC", stageId: "forest", habitat: "アラスカ・コディアックとうの しんりん",
    description: "ヒグマの あにきぶん！たちあがると みのたけ 3m、たいじゅう 700キロを こえる せかい さいだい きゅうの りく どうぶつ！サケの たべほうだいで そだつ！" },

  // ── ふくろう ──
  { animalId: "owl_horned", genericName: "ふくろう", specificName: "ワシミミズク", name: "ワシミミズク",
    emoji: "🦉", rarity: "RARE", stageId: "forest", habitat: "ユーラシアの いわばや しんりん",
    description: "つばさを ひろげると 180cm にも なる せかい さいだい きゅうの フクロウ！はねに ギザギザの ひみつが あって、ほとんど おとを たてずに とぶ よるの おうじゃ！" },
  { animalId: "owl_eagle_blakiston", genericName: "ふくろう", specificName: "シマフクロウ", name: "シマフクロウ",
    emoji: "🦉", rarity: "EPIC", stageId: "forest", habitat: "ほっかいどうの しんりん",
    description: "ほっかいどうに しか いない せかい さいだい きゅうの フクロウ！すいめんに とびこんで サケや マスを つかまえる ハンター！すうが すくなく ぜつめつ きぐしゅ。" },

  // ── サル類 ──
  { animalId: "macaque_japanese", genericName: "さる", specificName: "ニホンザル", name: "ニホンザル",
    emoji: "🐒", rarity: "COMMON", stageId: "forest", habitat: "ほんしゅう・しこく・きゅうしゅう",
    description: "にほんに しか いない サル！じごくだにの『おんせんに はいる サル』で せかいに ゆうめい。100ぴき いじょうの むれを つくり、リーダーは ボスざる！" },
  { animalId: "chimpanzee", genericName: "さる", specificName: "チンパンジー", name: "チンパンジー",
    emoji: "🐒", rarity: "RARE", stageId: "forest", habitat: "ちゅうおう・にしアフリカの ねったいうりん",
    description: "にんげんと いでんしが 98.7％ おなじ！いちばん ちかい しんせき。いしで ナッツを わったり、きの えだを どうぐに して アリを つる！なかまと ハグも するよ。" },
  { animalId: "gorilla", genericName: "ゴリラ", specificName: "ニシローランドゴリラ", name: "ニシローランドゴリラ",
    emoji: "🦍", rarity: "EPIC", stageId: "forest", habitat: "アフリカ ちゅうおうの ねったいうりん",
    description: "さいだい きゅうの サル！たいじゅう 200キロ こえる ことも。じつは とっても おだやかな くさしょく より。あぶないと むねを ドンドン たたく『ドラミング』を するんだ！" },
  { animalId: "orangutan", genericName: "さる", specificName: "オランウータン", name: "オランウータン",
    emoji: "🦧", rarity: "EPIC", stageId: "forest", habitat: "インドネシアの ジャングル",
    description: "インドネシアの ジャングルに すむ あかちゃいろの サル！どうぐを つかい、まいばん きの うえに ベッドを つくる。なまえは マレーごで『もりの ひと』という いみ！" },

  // ── その他 ──
  { animalId: "panda", genericName: "パンダ", specificName: "ジャイアントパンダ", name: "ジャイアントパンダ",
    emoji: "🐼", rarity: "EPIC", stageId: "forest", habitat: "ちゅうごく しせんしょうの たけばやし",
    description: "ちゅうごくの たけばやしに すむ せかいの アイドル！クマの なかまなのに ごはんは 99％ タケ！1にち 12じかんも たけを たべつづける ふしぎな くま！" },
  { animalId: "red_panda", genericName: "パンダ", specificName: "レッサーパンダ", name: "レッサーパンダ",
    emoji: "🐼", rarity: "RARE", stageId: "forest", habitat: "ヒマラヤ・ちゅうごく しなんの たかい もり",
    description: "じつは ジャイアントパンダより さきに『パンダ』と なづけられた もとせんしゅ！あかちゃいろの もふもふで、たちあがって あいてを いかくする すがたが かわいい！" },
  { animalId: "tiger_bengal", genericName: "とら", specificName: "ベンガルトラ", name: "ベンガルトラ",
    emoji: "🐅", rarity: "EPIC", stageId: "forest", habitat: "インドの ねったいうりん",
    description: "せかい さいだいの ネコの なかま！インドに すむ もりの ふくびきおうしゃ。しまもようは 1ぴき ずつ ちがって ゆびもんの よう。およぎが とくいで ワニまで！" },
  { animalId: "tiger_white", genericName: "とら", specificName: "ホワイトタイガー", name: "ホワイトタイガー",
    emoji: "🐅", rarity: "EPIC", stageId: "forest", habitat: "インドあたいりく（とつぜん へんい）",
    description: "とつぜん へんいで うまれた しろい ベンガルトラ！あおい め と しろい けに くろい しま という ファンタジー みたいな すがた。やせいでは とても めずらしい！" },
  { animalId: "beaver", genericName: "ビーバー", specificName: "アメリカビーバー", name: "アメリカビーバー",
    emoji: "🦫", rarity: "RARE", stageId: "forest", habitat: "きたアメリカの かわと みずうみ",
    description: "するどい はで きを きりたおして、かわに ダムを つくる けんちくか！ながさ 1キロの ダムを つくる ことも。きたアメリカの しんりんを かえる すごい パワー！" },
  { animalId: "koala", genericName: "コアラ", specificName: "コアラ", name: "コアラ",
    emoji: "🐨", rarity: "RARE", stageId: "forest", habitat: "オーストラリアの ユーカリばやし",
    description: "オーストラリアの ユーカリの きの うえで、1にち 20じかんも ねている のんびり やさん！あかちゃんは『ジョーイ』と よばれ、おかあさんの ふくろの なかで そだつ！" },

  // ══════════════════════════════════════════
  // 🦁 サバンナステージ（〜23種）
  // ══════════════════════════════════════════
  { animalId: "zebra_plains", genericName: "しまうま", specificName: "サバンナシマウマ", name: "サバンナシマウマ",
    emoji: "🦓", rarity: "COMMON", stageId: "savanna", habitat: "ひがし～みなみアフリカの くさち",
    description: "くろと しろの しま もようは 1ぴき ずつ ちがう！むれに なると しまが まじって、ライオンに ねらいを つけさせない さくせん。1にちで 20キロも あるくよ！" },
  { animalId: "zebra_grevy", genericName: "しまうま", specificName: "グレビーシマウマ", name: "グレビーシマウマ",
    emoji: "🦓", rarity: "RARE", stageId: "savanna", habitat: "ケニア・エチオピアの くさち",
    description: "せかいで いちばん おおきな シマウマ！しまの はばが ほそくて、おなかが しろい。みみが まんまる おおきくて、すぐ みわけられるよ！すうが すくなく きちょう。" },
  { animalId: "wildebeest", genericName: "ヌー", specificName: "オグロヌー", name: "オグロヌー",
    emoji: "🐃", rarity: "COMMON", stageId: "savanna", habitat: "ひがしアフリカの サバンナ",
    description: "まいとし 150まんとうが あめを おって おおいどう！マラがわを わたる えいぞうは サバンナの きびしさを みせる。うまれた こうしは すうふんで たちあがる！" },
  { animalId: "meerkat", genericName: "ミーアキャット", specificName: "ミーアキャット", name: "ミーアキャット",
    emoji: "🐾", rarity: "COMMON", stageId: "savanna", habitat: "みなみアフリカの かわいた くさち",
    description: "むれで じめんに あなを ほって くらすよ。みはりやくが まっすぐ たちあがり、そらの ワシ・じめんの ヘビなど あいてに よって なきごえを かえる かしこい コミュニティ！" },
  { animalId: "warthog", genericName: "イノシシ", specificName: "イボイノシシ", name: "イボイノシシ",
    emoji: "🐗", rarity: "COMMON", stageId: "savanna", habitat: "サハラいなんの くさち",
    description: "かおの ひだりみぎに ある イボが なまえの ゆらい。ライオンから にげる ときは じそく 55キロ！ふだんは ほかの どうぶつが ほった あなを リフォームして ねる！" },
  { animalId: "ostrich", genericName: "ダチョウ", specificName: "ダチョウ", name: "ダチョウ",
    emoji: "🦤", rarity: "COMMON", stageId: "savanna", habitat: "アフリカの かわいた くさち",
    description: "せかい さいだいの とり！みのたけ 2.7m。そらは とべないけど じそく 70キロで はしる！つよい あしの けりは ライオンの ずがいこつを くだく いりょく！" },
  { animalId: "giraffe", genericName: "キリン", specificName: "アミメキリン", name: "アミメキリン",
    emoji: "🦒", rarity: "RARE", stageId: "savanna", habitat: "ひがしアフリカの サバンナ",
    description: "くびだけで 2m こえる！した は 50cm にも なる！しんぞうは とくべつ おおきくて、くびの うえまで けつえきを おくる。あかしあの トゲも したで まきとって たべる！" },
  { animalId: "giraffe_masai", genericName: "キリン", specificName: "マサイキリン", name: "マサイキリン",
    emoji: "🦒", rarity: "RARE", stageId: "savanna", habitat: "ケニア・タンザニアの サバンナ",
    description: "キリンの なかまで さいだい！もようは ぎざぎざの くっきりした かたち。からだの たかさ 5.5m！すいみんは 1にち たった 20ぷんと、せかい さいたん きゅう！" },
  { animalId: "hyena_spotted", genericName: "ハイエナ", specificName: "ブチハイエナ", name: "ブチハイエナ",
    emoji: "🐕", rarity: "RARE", stageId: "savanna", habitat: "サハラいなんの アフリカ",
    description: "ほねを かみくだく アゴの ちから は サバンナ いちばん！えものの 70％は じぶんで かりする ハンター！むれの リーダーは メスで、しゃかいせいが たかい！" },
  { animalId: "hyena_striped", genericName: "ハイエナ", specificName: "シマハイエナ", name: "シマハイエナ",
    emoji: "🐕", rarity: "RARE", stageId: "savanna", habitat: "きたアフリカ・ちゅうとう・インド",
    description: "ハイエナ かぞくで いちばん ちいさい しゅ。しまもようで くび から せなかに たてがみが ある！ほねを たべる めいじん。やしょこうせいで しゃかいせいも たかい。" },
  { animalId: "leopard", genericName: "ヒョウ", specificName: "ヒョウ", name: "ヒョウ",
    emoji: "🐆", rarity: "RARE", stageId: "savanna", habitat: "アフリカ・アジアの しんりん・くさち",
    description: "じぶんの 3ばいの たいじゅうの シカでも きの うえに はこべる かいりき！よるの ステルス ハンターで、ひとの けはいを かんじると おとも なく きえる！" },
  { animalId: "rhino_black", genericName: "サイ", specificName: "クロサイ", name: "クロサイ",
    emoji: "🦏", rarity: "RARE", stageId: "savanna", habitat: "ひがし～みなみアフリカの サバンナ",
    description: "アフリカに のこる サイの しゅるい。つのは ツメと おなじ せいぶんの ケラチン！みつりょうで かずが へっていて、やせいでは いま 5000とう を きった…" },
  { animalId: "rhino_white", genericName: "サイ", specificName: "シロサイ", name: "シロサイ",
    emoji: "🦏", rarity: "RARE", stageId: "savanna", habitat: "みなみアフリカの くさち",
    description: "ゾウの つぎに おおきい りく どうぶつで たいじゅう 2.3t こえ！きたぶ あしゅは 2018ねんに さいごの オスが しに、いまは じんこうじゅせいで まもられている！" },
  { animalId: "lion", genericName: "ライオン", specificName: "アフリカライオン", name: "アフリカライオン",
    emoji: "🦁", rarity: "EPIC", stageId: "savanna", habitat: "サハラいなん アフリカの サバンナ",
    description: "ひゃくじゅうの おう！むれ（プライド）で くらす ゆいいつの ネコの なかま。かりは メスが たんとう！オスの たてがみは としで くろくなるほど つよさの あかし！" },
  { animalId: "lion_white", genericName: "ライオン", specificName: "ホワイトライオン", name: "ホワイトライオン",
    emoji: "🦁", rarity: "EPIC", stageId: "savanna", habitat: "みなみアフリカの ティンババティちほう",
    description: "みなみアフリカの とくべつな ちいきに うまれる、とつぜん へんいで しろい ライオン！しき そが うすくなる『リューシズム』に よる もの。やせいでは ほとんど みられない！" },
  { animalId: "elephant_african", genericName: "ぞう", specificName: "アフリカゾウ", name: "アフリカゾウ",
    emoji: "🐘", rarity: "EPIC", stageId: "savanna", habitat: "サハラいなんの アフリカ ぜんいき",
    description: "りく さいだいの どうぶつで たいじゅう 6t！はなの きんにくは 15まんぼん も！とても かしこく、しんだ なかまの ほねを なでる『とむらい』の こうどうも かくにん されている！" },
  { animalId: "elephant_asian", genericName: "ぞう", specificName: "アジアゾウ", name: "アジアゾウ",
    emoji: "🐘", rarity: "EPIC", stageId: "savanna", habitat: "インド～とうなんアジアの もり・くさち",
    description: "アフリカゾウより こがたで みみが ちいさい。むかしから にんげんと いっしょに はたらいた れきしを もち、ぶっきょうでは しんせいな どうぶつ！かがみで じぶんを みとめられる かしこさ！" },
  { animalId: "cheetah", genericName: "チーター", specificName: "チーター", name: "チーター",
    emoji: "🐆", rarity: "EPIC", stageId: "savanna", habitat: "アフリカの サバンナ",
    description: "りく さいそく！じそく 110キロを こえる しゅんぱつりょく！ただし ちょうきょりは はしれず 30びょうで ちからつきる。ツメが ひっこまず、ろめんを ける ちからが つよい！" },
  { animalId: "buffalo_cape", genericName: "バッファロー", specificName: "ケープバッファロー", name: "ケープバッファロー",
    emoji: "🐃", rarity: "EPIC", stageId: "savanna", habitat: "サハラいなん アフリカの くさち",
    description: "『くろい しにがみ』の いみょうを もつ アフリカ ごだいじゅうの ひとつ！むれで けっそくし、ライオンより ひとを ししに いたらしめる！つのの はばは 1m！" },
  { animalId: "fennec_fox", genericName: "きつね", specificName: "フェネック", name: "フェネック",
    emoji: "🦊", rarity: "RARE", stageId: "savanna", habitat: "サハラさばく・きたアフリカ",
    description: "せかい さいしょうの キツネ！サハラさばくに すみ、からだの わりに きょだいな みみで さばくの ねつを ほうさんして からだを ひやす！よるに あなを ほって くらすよ！" },
  { animalId: "baboon", genericName: "さる", specificName: "マントヒヒ", name: "マントヒヒ",
    emoji: "🐒", rarity: "RARE", stageId: "savanna", habitat: "アフリカの くさち・がんざんちたい",
    description: "オスの くびの まわりに ぎんいろの たてがみが ある サル！むかし エジプトでは『かみの つかい』として たいせつに された！むれで けんりょくを きょうそうする ふくざつな しゃかい！" },
  { animalId: "hippopotamus", genericName: "カバ", specificName: "カバ", name: "カバ",
    emoji: "🦛", rarity: "EPIC", stageId: "savanna", habitat: "サハラいなんの かわ・みずうみ",
    description: "アフリカで いちばん にんげんを おそう どうぶつ！ふだんは みずに もぐっていて、よるに くさを たべに あがる。じそく 30キロで はしるよ！はだから あかい『ひざわ』が でる！" },
  { animalId: "crocodile_nile", genericName: "ワニ", specificName: "ナイルワニ", name: "ナイルワニ",
    emoji: "🐊", rarity: "EPIC", stageId: "savanna", habitat: "アフリカの かわ・しっち",
    description: "アフリカ さいだいの ワニ！たいちょう 5m こえる ことも。ヌーの たいぐんが かわを わたる ときに まちぶせる おそろしい ハンター！くちは とじる ちからは あくいだが、ひらく ちからは よわい！" },
  { animalId: "flamingo", genericName: "とり", specificName: "オオフラミンゴ", name: "オオフラミンゴ",
    emoji: "🦩", rarity: "RARE", stageId: "savanna", habitat: "アフリカ・みなみヨーロッパの こ・しお",
    description: "あかい モ や プランクトンを たべる ことで からだが ピンクに なる！ふしぎ。1ぽんあしで ねむる くせが あって、こうごに あしを やすめる！" },

  // ══════════════════════════════════════════
  // 🧊 氷河期ステージ（〜22種）
  // ══════════════════════════════════════════
  { animalId: "reindeer", genericName: "しか", specificName: "トナカイ", name: "トナカイ",
    emoji: "🦌", rarity: "COMMON", stageId: "ice_age", habitat: "ほっきょくけんの ツンドラ",
    description: "シカの なかまで ゆいいつ、オスも メスも ツノを もつ ふしぎな しゅ！きびしい さむさに たいおうし、ひづめは ゆきを しっかり ふみしめる かたち！おおぜいで ながい たびを する！" },
  { animalId: "musk_ox", genericName: "うし", specificName: "ジャコウウシ", name: "ジャコウウシ",
    emoji: "🐂", rarity: "COMMON", stageId: "ice_age", habitat: "カナダきたぶ・グリーンランド",
    description: "ひょうがきから いきのこった すうすくない ほにゅうるい！ながい けと あつい たいもうで -40度にも たえる！おそわれると えんじんを くんで こどもを まもる！" },
  { animalId: "arctic_fox", genericName: "きつね", specificName: "ホッキョクギツネ", name: "ホッキョクギツネ",
    emoji: "🦊", rarity: "COMMON", stageId: "ice_age", habitat: "ほっきょくけんの ツンドラ・ひょうげん",
    description: "なつは ちゃいろ、ふゆは まっしろに けが かわる！みみと はなが ちいさく さむさで こおるのを ふせぐ。-50度でも へいきな ほにゅうるい さいきょうの たいかんのうりょく！" },
  { animalId: "polar_bear", genericName: "くま", specificName: "ホッキョクグマ", name: "ホッキョクグマ",
    emoji: "🐻‍❄️", rarity: "RARE", stageId: "ice_age", habitat: "ほっきょくかいの ひょうげん",
    description: "せかい さいだいの にくしょく りく どうぶつ！しろく みえる けは じつは とうめいで、ひかりを はんしゃして しろく みえる！およぎも とくいで じそく 10キロで およぐ！" },
  { animalId: "snow_leopard", genericName: "ヒョウ", specificName: "ユキヒョウ", name: "ユキヒョウ",
    emoji: "🐆", rarity: "RARE", stageId: "ice_age", habitat: "ちゅうおうアジアの こうざん ちたい",
    description: "ひょうこう 3000～6000m の いわやまに すむ きちょうな ネコの なかま。すいちょく 50m の がけを かけおりる！じぶんの たいちょうの 6ばいを いっとびで とぶ！" },
  { animalId: "owl_snowy", genericName: "ふくろう", specificName: "シロフクロウ", name: "シロフクロウ",
    emoji: "🦉", rarity: "RARE", stageId: "ice_age", habitat: "ほっきょくけんの ツンドラ",
    description: "ほっきょくけんに すむ まっしろな フクロウ。ゆきの うえで かんぺきな カモフラージュ！ほかの フクロウと ちがい ひるも かつどうする。ハリー・ポッターの ヘドウィグの モデル！" },
  { animalId: "walrus", genericName: "セイウチ", specificName: "セイウチ", name: "セイウチ",
    emoji: "🦭", rarity: "RARE", stageId: "ice_age", habitat: "ほっきょくけんの かいがん・ひょうじょう",
    description: "1m こえる キバは オス メス りょうほうが もつ！こおりに あなを あけて こきゅうしたり、ひょうかを のぼる つえに する！たいじゅう 1.5t！うみぞこの ハマグリを すいこむ！" },
  { animalId: "saiga", genericName: "アンテロープ", specificName: "サイガアンテロープ", name: "サイガアンテロープ",
    emoji: "🐐", rarity: "RARE", stageId: "ice_age", habitat: "ちゅうおうアジアの くさち",
    description: "ひょうがきから いきつづける『いきた かせき』。とくちょうてきな たれた はなは、ふゆは つめたい くうきを あたためる！2015ねんに なぞの ばいきんで おおぜい しんで ぜつめつ きぐ！" },
  { animalId: "penguin_emperor", genericName: "ペンギン", specificName: "コウテイペンギン", name: "コウテイペンギン",
    emoji: "🐧", rarity: "RARE", stageId: "ice_age", habitat: "なんきょく",
    description: "なんきょくの ひょうげんに すむ せかい さいだいの ペンギン！たかさ 1.2m！オスは -60度の さむさで 2かげつ なにも たべずに たまごを あたためつづける ちちおや の かがみ！" },
  { animalId: "orca", genericName: "クジラ", specificName: "シャチ", name: "シャチ",
    emoji: "🐳", rarity: "EPIC", stageId: "ice_age", habitat: "せかいの つめたい うみ",
    description: "うみの ハンターの たいちょう！むれで こうどうする かしこい イルカの なかま。シロナガスクジラさえ おそう ことが ある！くろと しろの もようは みると かっこいい！" },
  { animalId: "narwhal_ice", genericName: "クジラ", specificName: "イッカク", name: "イッカク",
    emoji: "🐳", rarity: "EPIC", stageId: "ice_age", habitat: "ほっきょくかい",
    description: "ほっきょくの うみに すむ、つの の はえた『うみの ユニコーン』！じつは つので なく、ねじれた『きば』！ながさ 3m にも なって、おもに オスが もつ ふしぎな クジラ！" },
  { animalId: "elephant_mammoth", genericName: "ぞう", specificName: "ケナガマンモス", name: "ケナガマンモス",
    emoji: "🦣", rarity: "EPIC", stageId: "ice_age", habitat: "むかしの ユーラシア・きたアメリカ",
    description: "やく 4000ねん まえまで いきていた ゾウの なかま！ながい まがった キバと あつい けがわが ひょうがきの さむさに ぴったり！シベリアの こおりの したから みつかる！", isExtinct: true },
  { animalId: "mammoth_columbian", genericName: "ぞう", specificName: "コロンビアマンモス", name: "コロンビアマンモス",
    emoji: "🦣", rarity: "EPIC", stageId: "ice_age", habitat: "むかしの きたアメリカ",
    description: "きたアメリカに すんでいた きょだいな マンモス！ケナガマンモスより おおきく、たかさ 4m こえる！キバは わんきょくして 4m にも たっした きょじん！", isExtinct: true },
  { animalId: "sabertooth", genericName: "ねこ", specificName: "スミロドン", name: "スミロドン（サーベルタイガー）",
    emoji: "🐯", rarity: "EPIC", stageId: "ice_age", habitat: "むかしの みなみ・きたアメリカ",
    description: "うわあごから 28cm の つるぎ みたいな きば！しじょう さいきょう きゅうの にくしょくじゅう！えものの のどを きばで さきさく かりを していた。1まんねん まえに ぜつめつ…", isExtinct: true },
  { animalId: "woolly_rhino", genericName: "サイ", specificName: "ケナガサイ", name: "ケナガサイ",
    emoji: "🦏", rarity: "EPIC", stageId: "ice_age", habitat: "むかしの ユーラシアたいりく",
    description: "ぜんしんを あつい けで おおわれた ひょうがきの サイ！ふたつの つのの まえの つのは ながさ 1m！ゆきを かきわけて くさを たべた きょじん！", isExtinct: true },
  { animalId: "megaloceros", genericName: "しか", specificName: "オオツノジカ", name: "オオツノジカ",
    emoji: "🦌", rarity: "EPIC", stageId: "ice_age", habitat: "むかしの ユーラシア たいりく",
    description: "ツノの はばが 3.6m に たっした しじょう さいだい きゅうの シカ！やく 7700ねん まえまで いきていた。アイルランドの どろの したから ぜんしんの ほねが でた！", isExtinct: true },
  { animalId: "dire_wolf", genericName: "おおかみ", specificName: "ダイアウルフ", name: "ダイアウルフ",
    emoji: "🐺", rarity: "EPIC", stageId: "ice_age", habitat: "むかしの きたアメリカ",
    description: "いまの ハイイロオオカミより ひとまわり おおきく、かむ ちからは 1.5ばい！やく 1まんねん まえに ぜつめつした ひょうがきの ちょうてん ハンター！", isExtinct: true },
  { animalId: "glyptodon", genericName: "アルマジロ", specificName: "グリプトドン", name: "グリプトドン",
    emoji: "🐢", rarity: "EPIC", stageId: "ice_age", habitat: "むかしの みなみ・きたアメリカ",
    description: "ぜんちょう 3m・たいじゅう 2t の きょだいな アルマジロ！せなかは 1000まい いじょうの ほねで おおわれた こうら！しっぽの さきに てきを なぐる ホネの こんぼう！", isExtinct: true },
  { animalId: "cave_bear", genericName: "くま", specificName: "ホラアナグマ", name: "ホラアナグマ",
    emoji: "🐻", rarity: "EPIC", stageId: "ice_age", habitat: "むかしの ヨーロッパの どうくつ",
    description: "ひょうがきの ヨーロッパに すんでいた おおきな クマ！どうくつに すみ、ネアンデルタールじんと ばしょを とりあって たたかった ことも！ぜつめつしてしまった…", isExtinct: true },
  { animalId: "ground_sloth", genericName: "ナマケモノ", specificName: "メガテリウム", name: "メガテリウム",
    emoji: "🦥", rarity: "EPIC", stageId: "ice_age", habitat: "むかしの みなみアメリカ",
    description: "じめんに すんでいた きょだいな ナマケモノ！たかさ 6m・たいじゅう 4t！うしろあしで たって きの たかい はを たべた。じょうもん じだいまで いきていた かも！", isExtinct: true },
  { animalId: "paraceratherium", genericName: "サイ", specificName: "パラケラテリウム", name: "パラケラテリウム",
    emoji: "🦏", rarity: "LEGENDARY", stageId: "ice_age", habitat: "むかしの アジア",
    description: "ぜつめつしてしまった、しじょう さいだい きゅうの りく ほにゅうるい！くびを いれて たかさ 8m！ゾウと キリンを たして 2 で わったような すがた！", isExtinct: true },
  { animalId: "smilodon_populator", genericName: "ねこ", specificName: "スミロドン・ポプラトル", name: "スミロドン・ポプラトル",
    emoji: "🐯", rarity: "LEGENDARY", stageId: "ice_age", habitat: "むかしの みなみアメリカ",
    description: "サーベルタイガーの ちょうだい けっさく！たいじゅう 400キロ こえ、いまの トラの 1.5ばい！28cm の きばで グランドスロスや コロンビアマンモスを かりした！", isExtinct: true },

  // ══════════════════════════════════════════
  // 🌊 深海ステージ（〜23種）
  // ══════════════════════════════════════════
  { animalId: "clownfish", genericName: "さかな", specificName: "カクレクマノミ", name: "カクレクマノミ",
    emoji: "🐠", rarity: "COMMON", stageId: "deep_sea", habitat: "インドよう～にしたいへいよう サンゴしょう",
    description: "イソギンチャクの どくに たえる パートナー！からだの ねんえきで どくを なかわした！うまれた ときは みんな オスで、ぐんの さいだい こたいが メスに かわる！" },
  { animalId: "octopus_common", genericName: "たこ", specificName: "マダコ", name: "マダコ",
    emoji: "🐙", rarity: "COMMON", stageId: "deep_sea", habitat: "せかいじゅうの うみ",
    description: "のうが 9つも ある！はだで いろや ひかりを かんじる ふしぎ。びんの フタを あける パズルも すうふんで とく！じゅみょうは 1～2ねんと みじかい てんさい！" },
  { animalId: "jellyfish_moon", genericName: "くらげ", specificName: "ミズクラゲ", name: "ミズクラゲ",
    emoji: "🪼", rarity: "COMMON", stageId: "deep_sea", habitat: "ぜんせかいの えんがん",
    description: "からだの 95％が みず！のうも しんぞうも ほねも ない！それでも 5おくねん いきのこってきた ちきゅう さいこの どうぶつ なかま！" },
  { animalId: "seahorse", genericName: "さかな", specificName: "タツノオトシゴ", name: "タツノオトシゴ",
    emoji: "🐠", rarity: "RARE", stageId: "deep_sea", habitat: "せかいの あさい うみ",
    description: "オスが あかちゃんを そだてる めずらしい さかな！おすの おなかの ふくろに メスが たまごを うんで、オスが 2～3しゅうかん おまもりするよ！" },
  { animalId: "nautilus", genericName: "いか", specificName: "オウムガイ", name: "オウムガイ",
    emoji: "🐚", rarity: "RARE", stageId: "deep_sea", habitat: "せいなんたいへいようの しんかい",
    description: "4おくねん いじょう すがたを ほとんど かえずに いきる『いきた かせき』！うずまきの からの なかは いくつも へやが あって、ガスで うかびあがる ふしぎな いか の しんせき！" },
  { animalId: "manta_ray", genericName: "エイ", specificName: "オニイトマキエイ（マンタ）", name: "オニイトマキエイ",
    emoji: "🐟", rarity: "RARE", stageId: "deep_sea", habitat: "せかいの ねったい～あねったい うみ",
    description: "ヒレの はしから はしまで 7m に たっする きょだいな エイ！にんげん なみに かしこくて、かがみで じぶんを みとめられる！プランクトンを こして たべる おだやかな きょじん！" },
  { animalId: "great_white_shark", genericName: "サメ", specificName: "ホホジロザメ", name: "ホホジロザメ",
    emoji: "🦈", rarity: "RARE", stageId: "deep_sea", habitat: "せかいの あたたかい うみ",
    description: "たいちょう 6m こえる うみの ちょうてん ハンター！はなさきに でんきを かんじる ロレンチーニ きかんが あり、えものの しんぞうおとまで キャッチ！いっしょうで 2まんぼんの はが はえかわる！" },
  { animalId: "whale_shark", genericName: "サメ", specificName: "ジンベエザメ", name: "ジンベエザメ",
    emoji: "🦈", rarity: "EPIC", stageId: "deep_sea", habitat: "せかいの ねったい・あねったい うみ",
    description: "せかい さいだいの さかな！たいちょう 13m、たいじゅう 20t！おおきな くちで みずを すいこみ、プランクトンや ちいさな さかなを たべる おだやかな きょじん！" },
  { animalId: "moray_eel", genericName: "うつぼ", specificName: "ウツボ", name: "ウツボ",
    emoji: "🐟", rarity: "RARE", stageId: "deep_sea", habitat: "せかいの あさい さんごしょう",
    description: "なんと あごが ふたつ ある！くちの おくに『のどの あご』が かくれていて、えものを くわえると ぐいっと のどに ひきこむ！うみの エイリアンの ような さかな！" },
  { animalId: "mantis_shrimp", genericName: "エビ", specificName: "シャコ（モンハナシャコ）", name: "モンハナシャコ",
    emoji: "🦐", rarity: "RARE", stageId: "deep_sea", habitat: "ねったいの さんごしょう",
    description: "パンチの はやさが だんがんと おなじ！じそく 80キロ！みず の なかで そくど が はやすぎて あわが かんしゃくの ように はじけて あいてを やっつける！" },
  { animalId: "anglerfish", genericName: "アンコウ", specificName: "チョウチンアンコウ", name: "チョウチンアンコウ",
    emoji: "🐟", rarity: "EPIC", stageId: "deep_sea", habitat: "せかいの しんかい・みず ふかさ 200～1000m",
    description: "あたまから ぴかぴか ひかる『ちょうちん』で えものを よびよせる しんかいの ハンター！オスは メスの 100ぶんの 1の おおきさで、メスに かみついて ゆごう する ふしぎ！" },
  { animalId: "lanternfish", genericName: "さかな", specificName: "ハダカイワシ", name: "ハダカイワシ",
    emoji: "🐟", rarity: "COMMON", stageId: "deep_sea", habitat: "せかいの しんかい",
    description: "しんかいで いちばん かずが おおい さかな！からだに ひかる つぶつぶが ならんでいて、よる に なると いっせいに ひかる！うみの イルミネーション！" },
  { animalId: "vampire_squid", genericName: "イカ", specificName: "コウモリダコ", name: "コウモリダコ",
    emoji: "🦑", rarity: "EPIC", stageId: "deep_sea", habitat: "せかいの しんかい・ふかさ 600～900m",
    description: "『じごくの きゅうけつイカ』と よばれる けれど、イカ でも タコ でもない べつ けいとうの あたまあし るい！からだは あおぐろく、めは あかい いきた かせき！" },
  { animalId: "dumbo_octopus", genericName: "たこ", specificName: "メンダコ", name: "メンダコ",
    emoji: "🐙", rarity: "RARE", stageId: "deep_sea", habitat: "ふかさ 200～1000m の しんかい",
    description: "あたまから ピョコンと はえた ふたつの ヒレで、ディズニーキャラの ダンボみたいに ひらひら およぐ かわいい しんかい タコ！おおきな めが チャームポイント！" },
  { animalId: "oarfish", genericName: "さかな", specificName: "リュウグウノツカイ", name: "リュウグウノツカイ",
    emoji: "🐉", rarity: "EPIC", stageId: "deep_sea", habitat: "せかいの しんかい・ふかさ 200～1000m",
    description: "たいちょう 11m に たっする せかい さいちょうの ほねの さかな！あかい とさかと ぎんいろの ほそながい からだから『にんぎょ』『りゅうぐうの つかい』の でんせつの もとに！" },
  { animalId: "giant_squid", genericName: "イカ", specificName: "ダイオウイカ", name: "ダイオウイカ",
    emoji: "🦑", rarity: "EPIC", stageId: "deep_sea", habitat: "せかいの しんかい・ふかさ 600～1100m",
    description: "ぜんちょう 13m・めは バスケットボール おおきさ の せかい さいだいの イカ！マッコウクジラと たたかう でんせつの そんざい！2012ねんに おがさわら おきで さつえいに せかい はじめて せいこう！" },
  { animalId: "blue_whale", genericName: "クジラ", specificName: "シロナガスクジラ", name: "シロナガスクジラ",
    emoji: "🐋", rarity: "EPIC", stageId: "deep_sea", habitat: "せかいの がいよう",
    description: "たいちょう 30m・たいじゅう 200t！しじょう さいだいの どうぶつ！きょうりゅうより おおきい！しんぞうは けいじどうしゃ サイズ、なきごえは 1600キロ さきまで とどく！" },
  { animalId: "humpback_whale", genericName: "クジラ", specificName: "ザトウクジラ", name: "ザトウクジラ",
    emoji: "🐋", rarity: "RARE", stageId: "deep_sea", habitat: "せかいの うみ",
    description: "ながい ヒレと きょくに とんだ うたごえで ゆうめい！おすの こいの うたは 30ぷん つづく ことも！うみから おおきく ジャンプする すがたは いやしの あいてとう！" },
  { animalId: "dolphin_bottlenose", genericName: "イルカ", specificName: "ハンドウイルカ", name: "ハンドウイルカ",
    emoji: "🐬", rarity: "RARE", stageId: "deep_sea", habitat: "せかいの あたたかい うみ",
    description: "すいぞくかんで おなじみの ともだち！じこ にんしき（じぶんの すがたを かがみで わかる）が できる かしこい うみの にんしゃ！すいみんは のうの はんぶんずつ！" },
  { animalId: "sea_turtle", genericName: "カメ", specificName: "アオウミガメ", name: "アオウミガメ",
    emoji: "🐢", rarity: "RARE", stageId: "deep_sea", habitat: "せかいの ねったい・あねったい うみ",
    description: "うまれた はまべに もどって たまごを うむ ナビゲーション めいじん！1ぴき あたり 100ねん ちかく いきる ことも！うみの りゅうかいを なんびゃくキロも およぐ！" },
  { animalId: "coelacanth", genericName: "さかな", specificName: "シーラカンス", name: "シーラカンス",
    emoji: "🐟", rarity: "EPIC", stageId: "deep_sea", habitat: "コモロしょとう・インドネシアおきの しんかい",
    description: "4おくねん まえから すがたを ほとんど かえずに いきつづける『いきた かせき』！1938ねんに みなみアフリカで さいはっけんされるまで ぜつめつしたと おもわれていた！" },
  { animalId: "narwhal", genericName: "クジラ", specificName: "イッカク（うみの ユニコーン）", name: "イッカク",
    emoji: "🐳", rarity: "EPIC", stageId: "deep_sea", habitat: "ほっきょくかい",
    description: "ほっきょくの うみに すむ つの の はえた クジラ！じつは つので なく、ねじれた『きば』！ながさ 3m！『うみの ユニコーン』と よばれる ふしぎな いきもの！" },
  { animalId: "megalodon", genericName: "サメ", specificName: "メガロドン", name: "メガロドン",
    emoji: "🦈", rarity: "LEGENDARY", stageId: "deep_sea", habitat: "むかしの ぜんせかいの うみ",
    description: "やく 300まんねん まえまで いきていた しじょう さいだいの サメ！たいちょう 18m・はの おおきさ 18cm！いまの ホホジロザメの 3ばい いじょう！クジラさえ たべた！", isExtinct: true },

  // ══════════════════════════════════════════
  // 🦖 恐竜時代ステージ（〜21種）
  // ══════════════════════════════════════════
  { animalId: "compsognathus", genericName: "きょうりゅう", specificName: "コンプソグナトゥス", name: "コンプソグナトゥス",
    emoji: "🦎", rarity: "COMMON", stageId: "cretaceous", habitat: "ジュラき まっきの ヨーロッパ",
    description: "ぜんちょう 1m・たいじゅう 3kg の ちいさな にくしょく きょうりゅう！にわとりほどの サイズで、トカゲや むしを たべた！おなかから トカゲが まるごと みつかった！", isExtinct: true },
  { animalId: "iguanodon", genericName: "きょうりゅう", specificName: "イグアノドン", name: "イグアノドン",
    emoji: "🦕", rarity: "COMMON", stageId: "cretaceous", habitat: "はくあき ぜんきの ヨーロッパ・きたアメリカ",
    description: "1822ねんに せかいで 2ばんめに なづけられた きょうりゅう！おやゆびに おおきな トゲを もって、ぼうぎょや ごはんに つかった！はじめは はなの うえの つのと まちがえられた！", isExtinct: true },
  { animalId: "archaeopteryx", genericName: "とり", specificName: "シソチョウ", name: "シソチョウ",
    emoji: "🦅", rarity: "RARE", stageId: "cretaceous", habitat: "ジュラき まっきの ヨーロッパ",
    description: "きょうりゅうと とりの あいだ！うろこと はねの りょうほうを もつ ふしぎな いきもの。ながさ 50cm。とぶ ことが できたかは いまも なぞ！とりの ごせんぞ かもしれない！", isExtinct: true },
  { animalId: "velociraptor", genericName: "きょうりゅう", specificName: "ヴェロキラプトル", name: "ヴェロキラプトル",
    emoji: "🦖", rarity: "RARE", stageId: "cretaceous", habitat: "はくあき こうきの モンゴル",
    description: "じっさいは シチメンチョウほどの サイズで ぜんしんに はねが あった ちいさな じゅうきゃくるい！うしろあしの かまづめで えものに とびかかった！えいがでは おおきく えがかれた！", isExtinct: true },
  { animalId: "parasaurolophus", genericName: "きょうりゅう", specificName: "パラサウロロフス", name: "パラサウロロフス",
    emoji: "🦕", rarity: "RARE", stageId: "cretaceous", habitat: "はくあき こうきの きたアメリカ",
    description: "あたまから うしろに ながく のびた『つの の トランペット』が トレードマーク！なかが つうろに なっていて、ふいて おおきな おとを だして なかまを よんだと いわれている！", isExtinct: true },
  { animalId: "stegosaurus", genericName: "きょうりゅう", specificName: "ステゴサウルス", name: "ステゴサウルス",
    emoji: "🦕", rarity: "RARE", stageId: "cretaceous", habitat: "ジュラき こうきの きたアメリカ",
    description: "せなかの 17まいの こつばん は たいおん ちょうせつと ぼうぎょの きのうを かねた！のうの おおきさは クルミの サイズ！しっぽの 4ぼんの トゲで みを まもった！", isExtinct: true },
  { animalId: "ankylosaurus", genericName: "きょうりゅう", specificName: "アンキロサウルス", name: "アンキロサウルス",
    emoji: "🦕", rarity: "RARE", stageId: "cretaceous", habitat: "はくあき こうきの きたアメリカ",
    description: "ぜんしんを ほねの よろいと トゲで かためた せんしゃの ような きょうりゅう！しっぽの さきに 20kg の こんぼうで、ティラノサウルスの あしを ほねおりさせる いりょく！", isExtinct: true },
  { animalId: "pteranodon", genericName: "翼竜", specificName: "プテラノドン", name: "プテラノドン",
    emoji: "🦅", rarity: "RARE", stageId: "cretaceous", habitat: "はくあき こうきの きたアメリカ",
    description: "つばさを ひろげると 7m の きょだいな よくりゅう！はが なく、うしろに そった おおきな トサカが とくちょう！うみの うえを とんで さかなを すくいあげた！", isExtinct: true },
  { animalId: "spinosaurus", genericName: "きょうりゅう", specificName: "スピノサウルス", name: "スピノサウルス",
    emoji: "🦖", rarity: "EPIC", stageId: "cretaceous", habitat: "はくあき ちゅうきの きたアフリカ",
    description: "ティラノサウルスより おおきい ぜんちょう 15m の しじょう さいだい きゅうの にくしょくじゅうきゃくるい！せなかに 2m の ほが あり、ワニみたいに みず の なかで くらした！", isExtinct: true },
  { animalId: "allosaurus", genericName: "きょうりゅう", specificName: "アロサウルス", name: "アロサウルス",
    emoji: "🦖", rarity: "EPIC", stageId: "cretaceous", habitat: "ジュラき こうきの きたアメリカ",
    description: "ジュラき の さいきょう プレデター！ぜんちょう 12m。ティラノサウルスより 8000まんねん まえに いきていた じゅうきゃくるいの おう！むれで かりした かもしれない！", isExtinct: true },
  { animalId: "carnotaurus", genericName: "きょうりゅう", specificName: "カルノタウルス", name: "カルノタウルス",
    emoji: "🦖", rarity: "EPIC", stageId: "cretaceous", habitat: "はくあき こうきの みなみアメリカ",
    description: "あたまに 2ぽんの ツノが はえた めずらしい にくしょく きょうりゅう！ぜんちょう 8m。じそく 50キロで はしる はやい ハンターだったかも！」（みじかい てが チャームポイント！", isExtinct: true },
  { animalId: "diplodocus", genericName: "きょうりゅう", specificName: "ディプロドクス", name: "ディプロドクス",
    emoji: "🦕", rarity: "EPIC", stageId: "cretaceous", habitat: "ジュラき こうきの きたアメリカ",
    description: "ぜんちょう 33m！くびと しっぽが すっごく ながい くさしょく きょうりゅう！しっぽを むちみたいに ふって おとが おんそく を こえる ことも あった！", isExtinct: true },
  { animalId: "ichthyosaurus", genericName: "海棲爬虫類", specificName: "イクチオサウルス", name: "イクチオサウルス",
    emoji: "🐬", rarity: "EPIC", stageId: "cretaceous", habitat: "ジュラき～はくあきの うみ",
    description: "イルカそっくりの すがたを した うみの は虫るい！ぜんちょう 2m。きょうりゅうじだいに うみで くらした、たまごでなく こを うむ めずらしい は虫るい！", isExtinct: true },
  { animalId: "plesiosaurus", genericName: "海棲爬虫類", specificName: "プレシオサウルス", name: "プレシオサウルス",
    emoji: "🐢", rarity: "EPIC", stageId: "cretaceous", habitat: "ジュラき～はくあきの うみ",
    description: "ながい くびと 4まいの ヒレを もつ うみの は虫るい！ぜんちょう 3～5m。スコットランドの ネス湖の かいぶつ ネッシーの モデルとも いわれる！", isExtinct: true },
  { animalId: "quetzalcoatlus", genericName: "翼竜", specificName: "ケツァルコアトルス", name: "ケツァルコアトルス",
    emoji: "🦅", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "はくあき こうきの きたアメリカ",
    description: "せかい さいだいの そらを とぶ いきもの！つばさを ひろげると 11m！キリンの たかさで そらを とぶ、ふしぎな きょだい よくりゅう！", isExtinct: true },
  { animalId: "trex", genericName: "きょうりゅう", specificName: "ティラノサウルス・レックス", name: "ティラノサウルス・レックス",
    emoji: "🦖", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "はくあき まっきの きたアメリカ",
    description: "しじょう さいきょう きゅうの にくしょく きょうりゅう！アゴの かむ ちからは 6トン で てっこうも くだく！たいちょう 13m・たいじゅう 9トン！『T. rex』の かせきは 50たい いじょう みつかった！", isExtinct: true },
  { animalId: "triceratops", genericName: "きょうりゅう", specificName: "トリケラトプス", name: "トリケラトプス",
    emoji: "🦕", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "はくあき まっきの きたアメリカ",
    description: "3ぼんの ツノと おおきな フリルを もつ くさしょく きょうりゅう！はくあき まっきに ティラノサウルスと おなじ じだいを いきた！フリルは たいおん ちょうせつや なかまの あいず！", isExtinct: true },
  { animalId: "brachiosaurus", genericName: "きょうりゅう", specificName: "ブラキオサウルス", name: "ブラキオサウルス",
    emoji: "🦕", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "ジュラき こうきの きたアメリカ",
    description: "ジュラき に いきた ちょうきょだいな くさしょく きょうりゅう！くびが ながく たいちょう 25m・たいじゅう 80トン！まえあしが うしろあしより ながく せなかが まえに かたむいてる！", isExtinct: true },
  { animalId: "mosasaurus", genericName: "海棲爬虫類", specificName: "モササウルス", name: "モササウルス",
    emoji: "🐊", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "はくあき こうきの せかいの うみ",
    description: "はくあき まっきの うみを しはいした ぜんちょう 17m の うみの は虫るい！トカゲから しんかし、いまの オオトカゲや ヘビの とおえん。サメさえ かみくだいた うみの ぜったい おうじゃ！", isExtinct: true },
  { animalId: "tyrannosaurus", genericName: "きょうりゅう", specificName: "【恐竜王】ティラノサウルス", name: "【恐竜王】ティラノサウルス",
    emoji: "🦖", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "はくあき まっきの きたアメリカ（でんせつ）",
    description: "すべての きょうりゅうの なかでも さいきょうと よばれる でんせつの おうじゃ！アゴの ちからは 6トンを こえ、ほねごと かみくだく！はねが あった かのうせいも！", isExtinct: true },

  // ══════════════════════════════════════════
  // 🐉 伝説ステージ（〜11種）
  // ══════════════════════════════════════════
  { animalId: "hercules_beetle", genericName: "かぶとむし", specificName: "【昆虫王】ヘラクレスオオカブト", name: "【昆虫王】ヘラクレスオオカブト",
    emoji: "🪲", rarity: "LEGENDARY", stageId: "mythos", habitat: "ちゅうなんべいの ねったいうりん（でんせつ）",
    description: "せかい さいちょうの カブトムシで ツノを いれて 18cm こえ！ちゅうなんべいの ねったいうりんに すみ、じぶんの たいじゅうの 850ばいの ちからを もつ！" },
  { animalId: "lion_king", genericName: "ライオン", specificName: "【百獣の王】ライオン", name: "【百獣の王】ライオン",
    emoji: "🦁", rarity: "LEGENDARY", stageId: "mythos", habitat: "サバンナの でんせつの こたい",
    description: "サバンナに くんりんする でんせつの おう！むれを ひきいる オスの たてがみは としで くろくなるほど つよさの あかし。ほえごえは 8キロ さきまで！" },
  { animalId: "dragon", genericName: "りゅう", specificName: "ヨーロッパドラゴン", name: "ヨーロッパドラゴン",
    emoji: "🐉", rarity: "LEGENDARY", stageId: "mythos", habitat: "ちゅうせいヨーロッパの でんせつ",
    description: "ヨーロッパの でんせつの きょだいな よくりゅう。ほのおを はき、たからものを まもると いわれる。ちゅうせい ヨーロッパの きしの でんせつに かかせない そんざい！" },
  { animalId: "unicorn", genericName: "ユニコーン", specificName: "ユニコーン", name: "ユニコーン",
    emoji: "🦄", rarity: "LEGENDARY", stageId: "mythos", habitat: "せいよう・ケルトの でんしょう",
    description: "ヨーロッパの でんせつの 1ぽんツノの しろい うま。ツノには どくを けす ちからが あり、じゅんすいな こころの ひとに ちかよると いわれる！スコットランドの こくしょう！" },
  { animalId: "phoenix", genericName: "ほうおう", specificName: "フェニックス（不死鳥）", name: "フェニックス",
    emoji: "🔥", rarity: "LEGENDARY", stageId: "mythos", habitat: "こだいエジプト～ギリシャの でんしょう",
    description: "500ねん に 1かい みずから ほのおに とびこみ、はいの なかから さいせい する ふしの とり！こだい エジプトの たいよう神 ラーの けしん『ベンヌ』が きげん！" },
  { animalId: "kraken", genericName: "イカ", specificName: "クラーケン", name: "クラーケン",
    emoji: "🦑", rarity: "LEGENDARY", stageId: "mythos", habitat: "ほくおうの でんしょうの うみ",
    description: "ノルウェー おきに ひそむ でんせつの きょだい うみ いきもの！ふねを まるごと のみこむ サイズで、あしは やまと みまちがえる ほどだという！" },
  { animalId: "pegasus", genericName: "ペガサス", specificName: "ペガサス", name: "ペガサス",
    emoji: "🐎", rarity: "LEGENDARY", stageId: "mythos", habitat: "ギリシャしんわの でんしょう",
    description: "ギリシャしんわの つばさが はえた しろい うま！えいゆう ペルセウスが のった！じめんを たたくと いずみが わきだす ふしぎな ちからを もつ そらの しんじゅう！" },
  { animalId: "cerberus", genericName: "ケルベロス", specificName: "ケルベロス", name: "ケルベロス",
    emoji: "🐕", rarity: "LEGENDARY", stageId: "mythos", habitat: "ギリシャしんわの じごく",
    description: "ギリシャしんわの じごくの もんばん いぬ！あたまが 3つで、しっぽは ヘビ、せなかには ドラゴンの くびが ある！どうぞが あつまる にぎやかな ばんけん！" },
  { animalId: "yeti", genericName: "ゆきおとこ", specificName: "イエティ", name: "イエティ",
    emoji: "🦍", rarity: "LEGENDARY", stageId: "mythos", habitat: "ヒマラヤの こうざん",
    description: "ヒマラヤの ゆきやまに すむと いわれる ゆきおとこ！しろい けに おおわれた おおきな かげが もくげき される けれど、いまも なぞの ままの でんせつの けもの！" },
  { animalId: "ryujin", genericName: "りゅう", specificName: "りゅうじん（龍神）", name: "りゅうじん",
    emoji: "🐲", rarity: "LEGENDARY", stageId: "mythos", habitat: "にほんの しんわ",
    description: "にほんしんわの うみと あめを つかさどる かみさま！りゅうぐうじょうに すみ、しおの たまを じざいに あやつる！うみの あらしも おだやかな てんきも おもいのまま！" },
  { animalId: "dragon_king", genericName: "りゅう", specificName: "【幻獣王】ドラゴン", name: "【幻獣王】ドラゴン",
    emoji: "🐉", rarity: "LEGENDARY", stageId: "mythos", habitat: "ぜんせかいの でんしょう",
    description: "とうようと せいよう すべての でんせつを こえた げんじゅうかいの ぜったい おうじゃ！だいちを ゆるがす ほえごえ、てっこうを とかす ほのお、そらを かける きょだいな つばさ！" },
];

async function main() {
  // 既存ユーザー・履歴・捕獲記録をクリアしてからシード（開発用途）。
  await prisma.questSubmission.deleteMany();
  await prisma.specialBonusNotification.deleteMany();
  await prisma.caughtAnimal.deleteMany();
  await prisma.gachaTransaction.deleteMany();
  await prisma.coinTransaction.deleteMany();
  await prisma.user.deleteMany();

  for (const child of CHILDREN) {
    const created = await prisma.user.create({
      data: {
        name: child.name,
        birthDate: new Date(child.birthDate),
        role: "CHILD",
        coinBalance: 0,
      },
    });
    console.log(`Seeded child: ${created.name} (${created.id})`);
  }

  const testUser = await prisma.user.create({
    data: {
      name: "🧪 テスト",
      birthDate: new Date("2000-01-01"),
      role: "CHILD",
      coinBalance: 99999,
      isTestAccount: true,
    },
  });
  console.log(`Seeded test user: ${testUser.name} (${testUser.id})`);

  for (const item of INVENTORY) {
    const upserted = await prisma.sharedInventoryItem.upsert({
      where: { itemId: item.itemId },
      update: {
        itemName: item.itemName,
        itemType: item.itemType,
        quantity: item.quantity,
      },
      create: {
        itemId: item.itemId,
        itemName: item.itemName,
        itemType: item.itemType,
        quantity: item.quantity,
      },
    });
    console.log(
      `Seeded item: ${upserted.itemName} x${upserted.quantity} (${upserted.itemType})`,
    );
  }

  // Stage マスタ
  const stageIdToDbId = new Map<string, string>();
  for (const s of STAGES) {
    const upserted = await prisma.stage.upsert({
      where: { stageId: s.stageId },
      update: {
        name: s.name,
        emoji: s.emoji,
        description: s.description,
        sortOrder: s.sortOrder,
      },
      create: {
        stageId: s.stageId,
        name: s.name,
        emoji: s.emoji,
        description: s.description,
        sortOrder: s.sortOrder,
      },
    });
    stageIdToDbId.set(s.stageId, upserted.id);
    console.log(`Seeded stage: ${upserted.emoji} ${upserted.name}`);
  }

  // Tool マスタ
  for (const t of TOOLS) {
    const toolData = {
      name: t.name,
      emoji: t.emoji,
      description: t.description,
      historicalContext: t.historicalContext,
      type: t.type,
      successRateBonus: t.successRateBonus,
      inventoryItemId: t.inventoryItemId ?? null,
      consumable: t.consumable,
      era: t.era,
      location: t.location,
      sortOrder: t.sortOrder,
    };
    const upserted = await prisma.tool.upsert({
      where: { toolId: t.toolId },
      update: toolData,
      create: { toolId: t.toolId, ...toolData },
    });
    console.log(`Seeded tool:  ${upserted.emoji} ${upserted.name} [${upserted.type}]`);
  }

  // Material マスタ
  for (const m of MATERIALS) {
    const upserted = await prisma.material.upsert({
      where: { materialId: m.materialId },
      update: { name: m.name, emoji: m.emoji, description: m.description },
      create: { materialId: m.materialId, name: m.name, emoji: m.emoji, description: m.description },
    });
    console.log(`Seeded material: ${upserted.emoji} ${upserted.name}`);
  }

  // テストユーザーに初期素材を付与（各10個）
  const testUsers = await prisma.user.findMany({
    where: { isTestAccount: true, role: "CHILD" },
    select: { id: true, name: true },
  });
  for (const user of testUsers) {
    const materials = await prisma.material.findMany();
    for (const mat of materials) {
      await prisma.userMaterial.upsert({
        where: { userId_materialId: { userId: user.id, materialId: mat.id } },
        update: {},  // 既存は変えない（量が減っていたら戻さない）
        create: { userId: user.id, materialId: mat.id, quantity: 10 },
      });
    }
    // テストユーザーに全道具を1個ずつ付与
    const tools = await prisma.tool.findMany();
    for (const tool of tools) {
      await prisma.userTool.upsert({
        where: { userId_toolId: { userId: user.id, toolId: tool.id } },
        update: {},
        create: { userId: user.id, toolId: tool.id, quantity: 3 },
      });
    }
    console.log(`Seeded UserMaterial + UserTool for test user: ${user.name}`);
  }

  // stageId → デフォルト era / location マッピング
  const ERA_BY_STAGE: Record<string, string> = {
    savanna:    "げんだい（いま）",
    forest:     "げんだい（いま）",
    ice_age:    "こおりのじだい（やく260まんねんまえ〜1まんねんまえ）",
    deep_sea:   "げんだい（いま）",
    cretaceous: "きょうりゅうじだい（やく6600まんねんまえ）",
    mythos:     "でんせつのじだい",
  };
  const LOCATION_BY_STAGE: Record<string, string> = {
    savanna:    "アフリカ",
    forest:     "ユーラシア",
    ice_age:    "ユーラシア・アメリカ",
    deep_sea:   "かいよう",
    cretaceous: "せかいかくち",
    mythos:     "せかい",
  };

  // Animal マスタ
  let animalSeedCount = 0;
  for (const animal of ANIMALS) {
    const stageDbId = stageIdToDbId.get(animal.stageId) ?? null;
    const data = {
      name: animal.name,
      genericName: animal.genericName,
      specificName: animal.specificName,
      emoji: animal.emoji,
      rarity: animal.rarity,
      description: animal.description,
      habitat: animal.habitat,
      era: ERA_BY_STAGE[animal.stageId] ?? "げんだい（いま）",
      location: LOCATION_BY_STAGE[animal.stageId] ?? "せかいかくち",
      isExtinct: animal.isExtinct ?? false,
      imageUrl: animal.imageUrl ?? null,
      stageId: stageDbId,
    };
    const upserted = await prisma.animal.upsert({
      where: { animalId: animal.animalId },
      update: data,
      create: { animalId: animal.animalId, ...data },
    });
    const extinctMark = upserted.isExtinct ? "💀" : "";
    animalSeedCount++;
    console.log(
      `Seeded animal: ${upserted.emoji}${extinctMark} ${upserted.specificName} [${upserted.genericName}] (${upserted.rarity})`,
    );
  }

  // クエスト：title をキーに upsert
  for (const quest of QUESTS) {
    const existing = await prisma.quest.findFirst({ where: { title: quest.title } });
    const upserted = existing
      ? await prisma.quest.update({
          where: { id: existing.id },
          data: {
            description: quest.description ?? null,
            rewardCoins: quest.rewardCoins,
            emoji: quest.emoji,
            isActive: true,
          },
        })
      : await prisma.quest.create({
          data: {
            title: quest.title,
            description: quest.description ?? null,
            rewardCoins: quest.rewardCoins,
            emoji: quest.emoji,
          },
        });
    console.log(
      `Seeded quest: ${upserted.emoji} ${upserted.title} (+${upserted.rewardCoins})`,
    );
  }

  // ペナルティマスタ
  for (const p of PENALTIES) {
    const existing = await prisma.penalty.findFirst({ where: { title: p.title } });
    const upserted = existing
      ? await prisma.penalty.update({
          where: { id: existing.id },
          data: {
            description: p.description ?? null,
            coinAmount: p.coinAmount,
            emoji: p.emoji,
            isActive: true,
          },
        })
      : await prisma.penalty.create({
          data: {
            title: p.title,
            description: p.description ?? null,
            coinAmount: p.coinAmount,
            emoji: p.emoji,
          },
        });
    console.log(
      `Seeded penalty: ${upserted.emoji} ${upserted.title} (-${upserted.coinAmount})`,
    );
  }

  console.log(`\n✅ Done. Animals seeded: ${animalSeedCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
