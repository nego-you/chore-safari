// 子供 + 共有インベントリ + Stage / Tool / どうぶつ図鑑マスタの初期データ投入。
//
// 2026-05-17 大規模改修:
//   - Stage（サバンナ・森林・氷河期・深海・恐竜時代・伝説）と
//     Tool（落とし穴・トラバサミ・アトラトル・複合弓 ほか）を追加。
//   - Animal は stageId / habitat / isExtinct を含む 100+ 種を投入。

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

// 共有倉庫の初期アイテム。
const INVENTORY: InventorySeed[] = [
  // エサ
  { itemId: "meat", itemName: "おにく", itemType: "FOOD", quantity: 1 },
  { itemId: "fish", itemName: "おさかな", itemType: "FOOD", quantity: 0 },
  { itemId: "berry", itemName: "きのみ", itemType: "FOOD", quantity: 0 },
  // 罠パーツ
  { itemId: "rope", itemName: "ロープ", itemType: "TRAP_PART", quantity: 3 },
  { itemId: "wood", itemName: "きのいた", itemType: "TRAP_PART", quantity: 0 },
  { itemId: "net", itemName: "あみ", itemType: "TRAP_PART", quantity: 0 },
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
      "アフリカに広がる広大な草原。背の高い草と点在するアカシアの木の下に、ライオン・ゾウ・キリン・チーターなどダイナミックな大型哺乳類が集まる。",
    sortOrder: 10,
  },
  {
    stageId: "forest",
    name: "森林",
    emoji: "🌳",
    description:
      "温帯〜亜寒帯の深い森。日本列島の里山からヨーロッパの針葉樹林まで、ウサギ・リス・タヌキ・クマ・オオカミなど多様な動物がひっそり暮らす。",
    sortOrder: 20,
  },
  {
    stageId: "ice_age",
    name: "氷河期",
    emoji: "🧊",
    description:
      "約260万年前から1万年前まで続いた更新世の氷河時代。マンモス・サーベルタイガー・ケナガサイなど、寒さに適応した巨大哺乳類が地表を闊歩していた。",
    sortOrder: 30,
  },
  {
    stageId: "deep_sea",
    name: "深海",
    emoji: "🌊",
    description:
      "光が届かない水深200m以下の世界。発光器を持つチョウチンアンコウ、巨大なダイオウイカ、リュウグウノツカイなど、未だ謎の多い生物が息づく。",
    sortOrder: 40,
  },
  {
    stageId: "cretaceous",
    name: "恐竜時代",
    emoji: "🦖",
    description:
      "中生代ジュラ紀〜白亜紀の地球。ティラノサウルスやトリケラトプスなど、史上最強の生物たちが地表・空・海を支配していた約6600万年前以前の世界。",
    sortOrder: 50,
  },
  {
    stageId: "mythos",
    name: "伝説",
    emoji: "🐉",
    description:
      "古今東西の神話・伝承に登場する幻の生き物たち。ドラゴン・ユニコーン・フェニックス・クラーケンなど、想像力が産んだ究極の存在が眠るステージ。",
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
  type: "TRAP" | "BOW" | "SPEAR";
  successRateBonus: number;
  inventoryItemId?: string;
  consumable: boolean;
  sortOrder: number;
};

