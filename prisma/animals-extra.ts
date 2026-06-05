// ─────────────────────────────────────────────────────────────────────────────
// 動物マスタの「差分（delta）」データ。
//
// なぜ別ファイル？
//   prisma/seed.ts の `db:seed` は user / coinTransaction / caughtAnimal などを
//   deleteMany する破壊的シードなので、家族の進捗（捕まえた動物・コイン）を消して
//   しまう。新しい動物を「追加」するだけなら本ファイル + upsert-animals.ts を使い、
//   進捗を一切消さずに DB へ反映できる。
//
//   - EXTRA_ANIMALS      … 追加していく実在の具体種（毎晩のスケジュールがここへ追記）
//   - REMOVED_ANIMAL_IDS … 実在動物のみ方針で DB から消す旧・幻獣（mythos）
//   - RELOCATIONS        … 旧 mythos から実在ステージへ移設する SSR
//   - REMOVED_STAGE_IDS  … 中身を移設・削除して空になった不要ステージ
//
// 反映方法:  npm run db:animals   （= tsx prisma/upsert-animals.ts）
// ─────────────────────────────────────────────────────────────────────────────

export type ExtraAnimal = {
  // ロジック上の一意キー（英小文字 + アンダースコア。例: "elephant_african"）
  animalId: string;
  // 大分類＝ゲーム中＆図鑑の「なかま」名（例: "ぞう"）。図鑑のドリルダウンの第1階層になる。
  genericName: string;
  // 具体種名＝図鑑に載る詳細名（例: "アフリカゾウ"）。これが「リアルな動物」の肝。
  specificName: string;
  emoji: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  // 子供向け（ひらがな・カタカナ中心）の約100字解説。
  description: string;
  // 生息地の自由記述（例: "アフリカの サバンナ"）。
  habitat: string;
  // 所属ステージ。実在の5ステージのいずれか。
  stageId: "savanna" | "forest" | "ice_age" | "deep_sea" | "cretaceous";
  isExtinct?: boolean;
  // 現実の平均寿命（年）。ゲーム内ではこの日数ぶん生存する。
  lifespanYears?: number;
};

// stageId → デフォルト era / location（seed.ts のマッピングと揃える）。
export const ERA_BY_STAGE: Record<string, string> = {
  savanna: "げんだい（いま）",
  forest: "げんだい（いま）",
  ice_age: "こおりのじだい（やく260まんねんまえ〜1まんねんまえ）",
  deep_sea: "げんだい（いま）",
  cretaceous: "きょうりゅうじだい（やく6600まんねんまえ）",
};

export const LOCATION_BY_STAGE: Record<string, string> = {
  savanna: "アフリカ",
  forest: "ユーラシア",
  ice_age: "ユーラシア・アメリカ",
  deep_sea: "かいよう",
  cretaceous: "せかいかくち",
};

// 実在動物のみ方針で DB から削除する旧・幻獣（mythos ステージ）の animalId。
// ※ Animal を消すと CaughtAnimal は onDelete: Cascade で連動削除される
//   （= 過去に捕まえた幻獣は図鑑から消える）。相棒設定は SetNull で安全。
export const REMOVED_ANIMAL_IDS: string[] = [
  "dragon",
  "unicorn",
  "phoenix",
  "kraken",
  "pegasus",
  "cerberus",
  "yeti",
  "ryujin",
  "dragon_king",
];

// 旧 mythos にいた「実在の王者」を、それぞれの実在ステージへ移設する（stageId を更新）。
export const RELOCATIONS: Array<{ animalId: string; stageId: ExtraAnimal["stageId"] }> = [
  { animalId: "hercules_beetle", stageId: "forest" },
  { animalId: "lion_king", stageId: "savanna" },
];

// 全動物を移設・削除した後に消す、空の不要ステージ。
export const REMOVED_STAGE_IDS: string[] = ["mythos"];