const TOOLS: ToolSeed[] = [
  // ── パッシブ罠 ─────────────────────────────────
  {
    toolId: "pitfall",
    name: "落とし穴",
    emoji: "🕳️",
    description: "地面に穴を掘って獲物が落ちるのを待つ最も古典的な罠。大型動物にも有効。",
    historicalContext:
      "落とし穴は人類が獣を狩るために使った最古の罠のひとつ。中国の周口店遺跡からは約50万年前のものと推定される遺構も見つかっており、マンモスやサイ等の大型哺乳類を捕らえるために世界各地で使われてきた。",
    type: "TRAP",
    successRateBonus: 0.0,
    inventoryItemId: "wood",
    consumable: true,
    sortOrder: 10,
  },
  {
    toolId: "leghold",
    name: "トラバサミ",
    emoji: "🪤",
    description: "獲物の足を挟むばね式の罠。中型獣に有効。",
    historicalContext:
      "金属製のばねトラップは18世紀の北米毛皮交易で広く普及。それ以前にも木と縄を使った同型のスナップトラップが、縄文時代の日本やシベリアの先住民により使われていた。現代では動物福祉の観点から多くの国で規制されている。",
    type: "TRAP",
    successRateBonus: 0.1,
    inventoryItemId: "rope",
    consumable: true,
    sortOrder: 20,
  },
  {
    toolId: "snare_net",
    name: "あみワナ",
    emoji: "🕸️",
    description: "天井から落とすネット。小〜中型の動物を傷つけずに捕獲できる。",
    historicalContext:
      "投網・落とし網の起源は1万年以上前。古代エジプトの壁画にも鳥猟用の網が描かれている。現代の生態学調査でも非殺傷捕獲の標準的な道具として使われ続けている。",
    type: "TRAP",
    successRateBonus: 0.15,
    inventoryItemId: "net",
    consumable: true,
    sortOrder: 30,
  },

  // ── アクティブ：投擲武器（SPEAR） ───────────────
  {
    toolId: "atlatl",
    name: "アトラトル（投槍器）",
    emoji: "🏹",
    description: "槍に「てこ」を加えて飛距離と威力を倍増させた投擲器。中型獣を一撃で。",
    historicalContext:
      "アトラトルは今から約3万年前、後期旧石器時代のヨーロッパで発明された人類最初の機械武器。長さ約60cmのてこの原理で槍の初速を2倍以上に増幅し、マンモスやバイソンの狩猟を可能にした。アステカ語の「投げ槍」が語源。",
    type: "SPEAR",
    successRateBonus: 0.25,
    consumable: false,
    sortOrder: 40,
  },
  {
    toolId: "harpoon",
    name: "もり（銛）",
    emoji: "🔱",
    description: "返しのついた魚介専用の投擲武器。深海生物にも届く。",
    historicalContext:
      "銛は約9万年前のアフリカ・カタンダ遺跡で骨製のものが発見されており、人類最古級の漁具とされる。日本でも縄文時代の貝塚から黒曜石・骨角製の銛が多数出土し、マグロやクジラの捕獲に使われた。",
    type: "SPEAR",
    successRateBonus: 0.3,
    consumable: false,
    sortOrder: 50,
  },

  // ── アクティブ：飛び道具（BOW） ─────────────────
  {
    toolId: "compound_bow",
    name: "複合弓",
    emoji: "🏹",
    description: "滑車を組み合わせて引きを軽くした近代弓。大型獣も一射で仕留める。",
    historicalContext:
      "複合弓（コンパウンドボウ）は1966年にアメリカの技術者ホリー・アレンが特許を取得した近代弓。ケーブルと滑車により最大引き重量を1/2以下に下げ、命中時の運動エネルギーは長弓の約2倍。現代ハンティングの主力武器。",
    type: "BOW",
    successRateBonus: 0.4,
    consumable: false,
    sortOrder: 60,
  },
  {
    toolId: "longbow",
    name: "長弓",
    emoji: "🏹",
    description: "古典的な木製の弓。コストは低く、レアな獲物にも狙える。",
    historicalContext:
      "ウェールズ・イングランド産の長弓（イチイ材）は中世ヨーロッパの戦場を支配し、1346年のクレシーの戦いでは仏騎兵を壊滅させた。射程は200m超、毎分10〜12射の速射力を誇り、火砲が普及するまで「ロングボウマン」は戦略兵器だった。",
    type: "BOW",
    successRateBonus: 0.2,
    consumable: false,
    sortOrder: 70,
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
  // 約100文字の詳細解説（図鑑用）
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

// ペナルティ初期データ。target_users 空＝全員に適用可能。
const PENALTIES: PenaltySeed[] = [
  { title: "けんか", description: "きょうだい げんかをした", coinAmount: 50, emoji: "🚨" },
  { title: "うそをついた", description: "うそを ついて あやまらなかった", coinAmount: 80, emoji: "🤥" },
  { title: "かたづけない", description: "おもちゃを ちらかしっぱなし", coinAmount: 20, emoji: "🧹" },
  { title: "やくそく やぶり", description: "ねるじかんを まもらなかった", coinAmount: 30, emoji: "⏰" },
];

// 親が承認するクエスト一覧。子供3人共通で使えるイメージ。
const QUESTS: QuestSeed[] = [
  { title: "おふろそうじ", description: "おふろを ピカピカに してね", rewardCoins: 50, emoji: "🛁" },
  { title: "ほんを1さつよむ", description: "さいごまで よめたら しんこく", rewardCoins: 30, emoji: "📖" },
  { title: "あさ4時半におきる", description: "アラームを じぶんで とめて おきよう", rewardCoins: 100, emoji: "⏰" },
  { title: "おもちゃをかたづける", description: "リビングの おもちゃを ぜんぶ もとに もどす", rewardCoins: 20, emoji: "🧸" },
  { title: "おはなみずやり", description: "ベランダの おはなに みずを あげる", rewardCoins: 15, emoji: "🌱" },
  { title: "テストでまんてん", description: "がっこうの テスト 100てん", rewardCoins: 300, emoji: "💯" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 図鑑マスタ（本格博物学版・100+ 種）
//   genericName = ゲーム中の抽象名 / specificName = 図鑑の詳細種名
// ─────────────────────────────────────────────────────────────────────────────
const ANIMALS: AnimalSeed[] = [
  // ══════════════════════════════════════════
  // 🌳 森林ステージ
  // ══════════════════════════════════════════
  {
    animalId: "rabbit_japanese",
    genericName: "うさぎ", specificName: "ニホンノウサギ", name: "ニホンノウサギ",
    emoji: "🐰", rarity: "COMMON", stageId: "forest", habitat: "日本の山野・草地",
    description: "日本の山や森に広く生息するウサギ。冬になると毛が白くなり、雪景色に溶け込む。後ろ足が長く、時速50kmで走ることができる。草や木の芽を食べる草食動物だ。",
  },
  {
    animalId: "rabbit_european",
    genericName: "うさぎ", specificName: "アナウサギ", name: "アナウサギ",
    emoji: "🐇", rarity: "COMMON", stageId: "forest", habitat: "ヨーロッパの草原・農地",
    description: "ヨーロッパ原産で、地面に複雑なトンネルを掘って集団で暮らす。現在のペットウサギはすべてアナウサギが先祖。目が頭の横についており、ほぼ360度見渡せる。",
  },
  {
    animalId: "squirrel_japanese",
    genericName: "りす", specificName: "ニホンリス", name: "ニホンリス",
    emoji: "🐿️", rarity: "COMMON", stageId: "forest", habitat: "本州・四国・九州の森林",
    description: "日本固有の小型リス。冬眠前にドングリや木の実を地面に埋めて貯める。しかし埋めた場所を忘れることも多く、そのまま芽が出て森が育つ。ふわふわの尻尾が特徴的。",
  },
  {
    animalId: "squirrel_flying",
    genericName: "りす", specificName: "モモンガ", name: "モモンガ",
    emoji: "🐿️", rarity: "COMMON", stageId: "forest", habitat: "亜寒帯〜温帯の針葉樹林",
    description: "前脚と後脚の間に広がる「飛膜」を使って木から木へとグライダーのように滑空する。最大で100メートルも飛ぶことがある。夜行性で、大きな目が暗闇でも見える。",
  },
  {
    animalId: "deer_japanese",
    genericName: "しか", specificName: "ニホンジカ", name: "ニホンジカ",
    emoji: "🦌", rarity: "COMMON", stageId: "forest", habitat: "日本全土の森林・山地",
    description: "日本全国に生息するシカ。オスだけが毎年生え変わる立派なツノを持つ。秋になると「バン！」と大きな鳴き声（ラッティング）でメスを呼ぶ。奈良公園のシカが有名。",
  },
  {
    animalId: "boar_japanese",
    genericName: "いのしし", specificName: "ニホンイノシシ", name: "ニホンイノシシ",
    emoji: "🐗", rarity: "COMMON", stageId: "forest", habitat: "日本の山林・里山",
    description: "日本の山野に生息するイノシシ。鼻先が強靭で、地面を掘って根っこや虫を探す。猪突猛進という言葉があるほど一直線に走る。子供はウリ坊と呼ばれ縞模様がかわいい。",
  },
  {
    animalId: "raccoon_dog",
    genericName: "たぬき", specificName: "ホンドタヌキ", name: "ホンドタヌキ",
    emoji: "🦝", rarity: "COMMON", stageId: "forest", habitat: "日本の里山・市街地周辺",
    description: "日本固有亜種のタヌキ。イヌ科の動物だが、冬になると冬眠に近い状態で過ごす珍しい習性を持つ。雑食性で何でも食べる。「化けるのがうまい」と昔話でも有名な動物。",
  },
  {
    animalId: "fox_red",
    genericName: "きつね", specificName: "キタキツネ", name: "キタキツネ",
    emoji: "🦊", rarity: "RARE", stageId: "forest", habitat: "北海道・サハリンの森林",
    description: "北海道に生息するアカギツネの亜種。雪の上に耳をそばだて、雪の下のネズミの動く音を聞いて垂直に飛び上がって捕らえる「マウシング」が得意。賢くて適応力が高い。",
  },
  {
    animalId: "wolf_gray",
    genericName: "おおかみ", specificName: "タイリクオオカミ", name: "タイリクオオカミ",
    emoji: "🐺", rarity: "RARE", stageId: "forest", habitat: "ユーラシア大陸・北米の森林・ツンドラ",
    description: "イヌの祖先。ユーラシア大陸に広く分布し、5〜15頭の群れで行動する。群れにはリーダーのアルファペアがいて社会性が高い。遠吠えで群れの仲間に位置を知らせる。",
  },
  {
    animalId: "wolf_japanese",
    genericName: "おおかみ", specificName: "ニホンオオカミ", name: "ニホンオオカミ",
    emoji: "🐺", rarity: "RARE", stageId: "forest", habitat: "かつての日本列島（本州・四国・九州）",
    description: "かつて日本に生息したオオカミ。明治時代に絶滅した。世界最小のオオカミで、山の神として祀られる地域もあった。最後の個体は1905年に奈良県で記録されている。",
    isExtinct: true,
  },
  {
    animalId: "bear_brown",
    genericName: "くま", specificName: "ヒグマ", name: "ヒグマ",
    emoji: "🐻", rarity: "RARE", stageId: "forest", habitat: "北海道の森林・河川敷",
    description: "日本最大の陸上動物で北海道に生息。体重は500kgを超えることも。秋にサケをとって食べ、冬眠前に大量の脂肪を蓄える。嗅覚はイヌの7倍以上と言われるほど鋭い。",
  },
  {
    animalId: "bear_black_asia",
    genericName: "くま", specificName: "ツキノワグマ", name: "ツキノワグマ",
    emoji: "🐻", rarity: "RARE", stageId: "forest", habitat: "本州・四国の山林",
    description: "胸に三日月型の白い模様を持つことが名前の由来。木登りが得意で、ドングリやハチミツを求めて高い木にも登る。日本本州の代表的な大型獣で、近年は里山との接触も多い。",
  },
  {
    animalId: "owl_horned",
    genericName: "ふくろう", specificName: "ワシミミズク", name: "ワシミミズク",
    emoji: "🦉", rarity: "RARE", stageId: "forest", habitat: "ユーラシア大陸の岩場・森林",
    description: "翼開長180cmにもなる世界最大級のフクロウ。羽毛にギザギザの構造があり、ほぼ無音で飛ぶ。首は270度回転でき、暗闇でも獲物を正確に捕らえる夜の王者。",
  },
  {
    animalId: "owl_snowy",
    genericName: "ふくろう", specificName: "シロフクロウ", name: "シロフクロウ",
    emoji: "🦉", rarity: "RARE", stageId: "forest", habitat: "北極圏のツンドラ",
    description: "北極圏に生息する真っ白なフクロウ。雪原で完璧なカモフラージュとなる。他のフクロウと違い昼にも活動する。ハリー・ポッターのヘドウィグのモデルでも有名。",
  },
  {
    animalId: "beaver",
    genericName: "ビーバー", specificName: "アメリカビーバー", name: "アメリカビーバー",
    emoji: "🦫", rarity: "RARE", stageId: "forest", habitat: "北米の河川・湖沼",
    description: "強靭な歯で木を切り倒し、川にダムを建設する建築家。作るダムは長さ1km・住居の池を生み出す。北米の生態系を作り変える「キーストーン種」として知られる。",
  },
  {
    animalId: "chimpanzee",
    genericName: "さる", specificName: "チンパンジー", name: "チンパンジー",
    emoji: "🐒", rarity: "RARE", stageId: "forest", habitat: "中央・西アフリカの熱帯雨林",
    description: "人間のDNAと98.7%一致する最も近い親戚。石を使ってナッツを割ったり、木の枝を加工してアリを釣ったりと道具を使う。感情が豊かで仲間と抱擁やキスで挨拶する。",
  },
  {
    animalId: "gorilla",
    genericName: "ゴリラ", specificName: "ニシローランドゴリラ", name: "ニシローランドゴリラ",
    emoji: "🦍", rarity: "EPIC", stageId: "forest", habitat: "アフリカ中部の熱帯雨林",
    description: "最大の霊長類で体重は200kgを超えることも。実は温厚な草食寄りの動物で、危険を感じたときにだけ胸を叩くドラミングを行う。手話を覚えることができるほど知能が高い。",
  },
  {
    animalId: "panda",
    genericName: "パンダ", specificName: "ジャイアントパンダ", name: "ジャイアントパンダ",
    emoji: "🐼", rarity: "EPIC", stageId: "forest", habitat: "中国四川省の竹林",
    description: "中国の標高1500m以上の竹林に生息する世界の人気者。クマ科でありながら99%が竹の食事。1日12時間以上竹を食べ続け、生涯のほとんどを食事に費やす不思議な大型獣。",
  },
  {
    animalId: "tiger_bengal",
    genericName: "とら", specificName: "ベンガルトラ", name: "ベンガルトラ",
    emoji: "🐅", rarity: "EPIC", stageId: "forest", habitat: "インド・バングラデシュの熱帯雨林",
    description: "世界最大のネコ科動物でインドを中心に生息。縞模様は個体ごとに異なり指紋のようなもの。単独で行動し、広大ななわばりを持つ。泳ぎが得意でワニを捕食することも。",
  },
  {
    animalId: "tiger_white",
    genericName: "とら", specificName: "ホワイトタイガー", name: "ホワイトタイガー",
    emoji: "🐅", rarity: "EPIC", stageId: "forest", habitat: "インド亜大陸（突然変異個体）",
    description: "色素が薄い突然変異のベンガルトラ。青い目と白い毛に黒縞という幻想的な姿。野生では非常に珍しく、自然界では目立ちすぎて狩りに不利とも言われる。",
  },

  // ══════════════════════════════════════════
  // 🦁 サバンナステージ
  // ══════════════════════════════════════════
  {
    animalId: "zebra_plains",
    genericName: "しまうま", specificName: "サバンナシマウマ", name: "サバンナシマウマ",
    emoji: "🦓", rarity: "COMMON", stageId: "savanna", habitat: "東〜南アフリカの草原",
    description: "黒と白の縞模様は個体ごとに違い、群れで集まると目がくらんで捕食者が個体を狙えなくなると考えられている。1日に20km以上を移動し、毎年大規模な群れの移動を行う。",
  },
  {
    animalId: "wildebeest",
    genericName: "ヌー", specificName: "オグロヌー", name: "オグロヌー",
    emoji: "🐃", rarity: "COMMON", stageId: "savanna", habitat: "東アフリカのサバンナ",
    description: "毎年150万頭が雨を追って大移動する「ヌーの大移動」で有名。マラ川を渡る際にワニに襲われる映像はサバンナの厳しさを象徴する。生まれた子牛は数分で立ち上がる。",
  },
  {
    animalId: "meerkat",
    genericName: "ミーアキャット", specificName: "ミーアキャット", name: "ミーアキャット",
    emoji: "🐾", rarity: "COMMON", stageId: "savanna", habitat: "南部アフリカの乾燥草原",
    description: "群れで地面に複雑な巣穴を掘って暮らす。見張り役の個体が直立で立ち、空のワシ・地上のヘビなどに合わせた鳴き声を使い分ける高度な社会性を持つ小型肉食獣。",
  },
  {
    animalId: "warthog",
    genericName: "イノシシ", specificName: "イボイノシシ", name: "イボイノシシ",
    emoji: "🐗", rarity: "COMMON", stageId: "savanna", habitat: "サハラ以南の草原",
    description: "顔の左右にある特徴的なイボが名前の由来。ライオン等から逃げる時は驚異の時速55km。普段は他の動物が掘った巣穴をリフォームして寝る、合理的なサバンナの住人。",
  },
  {
    animalId: "ostrich",
    genericName: "ダチョウ", specificName: "ダチョウ", name: "ダチョウ",
    emoji: "🦤", rarity: "COMMON", stageId: "savanna", habitat: "アフリカの乾燥地・サバンナ",
    description: "現存する世界最大の鳥で身長は2.7mに達する。空は飛べないが時速70kmで走り、強い脚の蹴りはライオンの頭蓋骨を砕く威力。卵は鳥類最大で1個1.5kgにもなる。",
  },
  {
    animalId: "giraffe",
    genericName: "キリン", specificName: "アミメキリン", name: "アミメキリン",
    emoji: "🦒", rarity: "RARE", stageId: "savanna", habitat: "東アフリカのサバンナ",
    description: "首だけで2mを超え、舌は50cmにもなる。心臓は体重比で最大級の重さで、首の上まで血液を送る。アカシアの棘だらけの葉も、長い舌で器用に巻き取って食べる。",
  },
  {
    animalId: "hyena_spotted",
    genericName: "ハイエナ", specificName: "ブチハイエナ", name: "ブチハイエナ",
    emoji: "🐕", rarity: "RARE", stageId: "savanna", habitat: "サハラ以南のアフリカ",
    description: "屍肉あさりというイメージとは裏腹に獲物の70%以上を自力で狩る優秀なハンター。アゴの咬合力は1100psi（約77kgf/cm²）で骨を砕く。群れはメスがリーダー。",
  },
  {
    animalId: "leopard",
    genericName: "ヒョウ", specificName: "ヒョウ", name: "ヒョウ",
    emoji: "🐆", rarity: "RARE", stageId: "savanna", habitat: "アフリカ・アジアの森林・サバンナ",
    description: "自分の3倍体重のシカでも木の上に運び上げる怪力の持ち主。完璧に近い夜行性のステルスハンターで、人の気配を察すると音もなく姿を消す。ネコ科最強の身体能力を誇る。",
  },
  {
    animalId: "rhino_black",
    genericName: "サイ", specificName: "クロサイ", name: "クロサイ",
    emoji: "🦏", rarity: "RARE", stageId: "savanna", habitat: "東〜南アフリカのサバンナ",
    description: "アフリカに残る2種のサイの1種。角はケラチン（爪と同じ成分）でできており、密猟により野生個体は5000頭を切る。視力は弱いが嗅覚と聴覚で周囲を察知する。",
  },
  {
    animalId: "rhino_white",
    genericName: "サイ", specificName: "シロサイ", name: "シロサイ",
    emoji: "🦏", rarity: "RARE", stageId: "savanna", habitat: "南アフリカの草原",
    description: "陸上動物ではゾウに次ぐ大きさで体重2.3t超。北部亜種は2018年に最後のオスが死亡し、機能的絶滅状態。現在は人工授精による種の保存が試みられている。",
  },
  {
    animalId: "lion",
    genericName: "ライオン", specificName: "アフリカライオン", name: "アフリカライオン",
    emoji: "🦁", rarity: "EPIC", stageId: "savanna", habitat: "サハラ以南アフリカのサバンナ",
    description: "百獣の王と呼ばれるネコ科最大級の動物。オスのたてがみが美しい。群れ（プライド）で暮らす唯一のネコ科で、狩りはメスが担う。遠吠えは8km先まで届く。",
  },
  {
    animalId: "lion_white",
    genericName: "ライオン", specificName: "ホワイトライオン", name: "ホワイトライオン",
    emoji: "🦁", rarity: "EPIC", stageId: "savanna", habitat: "南アフリカ・ティンババティ地方",
    description: "南アフリカのティンババティ地域に生まれる、突然変異による白いライオン。色素が薄くなる「リューシズム」という遺伝子変異によるもの。野生での目撃はきわめて珍しい。",
  },
  {
    animalId: "elephant_african",
    genericName: "ぞう", specificName: "アフリカゾウ", name: "アフリカゾウ",
    emoji: "🐘", rarity: "EPIC", stageId: "savanna", habitat: "サハラ以南のアフリカ全域",
    description: "陸上最大の動物で体重は6トンにも達する。鼻は筋肉だけで構成され15万本の筋肉繊維を持つ。知能が高く、死んだ仲間の骨を撫でる「弔い」の行動も確認されている。",
  },
  {
    animalId: "elephant_asian",
    genericName: "ぞう", specificName: "アジアゾウ", name: "アジアゾウ",
    emoji: "🐘", rarity: "EPIC", stageId: "savanna", habitat: "インド〜東南アジアの森林・草原",
    description: "アフリカゾウより小型で耳が小さい。インドから東南アジアに生息。古くから人と共に働いてきた歴史を持ち、仏教では神聖な動物とされる。鏡で自分を認識できる賢さがある。",
  },
  {
    animalId: "cheetah",
    genericName: "チーター", specificName: "チーター", name: "チーター",
    emoji: "🐆", rarity: "EPIC", stageId: "savanna", habitat: "アフリカのサバンナ",
    description: "陸上最速の動物で時速110kmを超える瞬発力を持つ。ただし長距離は走れず30秒ほどで力尽きる。爪が引っ込まないため路面を蹴る力が強い。狩りの成功率は50%以上と高い。",
  },
  {
    animalId: "buffalo_cape",
    genericName: "バッファロー", specificName: "ケープバッファロー", name: "ケープバッファロー",
    emoji: "🐃", rarity: "EPIC", stageId: "savanna", habitat: "サハラ以南アフリカの草原",
    description: "「黒い死神」の異名を持つアフリカ五大獣の一角。群れで結束し、ライオン以上に人を死に至らしめるとも言われる。角は左右の幅が1mに達し、頭で互いを守り合う。",
  },
  {
    animalId: "fennec_fox",
    genericName: "きつね", specificName: "フェネック", name: "フェネック",
    emoji: "🦊", rarity: "RARE", stageId: "savanna", habitat: "サハラ砂漠・北アフリカ",
    description: "世界最小のキツネ。サハラ砂漠に生息し、体の割に巨大な耳で砂漠の熱を放散して体を冷やす。耳は聴力にも優れ、地下に潜った獲物の音も聞き取れる。夜行性で砂に穴を掘る。",
  },

  // ══════════════════════════════════════════
  // 🧊 氷河期ステージ
  // ══════════════════════════════════════════
  {
    animalId: "reindeer",
    genericName: "しか", specificName: "トナカイ", name: "トナカイ",
    emoji: "🦌", rarity: "COMMON", stageId: "ice_age", habitat: "北極圏のツンドラ・タイガ",
    description: "シカの仲間で唯一、オスもメスもツノを持つ珍しい種。北極圏の厳しい寒さに適応し、蹄（ひづめ）は雪をしっかり踏みしめる形になっている。集団で長距離を移動する。",
  },
  {
    animalId: "musk_ox",
    genericName: "うし", specificName: "ジャコウウシ", name: "ジャコウウシ",
    emoji: "🐂", rarity: "COMMON", stageId: "ice_age", habitat: "カナダ北部・グリーンランドのツンドラ",
    description: "氷河期から生き残った数少ない哺乳類のひとつ。長い毛と厚い体毛で-40℃にも耐える。襲われると円陣を組み、子供を中心に守る防衛行動が知られる。",
  },
  {
    animalId: "arctic_fox",
    genericName: "きつね", specificName: "ホッキョクギツネ", name: "ホッキョクギツネ",
    emoji: "🦊", rarity: "COMMON", stageId: "ice_age", habitat: "北極圏のツンドラ・氷原",
    description: "夏は茶色、冬は真っ白に毛が変わる。耳と鼻が小さく寒さで凍るのを防ぐ。-50℃の極寒でも生き残れる哺乳類最強クラスの耐寒能力を持つ。",
  },
  {
    animalId: "polar_bear",
    genericName: "くま", specificName: "ホッキョクグマ", name: "ホッキョクグマ",
    emoji: "🐻‍❄️", rarity: "RARE", stageId: "ice_age", habitat: "北極海の氷原",
    description: "北極に生息する世界最大の肉食陸上動物。白く見える毛は実は透明で、光を反射して白く見える。アザラシを主食とし、泳ぎも得意。水中を時速10kmで泳ぐことができる。",
  },
  {
    animalId: "snow_leopard",
    genericName: "ヒョウ", specificName: "ユキヒョウ", name: "ユキヒョウ",
    emoji: "🐆", rarity: "RARE", stageId: "ice_age", habitat: "中央アジアの高山地帯",
    description: "標高3000〜6000mの岩山に生息する希少なネコ科。垂直50mの崖を駆け下りる驚異的なジャンプ力を持ち、自分の体長の6倍を一跳びで飛ぶ。野生個体は推定4000頭以下。",
  },
  {
    animalId: "walrus",
    genericName: "セイウチ", specificName: "セイウチ", name: "セイウチ",
    emoji: "🦭", rarity: "RARE", stageId: "ice_age", habitat: "北極圏の海岸・氷上",
    description: "1mを超える牙はオスメス両方が持ち、氷に穴をあけて呼吸したり、流氷を登る杖として使う。体重1.5tの巨体で海底のハマグリを吸い込み、舌で殻を割って中身を食べる。",
  },
  {
    animalId: "saiga",
    genericName: "アンテロープ", specificName: "サイガアンテロープ", name: "サイガアンテロープ",
    emoji: "🐐", rarity: "RARE", stageId: "ice_age", habitat: "中央アジアの乾燥草原",
    description: "氷河期から生き続ける「生きた化石」。象徴的な垂れた鼻は、冬は冷気を温め、夏は砂を濾す多機能器官。2015年には謎の細菌で20万頭が大量死し絶滅危機にある。",
  },
  {
    animalId: "elephant_mammoth",
    genericName: "ぞう", specificName: "ケナガマンモス", name: "ケナガマンモス",
    emoji: "🦣", rarity: "EPIC", stageId: "ice_age", habitat: "更新世のユーラシア・北米のツンドラ",
    description: "約4000年前まで生きていたゾウの仲間。長い湾曲したキバと厚い毛皮が特徴で、氷河期の寒さに適応していた。シベリアの永久凍土からほぼ完全な遺体が発見されている。",
    isExtinct: true,
  },
  {
    animalId: "sabertooth",
    genericName: "ねこ", specificName: "スミロドン（サーベルタイガー）", name: "スミロドン",
    emoji: "🐯", rarity: "EPIC", stageId: "ice_age", habitat: "更新世の南北アメリカ",
    description: "上顎から28cmもの剣のような牙を生やした史上最強級の肉食獣。約1万年前に絶滅した。獲物のノドを牙で切り裂く狩りをしていたと考えられる。化石は数千点見つかっている。",
    isExtinct: true,
  },
  {
    animalId: "woolly_rhino",
    genericName: "サイ", specificName: "ケナガサイ", name: "ケナガサイ",
    emoji: "🦏", rarity: "EPIC", stageId: "ice_age", habitat: "更新世のユーラシア大陸",
    description: "全身を厚い毛で覆われた氷河期のサイ。2本の角の前方の角は長さ1mに達し、雪をかき分けて草を食べた。ネアンデルタール人や旧石器時代の人類に狩られた可能性が高い。",
    isExtinct: true,
  },
  {
    animalId: "megaloceros",
    genericName: "しか", specificName: "オオツノジカ", name: "オオツノジカ",
    emoji: "🦌", rarity: "EPIC", stageId: "ice_age", habitat: "更新世のユーラシア大陸",
    description: "ツノの幅が3.6mにも達した史上最大級のシカ。約7700年前まで生存していた。アイルランドの泥炭層から完全な骨格が多数発掘され、別名アイリッシュエルクとも呼ばれる。",
    isExtinct: true,
  },
  {
    animalId: "dire_wolf",
    genericName: "おおかみ", specificName: "ダイアウルフ", name: "ダイアウルフ",
    emoji: "🐺", rarity: "EPIC", stageId: "ice_age", habitat: "更新世の北米",
    description: "現在のハイイロオオカミより一回り大きく、咬む力は1.5倍。約1万年前に絶滅した氷河期の頂点捕食者の一角。ロサンゼルスのラ・ブレア・タールピットから4000体の化石が見つかっている。",
    isExtinct: true,
  },
  {
    animalId: "glyptodon",
    genericName: "アルマジロ", specificName: "グリプトドン", name: "グリプトドン",
    emoji: "🐢", rarity: "EPIC", stageId: "ice_age", habitat: "更新世の南北アメリカ",
    description: "全長3m・体重2tの巨大アルマジロ。背中は1000枚以上の骨片で覆われた頑強な甲羅で、車1台ぶんの重さ。尾の先には敵を殴る棍棒のような骨塊を備えていた。",
    isExtinct: true,
  },

  // ══════════════════════════════════════════
  // 🌊 深海ステージ
  // ══════════════════════════════════════════
  {
    animalId: "clownfish",
    genericName: "さかな", specificName: "カクレクマノミ", name: "カクレクマノミ",
    emoji: "🐠", rarity: "COMMON", stageId: "deep_sea", habitat: "インド洋〜西太平洋のサンゴ礁",
    description: "イソギンチャクの毒に耐性を持ち共生する。体表の粘液が毒を中和する。生まれた時はすべてオスで、群れの最大個体がメスに性転換する珍しい繁殖システムを持つ。",
  },
  {
    animalId: "octopus_common",
    genericName: "たこ", specificName: "マダコ", name: "マダコ",
    emoji: "🐙", rarity: "COMMON", stageId: "deep_sea", habitat: "世界中の温帯海域",
    description: "脳が9つあり（中央脳1+各腕の脳8）、皮膚で色や光を感じることができる驚異の頭脳派。瓶のフタを開けるパズルも数分で解く。寿命は1〜2年と短い。",
  },
  {
    animalId: "jellyfish_moon",
    genericName: "くらげ", specificName: "ミズクラゲ", name: "ミズクラゲ",
    emoji: "🪼", rarity: "COMMON", stageId: "deep_sea", habitat: "全世界の沿岸海域",
    description: "体の95%が水でできており、脳も心臓も骨もない。それでいて5億年以上生き残ってきた地球最古の動物グループの一員。ベニクラゲの近縁には不老不死の種もいる。",
  },
  {
    animalId: "manta_ray",
    genericName: "エイ", specificName: "オニイトマキエイ（マンタ）", name: "オニイトマキエイ",
    emoji: "🐟", rarity: "RARE", stageId: "deep_sea", habitat: "世界の熱帯〜亜熱帯海域",
    description: "ヒレの端から端まで7mに達する巨大なエイ。人間並みに賢く、鏡で自分を認識できるとされる魚類でも数少ない動物。プランクトンを濾して食べる温和な巨人。",
  },
  {
    animalId: "great_white_shark",
    genericName: "サメ", specificName: "ホホジロザメ", name: "ホホジロザメ",
    emoji: "🦈", rarity: "RARE", stageId: "deep_sea", habitat: "世界の温帯・亜熱帯海域",
    description: "体長6m超の海の頂点捕食者。鼻先には電気を感じる「ロレンチーニ器官」があり、獲物の心拍まで察知する。一生に2万本以上の歯が生え変わる、生きた狩猟マシン。",
  },
  {
    animalId: "anglerfish",
    genericName: "アンコウ", specificName: "チョウチンアンコウ", name: "チョウチンアンコウ",
    emoji: "🐟", rarity: "RARE", stageId: "deep_sea", habitat: "全世界の深海・水深200〜1000m",
    description: "頭から伸びた発光器で獲物をおびき寄せる深海のハンター。オスはメスの100分の1の大きさで、メスに噛みついて融合し精子を提供する器官になる奇妙な繁殖をする。",
  },
  {
    animalId: "vampire_squid",
    genericName: "イカ", specificName: "コウモリダコ", name: "コウモリダコ",
    emoji: "🦑", rarity: "EPIC", stageId: "deep_sea", habitat: "全世界の深海・水深600〜900m",
    description: "「地獄の吸血イカ」と呼ばれるが、イカでもタコでもない別系統の頭足類。体は青黒く目は赤い。襲われると体を裏返してトゲ状の突起で身を守る生きた化石。",
  },
  {
    animalId: "oarfish",
    genericName: "さかな", specificName: "リュウグウノツカイ", name: "リュウグウノツカイ",
    emoji: "🐉", rarity: "EPIC", stageId: "deep_sea", habitat: "全世界の深海・水深200〜1000m",
    description: "体長11mに達する世界最長の硬骨魚。赤い鶏冠と銀色の細長い体から「人魚」「龍宮の使い」の伝説の元になったとも。地震の前兆として浅瀬に現れる迷信も。",
  },
  {
    animalId: "giant_squid",
    genericName: "イカ", specificName: "ダイオウイカ", name: "ダイオウイカ",
    emoji: "🦑", rarity: "EPIC", stageId: "deep_sea", habitat: "全世界の深海・水深600〜1100m",
    description: "全長13m・目はバスケットボール大の世界最大の無脊椎動物。マッコウクジラと格闘する伝説の存在。2012年に小笠原沖で世界初の生体撮影に成功した。",
  },
  {
    animalId: "blue_whale",
    genericName: "クジラ", specificName: "シロナガスクジラ", name: "シロナガスクジラ",
    emoji: "🐋", rarity: "EPIC", stageId: "deep_sea", habitat: "全世界の外洋",
    description: "体長30m・体重200tの史上最大の動物。恐竜よりも大きい。心臓は軽自動車サイズで、鳴き声は1600km先まで届く。1日4tのオキアミを食べる海の王者。",
  },
  {
    animalId: "coelacanth",
    genericName: "さかな", specificName: "シーラカンス", name: "シーラカンス",
    emoji: "🐟", rarity: "EPIC", stageId: "deep_sea", habitat: "コモロ諸島・インドネシア沖の深海",
    description: "4億年前から姿をほぼ変えず生き続ける「生きた化石」。1938年に南アフリカで再発見されるまで絶滅したと考えられていた。両生類の祖先に近い肉鰭類の生き残り。",
  },
  {
    animalId: "megalodon",
    genericName: "サメ", specificName: "メガロドン", name: "メガロドン",
    emoji: "🦈", rarity: "LEGENDARY", stageId: "deep_sea", habitat: "新生代中新世〜鮮新世の全世界の海",
    description: "約300万年前まで生きていた史上最大のサメ。体長18m・歯の大きさ18cmという超巨大捕食者。現代のホホジロザメの3倍以上のサイズで、クジラすら捕食していたと考えられる。",
    isExtinct: true,
  },

  // ══════════════════════════════════════════
  // 🦖 恐竜時代ステージ
  // ══════════════════════════════════════════
  {
    animalId: "compsognathus",
    genericName: "きょうりゅう", specificName: "コンプソグナトゥス", name: "コンプソグナトゥス",
    emoji: "🦎", rarity: "COMMON", stageId: "cretaceous", habitat: "ジュラ紀末期のヨーロッパ",
    description: "全長1m・体重3kgの小型肉食恐竜。鶏ほどのサイズで、トカゲや昆虫を捕食していた。化石の腹部からトカゲがそのまま見つかり、最後の食事まで解明された。",
    isExtinct: true,
  },
  {
    animalId: "iguanodon",
    genericName: "きょうりゅう", specificName: "イグアノドン", name: "イグアノドン",
    emoji: "🦕", rarity: "COMMON", stageId: "cretaceous", habitat: "白亜紀前期のヨーロッパ・北米",
    description: "1822年に世界で2番目に命名された恐竜。親指に大きな円錐形のスパイクを持ち、防御や採食に使った。当初は鼻の上の角と誤解されていた発見史で有名。",
    isExtinct: true,
  },
  {
    animalId: "velociraptor",
    genericName: "きょうりゅう", specificName: "ヴェロキラプトル", name: "ヴェロキラプトル",
    emoji: "🦖", rarity: "RARE", stageId: "cretaceous", habitat: "白亜紀後期のモンゴル",
    description: "実際には七面鳥ほどのサイズで全身羽毛に覆われた小型獣脚類。後脚の鎌爪は獲物に飛びかかって押さえつけるのに使われた。映画では大型化された姿で描かれている。",
    isExtinct: true,
  },
  {
    animalId: "stegosaurus",
    genericName: "きょうりゅう", specificName: "ステゴサウルス", name: "ステゴサウルス",
    emoji: "🦕", rarity: "RARE", stageId: "cretaceous", habitat: "ジュラ紀後期の北米",
    description: "背中の17枚の骨板はサーモスタットの役割（体温調節）と防御を兼ねた。脳の大きさは体の割にクルミ大しかなかったが、4本のトゲのある尾「サゴマイザー」で身を守った。",
    isExtinct: true,
  },
  {
    animalId: "ankylosaurus",
    genericName: "きょうりゅう", specificName: "アンキロサウルス", name: "アンキロサウルス",
    emoji: "🦕", rarity: "RARE", stageId: "cretaceous", habitat: "白亜紀後期の北米",
    description: "全身を骨製の鎧と棘で覆った戦車のような恐竜。尾の先には20kgのこん棒を持ち、ティラノサウルスの脚を骨折させるほどの威力で振り回したと推定される。",
    isExtinct: true,
  },
  {
    animalId: "pteranodon",
    genericName: "翼竜", specificName: "プテラノドン", name: "プテラノドン",
    emoji: "🦅", rarity: "RARE", stageId: "cretaceous", habitat: "白亜紀後期の北米",
    description: "翼開長7mに及ぶ巨大な翼竜。歯はなく、後ろに反った大きなトサカが特徴。海面を低空飛行して魚をすくい上げるペリカン的な狩りをしていたと考えられる。",
    isExtinct: true,
  },
  {
    animalId: "spinosaurus",
    genericName: "きょうりゅう", specificName: "スピノサウルス", name: "スピノサウルス",
    emoji: "🦖", rarity: "EPIC", stageId: "cretaceous", habitat: "白亜紀中期の北アフリカ",
    description: "ティラノサウルスより大きい全長15mの史上最大級の獣脚類。背中に2mの帆を持ち、現代のワニのように半水生生活をしていた珍しい恐竜。長い口で大型魚を捕食。",
    isExtinct: true,
  },
  {
    animalId: "trex",
    genericName: "きょうりゅう", specificName: "ティラノサウルス・レックス", name: "ティラノサウルス・レックス",
    emoji: "🦖", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "白亜紀末期の北米",
    description: "白亜紀後期に生きた史上最強クラスの肉食恐竜。あごの噛む力は6トンで鋼鉄も砕く。体長13m・体重9トン。「T. rex」の化石は現在まで50体以上が発見されている。",
    isExtinct: true,
  },
  {
    animalId: "triceratops",
    genericName: "きょうりゅう", specificName: "トリケラトプス", name: "トリケラトプス",
    emoji: "🦕", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "白亜紀末期の北米",
    description: "3本のツノと大きなフリルを持つ草食恐竜。白亜紀末期に生息し、ティラノサウルスと同じ時代を生きた。フリルは体温調節や仲間への信号に使われたと考えられている。",
    isExtinct: true,
  },
  {
    animalId: "brachiosaurus",
    genericName: "きょうりゅう", specificName: "ブラキオサウルス", name: "ブラキオサウルス",
    emoji: "🦕", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "ジュラ紀後期の北米",
    description: "ジュラ紀後期に生きた超巨大な草食恐竜。首が長く体長25m・体重80トンという驚異的なサイズ。前足が後足より長いため背中が前に傾いている。高い木の葉を食べていた。",
    isExtinct: true,
  },
  {
    animalId: "mosasaurus",
    genericName: "海棲爬虫類", specificName: "モササウルス", name: "モササウルス",
    emoji: "🐊", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "白亜紀後期の世界の海",
    description: "白亜紀末期の海を支配した全長17mの海棲爬虫類。トカゲから進化し、現代のオオトカゲやヘビの遠縁。アンモナイトやサメすら噛み砕いて食べた海の絶対王者。",
    isExtinct: true,
  },
  {
    animalId: "tyrannosaurus",
    genericName: "きょうりゅう", specificName: "【恐竜王】ティラノサウルス", name: "【恐竜王】ティラノサウルス",
    emoji: "🦖", rarity: "LEGENDARY", stageId: "cretaceous", habitat: "白亜紀末期の北米（伝説個体）",
    description: "すべての恐竜の中でも最強と呼ばれる伝説の王者。あごの力は6トンを超え、骨ごと噛み砕く。最新研究では羽毛があった可能性も。地球史上最も有名な恐竜として君臨し続ける！",
    isExtinct: true,
  },

  // ══════════════════════════════════════════
  // 🐉 伝説ステージ
  // ══════════════════════════════════════════
  {
    animalId: "hercules_beetle",
    genericName: "かぶとむし", specificName: "【昆虫王】ヘラクレスオオカブト", name: "【昆虫王】ヘラクレスオオカブト",
    emoji: "🪲", rarity: "LEGENDARY", stageId: "mythos", habitat: "中南米の熱帯雨林（伝説個体）",
    description: "世界最長のカブトムシでツノを含めると18cmを超える。中南米の熱帯雨林に生息し、自分の体重の850倍という超人的な力を持つ。幼虫期間は約2年で成虫になる昆虫界の王者！",
  },
  {
    animalId: "lion_king",
    genericName: "ライオン", specificName: "【百獣の王】ライオン", name: "【百獣の王】ライオン",
    emoji: "🦁", rarity: "LEGENDARY", stageId: "mythos", habitat: "サバンナの伝説の個体",
    description: "サバンナに君臨する伝説の王。群れを率いるオスのたてがみは年齢とともに黒くなるほど強い証。吠え声は8km先まで響き渡り、すべての動物が恐れをなす。まさに百獣の王！",
  },
  {
    animalId: "dragon",
    genericName: "りゅう", specificName: "ヨーロッパドラゴン", name: "ヨーロッパドラゴン",
    emoji: "🐉", rarity: "LEGENDARY", stageId: "mythos", habitat: "中世ヨーロッパの伝説",
    description: "ヨーロッパの伝説に登場する巨大な翼竜。炎を吐き、宝物を守るとされる。古代ローマの軍旗にも描かれ、中世ヨーロッパの騎士伝説に欠かせない存在として語り継がれている。",
  },
  {
    animalId: "unicorn",
    genericName: "ユニコーン", specificName: "ユニコーン", name: "ユニコーン",
    emoji: "🦄", rarity: "LEGENDARY", stageId: "mythos", habitat: "西洋・ケルト伝承",
    description: "ヨーロッパの伝説に登場する一本ツノの白馬。ツノには毒を消す力があるとされ、純粋な心の持ち主にだけ近寄ると言われる。スコットランドの国章にも描かれた神聖な存在。",
  },
  {
    animalId: "phoenix",
    genericName: "ほうおう", specificName: "フェニックス（不死鳥）", name: "フェニックス",
    emoji: "🔥", rarity: "LEGENDARY", stageId: "mythos", habitat: "古代エジプト〜ギリシャの伝承",
    description: "500年に一度自ら炎に飛び込み、灰の中から再生する不死の鳥。古代エジプトの太陽神ラーの化身ベンヌが起源とされる。日本では「鳳凰」として平等院鳳凰堂や1万円札の意匠に。",
  },
  {
    animalId: "kraken",
    genericName: "イカ", specificName: "クラーケン", name: "クラーケン",
    emoji: "🦑", rarity: "LEGENDARY", stageId: "mythos", habitat: "北欧の伝承の海",
    description: "ノルウェー沖に潜むとされる伝説の巨大海洋生物。船を丸ごと飲み込むサイズで、足は山と見間違うほどだという。実在のダイオウイカの目撃譚が伝説の元と考えられている。",
  },
  {
    animalId: "dragon_king",
    genericName: "りゅう", specificName: "【幻獣王】ドラゴン", name: "【幻獣王】ドラゴン",
    emoji: "🐉", rarity: "LEGENDARY", stageId: "mythos", habitat: "全世界の伝承",
    description: "東洋と西洋すべての伝説を超えた幻獣界の絶対王者。大地を揺るがす咆哮、鋼鉄を溶かす炎、天を翔ける巨大な翼…。あらゆる力を持つとされる究極の存在が今ここに降臨！",
  },
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
    const upserted = await prisma.tool.upsert({
      where: { toolId: t.toolId },
      update: {
        name: t.name,
        emoji: t.emoji,
        description: t.description,
        historicalContext: t.historicalContext,
        type: t.type,
        successRateBonus: t.successRateBonus,
        inventoryItemId: t.inventoryItemId ?? null,
        consumable: t.consumable,
        sortOrder: t.sortOrder,
      },
      create: {
        toolId: t.toolId,
        name: t.name,
        emoji: t.emoji,
        description: t.description,
        historicalContext: t.historicalContext,
        type: t.type,
        successRateBonus: t.successRateBonus,
        inventoryItemId: t.inventoryItemId ?? null,
        consumable: t.consumable,
        sortOrder: t.sortOrder,
      },
    });
    console.log(`Seeded tool:  ${upserted.emoji} ${upserted.name} [${upserted.type}]`);
  }

  // Animal マスタ
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
    console.log(
      `Seeded animal: ${upserted.emoji}${extinctMark} ${upserted.specificName} [${upserted.genericName}] (${upserted.rarity})`,
    );
  }

  // クエスト：title をキーに upsert（同じ title が既にあれば報酬と説明を更新）。
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

  // ペナルティマスタ（クエストと同じく title 一致で upsert）
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

  console.log(`\n✅ Done. Animals seeded: ${ANIMALS.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