// ─────────────────────────────────────────────────────────────────────────────
// 毎晩のスケジュールが少しずつ追記していく「実在の具体種」。
//
// 方針:
//   - 抽象名ではなく具体種を入れる（× ゾウ → ○ アフリカゾウ / アジアゾウ）。
//   - できれば既存の genericName の配下を厚くして「いろんな◯◯」を比べられるように。
//   - animalId は一意・英小文字。重複しても upsert なので安全（更新になる）。
//   - 累計で +100 種ほどを目標にゆっくり増やす。
// ─────────────────────────────────────────────────────────────────────────────
export const EXTRA_ANIMALS: ExtraAnimal[] = [
  // ── ペンギンの なかまを あつめる（既存: コウテイペンギン）──
  {
    animalId: "penguin_gentoo",
    genericName: "ペンギン",
    specificName: "ジェンツーペンギン",
    emoji: "🐧",
    rarity: "COMMON",
    description:
      "ペンギンの なかまで いちばん はやく およげるよ。じそく36キロも だせるんだって！あたまの しろい もようと、オレンジいろの くちばしが めじるし。",
    habitat: "なんきょくの ちかくの しま",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  {
    animalId: "penguin_adelie",
    genericName: "ペンギン",
    specificName: "アデリーペンギン",
    emoji: "🐧",
    rarity: "COMMON",
    description:
      "みなみきょくに すむ ちいさめの ペンギン。めの まわりが しろくて まんまる。すを いしころで つくり、メスに きれいな いしを プレゼントするんだよ。",
    habitat: "なんきょくの かいがん",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  {
    animalId: "penguin_king",
    genericName: "ペンギン",
    specificName: "キングペンギン",
    emoji: "🐧",
    rarity: "RARE",
    description:
      "コウテイペンギンの つぎに おおきい ペンギン。くびもとの きいろい もようが きれい。あかちゃんは ちゃいろの ふわふわで、おやと ぜんぜん にてないよ！",
    habitat: "みなみの つめたい うみの しま",
    stageId: "ice_age",
    lifespanYears: 20,
  },
  // ── カメの なかまを あつめる（既存: アオウミガメ）──
  {
    animalId: "turtle_galapagos",
    genericName: "カメ",
    specificName: "ガラパゴスゾウガメ",
    emoji: "🐢",
    rarity: "EPIC",
    description:
      "せかいで いちばん おおきい りくの カメ。100ねん いじょうも いきるよ。ごはんを たべなくても なんかげつも へいきな、ながいきの たつじん。",
    habitat: "ガラパゴスしょとうの しま",
    stageId: "forest",
    lifespanYears: 100,
  },
  {
    animalId: "turtle_leatherback",
    genericName: "カメ",
    specificName: "オサガメ",
    emoji: "🐢",
    rarity: "RARE",
    description:
      "ウミガメの なかまで いちばん おおきく、こうらの ながさは 2メートルちかく。つめたい うみでも およげる、めずらしい カメだよ。",
    habitat: "せかいじゅうの うみ",
    stageId: "deep_sea",
    lifespanYears: 45,
  },
  // ── ふくろうの なかまを あつめる（既存: ワシミミズク・シマフクロウ・シロフクロウ）──
  {
    animalId: "owl_barn",
    genericName: "ふくろう",
    specificName: "メンフクロウ",
    emoji: "🦉",
    rarity: "COMMON",
    description:
      "かおが ハートがたの フクロウ。くらやみでも おとだけで ネズミの ばしょが わかるほど、みみが とても いいんだ。",
    habitat: "せかいじゅうの のはら",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── イルカの なかまを あつめる（既存: ハンドウイルカ）──
  {
    animalId: "dolphin_common",
    genericName: "イルカ",
    specificName: "マイルカ",
    emoji: "🐬",
    rarity: "COMMON",
    description:
      "せかいの うみに ひろく すむ イルカ。からだの よこの すなどけいみたいな もようが めじるし。むれで すばやく およぐよ。",
    habitat: "せかいじゅうの あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  // ── わしの なかまを あつめる（既存: イヌワシ）──
  {
    animalId: "eagle_bald",
    genericName: "わし",
    specificName: "ハクトウワシ",
    emoji: "🦅",
    rarity: "RARE",
    description:
      "アメリカの こっかの とり。あたまが まっしろで かっこいい。めが とても よくて、1キロさきの さかなも みつけられるよ。",
    habitat: "きたアメリカの みずべ",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── あたらしい なかま：こうもり ──
  {
    animalId: "bat_indian_flying_fox",
    genericName: "こうもり",
    specificName: "インドオオコウモリ",
    emoji: "🦇",
    rarity: "RARE",
    description:
      "つばさを ひろげると 1.2メートルにもなる おおきな コウモリ。くだものが だいすきで、ちょうおんぱは つかわず めで みて とぶんだよ。",
    habitat: "インドの もりや まち",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：インコ ──
  {
    animalId: "macaw_blue_and_yellow",
    genericName: "インコ",
    specificName: "ルリコンゴウインコ",
    emoji: "🦜",
    rarity: "RARE",
    description:
      "あおと きいろの からだが きれいな おおきな インコ。とても かしこくて、ひとの ことばを まねできるよ。50ねん いじょうも いきる ながいきさん。",
    habitat: "みなみアメリカの ねったいうりん",
    stageId: "forest",
    lifespanYears: 50,
  },
  // ── あたらしい なかま：ふくろう ──
  {
    animalId: "owl_scops",
    genericName: "ふくろう",
    specificName: "コノハズク",
    emoji: "🦉",
    rarity: "COMMON",
    description:
      "てのひらに のるくらい ちいさな ふくろう。「ぶっぽうそう」と なくので むかしの ひとは べつの とりが ないていると おもっていたんだって。",
    habitat: "アジアの もり",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── あたらしい なかま：わし ──
  {
    animalId: "eagle_white_tailed",
    genericName: "わし",
    specificName: "オジロワシ",
    emoji: "🦅",
    rarity: "RARE",
    description:
      "しっぽの はねが まっしろな おおきな わし。さかなが だいすきで、みずうみの うえを とびながら つめで さっと つかまえるよ。",
    habitat: "うみべや みずうみの ちかく",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── あたらしい なかま：たか ──
  {
    animalId: "hawk_goshawk",
    genericName: "たか",
    specificName: "オオタカ",
    emoji: "🦅",
    rarity: "RARE",
    description:
      "もりの なかを すばやく とびまわる たか。むかしから「たかがり」で ひとと いっしょに かりを する なかよしの とりだったんだよ。",
    habitat: "もりや のはら",
    stageId: "forest",
    lifespanYears: 19,
  },
  // ── あたらしい なかま：はやぶさ ──
  {
    animalId: "falcon_peregrine",
    genericName: "はやぶさ",
    specificName: "ハヤブサ",
    emoji: "🦅",
    rarity: "RARE",
    description:
      "えものに むかって とぶときの はやさは じそく 300キロ いじょう！どうぶつの なかで いちばん はやく とべる ハンターなんだ。",
    habitat: "がけや ビルの たかいところ",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── あたらしい なかま：へび ──
  {
    animalId: "snake_python",
    genericName: "へび",
    specificName: "アミメニシキヘビ",
    emoji: "🐍",
    rarity: "RARE",
    description:
      "ながさが 6メートルを こえることもある せかいで いちばん ながい へび。どくは なくて、からだで ぎゅっと まいて えものを つかまえるよ。",
    habitat: "とうなんアジアの もり",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "snake_king_cobra",
    genericName: "へび",
    specificName: "キングコブラ",
    emoji: "🐍",
    rarity: "EPIC",
    description:
      "どくへびの なかで いちばん ながい へび。おこると からだの まえを たかく もちあげて、くびを ひろげて あいてを おどかすんだ。",
    habitat: "インドや とうなんアジアの もり",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：とかげ ──
  {
    animalId: "lizard_komodo",
    genericName: "とかげ",
    specificName: "コモドオオトカゲ",
    emoji: "🦎",
    rarity: "EPIC",
    description:
      "せかいで いちばん おおきな とかげで、ながさは 3メートルにもなる。したを ぺろぺろ だして においを かぎ、とおくの えものを みつけるよ。",
    habitat: "インドネシアの しま",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── あたらしい なかま：あざらし ──
  {
    animalId: "seal_spotted",
    genericName: "あざらし",
    specificName: "ゴマフアザラシ",
    emoji: "🦭",
    rarity: "COMMON",
    description:
      "からだに ごまみたいな くろい もようが ある アザラシ。あかちゃんは まっしろな ふわふわの けに つつまれて うまれてくるよ。",
    habitat: "きたの つめたい うみ",
    stageId: "ice_age",
    lifespanYears: 30,
  },
  {
    animalId: "seal_leopard",
    genericName: "あざらし",
    specificName: "ヒョウアザラシ",
    emoji: "🦭",
    rarity: "RARE",
    description:
      "ヒョウみたいな もようの なんきょくの アザラシ。およぐのが とても はやくて、ペンギンを おいかけて つかまえる つよい ハンターなんだ。",
    habitat: "なんきょくの うみ",
    stageId: "ice_age",
    lifespanYears: 26,
  },
  // ── あたらしい なかま：おうむ ──
  {
    animalId: "parrot_african_grey",
    genericName: "おうむ",
    specificName: "ヨウム",
    emoji: "🦜",
    rarity: "RARE",
    description:
      "はいいろの からだの かしこい おうむ。ひとの ことばを たくさん おぼえて、いみを わかって つかうことも できる とても あたまの いい とり。",
    habitat: "アフリカの もり",
    stageId: "forest",
    lifespanYears: 50,
  },
];
