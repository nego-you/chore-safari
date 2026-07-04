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

// genericName（図鑑の「なかま」名）のひらがな/カタカナ表記ゆれを統合する。
//   例: "いか"(オウムガイ) と "イカ"(ダイオウイカ等) が別カテゴリに割れていたのを
//   "イカ" に寄せて1つにまとめる。db:animals 実行時に既存DBへ非破壊で反映される。
export const GENERIC_NAME_MERGES: Array<{ from: string; to: string }> = [
  { from: "いか", to: "イカ" },
  { from: "いのしし", to: "イノシシ" },
];

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
  // ── ペンギンの なかまを もっと あつめる ──
  {
    animalId: "penguin_rockhopper",
    genericName: "ペンギン",
    specificName: "イワトビペンギン",
    emoji: "🐧",
    rarity: "RARE",
    description:
      "きいろい まゆげみたいな かざりばねが かっこいい ペンギン。なまえの とおり、いわばを ぴょんぴょん とびはねて すすむのが とくいなんだよ。",
    habitat: "みなみの つめたい うみの しま",
    stageId: "ice_age",
    lifespanYears: 10,
  },
  // ── わしの なかまを もっと あつめる ──
  {
    animalId: "eagle_harpy",
    genericName: "わし",
    specificName: "オウギワシ",
    emoji: "🦅",
    rarity: "EPIC",
    description:
      "せかいで いちばん つよい わしの ひとつ。あしの つめは ヒグマと おなじくらい おおきくて、サルや ナマケモノを つかまえて とぶんだ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── ふくろうの なかまを もっと あつめる ──
  {
    animalId: "owl_burrowing",
    genericName: "ふくろう",
    specificName: "アナホリフクロウ",
    emoji: "🦉",
    rarity: "COMMON",
    description:
      "じめんに あなを ほって すむ めずらしい ふくろう。ひるまも おきていて、ながい あしで くさはらを てくてく あるくよ。",
    habitat: "アメリカの くさはら",
    stageId: "savanna",
    lifespanYears: 9,
  },
  // ── へびの なかまを もっと あつめる ──
  {
    animalId: "snake_anaconda",
    genericName: "へび",
    specificName: "オオアナコンダ",
    emoji: "🐍",
    rarity: "EPIC",
    description:
      "せかいで いちばん おもい へび。おもさは 200キロを こえることも。みずの なかが だいすきで、めと はなだけ だして そっと えものを まつよ。",
    habitat: "みなみアメリカの かわや しっち",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── あざらしの なかまを もっと あつめる ──
  {
    animalId: "seal_harp",
    genericName: "あざらし",
    specificName: "タテゴトアザラシ",
    emoji: "🦭",
    rarity: "COMMON",
    description:
      "せなかの くろい もようが がっきの ハープに にている アザラシ。あかちゃんは まっしろな けで、こおりの うえで そだつんだよ。",
    habitat: "きたの こおりの うみ",
    stageId: "ice_age",
    lifespanYears: 30,
  },
  // ── イルカの なかまを もっと あつめる ──
  {
    animalId: "dolphin_pacific_white_sided",
    genericName: "イルカ",
    specificName: "カマイルカ",
    emoji: "🐬",
    rarity: "COMMON",
    description:
      "せなかが くろ、おなかが しろの すばしっこい イルカ。ふねが つくる なみに のって、たかく ジャンプするのが だいすきなんだ。",
    habitat: "きたの たいへいよう",
    stageId: "deep_sea",
    lifespanYears: 40,
  },
  // ── インコの なかまを もっと あつめる ──
  {
    animalId: "macaw_scarlet",
    genericName: "インコ",
    specificName: "アカコンゴウインコ",
    emoji: "🦜",
    rarity: "RARE",
    description:
      "まっかな からだに あおと きいろの つばさを もつ きれいな インコ。かたい きのみも、じょうぶな くちばしで かんたんに わってしまうよ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 50,
  },
  // ── あたらしい なかま：カメレオン ──
  {
    animalId: "chameleon_panther",
    genericName: "カメレオン",
    specificName: "パンサーカメレオン",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "からだの いろを かえられる とかげの なかま。みぎと ひだりの めを べつべつに うごかせて、したを からだより ながく のばして むしを とるよ。",
    habitat: "マダガスカルの もり",
    stageId: "forest",
    lifespanYears: 7,
  },
  // ── カメの なかまを もっと あつめる ──
  {
    animalId: "turtle_loggerhead",
    genericName: "カメ",
    specificName: "アカウミガメ",
    emoji: "🐢",
    rarity: "RARE",
    description:
      "たまごを うむために にほんの すなはまにも やってくる ウミガメ。あごの ちからが とても つよくて、かたい かいや カニも バリバリ たべるんだ。",
    habitat: "たいへいようや にほんの うみ",
    stageId: "deep_sea",
    lifespanYears: 60,
  },
  // ── はやぶさの なかまを もっと あつめる ──
  {
    animalId: "falcon_kestrel",
    genericName: "はやぶさ",
    specificName: "チョウゲンボウ",
    emoji: "🦅",
    rarity: "COMMON",
    description:
      "そらの おなじ ばしょで はねを ふるわせ、ぴたっと とまって とべる はやぶさの なかま。うえから のねずみを みつけて、さっと つかまえるよ。",
    habitat: "かわらや のはら",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── ペンギンの なかまを もっと あつめる ──
  {
    animalId: "penguin_chinstrap",
    genericName: "ペンギン",
    specificName: "ヒゲペンギン",
    emoji: "🐧",
    rarity: "COMMON",
    description:
      "あごの したに くろい せんが あって、ヒゲみたいに みえる ペンギン。せかいで いちばん かずが おおい ペンギンの ひとつで、なんびゃくまんわも あつまって くらすよ。",
    habitat: "なんきょくの かいがんや しま",
    stageId: "ice_age",
    lifespanYears: 20,
  },
  // ── サメの なかまを あつめる（既存: ホホジロザメ・ジンベエザメ）──
  {
    animalId: "shark_hammerhead",
    genericName: "サメ",
    specificName: "アカシュモクザメ",
    emoji: "🦈",
    rarity: "RARE",
    description:
      "あたまが ハンマーみたいな かたちの サメ。めが ひだりと みぎに はなれているから、まわりを ひろーく みわたせるんだ。むれで およぐ めずらしい サメだよ。",
    habitat: "あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  // ── クジラの なかまを もっと あつめる ──
  {
    animalId: "whale_sperm",
    genericName: "クジラ",
    specificName: "マッコウクジラ",
    emoji: "🐳",
    rarity: "EPIC",
    description:
      "はの ある どうぶつで せかいいち おおきい クジラ。いきを とめて 1じかん いじょう、ふかさ 2000メートルまで もぐって ダイオウイカを つかまえるんだ。",
    habitat: "せかいじゅうの ふかい うみ",
    stageId: "deep_sea",
    lifespanYears: 70,
  },
  // ── あたらしい なかま：ラッコ ──
  {
    animalId: "sea_otter",
    genericName: "ラッコ",
    specificName: "ラッコ",
    emoji: "🦦",
    rarity: "RARE",
    description:
      "うみに ぷかぷか うかんで くらす どうぶつ。おなかの うえで いしを つかって かいを わって たべるよ。ねるときは ながされないように かいそうを からだに まくんだ。",
    habitat: "きたの たいへいようの うみべ",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  // ── たかの なかまを もっと あつめる ──
  {
    animalId: "hawk_black_kite",
    genericName: "たか",
    specificName: "トビ",
    emoji: "🦅",
    rarity: "COMMON",
    description:
      "「ピーヒョロロ」と なきながら そらを くるくる まわる たかの なかま。はばたかずに かぜに のって とぶのが とくいで、にほんで いちばん みぢかな たかだよ。",
    habitat: "にほんじゅうの そらや かわら",
    stageId: "forest",
    lifespanYears: 24,
  },
  // ── とかげの なかまを もっと あつめる ──
  {
    animalId: "lizard_green_iguana",
    genericName: "とかげ",
    specificName: "グリーンイグアナ",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "みどりいろの おおきな とかげ。きのうえで くらして、はっぱを たべるよ。あぶないと たかい きから かわに とびこんで、すいすい およいで にげるんだ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── あたらしい なかま：くじゃく ──
  {
    animalId: "peacock_indian",
    genericName: "くじゃく",
    specificName: "インドクジャク",
    emoji: "🦚",
    rarity: "RARE",
    description:
      "オスは キラキラの かざりばねを おうぎみたいに ひろげて メスに アピールするよ。ひろげた はねの めだまもようは 100こ いじょうも あるんだ。",
    habitat: "インドや スリランカの もり",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── ナマケモノの なかまを あつめる（既存: メガテリウム）──
  {
    animalId: "sloth_three_toed",
    genericName: "ナマケモノ",
    specificName: "ミツユビナマケモノ",
    emoji: "🦥",
    rarity: "RARE",
    description:
      "1にちの ほとんどを きに ぶらさがって ねむって すごすよ。うごきが ゆっくりすぎて、からだに コケが はえて みどりいろに なることも あるんだ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── アルマジロの なかまを あつめる（既存: グリプトドン）──
  {
    animalId: "armadillo_nine_banded",
    genericName: "アルマジロ",
    specificName: "ココノオビアルマジロ",
    emoji: "🦔",
    rarity: "COMMON",
    description:
      "せなかが かたい よろいに おおわれた どうぶつ。びっくりすると まうえに ぴょんと とびあがるよ。あかちゃんは いつも おなじ かおの 4つごで うまれるんだ。",
    habitat: "アメリカの くさはらや もり",
    stageId: "savanna",
    lifespanYears: 12,
  },
  // ── ぞうの なかまを もっと あつめる ──
  {
    animalId: "elephant_forest",
    genericName: "ぞう",
    specificName: "マルミミゾウ",
    emoji: "🐘",
    rarity: "EPIC",
    description:
      "アフリカの もりの おくに すむ、みみが まるい ちいさめの ゾウ。きのみを たべて タネを もりじゅうに はこぶので「もりの にわし」と よばれているよ。",
    habitat: "アフリカの ねったいうりん",
    stageId: "forest",
    lifespanYears: 60,
  },
  // ── ねこの なかまを もっと あつめる ──
  {
    animalId: "cat_jaguar",
    genericName: "ねこ",
    specificName: "ジャガー",
    emoji: "🐆",
    rarity: "EPIC",
    description:
      "みなみアメリカ さいだいの ネコかどうぶつ。がんじょうな あごで カメの こうらも くだいて たべちゃうよ。みずが だいすきで、かわに とびこんで さかなを とるんだ。",
    habitat: "ちゅうなんべいの もりや かわぞい",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "cat_puma",
    genericName: "ねこ",
    specificName: "ピューマ",
    emoji: "🦁",
    rarity: "RARE",
    description:
      "きたアメリカから みなみアメリカまで、もっとも ひろい はんいに すむ ネコかどうぶつ。「クーガー」「マウンテンライオン」とも よばれる、おおくの なまえを もつ どうぶつ。",
    habitat: "アメリカたいりくの さまざまな しぜん",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── ワニの なかまを もっと あつめる（既存: ナイルワニ）──
  {
    animalId: "crocodile_saltwater",
    genericName: "ワニ",
    specificName: "イリエワニ",
    emoji: "🐊",
    rarity: "EPIC",
    description:
      "せかいで いちばん おおきな ハチュウルイで、ながさ 6メートルにもなる。しおみずでも あまみずでも くらせて、うみを わたって はなれた しまにも いくよ。",
    habitat: "とうなんアジアや オーストラリアの かわや うみぞい",
    stageId: "forest",
    lifespanYears: 70,
  },
  // ── あたらしい なかま：ハチドリ ──
  {
    animalId: "hummingbird_ruby_throated",
    genericName: "ハチドリ",
    specificName: "ルビーノドハチドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "はねを 1びょうに 70かいも はばたかせて、その ばで ぴたっと とまれる ちいさな とり。ながい くちばしで はなの みつを すって いきているよ。",
    habitat: "きたアメリカの もりや はなばたけ",
    stageId: "forest",
    lifespanYears: 5,
  },
  // ── かえるの なかまを もっと あつめる（既存: アマガエル）──
  {
    animalId: "frog_poison_dart",
    genericName: "かえる",
    specificName: "ヤドクガエル",
    emoji: "🐸",
    rarity: "EPIC",
    description:
      "あかや あおなど あざやかな いろで てきに どくを もっていると つたえるよ。たべた むしから どくを からだに ためる、かがくの にんじゃみたいな カエル。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── たこの なかまを もっと あつめる（既存: マダコ・メンダコ）──
  {
    animalId: "octopus_blue_ringed",
    genericName: "たこ",
    specificName: "ヒョウモンダコ",
    emoji: "🐙",
    rarity: "EPIC",
    description:
      "てのひらに のるくらい ちいさな タコ。おこると からだじゅうに あおい ひかる わっかが あらわれる。とても つよい どくを もっているよ。",
    habitat: "インドたいへいようの あさい うみ",
    stageId: "deep_sea",
    lifespanYears: 2,
  },
  // ── くまの なかまを もっと あつめる ──
  {
    animalId: "bear_spectacled",
    genericName: "くま",
    specificName: "メガネグマ",
    emoji: "🐻",
    rarity: "RARE",
    description:
      "みなみアメリカで ゆいいつの クマ。めの まわりに しろい もようが あって、メガネを かけているみたい。きのうえを のぼるのが とくいなんだ。",
    habitat: "みなみアメリカの アンデスさんみゃく",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── さるの なかまを もっと あつめる ──
  {
    animalId: "bonobo",
    genericName: "さる",
    specificName: "ボノボ",
    emoji: "🦍",
    rarity: "EPIC",
    description:
      "チンパンジーに とても にた サルだけど べつの どうぶつ。けんかが とても すくなくて なかまと なかよく くらすやさしい サル。にんげんの いちばん ちかい しんせきのひとつ。",
    habitat: "アフリカの コンゴの もり",
    stageId: "forest",
    lifespanYears: 40,
  },
  // ── あたらしい なかま：キツネザル ──
  {
    animalId: "lemur_ring_tailed",
    genericName: "キツネザル",
    specificName: "ワオキツネザル",
    emoji: "🐒",
    rarity: "RARE",
    description:
      "しろと くろの しまもようの しっぽが きれいな キツネザル。むれの リーダーは メスで、しっぽを たかく あげて においで なわばりを つたえるよ。",
    habitat: "マダガスカルの もりや そうげん",
    stageId: "forest",
    lifespanYears: 18,
  },
  // ── あたらしい なかま：アリクイ ──
  {
    animalId: "anteater_giant",
    genericName: "アリクイ",
    specificName: "オオアリクイ",
    emoji: "🐾",
    rarity: "RARE",
    description:
      "ながい はなと ながーい したで 1にちに 3まんびき ものアリを たべる どうぶつ。したの ながさは 60センチもあって、ぐるぐる まわして アリを なめとるよ。",
    habitat: "ちゅうなんべいの くさはら",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── あたらしい なかま：カンガルー ──
  {
    animalId: "kangaroo_red",
    genericName: "カンガルー",
    specificName: "アカカンガルー",
    emoji: "🦘",
    rarity: "COMMON",
    description:
      "オーストラリアで いちばん おおきな カンガルー。おなかの ふくろで あかちゃんを そだてるよ。うまれたての あかちゃんは 1センチほどで、じぶんで はいのぼって ふくろに はいるんだ。",
    habitat: "オーストラリアの そうげんや かんそうち",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：タスマニアデビル ──
  {
    animalId: "tasmanian_devil",
    genericName: "タスマニアデビル",
    specificName: "タスマニアデビル",
    emoji: "🦡",
    rarity: "EPIC",
    description:
      "オーストラリアの タスマニアしまだけに すむ どうぶつ。ちいさな からだのわりに かみつく ちからが とても つよくて、ほねまで たべちゃうんだ。よるに こわい こえで なくよ。",
    habitat: "タスマニアの もり",
    stageId: "forest",
    lifespanYears: 6,
  },
  // ── あたらしい なかま：カワセミ ──
  {
    animalId: "kingfisher_common",
    genericName: "カワセミ",
    specificName: "カワセミ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "かわの そばに すむ ちいさな とり。あおみどりの からだが キラキラ ひかる「かわの ほうせき」。さかなを みつけたら すいこんで とびこみ、さっと つかまえるよ。",
    habitat: "かわや いけの そば",
    stageId: "forest",
    lifespanYears: 4,
  },
  // ── あたらしい なかま：つる ──
  {
    animalId: "crane_red_crowned",
    genericName: "つる",
    specificName: "タンチョウ",
    emoji: "🦢",
    rarity: "EPIC",
    description:
      "あたまの てっぺんが まっかな にほんの シンボルの とり。つがいが むきあって はねを ひろげ いっしょに おどる「まい」は とても うつくしくて、えんぎが よいと されているよ。",
    habitat: "ほっかいどうの しっちや かわ",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── あたらしい なかま：ヤモリ ──
  {
    animalId: "gecko_tokay",
    genericName: "ヤモリ",
    specificName: "トッケイヤモリ",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "「トッケ！トッケ！」と なく おおきな ヤモリ。あしに ものすごく こまかい けが あって、ガラスや てんじょうも じゆうに はりついて あるけるんだ。",
    habitat: "とうなんアジアの もりや たてもの",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── あたらしい なかま：サンショウウオ ──
  {
    animalId: "salamander_giant_japanese",
    genericName: "サンショウウオ",
    specificName: "オオサンショウウオ",
    emoji: "🦎",
    rarity: "EPIC",
    description:
      "せかいで いちばん おおきな りょうせいるいで、にほんの きれいな かわに すむよ。ながさは 1.5メートルにもなる！かわの いしの したで じっと えものを まつ「にほんの ぬし」。",
    habitat: "にほんの きれいな かわ",
    stageId: "forest",
    lifespanYears: 50,
  },
  // ── あたらしい なかま：カピバラ ──
  {
    animalId: "capybara",
    genericName: "カピバラ",
    specificName: "カピバラ",
    emoji: "🐹",
    rarity: "COMMON",
    description:
      "せかいで いちばん おおきな ネズミのなかま。みずが だいすきで かわや いけの そばで くらすよ。おだやかで、ほかの どうぶつとも なかよくなれる やさしい どうぶつ。",
    habitat: "みなみアメリカの かわや しっち",
    stageId: "savanna",
    lifespanYears: 10,
  },
  // ── あたらしい なかま：マナティー ──
  {
    animalId: "manatee_west_indian",
    genericName: "マナティー",
    specificName: "アメリカマナティー",
    emoji: "🦭",
    rarity: "RARE",
    description:
      "うみに すむ おだやかな どうぶつで「うみの にんぎょ」と よばれたことも あるよ。まいにち たくさんの かいそうを たべ、おなかに きほうを ためて ぷかぷか うかんでいるんだ。",
    habitat: "カリブかいや アメリカの えんがん",
    stageId: "deep_sea",
    lifespanYears: 50,
  },
  // ── あたらしい なかま：アホウドリ ──
  {
    animalId: "albatross_wandering",
    genericName: "アホウドリ",
    specificName: "ワタリアホウドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "とりの なかで いちばん おおきな つばさを もち、ひろげると 3.5メートルにもなるよ！うみの かぜに のって はばたきを ほとんど せずに ながーい きょりを とべる うみの たびびと。",
    habitat: "みなみの うみ",
    stageId: "deep_sea",
    lifespanYears: 50,
  },
  // ── あたらしい なかま：やまねこ ──
  {
    animalId: "lynx_eurasian",
    genericName: "やまねこ",
    specificName: "ユーラシアオオヤマネコ",
    emoji: "🐈",
    rarity: "RARE",
    description:
      "ヨーロッパや アジアの もりに すむ ちゅうがたの ネコかどうぶつ。ながい ふさふさの ひげと おおきな あしで ゆきの うえを じょうずに あるき、しかなどを しずかに おいかけるよ。",
    habitat: "ユーラシアの もり",
    stageId: "forest",
    lifespanYears: 13,
  },
  // ── イルカの なかまを もっと あつめる ──
  {
    animalId: "dolphin_amazon_river",
    genericName: "イルカ",
    specificName: "アマゾンカワイルカ",
    emoji: "🐬",
    rarity: "RARE",
    description:
      "からだが ピンクいろに なる めずらしい イルカ。うみでは なく アマゾンがわの なかで くらしているよ。くびが まがるので かわの そこの えものを ひろい やすく、ひげで さわって みつけるんだ。",
    habitat: "みなみアメリカの アマゾンがわ",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── クジラの なかまを もっと あつめる ──
  {
    animalId: "whale_minke",
    genericName: "クジラ",
    specificName: "ミンククジラ",
    emoji: "🐳",
    rarity: "COMMON",
    description:
      "クジラの なかまでは ちゅうくらいの おおきさ。にほんの うみにも やってくる、みぢかな クジラ。むれで えものを かこんで たべる、かしこい りょうしなんだよ。",
    habitat: "せかいじゅうの うみ",
    stageId: "deep_sea",
    lifespanYears: 50,
  },
  // ── ペンギンの なかまを もっと あつめる ──
  {
    animalId: "penguin_humboldt",
    genericName: "ペンギン",
    specificName: "フンボルトペンギン",
    emoji: "🐧",
    rarity: "RARE",
    description:
      "みなみアメリカの かいがんに すむ ペンギン。むねの くろい たてじまが めじるし。つめたい フンボルトかいりゅうの うみで さかなを おいかけて いきているよ。",
    habitat: "ペルーや チリの かいがん",
    stageId: "ice_age",
    lifespanYears: 20,
  },
  // ── サメの なかまを もっと あつめる ──
  {
    animalId: "shark_basking",
    genericName: "サメ",
    specificName: "ウバザメ",
    emoji: "🦈",
    rarity: "RARE",
    description:
      "ジンベエザメに ついで せかいで 2ばんめに おおきな サメ。おおきな くちを あけて かいちゅうを こして たべる おだやかな サメで、ひとを おそったり しないよ。",
    habitat: "せかいじゅうの すずしい うみ",
    stageId: "deep_sea",
    lifespanYears: 50,
  },
  // ── あざらしの なかまを もっと あつめる ──
  {
    animalId: "seal_elephant_south",
    genericName: "あざらし",
    specificName: "ミナミゾウアザラシ",
    emoji: "🦭",
    rarity: "EPIC",
    description:
      "オスは はなが ゾウみたいに のびる、せかいで いちばん おおきな アザラシ。おもさは 4トンにもなるよ！いきを とめて 2じかん いじょう ふかい うみに もぐれるんだ。",
    habitat: "なんきょくの ちかくの しま",
    stageId: "ice_age",
    lifespanYears: 22,
  },
  // ── かえるの なかまを もっと あつめる ──
  {
    animalId: "frog_goliath",
    genericName: "かえる",
    specificName: "ゴライアスガエル",
    emoji: "🐸",
    rarity: "EPIC",
    description:
      "せかいで いちばん おおきな カエルで、からだの ながさが 32センチ、おもさが 3キロにもなるよ！でも こえは でないんだ。いしを うごかして こどもの ために いけを つくる やさしい おとうさんだよ。",
    habitat: "アフリカ にしカメルーンの かわ",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── こうもりの なかまを もっと あつめる ──
  {
    animalId: "bat_vampire",
    genericName: "こうもり",
    specificName: "チスイコウモリ",
    emoji: "🦇",
    rarity: "RARE",
    description:
      "ちを すって いきる めずらしい コウモリ。なかまが えものを みつけられなかった ときに、じぶんの すった ちを わけてあげる やさしいところがあるんだよ。",
    habitat: "ちゅうなんべいの もり",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── あたらしい なかま：ちょう ──
  {
    animalId: "butterfly_monarch",
    genericName: "ちょう",
    specificName: "オオカバマダラ",
    emoji: "🦋",
    rarity: "RARE",
    description:
      "オレンジと くろの もようが きれいな ちょう。まいとし カナダから メキシコまで 4000キロ いじょうも たびをする すごい むし。おじいちゃん・おばあちゃんの こに なっても もどってこられるんだよ。",
    habitat: "きたアメリカ・メキシコ",
    stageId: "savanna",
    lifespanYears: 1,
  },
  // ── あたらしい なかま：かぶとむし ──
  {
    animalId: "beetle_japanese_rhinoceros",
    genericName: "かぶとむし",
    specificName: "カブトムシ",
    emoji: "🪲",
    rarity: "COMMON",
    description:
      "オスの あたまに おおきな つのが はえている、にほんの なつの むし。じぶんの からだの 20ばい いじょうの おもさを もちあげられる ちからもちで、オスどうし つのを つかって たたかうよ。",
    habitat: "にほんの もり",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── あたらしい なかま：カマキリ ──
  {
    animalId: "mantis_orchid",
    genericName: "カマキリ",
    specificName: "ランカマキリ",
    emoji: "🦗",
    rarity: "EPIC",
    description:
      "はなびらに そっくりな すがたの カマキリ。しろや ピンクの からだで はなに まぎれ、みつを すいに きた むしを まちぶせして つかまえるよ。ぎたいの めいじんと よばれているんだ。",
    habitat: "とうなんアジアの ねったいうりん",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── クジラの なかまを もっと あつめる ──
  {
    animalId: "whale_beluga",
    genericName: "クジラ",
    specificName: "シロイルカ",
    emoji: "🐳",
    rarity: "RARE",
    description:
      "からだが まっしろな うつくしい クジラ。「うみの カナリア」と よばれるほど たくさんの こえを だすよ。おでこが まるくふくらんでいて、きもちに あわせて かおの むきを かえることが できるんだ。",
    habitat: "きたきょくの つめたい うみ",
    stageId: "ice_age",
    lifespanYears: 40,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "sunfish_ocean",
    genericName: "さかな",
    specificName: "マンボウ",
    emoji: "🐡",
    rarity: "RARE",
    description:
      "ほねの ある さかなで せかいいちおもく、おもさが 2トンにもなるよ！からだは まるくて しっぽが ないみたい。たいようの ひなたぼっこが だいすきで、うみの うえに ぷかっと よこになって うかんでいるよ。",
    habitat: "あたたかい おおきな うみ",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  // ── さるの なかまを もっと あつめる ──
  {
    animalId: "gibbon_lar",
    genericName: "テナガザル",
    specificName: "シロテテナガザル",
    emoji: "🦧",
    rarity: "RARE",
    description:
      "きの えだを つかむ てと あしが とても ながく、えだを つたって じそく 55キロで とびうつるよ！まいにち うたうように なきこえで なわばりを つたえる、もりの かしゅみたいな サルなんだ。",
    habitat: "とうなんアジアの もり",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── あたらしい なかま：かわうそ ──
  {
    animalId: "otter_small_clawed",
    genericName: "かわうそ",
    specificName: "コツメカワウソ",
    emoji: "🦦",
    rarity: "COMMON",
    description:
      "かわうそで いちばん ちいさな どうぶつ。つめが とても ちいさくて、きように てを うごかして かいや さかなを じぶんで つかまえるよ。むれで なかよく いっしょに いきているんだ。",
    habitat: "とうなんアジアの かわや マングローブ",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── くまの なかまを もっと あつめる ──
  {
    animalId: "bear_sun",
    genericName: "くま",
    specificName: "マレーグマ",
    emoji: "🐻",
    rarity: "RARE",
    description:
      "くまの なかまで いちばん ちいさく、むねに「U」じの きいろい もようがあるよ。したの ながさが 25センチもあって、はちのすに つっこんで はちみつを なめとるのが だいすきなんだ。",
    habitat: "とうなんアジアの ねったいうりん",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── あたらしい なかま：ウマ ──
  {
    animalId: "horse_przewalski",
    genericName: "ウマ",
    specificName: "モウコノウマ",
    emoji: "🐎",
    rarity: "EPIC",
    description:
      "ぜつめつ しかけたが じんるいが まもって ふやした、せかいで ゆいいつ ほんとうの やせいの ウマ。たてがみが たちあがっていて、ふつうの うまより ちいさく がっちりしているよ。",
    habitat: "モンゴルの そうげん",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── キリンの なかまを もっと あつめる ──
  {
    animalId: "okapi",
    genericName: "キリン",
    specificName: "オカピ",
    emoji: "🦒",
    rarity: "RARE",
    description:
      "キリンの いちばん ちかい しんせきなのに、あしが シマウマみたいな もようの ふしぎな どうぶつ。ながーい したで じぶんの めや ちちくびを なめることが できるんだよ。",
    habitat: "アフリカ コンゴの おくの もり",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── カメレオンの なかまを もっと あつめる ──
  {
    animalId: "chameleon_jackson",
    genericName: "カメレオン",
    specificName: "ジャクソンカメレオン",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "オスは あたまに 3ほんの つのが はえている かっこいい カメレオン。まるで ちいさな サイやきょうりゅうみたいなすがた！いろを かえて きの えだに そっと まぎれるよ。",
    habitat: "ひがしアフリカの もり",
    stageId: "forest",
    lifespanYears: 8,
  },
  // ── かえるの なかまを もっと あつめる ──
  {
    animalId: "frog_red_eyed",
    genericName: "かえる",
    specificName: "アカメアマガエル",
    emoji: "🐸",
    rarity: "COMMON",
    description:
      "まっかな めが とても めだつ きれいな カエル。てのひらが あおくて からだが みどりいろ。おそわれると あかい めを ぱっと ひらいて てきを びっくりさせ、そのすきに にげるんだ。",
    habitat: "ちゅうアメリカの ねったいうりん",
    stageId: "forest",
    lifespanYears: 5,
  },
  // ── あたらしい なかま：ハリネズミ ──
  {
    animalId: "hedgehog_european",
    genericName: "ハリネズミ",
    specificName: "ヨーロッパハリネズミ",
    emoji: "🦔",
    rarity: "COMMON",
    description:
      "からだじゅうに やく5000ほんの とがった はりが はえている どうぶつ。おそわれると まるく なって はりを たてて みをまもるよ。ひとばんに 2キロも あるいて むしを さがすんだ。",
    habitat: "ヨーロッパの もりや にわ",
    stageId: "forest",
    lifespanYears: 5,
  },
  // ── カバの なかまを もっと あつめる ──
  {
    animalId: "hippo_pygmy",
    genericName: "カバ",
    specificName: "ピグミーカバ",
    emoji: "🦛",
    rarity: "RARE",
    description:
      "にしアフリカの もりに すむ ちいさな カバ。ふつうの カバの 10ぶんの1くらいの おもさで、かわの ちかくの やぶを こっそり あるきまわるよ。めったに みられない はずかしがりやなんだ。",
    habitat: "にしアフリカの もりや かわ",
    stageId: "forest",
    lifespanYears: 35,
  },
  // ── サイの なかまを もっと あつめる ──
  {
    animalId: "rhino_indian",
    genericName: "サイ",
    specificName: "インドサイ",
    emoji: "🦏",
    rarity: "EPIC",
    description:
      "よろいみたいな でこぼこの かわを もつ おおきな サイ。みずあびが だいすきで かわや ぬまに つかって すずむよ。つのは 1ぽんだけなので アフリカの サイと みわけられるんだ。",
    habitat: "インドや ネパールの くさはらや もり",
    stageId: "savanna",
    lifespanYears: 40,
  },
  // ── あたらしい なかま：エミュー ──
  {
    animalId: "emu",
    genericName: "エミュー",
    specificName: "エミュー",
    emoji: "🦤",
    rarity: "COMMON",
    description:
      "オーストラリアに すむ とびない おおきな とり。ダチョウに ついで せかいで 2ばんめに おおきく、はやく はしれるけど とべないよ。おとうさんが たまごを 8しゅうかん あたためて こそだてするんだ。",
    habitat: "オーストラリアの そうげんや かんそうち",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "piranha_red_bellied",
    genericName: "さかな",
    specificName: "アカハラピラニア",
    emoji: "🐠",
    rarity: "RARE",
    description:
      "みなみアメリカの アマゾンがわに すむ、するどい はの さかな。むれで えものを おいかけるよ。じつは ほとんどの じかんは ほかの さかなを たべていて、ひとを おそうことは めったにないんだ。",
    habitat: "みなみアメリカの アマゾンがわ",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── あたらしい なかま：コウノトリ ──
  {
    animalId: "stork_oriental",
    genericName: "コウノトリ",
    specificName: "コウノトリ",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "にほんや アジアに すむ しろい おおきな とり。かつて にほんでは ぜつめつしそうになったが、まもって ふやす とりくみで いまは ほっかつした。あかちゃんを はこんでくるという でんせつが ある とりだよ。",
    habitat: "アジアの かわや しっち",
    stageId: "forest",
    lifespanYears: 35,
  },
  // ── ちょうの なかまを もっと あつめる ──
  {
    animalId: "butterfly_birdwing",
    genericName: "ちょう",
    specificName: "トリバネアゲハ",
    emoji: "🦋",
    rarity: "RARE",
    description:
      "とりの はばたきみたいな おおきな つばさを もつ ちょうちょ。メスの つばさを ひろげると 30センチに なることも！ せかいで いちばん おおきな ちょうの なかまで、キラキラ ひかる みどりいろが きれいだよ。",
    habitat: "とうなんアジアの ねったいうりん",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── くらげの なかまを もっと あつめる ──
  {
    animalId: "jellyfish_nomura",
    genericName: "くらげ",
    specificName: "エチゼンクラゲ",
    emoji: "🪼",
    rarity: "RARE",
    description:
      "かさの はばが 2メートル、おもさ 200キロにも なる きょだいな クラゲ。にほんの うみに やってきて、ぎょふの あみを こわすことも ある。にんげんの おとな より ずっと おもいんだよ。",
    habitat: "にほんかいや ひがしシナかい",
    stageId: "deep_sea",
    lifespanYears: 1,
  },
  // ── カンガルーの なかまを もっと あつめる ──
  {
    animalId: "quokka",
    genericName: "カンガルー",
    specificName: "クオッカ",
    emoji: "🦘",
    rarity: "RARE",
    description:
      "オーストラリアの ちいさな しまに だけ すむ カンガルーの なかま。にこにこ しているように みえる かおから「せかいで いちばん しあわせそうな どうぶつ」と よばれているんだよ。",
    habitat: "オーストラリアの ロットネストしま",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── あたらしい なかま：クズリ ──
  {
    animalId: "wolverine",
    genericName: "クズリ",
    specificName: "クズリ",
    emoji: "🦡",
    rarity: "RARE",
    description:
      "イタチの なかまで いちばん おおきく、じぶんより ずっと おおきな シカや クマとも むかいあう きもの すわった どうぶつ。ゆきの なかでも じょうぶで、はるか きたの もりに くらしているよ。",
    habitat: "きたアメリカや ユーラシアの ゆきの もり",
    stageId: "ice_age",
    lifespanYears: 13,
  },
  // ── さるの なかまを もっと あつめる ──
  {
    animalId: "marmoset_common",
    genericName: "さる",
    specificName: "コモンマーモセット",
    emoji: "🐒",
    rarity: "COMMON",
    description:
      "てのひらに のるくらい ちいさな サル。しろい ふさふさの みみかざりが かわいい。かならず ふたごで うまれて、おとうさんや きょうだいが いっしょに そだてる やさしい かぞくの どうぶつ。",
    habitat: "みなみアメリカの ブラジルの もり",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── わしの なかまを もっと あつめる ──
  {
    animalId: "condor_andean",
    genericName: "わし",
    specificName: "アンデスコンドル",
    emoji: "🦅",
    rarity: "EPIC",
    description:
      "つばさを ひろげると 3メートルを こえる、せかいで いちばん おおきな とびとり。アンデスさんみゃくの たかい そらを はばたかずに ながーく とびつづけるよ。70ねんも いきる ながいきさん。",
    habitat: "みなみアメリカの アンデスさんみゃく",
    stageId: "savanna",
    lifespanYears: 70,
  },
  // ── ねこの なかまを もっと あつめる ──
  {
    animalId: "cat_sand",
    genericName: "ねこ",
    specificName: "スナネコ",
    emoji: "🐱",
    rarity: "RARE",
    description:
      "さばくに すむ ちいさな ヤセイネコ。あしの うらが あつい けに おおわれて、やけた すなのうえも じょうずに あるけるよ。みずが すくなくても たべものから えいようを とれる さばくの ますたーなんだ。",
    habitat: "アフリカや アジアの さばく",
    stageId: "savanna",
    lifespanYears: 13,
  },
  {
    animalId: "cat_serval",
    genericName: "ねこ",
    specificName: "サーバル",
    emoji: "🐆",
    rarity: "RARE",
    description:
      "ながい あしと おおきな ミミを もつ アフリカの ネコかどうぶつ。たかく ジャンプして とびながら とりを たいきちゅうで つかまえるほど えものとりが うまい、サバンナの ハンターだよ。",
    habitat: "アフリカの サバンナや しっち",
    stageId: "savanna",
    lifespanYears: 19,
  },
  // ── あたらしい なかま：ハシビロコウ ──
  {
    animalId: "shoebill",
    genericName: "ハシビロコウ",
    specificName: "ハシビロコウ",
    emoji: "🦤",
    rarity: "EPIC",
    description:
      "くつみたいな おおきな くちばしを もつ ふしぎな とり。じーっと うごかずに えものを まつ「うごかない めつき」が ゆうめい。なかまに あうと くちばしを かちかち ならして あいさつするんだ。",
    habitat: "アフリカの しっちや かわ",
    stageId: "savanna",
    lifespanYears: 35,
  },
  // ── インコの なかまを もっと あつめる ──
  {
    animalId: "parrot_budgerigar",
    genericName: "インコ",
    specificName: "セキセイインコ",
    emoji: "🦜",
    rarity: "COMMON",
    description:
      "みどりや きいろ、あおなど きれいな いろの ちいさな インコ。オーストラリアの そうげんで なんまんわもの おおきな むれを つくるよ。ことばを まねするのが とくいで ペットとしても にんきなんだ。",
    habitat: "オーストラリアの かんそうした そうげん",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── カメの なかまを もっと あつめる ──
  {
    animalId: "turtle_matamata",
    genericName: "カメ",
    specificName: "マタマタガメ",
    emoji: "🐢",
    rarity: "EPIC",
    description:
      "かわの おちばや すなに まじって みえにくい ふしぎな かたちの カメ。くびの ひらべったい かわを ゆらして さかなを よびよせ、ぱかっと くちを あけて すいこんで つかまえるよ。",
    habitat: "みなみアメリカの アマゾンがわ",
    stageId: "forest",
    lifespanYears: 40,
  },
  // ── しかの なかまを もっと あつめる ──
  {
    animalId: "deer_red",
    genericName: "しか",
    specificName: "アカシカ",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "ヨーロッパで いちばん おおきな シカ。オスは えだわかれした りっぱな つのを もち、しゅうかくの きせつに おおごえで ほえて なわばりを しらせるよ。とおくまで きこえる こえだよ。",
    habitat: "ヨーロッパや アジアの もり",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "salmon_chinook",
    genericName: "さかな",
    specificName: "キングサーモン",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "サケの なかまで いちばん おおきく、おもさが 50キロを こえることも。うまれた かわに もどって たまごを うむ、きおくりょくの すごい さかな。たいへいようの きたの うみから かわを のぼってくるよ。",
    habitat: "きたアメリカの かわや たいへいよう",
    stageId: "forest",
    lifespanYears: 7,
  },
  // ── へびの なかまを もっと あつめる ──
  {
    animalId: "snake_ball_python",
    genericName: "へび",
    specificName: "ボールパイソン",
    emoji: "🐍",
    rarity: "COMMON",
    description:
      "こわいと からだを まるめて ボールみたいな かたちに なる おとなしい へび。にしアフリカの くさはらに すんでいるよ。ペットとしても にんきで、30ねん いじょう いきる ながいきさん。",
    habitat: "にしアフリカの くさはらや もり",
    stageId: "savanna",
    lifespanYears: 30,
  },
  // ── あたらしい なかま：ライチョウ ──
  {
    animalId: "ptarmigan_rock",
    genericName: "とり",
    specificName: "ライチョウ",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "にほんの アルプスや きたきょくに すむ とり。ふゆは からだが まっしろに なって ゆきに まぎれるよ。にほんでは「かみの つかい」と よばれて まもられてきた、たいへん めずらしい とりなんだ。",
    habitat: "にほんの こうさんたい・きたきょく",
    stageId: "ice_age",
    lifespanYears: 5,
  },
  // ── しまうまの なかまを もっと あつめる ──
  {
    animalId: "zebra_mountain",
    genericName: "しまうま",
    specificName: "ヤマシマウマ",
    emoji: "🦓",
    rarity: "COMMON",
    description:
      "あしの しまもようが ほそくて、おなかには しまが ない めずらしい シマウマ。やまの がけや いわばを じょうずに のぼりおりするのが とくいなんだ。",
    habitat: "アフリカの やまや がけ",
    stageId: "savanna",
    lifespanYears: 25,
  },
  // ── きつねの なかまを もっと あつめる ──
  {
    animalId: "fox_tibetan_sand",
    genericName: "きつね",
    specificName: "チベットスナギツネ",
    emoji: "🦊",
    rarity: "RARE",
    description:
      "しかくい かおが とくちょうの めずらしい キツネ。とても たかい こうげんに すんでいて、さむさにも へいきな じょうぶな からだを しているよ。",
    habitat: "チベットの たかい こうげん",
    stageId: "ice_age",
    lifespanYears: 10,
  },
  // ── おおかみの なかまを もっと あつめる ──
  {
    animalId: "wolf_red",
    genericName: "おおかみ",
    specificName: "アカオオカミ",
    emoji: "🐺",
    rarity: "EPIC",
    description:
      "あかみがかった けいろの オオカミ。いまは とても かずが すくなくなってしまい、ほごの ために そだてて しぜんに かえす とりくみが すすめられているよ。",
    habitat: "きたアメリカの しっちや もり",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── りすの なかまを もっと あつめる ──
  {
    animalId: "squirrel_chipmunk",
    genericName: "りす",
    specificName: "シマリス",
    emoji: "🐿️",
    rarity: "COMMON",
    description:
      "せなかに くろい しまもようが ある ちいさな リス。ほおぶくろに きのみを いっぱい つめこんで、あなの なかに たくわえて ふゆを すごすんだ。",
    habitat: "シベリアや ほっかいどうの もり",
    stageId: "forest",
    lifespanYears: 6,
  },
  // ── うさぎの なかまを もっと あつめる ──
  {
    animalId: "rabbit_amami",
    genericName: "うさぎ",
    specificName: "アマミノクロウサギ",
    emoji: "🐇",
    rarity: "EPIC",
    description:
      "あまみおおしまと とくのしまだけに すむ めずらしい ウサギ。みみが ちいさくて あしも たんきょり用。とても むかしの ウサギの すがたを のこしているんだよ。",
    habitat: "あまみおおしま・とくのしまの もり",
    stageId: "forest",
    lifespanYears: 8,
  },
  // ── くまの なかまを もっと あつめる ──
  {
    animalId: "bear_american_black",
    genericName: "くま",
    specificName: "アメリカグマ",
    emoji: "🐻",
    rarity: "COMMON",
    description:
      "きたアメリカに ひろく すむ くろい くま。きのうえに のぼるのが じょうずで、どんぐりや ベリーを たべるよ。ツキノワグマの しんせきの どうぶつなんだ。",
    habitat: "きたアメリカの もり",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── とらの なかまを あつめる（既存: ベンガルトラ・ホワイトタイガー）──
  {
    animalId: "tiger_siberian",
    genericName: "とら",
    specificName: "アムールトラ",
    emoji: "🐅",
    rarity: "LEGENDARY",
    description:
      "ねこの なかまで せかいいち おおきい トラ。ゆきの もりに すんでいて、けが ながくて ふさふさ。いきのこっているのは やせいで 500とう ほどしか いないんだ。",
    habitat: "ロシアの ゆきの もり",
    stageId: "ice_age",
    lifespanYears: 16,
  },
  {
    animalId: "tiger_sumatran",
    genericName: "とら",
    specificName: "スマトラトラ",
    emoji: "🐅",
    rarity: "EPIC",
    description:
      "トラの なかまで いちばん ちいさい トラ。しまもようが せまく たくさん あるのが とくちょう。すまとらじまの もりだけに すむ、とても めずらしい トラだよ。",
    habitat: "インドネシア スマトラじまの もり",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── イノシシの なかまを もっと あつめる ──
  {
    animalId: "boar_european",
    genericName: "イノシシ",
    specificName: "ヨーロッパイノシシ",
    emoji: "🐗",
    rarity: "COMMON",
    description:
      "ヨーロッパの もりに ひろく すむ イノシシ。あかちゃんは うりぼうと よばれ、しまもようの けがわで うまれてくるよ。はなさきが つよくて じめんを ほって たべものを さがすんだ。",
    habitat: "ヨーロッパの もり",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── キリンの なかまを もっと あつめる ──
  {
    animalId: "giraffe_cape",
    genericName: "キリン",
    specificName: "ケープキリン",
    emoji: "🦒",
    rarity: "RARE",
    description:
      "みなみアフリカに すむ キリン。もようが ほしがたに ちかい かたちを しているよ。せが たかいので たかい きの はっぱも らくに たべられるんだ。",
    habitat: "みなみアフリカの サバンナ",
    stageId: "savanna",
    lifespanYears: 25,
  },
  // ── サイの なかまを もっと あつめる ──
  {
    animalId: "rhino_sumatran",
    genericName: "サイ",
    specificName: "スマトラサイ",
    emoji: "🦏",
    rarity: "LEGENDARY",
    description:
      "サイの なかまで いちばん ちいさく、からだじゅうが あかちゃいろの けで おおわれているよ。せかいに のこっているのは わずか80とう ほどの、とても めずらしい サイなんだ。",
    habitat: "インドネシアの ねったいうりん",
    stageId: "forest",
    lifespanYears: 35,
  },
  // ── ぞうの なかまを もっと あつめる ──
  {
    animalId: "elephant_borneo",
    genericName: "ぞう",
    specificName: "ボルネオゾウ",
    emoji: "🐘",
    rarity: "EPIC",
    description:
      "アジアゾウの なかまで からだが ちいさめで、おなかが ぽっこり まるい かわいい ゾウ。ボルネオじまの もりだけに すんでいる、とても めずらしいゾウだよ。",
    habitat: "ボルネオじまの ねったいうりん",
    stageId: "forest",
    lifespanYears: 60,
  },
  // ── ヒョウの なかまを もっと あつめる ──
  {
    animalId: "leopard_amur",
    genericName: "ヒョウ",
    specificName: "アムールヒョウ",
    emoji: "🐆",
    rarity: "LEGENDARY",
    description:
      "ゆきの もりに すむ ヒョウで、ふゆに けが ながく ふさふさに なるよ。やせいに のこっているのは 100とう くらいしか いない、せかいで いちばん めずらしい ヒョウなんだ。",
    habitat: "ロシアと ちゅうごくの さかいめの もり",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  // ── しかの なかまを もっと あつめる ──
  {
    animalId: "deer_fallow",
    genericName: "しか",
    specificName: "ダマジカ",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "オスの つのが いたのように ひらたく ひろがる シカ。からだに しろい てんてんもようが あって、むかしから こうえんなどで かわれてきた おだやかな シカだよ。",
    habitat: "ヨーロッパの もりや こうげん",
    stageId: "forest",
    lifespanYears: 16,
  },
  // ── クジラの なかまを もっと あつめる ──
  {
    animalId: "whale_right",
    genericName: "クジラ",
    specificName: "セミクジラ",
    emoji: "🐳",
    rarity: "EPIC",
    description:
      "あたまに ふじつぼが つく ごつごつした もようが ある クジラ。およぐ はやさが ゆっくりで、むかし りょうしに とられやすかったので いまは かずが とても すくないんだ。",
    habitat: "せかいじゅうの すずしい うみ",
    stageId: "deep_sea",
    lifespanYears: 70,
  },
  // ── イルカの なかまを もっと あつめる ──
  {
    animalId: "dolphin_commersons",
    genericName: "イルカ",
    specificName: "イロワケイルカ",
    emoji: "🐬",
    rarity: "RARE",
    description:
      "からだが しろと くろの パンダみたいな もようの ちいさな イルカ。みなみアメリカの つめたい うみに すんでいて、なみの なかで くるくる まわるのが とくいだよ。",
    habitat: "みなみアメリカの つめたい うみ",
    stageId: "deep_sea",
    lifespanYears: 18,
  },
  // ── サメの なかまを もっと あつめる ──
  {
    animalId: "shark_tiger",
    genericName: "サメ",
    specificName: "イタチザメ",
    emoji: "🦈",
    rarity: "RARE",
    description:
      "からだに とらみたいな しまもようが ある おおきな サメ。なんでも たべる どくしょくで、うみがめの こうらも バリバリ かみくだく つよい あごを もっているよ。",
    habitat: "せかいじゅうの あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  // ── あたらしい なかま：エイ ──
  {
    animalId: "ray_stingray",
    genericName: "エイ",
    specificName: "アカエイ",
    emoji: "🐡",
    rarity: "COMMON",
    description:
      "ひらたい からだで うみの そこを すべるように およぐ サメの しんせき。しっぽに どくの ある とげが あって、じぶんの みを まもる ために つかうよ。",
    habitat: "にほんの あさい うみ",
    stageId: "deep_sea",
    lifespanYears: 15,
  },
  // ── たこの なかまを もっと あつめる ──
  {
    animalId: "octopus_giant_pacific",
    genericName: "たこ",
    specificName: "ミズダコ",
    emoji: "🐙",
    rarity: "RARE",
    description:
      "せかいで いちばん おおきな タコ。あしを ひろげると 3メートルを こえることも あるよ。あたまが よくて、ふたを あけて はこの なかの えさを とりだせるんだ。",
    habitat: "きたの たいへいようの うみ",
    stageId: "deep_sea",
    lifespanYears: 5,
  },
  // ── あたらしい なかま：イカ ──
  {
    animalId: "squid_firefly",
    genericName: "イカ",
    specificName: "ホタルイカ",
    emoji: "🦑",
    rarity: "RARE",
    description:
      "からだから あおい ひかりを はなつ ちいさな イカ。にほんの とやまわんでは、はるの よるに うみめんが ひかる ふしぎな こうけいが みられるんだよ。",
    habitat: "にほんかいの ふかい うみ",
    stageId: "deep_sea",
    lifespanYears: 1,
  },
  // ── くらげの なかまを もっと あつめる ──
  {
    animalId: "jellyfish_man_of_war",
    genericName: "くらげ",
    specificName: "カツオノエボシ",
    emoji: "🪼",
    rarity: "RARE",
    description:
      "うみの うえに ふうせんみたいな うきぶくろを もつ どくの ある いきもの。じつは 1つの どうぶつではなく、たくさんの ちいさな いきものが あつまって くらしているんだ。",
    habitat: "あたたかい うみの うみめん",
    stageId: "deep_sea",
    lifespanYears: 1,
  },
  // ── カメの なかまを もっと あつめる ──
  {
    animalId: "turtle_hawksbill",
    genericName: "カメ",
    specificName: "タイマイ",
    emoji: "🐢",
    rarity: "EPIC",
    description:
      "くちばしが とりのように とがった ウミガメ。こうらの もようが きれいで、サンゴしょうの すきまに いる かいめんなどを たべて くらしているよ。",
    habitat: "あたたかい サンゴしょうの うみ",
    stageId: "deep_sea",
    lifespanYears: 50,
  },
  // ── ワニの なかまを もっと あつめる ──
  {
    animalId: "crocodile_american",
    genericName: "ワニ",
    specificName: "ミシシッピワニ",
    emoji: "🐊",
    rarity: "COMMON",
    description:
      "あたまが まるみを おびた がんじょうな ワニ。さむい きせつには あなぐらに もぐって じっと すごすよ。むかしは へりつつあったが、いまは かずが ふえて もどってきたんだ。",
    habitat: "きたアメリカの ぬまや かわ",
    stageId: "forest",
    lifespanYears: 50,
  },
  // ── とかげの なかまを もっと あつめる ──
  {
    animalId: "lizard_gila_monster",
    genericName: "とかげ",
    specificName: "ドクトカゲ",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "オレンジと くろの もようが めだつ どくを もつ めずらしい トカゲ。あごから どくを ぶんぴつして、かみついた あいてに じわじわ きかせるんだ。",
    habitat: "きたアメリカの さばく",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── へびの なかまを もっと あつめる ──
  {
    animalId: "snake_rattlesnake",
    genericName: "へび",
    specificName: "ガラガラヘビ",
    emoji: "🐍",
    rarity: "COMMON",
    description:
      "しっぽを ふって ガラガラと おとを ならし、てきに けいこくする へび。どくを もっていて、あつい さばくでも すずしい あなの なかで すずしく すごすんだよ。",
    habitat: "きたアメリカの さばくや くさはら",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── カメレオンの なかまを もっと あつめる ──
  {
    animalId: "chameleon_veiled",
    genericName: "カメレオン",
    specificName: "エボシカメレオン",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "あたまの うえに とさかのような でっぱりが ある カメレオン。あめが ふらない かんそうした ばしょでも、その とさかに つゆを あつめて みずを のむんだ。",
    habitat: "アラビアはんとうの やま",
    stageId: "forest",
    lifespanYears: 8,
  },
  // ── ヤモリの なかまを もっと あつめる ──
  {
    animalId: "gecko_leopard",
    genericName: "ヤモリ",
    specificName: "ヒョウモントカゲモドキ",
    emoji: "🦎",
    rarity: "COMMON",
    description:
      "ヒョウみたいな ぶつぶつもようの ヤモリ。ほかの ヤモリと ちがって かべに はりつけないけど、まぶたが あって ぱちぱち まばたきが できるんだよ。",
    habitat: "インドや パキスタンの さばく",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── ペンギンの なかまを もっと あつめる ──
  {
    animalId: "penguin_magellanic",
    genericName: "ペンギン",
    specificName: "マゼランペンギン",
    emoji: "🐧",
    rarity: "RARE",
    description:
      "むなもとに くろい たてじまが 2ほん ある ペンギン。じめんに あなを ほって すを つくり、まいとし おなじ あいてと つがいに なる なかよしの とりだよ。",
    habitat: "みなみアメリカの かいがん",
    stageId: "ice_age",
    lifespanYears: 20,
  },
  // ── ふくろうの なかまを もっと あつめる ──
  {
    animalId: "owl_spectacled",
    genericName: "ふくろう",
    specificName: "メガネフクロウ",
    emoji: "🦉",
    rarity: "RARE",
    description:
      "めの まわりの しろい もようが メガネを かけているように みえる フクロウ。あかちゃんの ときは からだが まっしろで、おとなになると いろが かわるんだ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 17,
  },
  // ── わしの なかまを もっと あつめる ──
  {
    animalId: "eagle_philippine",
    genericName: "わし",
    specificName: "フィリピンワシ",
    emoji: "🦅",
    rarity: "LEGENDARY",
    description:
      "せかいで いちばん おおきな わしの ひとつ。あたまの ふわふわの かみのけみたいな はねが とくちょう。フィリピンの もりにしか すんでいない、たいへん めずらしい とりだよ。",
    habitat: "フィリピンの ねったいうりん",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── たかの なかまを もっと あつめる ──
  {
    animalId: "hawk_buzzard",
    genericName: "たか",
    specificName: "ノスリ",
    emoji: "🦅",
    rarity: "COMMON",
    description:
      "でんちゅうの うえなどに とまって じっと えものを まつ たか。「ホバリング」と いって そらで はばたきながら とまる ことも できる、にほんで みかける みぢかな たかだよ。",
    habitat: "にほんの のはらや かわら",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── はやぶさの なかまを もっと あつめる ──
  {
    animalId: "falcon_gyr",
    genericName: "はやぶさ",
    specificName: "シロハヤブサ",
    emoji: "🦅",
    rarity: "RARE",
    description:
      "はやぶさの なかまで いちばん おおきく、からだが まっしろな ものも いる めずらしい とり。きたきょくの さむい ちいきに すんでいて、むかしから おうぞくに あいされてきたんだ。",
    habitat: "きたきょくの こおりの だいち",
    stageId: "ice_age",
    lifespanYears: 20,
  },
  // ── インコの なかまを もっと あつめる ──
  {
    animalId: "parakeet_cockatiel",
    genericName: "インコ",
    specificName: "オカメインコ",
    emoji: "🦜",
    rarity: "COMMON",
    description:
      "あたまに ぴんと たった かんむりばねが かわいい インコ。ほっぺたが オレンジいろで、うれしいと かんむりばねを ぴょこぴょこ うごかすんだよ。",
    habitat: "オーストラリアの かんそうした そうげん",
    stageId: "savanna",
    lifespanYears: 16,
  },
  // ── おうむの なかまを もっと あつめる ──
  {
    animalId: "cockatoo_sulphur_crested",
    genericName: "おうむ",
    specificName: "キバタン",
    emoji: "🦜",
    rarity: "RARE",
    description:
      "あたまの きいろい かんむりばねを ぱっと ひろげる おおきな オウム。おおきな こえで なき、なかまどうしで さわがしく むれで くらしているよ。",
    habitat: "オーストラリアの もりや まち",
    stageId: "forest",
    lifespanYears: 40,
  },
  // ── つるの なかまを もっと あつめる ──
  {
    animalId: "crane_hooded",
    genericName: "つる",
    specificName: "ナベヅル",
    emoji: "🦢",
    rarity: "RARE",
    description:
      "あたまと くびが くろっぽい ツル。あきに シベリアから にほんへ わたってきて、かごしまの いずみで おおきな むれを つくって ふゆを すごすんだよ。",
    habitat: "シベリアと にほんの しっち",
    stageId: "forest",
    lifespanYears: 22,
  },
  // ── アホウドリの なかまを もっと あつめる ──
  {
    animalId: "albatross_black_footed",
    genericName: "アホウドリ",
    specificName: "コアホウドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "からだが くろっぽい アホウドリ。にほんの とりしまや おがさわらの しまじまでも すを つくる。うみの うえを ながいきょり とびつづける じょうずな ひこうかだよ。",
    habitat: "きたたいへいようの しまじま",
    stageId: "deep_sea",
    lifespanYears: 40,
  },
  // ── あたらしい なかま：ラクダ ──
  {
    animalId: "camel_dromedary",
    genericName: "ラクダ",
    specificName: "ヒトコブラクダ",
    emoji: "🐪",
    rarity: "COMMON",
    description:
      "せなかに こぶが 1つ ある ラクダ。こぶの なかには しぼうが たっぷり たくわえられていて、みずや ごはんが なくても さばくを なんにちも あるけるんだよ。",
    habitat: "ちゅうとうや アフリカの さばく",
    stageId: "savanna",
    lifespanYears: 40,
  },
  {
    animalId: "camel_bactrian",
    genericName: "ラクダ",
    specificName: "フタコブラクダ",
    emoji: "🐫",
    rarity: "RARE",
    description:
      "せなかに こぶが 2つ ある ラクダ。なつは あつく ふゆは とても さむい ちゅうおうアジアの さばくに すんでいて、けが ながくて ふさふさに なるんだ。",
    habitat: "ちゅうおうアジアの さばく",
    stageId: "savanna",
    lifespanYears: 40,
  },
  // ── あたらしい なかま：ラマ ──
  {
    animalId: "llama_alpaca",
    genericName: "ラマ",
    specificName: "アルパカ",
    emoji: "🦙",
    rarity: "COMMON",
    description:
      "ふわふわの けが きもちいい アンデスの どうぶつ。けは あたたかい いとに なって ふくに つかわれるよ。おこると あいてに つばを ぴゅっと とばすことも あるんだ。",
    habitat: "みなみアメリカ アンデスの こうち",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "llama_llama",
    genericName: "ラマ",
    specificName: "ラマ",
    emoji: "🦙",
    rarity: "COMMON",
    description:
      "アルパカより からだが おおきい アンデスの どうぶつ。むかしから にもつを はこぶ どうぶつとして にんげんに かわれてきた、ちからもちで がまんづよい どうぶつだよ。",
    habitat: "みなみアメリカ アンデスの こうち",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── アルマジロの なかまを もっと あつめる ──
  {
    animalId: "armadillo_three_banded",
    genericName: "アルマジロ",
    specificName: "ミツオビアルマジロ",
    emoji: "🦔",
    rarity: "RARE",
    description:
      "あぶないと からだを まるめて ボールみたいに なる アルマジロ。よろいに 3つの おびじょうの すきまが あるから、ぴったり まんまるに なれるんだよ。",
    habitat: "みなみアメリカの くさはら",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── かわうその なかまを もっと あつめる ──
  {
    animalId: "otter_eurasian",
    genericName: "かわうそ",
    specificName: "ユーラシアカワウソ",
    emoji: "🦦",
    rarity: "COMMON",
    description:
      "ヨーロッパや アジアの きれいな かわに すむ カワウソ。よるに かつどうして さかなや カニを とるよ。にほんでは いちど ぜつめつしてしまった ちいきも あるんだ。",
    habitat: "ヨーロッパ・アジアの かわ",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── あたらしい なかま：ヒクイドリ ──
  {
    animalId: "cassowary_southern",
    genericName: "ヒクイドリ",
    specificName: "ヒクイドリ",
    emoji: "🦤",
    rarity: "EPIC",
    description:
      "あたまに かたい とさかが ある とびない おおきな とり。あしの つめが するどくて キックの ちからが とても つよい。せかいで いちばん きけんな とりとも いわれているよ。",
    habitat: "ニューギニアや オーストラリアの ねったいうりん",
    stageId: "forest",
    lifespanYears: 40,
  },
  // ── カマキリの なかまを もっと あつめる ──
  {
    animalId: "mantis_giant_asian",
    genericName: "カマキリ",
    specificName: "ハラビロカマキリ",
    emoji: "🦗",
    rarity: "COMMON",
    description:
      "おなかが ひろくて たいらな カマキリ。にほんの のはらや はたけで よく みつかるよ。かまのような まえあしで すばやく むしを つかまえる じょうずな ハンターなんだ。",
    habitat: "にほんの のはらや はたけ",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── あたらしい なかま：くわがた ──
  {
    animalId: "stag_beetle_giant",
    genericName: "くわがた",
    specificName: "オオクワガタ",
    emoji: "🪲",
    rarity: "RARE",
    description:
      "おおきな あごが はさみのような クワガタムシ。きの みきの あなで くらしていて、なつの よるに クヌギの きの じゅえきに あつまるよ。にんきが あって たかく とりひきされることも あるんだ。",
    habitat: "にほんの くぬぎばやし",
    stageId: "forest",
    lifespanYears: 3,
  },
  // ── ちょうの なかまを もっと あつめる ──
  {
    animalId: "butterfly_blue_morpho",
    genericName: "ちょう",
    specificName: "モルフォチョウ",
    emoji: "🦋",
    rarity: "RARE",
    description:
      "つばさの うらおもてで いろが ちがう ふしぎな ちょうちょ。おもてめんは きらきら ひかる あおいろで、とぶたびに いろが きらきら かわって みえるんだよ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_flying",
    genericName: "さかな",
    specificName: "トビウオ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "おおきな ひれを はねのように ひろげて、うみの うえを 高く とびはねる さかな。てきから にげるときに、すいめんを 400メートルいじょうも とびつづけることが あるんだよ。",
    habitat: "あたたかい うみの うみめん",
    stageId: "deep_sea",
    lifespanYears: 50,
  },
  // ── ねこの なかまを もっと あつめる ──
  {
    animalId: "cat_caracal",
    genericName: "ねこ",
    specificName: "カラカル",
    emoji: "🐱",
    rarity: "RARE",
    description:
      "みみの さきに ぴんと たった くろい ふさげが ある ネコ。ジャンプりょくが すごく、とんでいる とりを その場で とびあがって とらえてしまうんだよ。",
    habitat: "アフリカ・ちゅうとうの サバンナ",
    stageId: "savanna",
    lifespanYears: 12,
  },
  {
    animalId: "cat_fishing",
    genericName: "ねこ",
    specificName: "スナドリネコ",
    emoji: "🐱",
    rarity: "RARE",
    description:
      "みずべに すんで さかなを すいちゅうから つかまえる めずらしい ネコ。あしの ゆびに みずかきが あって、すいえいも とくいなんだよ。",
    habitat: "アジアの しっちや かわべ",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── くまの なかまを もっと あつめる ──
  {
    animalId: "bear_sloth",
    genericName: "くま",
    specificName: "ナマケグマ",
    emoji: "🐻",
    rarity: "RARE",
    description:
      "ながい くちさきを シロアリの すに さしこんで、ストローみたいに すいこんで たべる クマ。こどもを せなかに のせて あるく すがたも かわいいよ。",
    habitat: "インドの もりや くさはら",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── きつねの なかまを もっと あつめる ──
  {
    animalId: "fox_grey",
    genericName: "きつね",
    specificName: "ハイイロギツネ",
    emoji: "🦊",
    rarity: "COMMON",
    description:
      "きを のぼれる めずらしい キツネ。つめが ねこのように するどく まがっているので、てきから にげる ときに きの うえに かくれられるよ。",
    habitat: "きたアメリカの もり",
    stageId: "forest",
    lifespanYears: 8,
  },
  // ── とかげの なかまを もっと あつめる ──
  {
    animalId: "lizard_thorny_devil",
    genericName: "とかげ",
    specificName: "トゲトゲトカゲ",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "からだじゅうが とげで おおわれた オーストラリアの トカゲ。あしの うらで つゆを あつめて、ひふを つたわせて みずを のむんだよ。",
    habitat: "オーストラリアの さばく",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "lizard_frilled",
    genericName: "とかげ",
    specificName: "エリマキトカゲ",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "おどろくと くびの まわりの えりまきを ばっと ひろげて おおきく みせる トカゲ。にほんあしで たって はやく はしることも できるよ。",
    habitat: "オーストラリア・ニューギニアの もり",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── へびの なかまを もっと あつめる ──
  {
    animalId: "snake_black_mamba",
    genericName: "へび",
    specificName: "ブラックマンバ",
    emoji: "🐍",
    rarity: "EPIC",
    description:
      "アフリカに すむ、せかいでも とても はやく うごける どくヘビ。くちの なかが くろいのが なまえの ゆらいで、するどい どくきばを もつよ。",
    habitat: "アフリカの サバンナや もり",
    stageId: "savanna",
    lifespanYears: 11,
  },
  // ── ふくろうの なかまを もっと あつめる ──
  {
    animalId: "owl_great_grey",
    genericName: "ふくろう",
    specificName: "カラフトフクロウ",
    emoji: "🦉",
    rarity: "RARE",
    description:
      "せかいで いちばん おおきい フクロウの なかま。かおが まんまるで おおきく、ゆきの なかの ネズミの おとも きこえる するどい みみを もつよ。",
    habitat: "きたの つめたい もり",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  {
    animalId: "owl_tawny",
    genericName: "ふくろう",
    specificName: "モリフクロウ",
    emoji: "🦉",
    rarity: "COMMON",
    description:
      "ヨーロッパの もりに ひろく すむ フクロウ。「ホーホー」という なきごえが ゆうめいで、よるに なると かつどうする よるの ハンターだよ。",
    habitat: "ヨーロッパの もり",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── わしの なかまを もっと あつめる ──
  {
    animalId: "eagle_osprey",
    genericName: "わし",
    specificName: "ミサゴ",
    emoji: "🦅",
    rarity: "COMMON",
    description:
      "うみや かわに すいちょくに とびこんで、さかなだけを つかまえる めずらしい タカ。つめが するどく、せかいじゅうの みずべで くらしているよ。",
    habitat: "せかいじゅうの みずべ",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "secretarybird",
    genericName: "ヘビクイワシ",
    specificName: "ヘビクイワシ",
    emoji: "🦅",
    rarity: "EPIC",
    description:
      "あしの ながい めずらしい もうきん。そらを とぶより じめんを あるいて ヘビを ふみつけて たべるのが とくいな、ユニークな とりだよ。",
    habitat: "アフリカの サバンナ",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── イルカの なかまを もっと あつめる ──
  {
    animalId: "dolphin_risso",
    genericName: "イルカ",
    specificName: "ハナゴンドウ",
    emoji: "🐬",
    rarity: "RARE",
    description:
      "せいちょうすると からだに たくさんの きずあとが つく めずらしい イルカ。いかを たべるのが だいすきで、ふかい うみまで もぐるよ。",
    habitat: "せかいじゅうの あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 35,
  },
  {
    animalId: "dolphin_spinner",
    genericName: "イルカ",
    specificName: "ハシナガイルカ",
    emoji: "🐬",
    rarity: "COMMON",
    description:
      "うみの うえで くるくると かいてんしながら ジャンプする イルカ。そのアクロバットな うごきから「スピナー（くるくる）」と よばれているよ。",
    habitat: "せかいじゅうの あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  // ── インコの なかまを もっと あつめる ──
  {
    animalId: "lovebird_peach_faced",
    genericName: "インコ",
    specificName: "コザクラインコ",
    emoji: "🦜",
    rarity: "COMMON",
    description:
      "ほっぺが もも いろの ちいさな インコ。なかまや かいぬしに ぴったり よりそうので「ラブバード（あいの とり）」と よばれているよ。",
    habitat: "アフリカの かんそうした サバンナ",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── こうもりの なかまを もっと あつめる ──
  {
    animalId: "bat_horseshoe",
    genericName: "こうもり",
    specificName: "キクガシラコウモリ",
    emoji: "🦇",
    rarity: "COMMON",
    description:
      "はなさきが きくの はなのような かたちを している コウモリ。ちょうおんぱを はなして どうくつの なかでも じゆうに とびまわるよ。",
    habitat: "せかいじゅうの どうくつ",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── クジラの なかまを もっと あつめる ──
  {
    animalId: "whale_bowhead",
    genericName: "クジラ",
    specificName: "ホッキョククジラ",
    emoji: "🐳",
    rarity: "LEGENDARY",
    description:
      "200ねん いじょう いきると いわれる、どうぶつの なかでも とびきり ながいきの クジラ。あつい しぼうで つめたい きたの うみでも へいきだよ。",
    habitat: "きたきょくの つめたい うみ",
    stageId: "ice_age",
    lifespanYears: 200,
  },
  {
    animalId: "whale_gray",
    genericName: "クジラ",
    specificName: "コククジラ",
    emoji: "🐳",
    rarity: "RARE",
    description:
      "1まんキロ いじょうを いどうする、ほにゅうるいで いちばん ながい かいゆうを する クジラ。からだに ふじつぼが くっつくのが とくちょうだよ。",
    habitat: "たいへいようの きたから みなみまで",
    stageId: "deep_sea",
    lifespanYears: 70,
  },
  // ── サメの なかまを もっと あつめる ──
  {
    animalId: "shark_mako",
    genericName: "サメ",
    specificName: "アオザメ",
    emoji: "🦈",
    rarity: "RARE",
    description:
      "サメの なかで いちばん はやく およげる しゅるい。じそく74キロにも たっして、うみの なかを ロケットのように すいすい すすむよ。",
    habitat: "せかいじゅうの あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 25,
  },
  // ── かえるの なかまを もっと あつめる ──
  {
    animalId: "frog_horned",
    genericName: "かえる",
    specificName: "ツノガエル",
    emoji: "🐸",
    rarity: "COMMON",
    description:
      "まんまるな からだに おおきな くちが とくちょうの カエル。じぶんと おなじくらいの おおきさの えさも ぱくっと たべてしまうよ。",
    habitat: "みなみアメリカの くさはら",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── ワニの なかまを もっと あつめる ──
  {
    animalId: "caiman_spectacled",
    genericName: "ワニ",
    specificName: "メガネカイマン",
    emoji: "🐊",
    rarity: "COMMON",
    description:
      "めの まわりの もようが メガネのように みえる ちいさめの ワニ。みなみアメリカの かわや ぬまに ひろく すんでいるよ。",
    habitat: "みなみアメリカの かわや ぬま",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── たこの なかまを もっと あつめる ──
  {
    animalId: "octopus_mimic",
    genericName: "たこ",
    specificName: "ミミックオクトパス",
    emoji: "🐙",
    rarity: "LEGENDARY",
    description:
      "うみへびや ひらめなど、ほかの どうぶつに そっくりに へんしんできる めずらしい タコ。てきから みを かくす とくいぎを もつよ。",
    habitat: "とうなんアジアの あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 2,
  },
  // ── エイの なかまを もっと あつめる ──
  {
    animalId: "ray_eagle",
    genericName: "エイ",
    specificName: "マダラトビエイ",
    emoji: "🐡",
    rarity: "RARE",
    description:
      "からだに しろい まるい もようが たくさん ある エイ。うみの なかで つばさのように ひれを うごかして、ゆうがに およぐよ。",
    habitat: "せかいじゅうの あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 25,
  },
  // ── さるの なかまを もっと あつめる ──
  {
    animalId: "monkey_proboscis",
    genericName: "さる",
    specificName: "テングザル",
    emoji: "🐒",
    rarity: "EPIC",
    description:
      "オスは おおきな はなを もつ めずらしい サル。きから きへ ジャンプし、みずの なかも すいすい およげる ユニークな サルだよ。",
    habitat: "ボルネオじまの ねったいうりん",
    stageId: "forest",
    lifespanYears: 25,
  },
  {
    animalId: "monkey_capuchin",
    genericName: "さる",
    specificName: "フサオマキザル",
    emoji: "🐒",
    rarity: "COMMON",
    description:
      "とても かしこく どうぐを つかう サル。いしを つかって きの みを わったり、えさを とる くふうを する すがたが みられるよ。",
    habitat: "みなみアメリカの もり",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── あたらしい なかま：カニ ──
  {
    animalId: "crab_coconut",
    genericName: "カニ",
    specificName: "ヤシガニ",
    emoji: "🦀",
    rarity: "EPIC",
    description:
      "せかいで いちばん おおきな りくの こうかくるい。はさみの ちからが とても つよく、ヤシの みの からも わって たべてしまうよ。",
    habitat: "とうなんアジアの しまじま",
    stageId: "forest",
    lifespanYears: 60,
  },
  {
    animalId: "crab_japanese_spider",
    genericName: "カニ",
    specificName: "タカアシガニ",
    emoji: "🦀",
    rarity: "EPIC",
    description:
      "あしを ひろげると 3メートルにも なる、せかいで いちばん おおきい カニ。ふかい うみの そこに すんでいる きょだいな すがただよ。",
    habitat: "にほんの ふかい うみ",
    stageId: "deep_sea",
    lifespanYears: 100,
  },
  // ── あたらしい なかま：サソリ ──
  {
    animalId: "scorpion_deathstalker",
    genericName: "サソリ",
    specificName: "デスストーカー",
    emoji: "🦂",
    rarity: "LEGENDARY",
    description:
      "せかいで いちばん きけんな サソリの ひとつ。さばくに すんでいて、どくの つよさは ひとを びょういんに おくりこむほど なんだよ。",
    habitat: "ちゅうとう・きたアフリカの さばく",
    stageId: "savanna",
    lifespanYears: 5,
  },
  // ── あたらしい なかま：ヤマアラシ ──
  {
    animalId: "porcupine_crested",
    genericName: "ヤマアラシ",
    specificName: "アフリカタテガミヤマアラシ",
    emoji: "🦔",
    rarity: "RARE",
    description:
      "せなかに ながい とげを たくさん もつ どうぶつ。きけんを かんじると とげを たてて おおきく みせて、てきを おどろかせるよ。",
    habitat: "アフリカの サバンナや もり",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── アンテロープの なかまを もっと あつめる ──
  {
    animalId: "antelope_impala",
    genericName: "アンテロープ",
    specificName: "インパラ",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "サバンナを ジャンプして はしる うつくしい アンテロープ。てきに おそわれると 3メートルの たかさまで とびはねて にげるよ。",
    habitat: "アフリカの サバンナ",
    stageId: "savanna",
    lifespanYears: 13,
  },
  {
    animalId: "antelope_thomson_gazelle",
    genericName: "アンテロープ",
    specificName: "トムソンガゼル",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "サバンナで いちばん すばやく うごく ちいさめの ガゼル。チーターに おわれても じぐざぐに はしって うまく にげることが あるよ。",
    habitat: "アフリカの サバンナ",
    stageId: "savanna",
    lifespanYears: 10,
  },
  // ── アルマジロの なかまを もっと あつめる ──
  {
    animalId: "armadillo_giant",
    genericName: "アルマジロ",
    specificName: "オオアルマジロ",
    emoji: "🦔",
    rarity: "EPIC",
    description:
      "アルマジロの なかまで いちばん おおきく、たいじゅうは 30キロにも なるよ。するどい つめで ありづかを あっという まに くずして たべるんだ。",
    habitat: "みなみアメリカの もり",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── きょうりゅうの なかまを もっと あつめる ──
  {
    animalId: "pachycephalosaurus",
    genericName: "きょうりゅう",
    specificName: "パキケファロサウルス",
    emoji: "🦕",
    rarity: "RARE",
    description:
      "あたまの ほねが ぶあつく かたい きょうりゅう。オスどうしで あたまを ぶつけあって ちからくらべを したと かんがえられているよ。",
    habitat: "きたアメリカの だいち",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "giganotosaurus",
    genericName: "きょうりゅう",
    specificName: "ギガノトサウルス",
    emoji: "🦖",
    rarity: "EPIC",
    description:
      "ティラノサウルスよりも おおきいと いわれる にくしょくきょうりゅう。みなみアメリカに すんでいた、きょだいな ハンターだったよ。",
    habitat: "みなみアメリカの だいち",
    stageId: "cretaceous",
    isExtinct: true,
  },
  // ── あざらしの なかまを もっと あつめる ──
  {
    animalId: "seal_ringed",
    genericName: "あざらし",
    specificName: "ワモンアザラシ",
    emoji: "🦭",
    rarity: "COMMON",
    description:
      "からだに わのような もようが ある アザラシ。こおりに あなを あけて、その あなから うみに もぐって さかなを とるのが とくいだよ。",
    habitat: "きたきょくの こおりの うみ",
    stageId: "ice_age",
    lifespanYears: 30,
  },
  // ── あたらしい なかま：クモ ──
  {
    animalId: "spider_tarantula",
    genericName: "クモ",
    specificName: "タランチュラ",
    emoji: "🕷️",
    rarity: "RARE",
    description:
      "からだじゅうが もこもこの けで おおわれた おおきな クモ。みかけは こわいけど、どくは そんなに つよくなく、ペットとしても にんきなんだよ。",
    habitat: "みなみアメリカの もり",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── あたらしい なかま：イモリ ──
  {
    animalId: "newt_japanese_fire_belly",
    genericName: "イモリ",
    specificName: "アカハライモリ",
    emoji: "🦎",
    rarity: "COMMON",
    description:
      "おなかが あかい いろを している にほんの イモリ。みずべに すんでいて、しっぽを なくしても また はえてくる ふしぎな ちからを もつよ。",
    habitat: "にほんの ためいけや たんぼ",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── ペンギンの なかまを もっと あつめる ──
  {
    animalId: "penguin_little",
    genericName: "ペンギン",
    specificName: "コガタペンギン",
    emoji: "🐧",
    rarity: "COMMON",
    description:
      "せかいで いちばん ちいさい ペンギンで、おとな でも たかさ 30センチ ほど。オーストラリアや ニュージーランドに すんでいて、よるに おかに あがって すを つくるよ。",
    habitat: "オーストラリア・ニュージーランドの かいがん",
    stageId: "ice_age",
    lifespanYears: 6,
  },
  {
    animalId: "penguin_african",
    genericName: "ペンギン",
    specificName: "アフリカペンギン",
    emoji: "🐧",
    rarity: "RARE",
    description:
      "アフリカの みなみはしに すむ ペンギン。「ロバのような なきごえ」から「ジャッカスペンギン」とも よばれるよ。むねの くろい まるい もようが めじるしなんだ。",
    habitat: "みなみアフリカの かいがん",
    stageId: "ice_age",
    lifespanYears: 20,
  },
  // ── ふくろうの なかまを もっと あつめる ──
  {
    animalId: "owl_hawk",
    genericName: "ふくろう",
    specificName: "タカフクロウ",
    emoji: "🦉",
    rarity: "RARE",
    description:
      "タカのように ひるまも かつどうして えものを つかまえる めずらしい フクロウ。とがった つばさと ながい しっぽで きびきびと ひこうするよ。",
    habitat: "きたの もり（シベリア・スカンジナビア）",
    stageId: "ice_age",
    lifespanYears: 10,
  },
  // ── わしの なかまを もっと あつめる ──
  {
    animalId: "eagle_mountain_hawk",
    genericName: "わし",
    specificName: "クマタカ",
    emoji: "🦅",
    rarity: "EPIC",
    description:
      "にほんの もりに すむ おおきな タカのなかま。どんよく えものを おいかけ、サルや ヘビさえ つかまえるよ。めの まわりの もようが かつら みたいで かっこいいんだ。",
    habitat: "にほん・アジアの ひろようじゅりん",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── クジラの なかまを もっと あつめる ──
  {
    animalId: "whale_fin",
    genericName: "クジラ",
    specificName: "ナガスクジラ",
    emoji: "🐳",
    rarity: "EPIC",
    description:
      "シロナガスクジラに ついで せかいで 2ばんめに おおきい クジラ。およぐ はやさも とても はやく「うみの グレイハウンド」と よばれているよ。",
    habitat: "せかいじゅうの うみ",
    stageId: "deep_sea",
    lifespanYears: 90,
  },
  {
    animalId: "whale_pilot",
    genericName: "クジラ",
    specificName: "ゴンドウクジラ",
    emoji: "🐳",
    rarity: "RARE",
    description:
      "おでこが ぼっくり まるい クジラ。かしこくて グループで かりを するよ。「パイロット（先導）」という なまえの とおり、むれの リーダーに ついて いくんだ。",
    habitat: "せかいじゅうの あたたかい・おんたいの うみ",
    stageId: "deep_sea",
    lifespanYears: 45,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_bluefin_tuna",
    genericName: "さかな",
    specificName: "クロマグロ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "マグロの なかまで いちばん おおきく、おもさ 400キロを こえることも。じそく 70キロ で およぐ うみの スプリンター。おすしの ネタで だいにんきだよ。",
    habitat: "たいへいよう・たいせいようの つめたい うみ",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  {
    animalId: "fish_sailfish",
    genericName: "さかな",
    specificName: "バショウカジキ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "せびれが おおきな はのような かたちで、帆かけ船みたい。さかなで いちばん はやく、じそく 100キロを こえるともいわれる うみの スピードキング！",
    habitat: "あたたかい うみの うみめん",
    stageId: "deep_sea",
    lifespanYears: 5,
  },
  // ── アンテロープの なかまを もっと あつめる ──
  {
    animalId: "antelope_kudu",
    genericName: "アンテロープ",
    specificName: "クーズー",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "オスは らせんじょうに ねじれた りっぱな つのを もつ アンテロープ。からだに しろい たてしまが あって、もりの なかで みえにくいんだよ。",
    habitat: "アフリカの もりや サバンナ",
    stageId: "savanna",
    lifespanYears: 12,
  },
  {
    animalId: "antelope_gemsbok",
    genericName: "アンテロープ",
    specificName: "ゲムズボック",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "まっすぐな ながい つのを もつ おおきな アンテロープ。さばくの あつさにも つよく、みずなしでも ながいきかん すごすことが できるよ。",
    habitat: "みなみアフリカの かんそうした サバンナ",
    stageId: "savanna",
    lifespanYears: 18,
  },
  {
    animalId: "antelope_springbok",
    genericName: "アンテロープ",
    specificName: "スプリングボック",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "みなみアフリカの こっかの どうぶつ。うれしいと 3メートルも たかく ぴょんぴょん とびはねる「プロンキング」という うごきが とくちょうだよ。",
    habitat: "みなみアフリカの かんそうした そうげん",
    stageId: "savanna",
    lifespanYears: 10,
  },
  {
    animalId: "antelope_eland",
    genericName: "アンテロープ",
    specificName: "エランド",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "アンテロープの なかまで いちばん おおきく、おもさが 900キロにもなるよ。おとなしくて かりやすいため、かこいの なかで かわれることも あるんだ。",
    habitat: "アフリカの サバンナや くさはら",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── しかの なかまを もっと あつめる ──
  {
    animalId: "deer_sambar",
    genericName: "しか",
    specificName: "サンバーシカ",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "アジアで いちばん おおきな シカのひとつ。からだが おおきく、のどに ながい たてがみが はえているよ。みずが だいすきで、よく いけに はいって たべものを さがすんだ。",
    habitat: "みなみアジア・とうなんアジアの もり",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：ヤギ ──
  {
    animalId: "goat_ibex",
    genericName: "ヤギ",
    specificName: "アルプスアイベックス",
    emoji: "🐐",
    rarity: "RARE",
    description:
      "アルプスの けわしい がけを じょうずに のぼる ヤギ。オスの おおきく そりかえった つのは 1メートルを こえることも。ふゆは やまを くだって すごすんだよ。",
    habitat: "ヨーロッパ アルプスの こうざんたい",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  // ── あたらしい なかま：ひつじ ──
  {
    animalId: "sheep_bighorn",
    genericName: "ひつじ",
    specificName: "ビッグホーンシープ",
    emoji: "🐑",
    rarity: "RARE",
    description:
      "おすは ぐるっと まるく まがった おおきな つのを もち、ライバルと あたまを ぶつけあう「つのつき」を するよ。ロッキーさんみゃくの けわしい いわばを かけまわるんだ。",
    habitat: "きたアメリカの ロッキーさんみゃく",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── あたらしい なかま：うし ──
  {
    animalId: "buffalo_bison_american",
    genericName: "うし",
    specificName: "アメリカバイソン",
    emoji: "🐃",
    rarity: "RARE",
    description:
      "きたアメリカで いちばん おもい りくの どうぶつ。おもさは 1トン いじょう！むかしは なんおくとうも いたのに、かりすぎで ぐっと へってしまったんだ。",
    habitat: "きたアメリカの そうげん",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "cattle_yak",
    genericName: "うし",
    specificName: "ヤク",
    emoji: "🐂",
    rarity: "RARE",
    description:
      "チベットの たかい やまに すむ おおきな ウシ。ふわふわに ながい けが あたたかく、さんそが うすい 4000メートルを こえる こうちでも へいきで くらせるんだよ。",
    habitat: "チベット・ヒマラヤの たかち",
    stageId: "ice_age",
    lifespanYears: 23,
  },
  // ── あたらしい なかま：ウォンバット ──
  {
    animalId: "wombat_common",
    genericName: "ウォンバット",
    specificName: "ヒメウォンバット",
    emoji: "🦫",
    rarity: "RARE",
    description:
      "オーストラリアに すむ ずんぐりした どうぶつ。おなかの ふくろが うしろむきに なっていて、あなを ほるときに どろが はいらないんだよ。うんちが さいころみたいな しかくなんだ！",
    habitat: "オーストラリアの そうげんや もり",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── ねこの なかまを もっと あつめる ──
  {
    animalId: "cat_ocelot",
    genericName: "ねこ",
    specificName: "オセロット",
    emoji: "🐆",
    rarity: "RARE",
    description:
      "みなみアメリカの もりに すむ うつくしい ヤセイネコ。ヒョウに にた もようで、よるに こっそり えものを おいかけるよ。およぐのも とくいな きれいな ネコなんだ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "cat_golden_african",
    genericName: "ねこ",
    specificName: "アフリカンゴールデンキャット",
    emoji: "🐱",
    rarity: "RARE",
    description:
      "アフリカの もりに すむ なぞの おおきな ヤセイネコ。からだの いろは きんいろから あかっぽい かっしょくまで さまざまで、めったに みられない きれいな ネコだよ。",
    habitat: "ちゅうおうアフリカの ねったいうりん",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── とかげの なかまを もっと あつめる ──
  {
    animalId: "lizard_bluetongue",
    genericName: "とかげ",
    specificName: "アオジタトカゲ",
    emoji: "🦎",
    rarity: "COMMON",
    description:
      "びっくりすると まっさおな したを だして てきを おどろかせる トカゲ。あしが みじかくて ずんぐりした からだで、おだやかな せいかくなんだ。",
    habitat: "オーストラリアの もりや そうげん",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "lizard_basilisk",
    genericName: "とかげ",
    specificName: "バジリスクトカゲ",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "みずの うえを はしって わたれる ふしぎな トカゲ！てきに おわれると あしを はやく うごかして みずめんを ダッシュするよ。「キリストのトカゲ」とも よばれているんだ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 7,
  },
  // ── サンショウウオの なかまを もっと あつめる ──
  {
    animalId: "salamander_fire",
    genericName: "サンショウウオ",
    specificName: "ファイアサラマンダー",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "くろい からだに きいろい もようが あって まるで かみなりみたいな サンショウウオ。どくの ある よう液を ひふから だして てきから みを まもるよ。",
    habitat: "ヨーロッパの しめった もり",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── かえるの なかまを もっと あつめる ──
  {
    animalId: "frog_glass",
    genericName: "かえる",
    specificName: "ガラスガエル",
    emoji: "🐸",
    rarity: "EPIC",
    description:
      "おなかの かわが とうめいで、なかの しんぞうや いなど が みえる ふしぎな カエル。まるで びょういんの レントゲンみたいだよ！ちゅうなんべいの もりに すんでいるんだ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── へびの なかまを もっと あつめる ──
  {
    animalId: "snake_boa",
    genericName: "へび",
    specificName: "ボアコンストリクター",
    emoji: "🐍",
    rarity: "COMMON",
    description:
      "からだで えものを ぎゅっと しめて たべる おおきな へび。どくは なくて、えものの いきを とめる ほうほうで つかまえるよ。ペットとしても にんきなんだ。",
    habitat: "ちゅうなんべいの もりや くさはら",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：ヤドカリ ──
  {
    animalId: "hermit_crab",
    genericName: "ヤドカリ",
    specificName: "オカヤドカリ",
    emoji: "🦀",
    rarity: "COMMON",
    description:
      "かいがらを「うち」として しょいこんで くらすかわいい いきもの。からだが おおきくなったら あたらしい かいがらに ひっこしするよ。りくでも くらせる めずらしい ヤドカリなんだ。",
    habitat: "りゅうきゅう・とうなんアジアの かいがん",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_halibut",
    genericName: "さかな",
    specificName: "オヒョウ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "うみの そこに すむ ひらべったい さかな。おもさが 300キロを こえるものも いる、とても おおきなカレイのなかまだよ。うまれたときは めが からだの りょうがわに あるけど、おおきくなると かたがわに うつるんだ。",
    habitat: "きたの つめたい うみの そこ",
    stageId: "deep_sea",
    lifespanYears: 50,
  },
  {
    animalId: "fish_barracuda",
    genericName: "さかな",
    specificName: "オニカマス",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "ながい からだに するどい きばが ずらりと ならんだ うみの スプリンター。じそく 40キロ以上で えものを おいかけて、するどい きばで かみつくんだ。",
    habitat: "あたたかい うみの うみめん",
    stageId: "deep_sea",
    lifespanYears: 15,
  },
  // ── あたらしい なかま：アシカ ──
  {
    animalId: "sea_lion_california",
    genericName: "アシカ",
    specificName: "カリフォルニアアシカ",
    emoji: "🦭",
    rarity: "COMMON",
    description:
      "とても かしこくて トレーニングしやすいので、サーカスや すいぞくかんで よく かわれているアシカ。じょうずに ボールを はなさきで ころがすことも できるんだよ。",
    habitat: "きたたいへいようの かいがん",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：センザンコウ ──
  {
    animalId: "pangolin_ground",
    genericName: "センザンコウ",
    specificName: "ミミセンザンコウ",
    emoji: "🦔",
    rarity: "EPIC",
    description:
      "からだが うろこ状の かたいけで おおわれた めずらしい どうぶつ。まるくなると よろいに つつまれた まりのよう。ながい したで アリを なめとって たべるよ。",
    habitat: "アフリカの サバンナや もり",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：オオハシ ──
  {
    animalId: "bird_toucan",
    genericName: "オオハシ",
    specificName: "オオハシ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "からだより ながい おおきな くちばしを もつ とり。くちばしは かるいのに いろが あざやか。なかまと くちばしで きのみを なげあって あそぶことも あるんだよ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── とりの なかまを もっと あつめる ──
  {
    animalId: "bird_flamingo_lesser",
    genericName: "とり",
    specificName: "コビトフラミンゴ",
    emoji: "🦩",
    rarity: "RARE",
    description:
      "フラミンゴの なかまで いちばん ちいさい しゅるい。でも せかいで いちばん かずが おおい フラミンゴで、アフリカの しおあじの みずうみに なんひゃくまんわも あつまるよ。",
    habitat: "アフリカの えんかしつ の みずうみ",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "ibis_japanese",
    genericName: "とり",
    specificName: "トキ",
    emoji: "🦩",
    rarity: "LEGENDARY",
    description:
      "はねの うらがわが うつくしい もももいろの とり。にほんでは ぜつめつしてしまったが、ちゅうごくで みつかった さいごの こから ふやして にほんの しぜんに かえす とりくみが つづいているんだよ。",
    habitat: "にほんと ちゅうごくの みずた",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── あたらしい なかま：アライグマ ──
  {
    animalId: "raccoon_north_american",
    genericName: "アライグマ",
    specificName: "アライグマ",
    emoji: "🦝",
    rarity: "COMMON",
    description:
      "めの まわりが くろくて マスクを かけているみたいな どうぶつ。てが とても きように うごいて、まるで みずで あらうように えさを もつしぐさが なまえの ゆらいなんだ。",
    habitat: "きたアメリカ・にほんの まちや もり",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── たかの なかまを もっと あつめる ──
  {
    animalId: "hawk_harrier",
    genericName: "たか",
    specificName: "チュウヒ",
    emoji: "🦅",
    rarity: "COMMON",
    description:
      "よし原や しっちの うえを ゆるやかに とびながら えものを さがすタカ。つばさを ▽がたに ひろげて ふわふわと とぶすがたが とくちょうだよ。にほんでも みられるよ。",
    habitat: "アジア・ヨーロッパの しっちや よしはら",
    stageId: "savanna",
    lifespanYears: 16,
  },
  // ── あたらしい なかま：ディンゴ ──
  {
    animalId: "dingo",
    genericName: "いぬ",
    specificName: "ディンゴ",
    emoji: "🐕",
    rarity: "RARE",
    description:
      "オーストラリアに すむ ヤセイの イヌ。4000ねんまえに にんげんと いっしょに オーストラリアに やってきたと かんがえられているよ。こえは ワンワンではなく、遠吠えするんだ。",
    habitat: "オーストラリアの そうげんや かんそうち",
    stageId: "savanna",
    lifespanYears: 10,
  },
  // ── あたらしい なかま：モグラ ──
  {
    animalId: "mole_star_nosed",
    genericName: "モグラ",
    specificName: "ホシバナモグラ",
    emoji: "🐾",
    rarity: "RARE",
    description:
      "はなさきに 22ほんの にくしつの しょっかくを もつ ふしぎな モグラ。この はなで いっしゅんに えものを みつけて たべる、どうぶつで いちばん はやい たべっぷりなんだ。",
    habitat: "きたアメリカひがしぶの しめった ち",
    stageId: "forest",
    lifespanYears: 4,
  },
  // ── きょうりゅうの なかまを もっと あつめる ──
  {
    animalId: "dino_therizinosaurus",
    genericName: "きょうりゅう",
    specificName: "テリジノサウルス",
    emoji: "🦕",
    rarity: "EPIC",
    description:
      "おもさ 1メートルを こえる きょだいな つめを もつ きょうりゅう。そのつめは かぶとむしの ツノのような どうぐで、えだを ひきよせて はっぱを たべるために つかっていたよ。",
    habitat: "アジア（もんごる・ちゅうごく）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_deinonychus",
    genericName: "きょうりゅう",
    specificName: "デイノニクス",
    emoji: "🦖",
    rarity: "RARE",
    description:
      "「おそろしい かぎづめ」という なまえをもつ にくしょくきょうりゅう。かしこくて むれで きょうりょくして おおきな えものを たおしていた、きびんな ハンターなんだ。",
    habitat: "きたアメリカ",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_edmontosaurus",
    genericName: "きょうりゅう",
    specificName: "エドモントサウルス",
    emoji: "🦕",
    rarity: "COMMON",
    description:
      "くちびるが かものくちばしみたいに ひらべったい、なんわじゅうもの むれで くらしていた きょうりゅう。ハドロサウルスの なかまで、は が なんじゅっぽんも はえていたよ。",
    habitat: "きたアメリカ",
    stageId: "cretaceous",
    isExtinct: true,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_pufferfish_tiger",
    genericName: "さかな",
    specificName: "トラフグ",
    emoji: "🐡",
    rarity: "RARE",
    description:
      "からだに くろい まだらもようの ある フグ。きけんを かんじると みずを のみこんで まんまるに ふくらむよ。どくが あるのに にほんでは ごちそうの さかなとして にんきなんだ。",
    habitat: "にほんかい・ひがしシナかい",
    stageId: "deep_sea",
    lifespanYears: 10,
  },
  {
    animalId: "fish_eel_japanese",
    genericName: "さかな",
    specificName: "ニホンウナギ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "うなぎどんぶりで にんきの さかな。にほんの かわで おとなになり、はるかとおい たいへいようのうみまで たまごを うみに いく、なぞの おおたびを するんだよ。",
    habitat: "にほんのかわ・たいへいよう",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "fish_archerfish",
    genericName: "さかな",
    specificName: "テッポウウオ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "みずの なかから えだに いる むしを ねらって、くちから みずを ぴゅっと とばして おとすよ。まるで ピストルみたいに かいちゅうを うつ、ねらいうちの めいじんなんだ。",
    habitat: "とうなんアジアのマングローブ",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "fish_mudskipper",
    genericName: "さかな",
    specificName: "トビハゼ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "ひれを つかって りくを あるける めずらしい さかな。どろばたを ぴょんぴょん はねて、きのうえに のぼることも できるよ。えらに みずを ためて りくでも こきゅうできるんだ。",
    habitat: "アジア・アフリカのマングローブ",
    stageId: "savanna",
    lifespanYears: 5,
  },
  {
    animalId: "fish_swordfish",
    genericName: "さかな",
    specificName: "メカジキ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "あたまから ながい つるぎのような くちさきが にょきっと でている さかな。えものを このつるぎで たたいて とらえるんだ。じそく 90キロを こえることもある うみの スプリンターだよ。",
    habitat: "せかいじゅうのあたたかいうみ",
    stageId: "deep_sea",
    lifespanYears: 9,
  },
  // ── とりの なかまを もっと あつめる ──
  {
    animalId: "bird_swallow_barn",
    genericName: "とり",
    specificName: "ツバメ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "にほんの はるに やってくる わたりどり。むかしから にんげんの いえの ひさしに すを つくり、むしを たくさん たべてくれる たのしい なかまとして あいされてきたよ。",
    habitat: "にほんをふくむアジア",
    stageId: "savanna",
    lifespanYears: 4,
  },
  {
    animalId: "bird_crow_jungle",
    genericName: "とり",
    specificName: "ハシブトガラス",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "まちにも もりにも すむ とても かしこい カラス。しんごうが あかになったら どうろに くるみを おいて くるまに ひかせてわる、どうぐを つかうちえのある とりなんだよ。",
    habitat: "にほんのまちやもり",
    stageId: "forest",
    lifespanYears: 13,
  },
  {
    animalId: "bird_mallard",
    genericName: "とり",
    specificName: "マガモ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "オスのあたまが きれいな みどりいろの カモ。みずに ぷかぷか うかんで くちばしで えさを こしとるよ。にほんの かわや いけで ふゆに よく みかけるんだ。",
    habitat: "せかいじゅうのかわやいけ",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "bird_hoopoe",
    genericName: "とり",
    specificName: "ヤツガシラ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "あたまに おうぎがたの かんむりばねを もつ うつくしい とり。なまえは かんむりを ひろげると 8つの あたまが ならんで みえるように みえることから ついたんだよ。",
    habitat: "ヨーロッパ・アジア・アフリカのさばくやもり",
    stageId: "savanna",
    lifespanYears: 10,
  },
  {
    animalId: "bird_lyrebird",
    genericName: "とり",
    specificName: "コトドリ",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "オーストラリアのもりに すむ「うたの でんせつ」。ほかの とりの こえだけでなく、チェンソーや カメラの おとまで そっくりに まねする、せかいいちの ものまね師なんだよ。",
    habitat: "オーストラリアのうっそうとしたもり",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "bird_roadrunner",
    genericName: "とり",
    specificName: "オオミチバシリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "はしるのが とくいな とり。じそく 30キロで さばくを かけまわり、ヘビや トカゲを つかまえるよ。アニメの「ロードランナー」の モデルになった とりなんだ。",
    habitat: "きたアメリカのさばくやかんそうち",
    stageId: "savanna",
    lifespanYears: 8,
  },
  {
    animalId: "bird_booby_blue_footed",
    genericName: "とり",
    specificName: "アオアシカツオドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "あしが まっさおな めずらしい とり。オスは メスに あしを みせて ぺたぺたと あるき「ぼくのあし、きれいでしょ！」と アピールして もとめるんだよ。",
    habitat: "ガラパゴスしょとうやきたアメリカにしかいがん",
    stageId: "deep_sea",
    lifespanYears: 17,
  },
  {
    animalId: "kiwi_north_island",
    genericName: "とり",
    specificName: "キウイ（北島キウイ）",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "ニュージーランドのもりに すむ とびない とり。くらい よるに ながい くちさきで じめんの においを かいで ミミズを さがすよ。からだの わりに とても おおきな たまごを うむんだ。",
    habitat: "ニュージーランドのもり",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── むしの なかまを あつめる ──
  {
    animalId: "insect_cicada_japanese",
    genericName: "セミ",
    specificName: "アブラゼミ",
    emoji: "🦗",
    rarity: "COMMON",
    description:
      "にほんのなつに「ジージー」と なく セミ。7ねんも じめんの なかで よう虫として すごし、なつの 1〜2しゅうかんだけ ちじょうにでて なくんだよ。",
    habitat: "にほんのもりやこうえん",
    stageId: "forest",
    lifespanYears: 7,
  },
  {
    animalId: "insect_firefly_japanese",
    genericName: "ほたる",
    specificName: "ゲンジボタル",
    emoji: "🪲",
    rarity: "RARE",
    description:
      "おしりが あおしろく ひかる ふしぎな むし。なかまに あいずを おくるために てんめつするよ。にほんのきれいな かわのそばでしか すめないので、かんきょうの まもりびとと よばれるんだ。",
    habitat: "にほんのきれいなかわのそば",
    stageId: "forest",
    lifespanYears: 1,
  },
  {
    animalId: "insect_dragonfly_skimmer",
    genericName: "とんぼ",
    specificName: "ギンヤンマ",
    emoji: "🦗",
    rarity: "COMMON",
    description:
      "むねが みどりいろで おなかが あおい おおきな トンボ。じぶんより ちいさな むしを たいきちゅうで つかまえるよ。なつのたんぼや いけで みかける うつくしい とんぼなんだ。",
    habitat: "にほんのたんぼやいけ",
    stageId: "savanna",
    lifespanYears: 1,
  },
  {
    animalId: "insect_honeybee",
    genericName: "ミツバチ",
    specificName: "セイヨウミツバチ",
    emoji: "🐝",
    rarity: "COMMON",
    description:
      "むれで はたらいて はなのみつを あつめ、はちみつを つくる むし。はたらきバチは いっしょうに ティースプーン 1ぱいぶんしか はちみつを あつめられないって しってた？",
    habitat: "せかいじゅうのはなばたけ",
    stageId: "savanna",
    lifespanYears: 1,
  },
  // ── うみのなかまを もっと あつめる ──
  {
    animalId: "starfish_sunflower",
    genericName: "ヒトデ",
    specificName: "ヒマワリヒトデ",
    emoji: "⭐",
    rarity: "RARE",
    description:
      "あしが 24ほんも ある きょだいな ヒトデ。ちょっけい 1メートルに なることも！ウニを おいかけて たべる すごいスピードの ハンターで、うみの バランスを まもる だいじな いきものだよ。",
    habitat: "きたたいへいようのうみのそこ",
    stageId: "deep_sea",
    lifespanYears: 5,
  },
  {
    animalId: "urchin_purple_sea",
    genericName: "ウニ",
    specificName: "ムラサキウニ",
    emoji: "🦔",
    rarity: "COMMON",
    description:
      "とげとげしたトゲで からだを まもっているウニ。このトゲは じつは あるいたり えさを つかんだりするのにも つかうよ。おすしの「うに」は ウニの たまごや せいしょくそうなんだよ。",
    habitat: "にほんのかいがんやいわばのうみ",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  {
    animalId: "sea_cucumber_japanese",
    genericName: "ナマコ",
    specificName: "マナマコ",
    emoji: "🌊",
    rarity: "COMMON",
    description:
      "うみのそこを ゆっくり はいまわる なまこ。あぶないと はらわたを だして てきの きをひくんだよ！なくなった はらわたは またはえてくるから だいじょうぶ。かんそうさせると ちゅうかりょうりの ざいりょうになるんだ。",
    habitat: "にほんのうみのそこ",
    stageId: "deep_sea",
    lifespanYears: 10,
  },
  {
    animalId: "lobster_european",
    genericName: "エビ",
    specificName: "ヨーロッパオマール",
    emoji: "🦞",
    rarity: "RARE",
    description:
      "からだが あおむらさきの おおきな エビ。つよい ハサミで えものを つかまえるよ。100ねん いじょうも いきるといわれ、としをとっても えい養を とれるかぎり ずっと そだちつづけるんだ。",
    habitat: "ヨーロッパのうみのそこ",
    stageId: "deep_sea",
    lifespanYears: 70,
  },
  // ── きょうりゅうの なかまを もっと あつめる ──
  {
    animalId: "dino_eoraptor",
    genericName: "きょうりゅう",
    specificName: "エオラプトル",
    emoji: "🦕",
    rarity: "COMMON",
    description:
      "いちばん むかしの きょうりゅうの ひとつで、やく 2.3おくねんまえに いた。ながさは 1メートルほどで ちいさく、きょうりゅうたちの そせんとも いえる とても だいじな どうぶつだよ。",
    habitat: "みなみアメリカ（アルゼンチン）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_ceratosaurus",
    genericName: "きょうりゅう",
    specificName: "ケラトサウルス",
    emoji: "🦖",
    rarity: "RARE",
    description:
      "はなの うえに つのが はえた にくしょくきょうりゅう。「つの の ある トカゲ」という いみの なまえで、ジュラきの きたアメリカに すんでいた、こわい ハンターだったよ。",
    habitat: "きたアメリカ",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_protoceratops",
    genericName: "きょうりゅう",
    specificName: "プロトケラトプス",
    emoji: "🦕",
    rarity: "COMMON",
    description:
      "トリケラトプスの しんせきで、つのが まだ ちいさく かたい えりかざりを もつ ちいさな きょうりゅう。たまごの そばで こどもを まもる すがたの かせきが みつかって いるよ。",
    habitat: "アジア（モンゴル）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_oviraptor",
    genericName: "きょうりゅう",
    specificName: "オヴィラプトル",
    emoji: "🦖",
    rarity: "RARE",
    description:
      "むかしは「たまごどろぼう」と よばれていたが、じつは じぶんの たまごを まもっていたんだと わかったよ。とさかのある あたまが とくちょうの ちいさめの きょうりゅうなんだ。",
    habitat: "アジア（モンゴル）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_maiasaura",
    genericName: "きょうりゅう",
    specificName: "マイアサウラ",
    emoji: "🦕",
    rarity: "COMMON",
    description:
      "「りょうしんづよい ははおやトカゲ」という いみの なまえを もつ きょうりゅう。おおきな むれで くらし、こどもたちが じぶんで たべられるように なるまで そだてたんだよ。",
    habitat: "きたアメリカ",
    stageId: "cretaceous",
    isExtinct: true,
  },
  // ── とかげの なかまを もっと あつめる ──
  {
    animalId: "iguana_marine_galapagos",
    genericName: "とかげ",
    specificName: "ウミイグアナ",
    emoji: "🦎",
    rarity: "EPIC",
    description:
      "とかげで ゆいいつ うみに はいって たべものを さがす めずらしい トカゲ。ガラパゴスの いわばから うみに もぐり、かいそうを たべるよ。たまった しおを はなから ぷしゅっと だすんだ。",
    habitat: "ガラパゴスしょとうのかいがん",
    stageId: "savanna",
    lifespanYears: 12,
  },
  // ── へびの なかまを もっと あつめる ──
  {
    animalId: "snake_corn",
    genericName: "へび",
    specificName: "コーンスネーク",
    emoji: "🐍",
    rarity: "COMMON",
    description:
      "あかや オレンジの きれいな もようの おとなしい ヘビ。とうもろこしぐらを ネズミから まもると いうことから なまえが ついたよ。どくは なく、ペットとしても にんきなんだ。",
    habitat: "きたアメリカのもり・のはら",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "snake_coral",
    genericName: "へび",
    specificName: "サンゴヘビ",
    emoji: "🐍",
    rarity: "RARE",
    description:
      "あか・き・くろの あざやかな しましまが きれいな どくヘビ。うつくしい いろで どくが あることを てきに しらせているよ。くちが ちいさいので なかなか かめないんだ。",
    habitat: "きたアメリカ・みなみアメリカのもり",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── ヤモリの なかまを もっと あつめる ──
  {
    animalId: "gecko_day_madagascar",
    genericName: "ヤモリ",
    specificName: "オオヒルヤモリ",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "マダガスカルに すむ みどりいろが きれいな ヤモリ。ふつうの ヤモリと ちがって ひるまに かつどうして、あかい もようが まるで えのぐで かいたみたいで うつくしいよ。",
    habitat: "マダガスカルのもり",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── うさぎの なかまを もっと あつめる ──
  {
    animalId: "rabbit_snowshoe",
    genericName: "うさぎ",
    specificName: "カンジキウサギ",
    emoji: "🐇",
    rarity: "COMMON",
    description:
      "ふゆは まっしろ、なつは ちゃいろに けが かわる うさぎ。おおきな あしのうらが ゆきのうえを あるきやすくする かんじきみたいなので この なまえだよ。",
    habitat: "きたアメリカのゆきのもり",
    stageId: "ice_age",
    lifespanYears: 5,
  },
  // ── りすの なかまを もっと あつめる ──
  {
    animalId: "squirrel_ground_prairie",
    genericName: "りす",
    specificName: "ジュウサンセンジリス",
    emoji: "🐿️",
    rarity: "COMMON",
    description:
      "きのうえではなく じめんに あなを ほって くらす リス。てきを みつけると 2あしで たちあがって なかまに けいこくするよ。なかまのために じぶんが めだつ きけんをおかすんだ。",
    habitat: "きたアメリカのそうげん",
    stageId: "savanna",
    lifespanYears: 6,
  },
  // ── おおかみの なかまを もっと あつめる ──
  {
    animalId: "wolf_arctic",
    genericName: "おおかみ",
    specificName: "ホッキョクオオカミ",
    emoji: "🐺",
    rarity: "RARE",
    description:
      "きたきょくの こおりの だいちに すむ しろい オオカミ。マイナス 40どの さむさでも へいき！むれで ジャコウウシなどを おいかけて つかまえる つよい ハンターだよ。",
    habitat: "きたきょくのこおりのだいち",
    stageId: "ice_age",
    lifespanYears: 7,
  },
  // ── さるの なかまを もっと あつめる ──
  {
    animalId: "monkey_spider",
    genericName: "さる",
    specificName: "クログモザル",
    emoji: "🐒",
    rarity: "RARE",
    description:
      "ながい てあしと しっぽを えだに まきつかせて、クモのように もりのなかを くるくる うごく サル。しっぽも てとおなじように えだを つかめる、5ほんめの あしをもつサルなんだよ。",
    habitat: "みなみアメリカのねったいうりん",
    stageId: "forest",
    lifespanYears: 25,
  },
  {
    animalId: "monkey_gelada",
    genericName: "さる",
    specificName: "ゲラダヒヒ",
    emoji: "🦍",
    rarity: "RARE",
    description:
      "エチオピアの たかい やまに すむ サル。むねに あかい ハートがたの ひふが あるよ。ほとんど くさを たべる とても めずらしいサルで、ゆびで くさを ひとつひとつ つんで たべるんだ。",
    habitat: "エチオピアのこうざんたいのそうげん",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── ペンギンの なかまを もっと あつめる ──
  {
    animalId: "penguin_macaroni",
    genericName: "ペンギン",
    specificName: "マカロニペンギン",
    emoji: "🐧",
    rarity: "RARE",
    description:
      "あたまの きいろや オレンジいろの かざりばねが マカロニみたいなペンギン。ペンギンの なかまで いちばん かずが おおく、せかいに 1800まんわ いじょうも いるんだよ！",
    habitat: "なんきょくちかくのしまじま",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  // ── ヤギの なかまを もっと あつめる ──
  {
    animalId: "goat_mountain_white",
    genericName: "ヤギ",
    specificName: "シロイワヤギ",
    emoji: "🐐",
    rarity: "RARE",
    description:
      "きたアメリカの ロッキーさんみゃくの けわしい がけに すむ しろい ヤギ。あしのひづめが やわらかく がけを しっかり つかめるので、ほぼ まっすぐな がけも へいきで のぼるよ。",
    habitat: "きたアメリカのロッキーさんみゃく",
    stageId: "ice_age",
    lifespanYears: 12,
  },
  // ── あたらしい なかま：ハムスター ──
  {
    animalId: "hamster_syrian",
    genericName: "ハムスター",
    specificName: "ゴールデンハムスター",
    emoji: "🐹",
    rarity: "COMMON",
    description:
      "ほっぺに えさを いっぱい つめこめる ちいさな どうぶつ。ほおぶくろは じぶんの からだと おなじくらいの えさを つめることも できるよ！やせいでは シリアのかんそうちに すんでいるんだ。",
    habitat: "シリアのかんそうしたくさはら",
    stageId: "savanna",
    lifespanYears: 2,
  },
  // ── あたらしい なかま：イタチ ──
  {
    animalId: "ferret_black_footed",
    genericName: "イタチ",
    specificName: "クロアシイタチ",
    emoji: "🦡",
    rarity: "EPIC",
    description:
      "きたアメリカで いちどは ぜつめつしたとおもわれたが、1981ねんに みつかり、ほごかつどうによって ふっかつした どうぶつ。くろい めまわりが マスクみたいで かわいいよ。",
    habitat: "きたアメリカのそうげん",
    stageId: "savanna",
    lifespanYears: 5,
  },
  // ── ナマケモノの なかまを もっと あつめる ──
  {
    animalId: "sloth_two_toed",
    genericName: "ナマケモノ",
    specificName: "フタユビナマケモノ",
    emoji: "🦥",
    rarity: "RARE",
    description:
      "ミツユビナマケモノより まえあしのつめが 1ほん すくない なかま。よるに かつどうして はっぱや くだものを たべるよ。きに ぶらさがったまま ねむっても おちないよう てが ロックされるんだ！",
    habitat: "ちゅうなんべいのねったいうりん",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_arowana_asian",
    genericName: "さかな",
    specificName: "アジアアロワナ",
    emoji: "🐟",
    rarity: "EPIC",
    description:
      "「ドラゴンフィッシュ」とよばれるきんうろこのさかな。みずからとびあがってえだのむしをつかまえるよ。ねだんがとてもたかくて1ぴきでなんびゃくまんえんにもなることがあるんだ。",
    habitat: "とうなんアジアのかわやぬま",
    stageId: "forest",
    lifespanYears: 25,
  },
  {
    animalId: "fish_remora",
    genericName: "さかな",
    specificName: "コバンザメ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "あたまにきゅうばんがあって、サメやクジラのからだにくっついてはこんでもらうよ。ホストのたべのこしをもらっていきているんだ。まるでもちつきもたれつのおともだちみたいだね。",
    habitat: "せかいじゅうのあたたかいうみ",
    stageId: "deep_sea",
    lifespanYears: 12,
  },
  {
    animalId: "fish_gulper_eel",
    genericName: "さかな",
    specificName: "フクロウウナギ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "ふかいうみにすむふしぎなさかな。くちがからだよりおおきくひらいて、じぶんよりおおきなさかなもまるごとのめるよ。しっぽのさきがひかっておきながらえものをおびきよせるんだ。",
    habitat: "せかいじゅうのふかいうみ（500〜3000m）",
    stageId: "deep_sea",
    lifespanYears: 10,
  },
  {
    animalId: "fish_leafy_seadragon",
    genericName: "さかな",
    specificName: "リーフィーシードラゴン",
    emoji: "🐟",
    rarity: "EPIC",
    description:
      "はっぱのようなでっぱりがからだじゅうにあるタツノオトシゴのなかま。かいそうにまぎれてにんじゃのようにかくれるよ。オスがたまごをしっぽでもってそだてるやさしいおとうさんなんだ。",
    habitat: "オーストラリアのうみのかいそうばたけ",
    stageId: "deep_sea",
    lifespanYears: 7,
  },
  {
    animalId: "fish_yellowfin_tuna",
    genericName: "さかな",
    specificName: "キハダマグロ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "きいろいせびれとおびれがきれいなおおきなマグロ。じそく75キロでかいちゅうをかけぬけるよ。おすしやかんづめになってせかいじゅうでたべられているさかなだよ。",
    habitat: "せかいじゅうのあたたかいうみ",
    stageId: "deep_sea",
    lifespanYears: 9,
  },
  {
    animalId: "fish_clown_triggerfish",
    genericName: "さかな",
    specificName: "ゴマモンガラ",
    emoji: "🐠",
    rarity: "RARE",
    description:
      "おなかのしろいまるいもようがドットがらできれいなさかな。たまごをまもるためにすにちかづいたダイバーをかみつくこともある、たよりになるおかあさんだよ。",
    habitat: "インドたいへいようのサンゴしょう",
    stageId: "deep_sea",
    lifespanYears: 7,
  },
  {
    animalId: "fish_garden_eel",
    genericName: "さかな",
    specificName: "チンアナゴ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "すなのなかにくらして、あたまだけにょきにょきだしてかいりゅうにのったえさをまつさかな。てきがちかづくとすなにもぐってかくれるよ。すいぞくかんのにんきものなんだ。",
    habitat: "あたたかいうみのあさいすなはら",
    stageId: "deep_sea",
    lifespanYears: 40,
  },
  // ── イカの なかまを もっと あつめる ──
  {
    animalId: "squid_bigfin_reef",
    genericName: "イカ",
    specificName: "アオリイカ",
    emoji: "🦑",
    rarity: "COMMON",
    description:
      "にほんのうみにひろくすむイカ。からだのいろをぴかぴかかえてなかまとコミュニケーションするんだ。おすしのネタとしてとてもにんきで、いかのなかでいちばんおいしいともいわれているよ。",
    habitat: "にほんのいわばのうみ",
    stageId: "deep_sea",
    lifespanYears: 1,
  },
  // ── むしの なかまを あつめる ──
  {
    animalId: "insect_leafcutter_ant",
    genericName: "アリ",
    specificName: "ハキリアリ",
    emoji: "🐜",
    rarity: "RARE",
    description:
      "はっぱをせっせときりとってそうこにはこぶアリ。そのはっぱできのこをそだててたべているんだよ。1にちにきりとるはっぱはコロニーぜんたいでウシ1とうぶんのりょうにもなるんだ。",
    habitat: "ちゅうなんべいのもり",
    stageId: "savanna",
    lifespanYears: 1,
  },
  {
    animalId: "beetle_scarab",
    genericName: "かぶとむし",
    specificName: "スカラベ",
    emoji: "🪲",
    rarity: "RARE",
    description:
      "ふんをまるめてころがしてちかのすにはこんでこどものえさにするコガネムシ。こだいエジプトでは「たいようがうごく」すがたににているとしてしんせいなむしとあがめられていたんだよ。",
    habitat: "アフリカのサバンナやさばく",
    stageId: "savanna",
    lifespanYears: 1,
  },
  {
    animalId: "moth_atlas_yonaguni",
    genericName: "ガ",
    specificName: "ヨナグニサン",
    emoji: "🦋",
    rarity: "EPIC",
    description:
      "よなぐにじまにすむにほんでいちばんおおきなガ。つばさをひろげると25センチにもなるよ！おとなになるとくちがなくなってなにもたべないまま、1しゅうかんだけいきてたまごをうむんだ。",
    habitat: "にほんのよなぐにじまやとうなんアジア",
    stageId: "forest",
    lifespanYears: 1,
  },
  {
    animalId: "butterfly_swallowtail_japanese",
    genericName: "ちょう",
    specificName: "アゲハチョウ",
    emoji: "🦋",
    rarity: "COMMON",
    description:
      "にほんのはるによくみられるきいろとくろのちょうちょ。はねのうしろにながいでっぱりがあるのがとくちょう。ようちゅうはみかんのはっぱをたべて、さなぎになってうつくしいちょうになるよ。",
    habitat: "にほんのこうえんやのはら",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── とりの なかまを もっと あつめる ──
  {
    animalId: "bird_puffin_atlantic",
    genericName: "とり",
    specificName: "ニシツノメドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "あかときいろとくろのカラフルなくちばしのとり。そのくちばしでさかなをいっぺんに10ひきもくわえられるよ！きたのうみのがけにすをつくり、ひるよるそらとうみでいきているんだ。",
    habitat: "きたたいへいようのがけやうみ",
    stageId: "ice_age",
    lifespanYears: 25,
  },
  {
    animalId: "bird_dalmatian_pelican",
    genericName: "とり",
    specificName: "ダルマチアペリカン",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "せかいでいちばんおおきなペリカン。くちばしのしたのおおきなふくろにさかなをすくってたべるよ。あたまのちぢれたかざりばねとぎんいろのはねがとてもうつくしいんだ。",
    habitat: "ヨーロッパ・アジアのみずうみやかわ",
    stageId: "savanna",
    lifespanYears: 24,
  },
  {
    animalId: "bird_marabou_stork",
    genericName: "とり",
    specificName: "ハゲコウ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "あたまがはげて「ブサイク」といわれがちだが、しにものをたべてかんきょうをきれいにするだいじなとり。アフリカのサバンナの「おそうじや」さんで、むれでしかばねをきれいにするよ。",
    habitat: "アフリカのサバンナやみずべ",
    stageId: "savanna",
    lifespanYears: 25,
  },
  {
    animalId: "bird_raven_common",
    genericName: "とり",
    specificName: "ワタリガラス",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "カラスのなかまでいちばんおおきく、とびきりかしこいとり。えさをかくしてほかのとりにさとられないようにする「うそ」のようなこうどうをとることがわかっているんだよ。",
    habitat: "きたアメリカ・ヨーロッパのもりやさんがく",
    stageId: "ice_age",
    lifespanYears: 17,
  },
  {
    animalId: "bird_common_swift",
    genericName: "とり",
    specificName: "ヨーロッパアマツバメ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "そらをとびながらねむったりたべたりするとり。1ねんのうち10かげつもちじょうにおりずにそらですごすんだよ！いのちのおおかんぶんをそらにいる、まことのてんくうのたびびとなんだ。",
    habitat: "ヨーロッパ・アジアのたてものやがけ",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "parrot_kea",
    genericName: "インコ",
    specificName: "ケア",
    emoji: "🦜",
    rarity: "EPIC",
    description:
      "せかいでゆいいつアルプスのやまにすむインコ。とてもかしこくていたずらもので、くるまのゴムをひっぱっていたずらすることも。「いかさま」をみぬくちりょくもあるんだよ。",
    habitat: "ニュージーランドのさんがく",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "bird_crowned_pigeon",
    genericName: "とり",
    specificName: "カンムリバト",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "あおいレースのようなかんむりをもつせかいでいちばんおおきなハトのなかま。きれいなみためからペットにつかまえられてかずがへっているんだ。ニューギニアのもりのほうせきだよ。",
    habitat: "ニューギニアのねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── きょうりゅうの なかまを もっと あつめる ──
  {
    animalId: "dino_gallimimus",
    genericName: "きょうりゅう",
    specificName: "ガリミムス",
    emoji: "🦕",
    rarity: "RARE",
    description:
      "ダチョウにそっくりなすがたのすばやいきょうりゅう。じそく45キロではしったとかんがえられているよ。「にわとりをまねするもの」というなまえをもつ、くびのながいきょうりゅうなんだ。",
    habitat: "アジア（モンゴル）のそうげん",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_styracosaurus",
    genericName: "きょうりゅう",
    specificName: "スティラコサウルス",
    emoji: "🦕",
    rarity: "RARE",
    description:
      "えりに6ほんもながいつのがはえたかっこいいきょうりゅう。はなにもおおきなつのが1ほん。トリケラトプスのしんせきで、つのをつかってなかまとたたかっていたとかんがえられているよ。",
    habitat: "きたアメリカ",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_amargasaurus",
    genericName: "きょうりゅう",
    specificName: "アマルガサウルス",
    emoji: "🦕",
    rarity: "EPIC",
    description:
      "くびに2れつのながいほねのとげがはえためずらしいきょうりゅう。そのとげはてきからみをまもるよろいや、からだをおおきくみせるためにつかっていたとかんがえられているよ。",
    habitat: "みなみアメリカ（アルゼンチン）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_carcharodontosaurus",
    genericName: "きょうりゅう",
    specificName: "カルカロドントサウルス",
    emoji: "🦖",
    rarity: "EPIC",
    description:
      "ティラノサウルスよりおおきいかもしれないアフリカのきょだいなにくしょくきょうりゅう。ホホジロザメのようなするどいはがならんでいて、なまえも「サメのはきょうりゅう」というなんだよ。",
    habitat: "アフリカ（サハラ）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_microraptor",
    genericName: "きょうりゅう",
    specificName: "ミクロラプトル",
    emoji: "🦖",
    rarity: "RARE",
    description:
      "4まいのつばさをもつカラスほどのちいさなきょうりゅう。きのあいだをグライダーのようにとびうつったとかんがえられているよ。とりときょうりゅうのちゅうかんみたいなどうぶつなんだ。",
    habitat: "アジア（ちゅうごく）のもり",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_kentrosaurus",
    genericName: "きょうりゅう",
    specificName: "ケントロサウルス",
    emoji: "🦕",
    rarity: "RARE",
    description:
      "せなかにまるいいたとするどいとげがならんだアフリカのきょうりゅう。ステゴサウルスのしんせきで、しっぽのとげでてきにキックしてたおすちからがあったんだよ。",
    habitat: "アフリカ（タンザニア）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  // ── あたらしい なかま：ツチブタ ──
  {
    animalId: "aardvark",
    genericName: "ツチブタ",
    specificName: "ツチブタ",
    emoji: "🐾",
    rarity: "RARE",
    description:
      "ながいはなとおおきなミミをもつよるにかつどうするどうぶつ。ながいした（30センチ！）でアリをなめとってたべるよ。あなをほるのがとくいで、ほかのどうぶつがそのあとのあなをすみかにすることもあるんだ。",
    habitat: "アフリカのサバンナやもり",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：バク ──
  {
    animalId: "tapir_malayan",
    genericName: "バク",
    specificName: "マレーバク",
    emoji: "🐾",
    rarity: "RARE",
    description:
      "からだのまんなかがしろくてまえうしろがくろいパンダみたいなもようのどうぶつ。ながいはなをストローみたいにつかってはっぱをたべるよ。きょうりゅうじだいからすがたがほとんどかわっていないんだ。",
    habitat: "とうなんアジアのねったいうりん",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── あたらしい なかま：ミツアナグマ ──
  {
    animalId: "honey_badger",
    genericName: "アナグマ",
    specificName: "ミツアナグマ",
    emoji: "🦡",
    rarity: "EPIC",
    description:
      "「せかいでいちばんこわいものなしなどうぶつ」としてギネスにのっているイタチのなかま。ハチにさされてもへいき、どくヘビにかまれてもつよくて、ライオンにもむかっていくよ。はちみつがだいすきなんだ。",
    habitat: "アフリカ・アジアのさばくやもり",
    stageId: "savanna",
    lifespanYears: 24,
  },
  // ── イタチの なかまを もっと あつめる ──
  {
    animalId: "stoat_ermine",
    genericName: "イタチ",
    specificName: "オコジョ",
    emoji: "🦡",
    rarity: "RARE",
    description:
      "ふゆにからだがまっしろになるちいさなイタチ。じぶんよりおおきなウサギでもおそうきものすわったハンター。むかしからおうさまのマントにつかわれてきたまっしろのけをもつどうぶつだよ。",
    habitat: "ユーラシア・きたアメリカのもりやこうざん",
    stageId: "ice_age",
    lifespanYears: 7,
  },
  // ── あたらしい なかま：マングース ──
  {
    animalId: "mongoose_dwarf",
    genericName: "マングース",
    specificName: "コビトマングース",
    emoji: "🐾",
    rarity: "COMMON",
    description:
      "アフリカでいちばんちいさなにくしょくどうぶつ。シロアリのつかあとにコロニーでくらし、みはりが「キキキ」とさけんでてきをみんなにしらせるよ。なかよしなかぞくでくらしているんだ。",
    habitat: "アフリカのサバンナ",
    stageId: "savanna",
    lifespanYears: 10,
  },
  // ── あたらしい なかま：ビンツロング ──
  {
    animalId: "binturong",
    genericName: "ジャコウネコ",
    specificName: "ビンツロング",
    emoji: "🐾",
    rarity: "RARE",
    description:
      "くまみたいなすがたのとうなんアジアのどうぶつ。においがなんと「ポップコーン」ににているんだよ！しっぽがえだをつかめてきをのぼるのがとくいな、めずらしいどうぶつなんだ。",
    habitat: "とうなんアジアのねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：フォッサ ──
  {
    animalId: "fossa_madagascar",
    genericName: "ジャコウネコ",
    specificName: "フォッサ",
    emoji: "🐱",
    rarity: "EPIC",
    description:
      "マダガスカルだけにすむいちばんおおきなにくしょくどうぶつ。ネコににているけどマングースのなかまなんだ。きをのぼるのがとくいで、ワオキツネザルをおいかけてつかまえるよ。",
    habitat: "マダガスカルのもり",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── アンテロープの なかまを もっと あつめる ──
  {
    animalId: "antelope_bongo",
    genericName: "アンテロープ",
    specificName: "ボンゴ",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "アフリカでいちばんおおきなもりのアンテロープ。からだがあかみのあるちゃいろでしろいたてじまがたくさん。つのはくるっとねじれていて、メスもオスもりっぱなつのをもっているんだよ。",
    habitat: "ちゅうおうアフリカのもり",
    stageId: "forest",
    lifespanYears: 22,
  },
  // ── しかの なかまを もっと あつめる ──
  {
    animalId: "deer_chital",
    genericName: "しか",
    specificName: "チタルジカ",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "インドにすむうつくしいシカ。おとなになってもからだのしろいてんてんがきえないよ。チタルがてきのきけんをさけぶと、ちかくのサルたちもいっしょにとびにげるなかよしなかぞくなんだ。",
    habitat: "インドのくさはらやもり",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── クジラの なかまを もっと あつめる ──
  {
    animalId: "whale_cuvier_beaked",
    genericName: "クジラ",
    specificName: "アカボウクジラ",
    emoji: "🐳",
    rarity: "RARE",
    description:
      "ふかさ3000メートル・222ぷんいきをとめてもぐりつづけるきろくをもつクジラ。くちばしがとがっていて、ふかいうみのイカをつかまえているよ。クジラでいちばんふかくもぐれるんだ。",
    habitat: "せかいじゅうのふかいうみ",
    stageId: "deep_sea",
    lifespanYears: 40,
  },
  // ── あざらしの なかまを もっと あつめる ──
  {
    animalId: "seal_monk_hawaiian",
    genericName: "あざらし",
    specificName: "ハワイモンクアザラシ",
    emoji: "🦭",
    rarity: "EPIC",
    description:
      "ハワイだけにすむとてもめずらしいアザラシ。なんきょくではなくあたたかいハワイのうみにすむ、かずがへってしまったアザラシで、おまもりのようにたいせつにほごされているよ。",
    habitat: "ハワイのうみ",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  // ── アシカの なかまを もっと あつめる ──
  {
    animalId: "sea_lion_steller",
    genericName: "アシカ",
    specificName: "トド",
    emoji: "🦭",
    rarity: "RARE",
    description:
      "アシカのなかまでいちばんおおきく、オスは1トンにもなることがあるよ。にほんのうみにもやってきて「ゴォォ」とおおごえでなく。ぎょせんのあみからさかなをとることもあるんだ。",
    habitat: "きたたいへいようのうみ",
    stageId: "ice_age",
    lifespanYears: 23,
  },
  // ── サメの なかまを もっと あつめる ──
  {
    animalId: "shark_cookiecutter",
    genericName: "サメ",
    specificName: "ダルマザメ",
    emoji: "🦈",
    rarity: "RARE",
    description:
      "こぶしよりちいさいのに、クジラやマグロからまるいはんこみたいなきずをのこしてにくをくりぬいてたべるこわいサメ。「クッキーカッター」ともよばれるとくいなわざをもつサメだよ。",
    habitat: "せかいじゅうのふかいうみ",
    stageId: "deep_sea",
    lifespanYears: 25,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_viperfish",
    genericName: "さかな",
    specificName: "ホウライエソ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "きばがおおきすぎてくちをとじられないふかうみのさかな。からだをひかってえものをおびきよせ、するどいきばでつかまえるよ。ふだんはふかさ200〜1000メートルのくらいうみにいるんだ。",
    habitat: "せかいじゅうのふかいうみ",
    stageId: "deep_sea",
    lifespanYears: 15,
  },
  // ── イルカの なかまを もっと あつめる ──
  {
    animalId: "dolphin_false_killer_whale",
    genericName: "イルカ",
    specificName: "カズハゴンドウ",
    emoji: "🐬",
    rarity: "RARE",
    description:
      "おおきてくろいイルカ。じぶんでつかまえたさかなをなんとにんげんのダイバーにわけてあげることがあるんだよ！ほかのイルカやクジラともなかよくできる、やさしいイルカなんだ。",
    habitat: "せかいじゅうのあたたかいうみ",
    stageId: "deep_sea",
    lifespanYears: 58,
  },
  // ── ペンギンの なかまを もっと あつめる ──
  {
    animalId: "penguin_galapagos",
    genericName: "ペンギン",
    specificName: "ガラパゴスペンギン",
    emoji: "🐧",
    rarity: "RARE",
    description:
      "せきどうに いちばん ちかい しまに すむ ペンギン。ペンギンのなかまでは きたのほうに いる めずらしい しゅるいで、つめたいかいりゅうのおかげで あつい しまでも いきられるんだよ。",
    habitat: "ガラパゴスしょとうの うみ",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  // ── とりの なかまを もっと あつめる ──
  {
    animalId: "bird_quetzal",
    genericName: "とり",
    specificName: "ケツァール",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "からだより ながい みどりの かざりばねを もつ うつくしい とり。むかしの マヤ・アステカ ぶんめいでは かみさまの シンボルとして あがめられていたんだよ。グアテマラの こっかの とりなんだ。",
    habitat: "ちゅうアメリカの くもりもり",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "bird_grey_heron",
    genericName: "とり",
    specificName: "アオサギ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "にほんで みられる いちばん おおきな サギ。かわの ちかくで じーっと たって さかなを まち、くびを のばして あっという まに つついて つかまえるよ。にほんの かわや いけで よく みかけるんだ。",
    habitat: "にほんを ふくむ せかいじゅうの かわや いけ",
    stageId: "forest",
    lifespanYears: 25,
  },
  {
    animalId: "bird_japanese_pheasant",
    genericName: "とり",
    specificName: "キジ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "にほんの こっかに えらばれた とり。オスは あたまが あおみどり、ほっぺが まっかで とても きれい。「ももたろう」に でてくる にほんの くにとりで、あぶないと じめんに もぐって かくれるよ。",
    habitat: "にほんの やまや のはら",
    stageId: "forest",
    lifespanYears: 7,
  },
  {
    animalId: "bird_greater_bird_paradise",
    genericName: "フウチョウ",
    specificName: "オオフウチョウ",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "「ごくらくとり」と よばれる うつくしい とり。オスは きいろや みどりの キラキラの はねを もち、きの えだで くるくる まわって メスに アピールするよ。ニューギニアの もりに すむんだ。",
    habitat: "ニューギニアの ねったいうりん",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "bird_spoonbill_eurasian",
    genericName: "とり",
    specificName: "ヘラサギ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "くちばしの さきが しゃもじみたいに ひらべったく ひろがった しろい とり。みずの なかで くちばしを ひだりみぎに ふりながら こして えさを さがすよ。にほんにも わたって くることがあるんだ。",
    habitat: "アジア・ヨーロッパの しっちや かわ",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "bird_bar_headed_goose",
    genericName: "とり",
    specificName: "インドガン",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "とりのなかで いちばん たかく とべる とり。ヒマラヤの やまを こえるために 8000メートル いじょうの たかさを とぶんだよ！にんげんが さんそマスクなしでは いきられない たかさなんだ。",
    habitat: "チベット・インドの みずうみや しっち",
    stageId: "ice_age",
    lifespanYears: 25,
  },
  {
    animalId: "bird_kakapo",
    genericName: "インコ",
    specificName: "カカポ",
    emoji: "🦜",
    rarity: "LEGENDARY",
    description:
      "ニュージーランドだけに すむ、せかいで いちばん おもい インコで とべないよ。250わ いじょうしか いないために、ひとりひとりに なまえが ついて まもられているほど とても きちょうなんだ。",
    habitat: "ニュージーランドの しまの もり",
    stageId: "forest",
    lifespanYears: 60,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_napoleon_wrasse",
    genericName: "さかな",
    specificName: "コブダイ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "おでこが こぶのように もりあがった おおきな さかな。ながさ 2メートルにも なる あおみどりの さかなで、やさしい めと おおきな くちが とくちょう。サンゴしょうの にんきものなんだよ。",
    habitat: "インドたいへいようの サンゴしょう",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  {
    animalId: "fish_mandarin_dragonet",
    genericName: "さかな",
    specificName: "マンダリンフィッシュ",
    emoji: "🐠",
    rarity: "EPIC",
    description:
      "あか・あお・みどりの キラキラした もようが「せかいで いちばん うつくしい さかな」ともいわれているよ。よるに あいてを みつけて 2ひきで いっしょに うみあがって たまごを うむんだ。",
    habitat: "とうなんアジアの サンゴしょう",
    stageId: "deep_sea",
    lifespanYears: 15,
  },
  {
    animalId: "fish_arapaima",
    genericName: "さかな",
    specificName: "アラパイマ",
    emoji: "🐟",
    rarity: "EPIC",
    description:
      "ながさ 3メートルにもなる、せかいさいだいきゅうの たんすいぎょ。くうきを すいこんで こきゅうできる めずらしい さかな。みずめんに とびあがって えものを とることも あるんだよ。",
    habitat: "みなみアメリカの アマゾンがわ",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "fish_beluga_sturgeon",
    genericName: "さかな",
    specificName: "ベルーガチョウザメ",
    emoji: "🐟",
    rarity: "EPIC",
    description:
      "ほねの ある さかなで せかいいちおおきく、ながさ 8メートル・おもさ 1500キロにもなるよ！100ねん いじょうも いきて、このたまごが ちょうこうきゅうな「キャビア」に なるんだ。",
    habitat: "カスピかいや くろかい",
    stageId: "deep_sea",
    lifespanYears: 100,
  },
  {
    animalId: "fish_parrotfish",
    genericName: "さかな",
    specificName: "ブダイ",
    emoji: "🐠",
    rarity: "COMMON",
    description:
      "カラフルな いろのさかな。かたい くちばしで サンゴを かじって たべて、うんちを しろい すなに して うみのそこを つくるよ。カリブかいの しろい すなは ブダイが つくったんだよ！",
    habitat: "あたたかい うみの サンゴしょう",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  {
    animalId: "fish_giant_grouper",
    genericName: "さかな",
    specificName: "タマカイ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "ながさ 2.7メートルにもなる、サンゴしょうで いちばん おおきな さかな。おおきな くちで さかなや タコを すいこんで たべるよ。もともと オスだったが おとなになると メスになる ふしぎな さかな。",
    habitat: "インドたいへいようの サンゴしょう",
    stageId: "deep_sea",
    lifespanYears: 40,
  },
  // ── きょうりゅうの なかまを もっと あつめる ──
  {
    animalId: "dino_psittacosaurus",
    genericName: "きょうりゅう",
    specificName: "プシッタコサウルス",
    emoji: "🦕",
    rarity: "COMMON",
    description:
      "「オウムのとかげ」という なまえの ちいさな きょうりゅう。くちばしが オウムみたいに まがっていて たねや きのみを たべていたよ。こどもを たくさん うんで そだてる やさしい おかあさんだったんだ。",
    habitat: "アジアの そうげん",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_apatosaurus",
    genericName: "きょうりゅう",
    specificName: "アパトサウルス",
    emoji: "🦕",
    rarity: "RARE",
    description:
      "むかし「ブロントサウルス」と よばれた くびながきょうりゅう。ながい しっぽを むちのように ふると じそく 500キロを こえる おとが でたと かんがえられているよ。はたけより ながい からだだったんだ！",
    habitat: "きたアメリカの そうげん",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_argentinosaurus",
    genericName: "きょうりゅう",
    specificName: "アルゼンチノサウルス",
    emoji: "🦕",
    rarity: "LEGENDARY",
    description:
      "せかいで いちばん おおきな きょうりゅうのひとつ。おもさ 80トンにも なったかもしれないよ！こどもの ときは 1にちに 40キロも たいじゅうが ふえていたと かんがえられているんだ。",
    habitat: "みなみアメリカ（アルゼンチン）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_troodon",
    genericName: "きょうりゅう",
    specificName: "トゥルードン",
    emoji: "🦖",
    rarity: "RARE",
    description:
      "きょうりゅうの なかで いちばん あたまが よかったと かんがえられているきょうりゅう。からだの おおきさの わりに のうが とても おおきくて、よるに かつどうするために めも おおきかったんだよ。",
    habitat: "きたアメリカの もり",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_pachyrhinosaurus",
    genericName: "きょうりゅう",
    specificName: "パキリノサウルス",
    emoji: "🦕",
    rarity: "RARE",
    description:
      "はなのうえが つのではなく おおきな こぶになっている めずらしい ツノりゅう。えりには たくさんの つのが はえていたよ。アラスカの さむいちいきに すんでいた くさを たべるきょうりゅうなんだ。",
    habitat: "きたアメリカ（アラスカ）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "dino_muttaburrasaurus",
    genericName: "きょうりゅう",
    specificName: "ムタブラサウルス",
    emoji: "🦕",
    rarity: "COMMON",
    description:
      "オーストラリアで みつかった おおきな くちばしの きょうりゅう。はなのうえに こぶがあって、そこから なかまに さけびごえを だしていたと かんがえられているよ。",
    habitat: "オーストラリアのそうげん",
    stageId: "cretaceous",
    isExtinct: true,
  },
  // ── こんちゅうの なかまを もっと あつめる ──
  {
    animalId: "insect_ladybug",
    genericName: "テントウムシ",
    specificName: "ナナホシテントウ",
    emoji: "🐞",
    rarity: "COMMON",
    description:
      "せなかに 7つの くろい てんがある あかい テントウムシ。おそわれると あしから くさい しるを だして てきを にがらせるよ。1にちに 50ひきも の アブラムシを たべる、はたけの たすけっとなんだ。",
    habitat: "せかいじゅうの はたけや のはら",
    stageId: "forest",
    lifespanYears: 1,
  },
  {
    animalId: "insect_jewel_beetle",
    genericName: "タマムシ",
    specificName: "ヤマトタマムシ",
    emoji: "🪲",
    rarity: "RARE",
    description:
      "はねが きんいろや あおみどりに キラキラ かがやく うつくしい こうちゅう。むかしから「たまむしの はね」は きんぞくより うつくしいと いわれ、1400ねんまえの にほんの たからものにも つかわれているよ。",
    habitat: "にほんの しいや かしのはやし",
    stageId: "forest",
    lifespanYears: 1,
  },
  {
    animalId: "insect_walking_stick",
    genericName: "ナナフシ",
    specificName: "ナナフシ",
    emoji: "🦗",
    rarity: "COMMON",
    description:
      "えだや くきに そっくりな すがたで みわけが つかない むし。ゆらゆら ゆれながら あるいて えだのふりを するよ。オスが いなくても メスだけで こどもを うめる、ふしぎな むしなんだ。",
    habitat: "アジア・ヨーロッパの もり",
    stageId: "forest",
    lifespanYears: 1,
  },
  {
    animalId: "insect_water_strider",
    genericName: "アメンボ",
    specificName: "アメンボ",
    emoji: "🦗",
    rarity: "COMMON",
    description:
      "みずのうえを スーっと すべる むし。あしのさきに みずを はじく けが はえていて、みずのひょうめんちょうりょくで しずまないよ。あまい においが あめだまに にているから その なまえがついたんだ。",
    habitat: "にほんの かわや いけ",
    stageId: "forest",
    lifespanYears: 1,
  },
  {
    animalId: "insect_cicada_giant",
    genericName: "セミ",
    specificName: "クマゼミ",
    emoji: "🦗",
    rarity: "COMMON",
    description:
      "にほんで いちばん おおきい セミ。「シャアシャア」と なつの まっさかりに おおきな こえで なくよ。がんじょうな くちさきで きのみきに あなを あけて しるを のみながら いきているんだ。",
    habitat: "にほんの おおきな きのある まちや もり",
    stageId: "forest",
    lifespanYears: 7,
  },
  // ── かえるの なかまを もっと あつめる ──
  {
    animalId: "frog_tomato",
    genericName: "かえる",
    specificName: "トマトガエル",
    emoji: "🐸",
    rarity: "RARE",
    description:
      "まっかな トマトみたいな まるいからだの カエル。おそわれると きはだから ねばねばした あぶらを だして てきの くちを ふさいでしまうよ。マダガスカルだけに すむ めずらしい カエルなんだ。",
    habitat: "マダガスカルの しめった もり",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "frog_surinam_toad",
    genericName: "かえる",
    specificName: "コモリガエル",
    emoji: "🐸",
    rarity: "EPIC",
    description:
      "おかあさんの せなかに たまごを うめて、そのまま そこで こどもを そだてる カエル。たまごが だんだん せなかに しずんでいって、やがて せなかの あなから こどもが とびだしてくるんだよ！",
    habitat: "みなみアメリカの かわや ぬま",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── くもの なかまを もっと あつめる ──
  {
    animalId: "spider_peacock_jumping",
    genericName: "クモ",
    specificName: "クジャクグモ",
    emoji: "🕷",
    rarity: "RARE",
    description:
      "からだが 5ミリほどの ちいさな クモ。オスは おなかが クジャクの はねみたいな あざやかな もようで、メスに むかって さかだちして あしを ふって もとめるんだ。かわいい ダンスが とくちょうだよ。",
    habitat: "オーストラリアの そうげんや もり",
    stageId: "savanna",
    lifespanYears: 1,
  },
  {
    animalId: "spider_redback",
    genericName: "クモ",
    specificName: "セアカゴケグモ",
    emoji: "🕷",
    rarity: "EPIC",
    description:
      "くろい からだの せなかに あかい すじが ある どくグモ。もとは オーストラリアに すんでいたが、にほんにも やってきたよ。メスだけが どくを もつが、きちんと ちりょうすれば だいじょうぶなんだ。",
    habitat: "オーストラリアの まちや かんそうち",
    stageId: "savanna",
    lifespanYears: 3,
  },
  // ── ねこの なかまを もっと あつめる ──
  {
    animalId: "cat_margay",
    genericName: "ねこ",
    specificName: "マーゲイ",
    emoji: "🐆",
    rarity: "RARE",
    description:
      "みなみアメリカの もりに すむ ちいさな ヤセイネコ。あしを うしろに まわしたまま きのみきを くだれるほど きを のぼるのが とくいで、ほとんどの じかんを きのうえで すごすんだよ。",
    habitat: "ちゅうなんべいの ねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "cat_pallas",
    genericName: "ねこ",
    specificName: "マヌルネコ",
    emoji: "🐱",
    rarity: "RARE",
    description:
      "まんまるに みえる きいろい めと、ながくて こい けが とくちょうの ちいさな ヤセイネコ。じつは ふとっているのではなく、さむい やまに すむために けが ながくて ふわふわなんだよ。",
    habitat: "チベット・モンゴルの こうがんや さむい そうげん",
    stageId: "ice_age",
    lifespanYears: 12,
  },
  {
    animalId: "cat_flat_headed",
    genericName: "ねこ",
    specificName: "ヒラアタマネコ",
    emoji: "🐱",
    rarity: "EPIC",
    description:
      "なまえのとおり あたまが よこに たいらな めずらしい ヤセイネコ。とうなんアジアの かわべに すんで、みずに あしや かおを いれて さかなを つかまえるよ。とても かずが すくないんだ。",
    habitat: "とうなんアジアの かわべ",
    stageId: "forest",
    lifespanYears: 14,
  },
  // ── しかの なかまを もっと あつめる ──
  {
    animalId: "deer_pudu",
    genericName: "しか",
    specificName: "プドゥー",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "せかいで いちばん ちいさい シカ。おとなになっても たかさ 35センチほどしかなく、ウサギより すこし おおきい くらい。みなみアメリカの アンデスの もりに かくれるように くらしているよ。",
    habitat: "みなみアメリカの アンデスさんみゃく",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── おおかみの なかまを もっと あつめる ──
  {
    animalId: "wolf_maned",
    genericName: "おおかみ",
    specificName: "タテガミオオカミ",
    emoji: "🐺",
    rarity: "RARE",
    description:
      "くびに タテガミのような ながい けが はえた、あしが とても ながい オオカミ。みなみアメリカの くさはらを みわたすために あしが そだったよ。くだものが だいすきで はっぱも たべるんだ。",
    habitat: "みなみアメリカの くさはら",
    stageId: "savanna",
    lifespanYears: 12,
  },
  // ── きつねの なかまを もっと あつめる ──
  {
    animalId: "fox_bat_eared",
    genericName: "きつね",
    specificName: "オオミミギツネ",
    emoji: "🦊",
    rarity: "RARE",
    description:
      "コウモリみたいな とても おおきな ミミを もつ アフリカの キツネ。そのミミで じめんのなかの シロアリの おとを きいて、さっとあなをほって なめとって たべるよ。1ばんに 1まんびきも！",
    habitat: "アフリカの サバンナや かんそうした くさはら",
    stageId: "savanna",
    lifespanYears: 13,
  },
  // ── バクの なかまを もっと あつめる ──
  {
    animalId: "tapir_south_american",
    genericName: "バク",
    specificName: "ブラジルバク",
    emoji: "🐾",
    rarity: "RARE",
    description:
      "みなみアメリカに すむ おおきな どうぶつ。みずが だいすきで よく かわや ぬまに はいって すごすよ。ながい はなさきを ホースのように じゆうに うごかして えだの はっぱを つかむんだ。",
    habitat: "みなみアメリカの もりや かわべ",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── あたらしい なかま：ニワシドリ ──
  {
    animalId: "bird_bowerbird",
    genericName: "とり",
    specificName: "ニワシドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "オスが メスを よぶために えだや かいがらや こんぶつを あつめて りっぱな「にわ」をつくる とり。あおいものだけ あつめる しゅるいも いるよ。にわが りっぱなほど モテるんだ！",
    habitat: "オーストラリア・ニューギニアの もり",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：ツチオオカミ ──
  {
    animalId: "aardwolf",
    genericName: "ハイエナ",
    specificName: "ツチオオカミ",
    emoji: "🦡",
    rarity: "RARE",
    description:
      "ハイエナの なかまなのに、シロアリだけを たべる おとなしい どうぶつ。するどい つめで あなを ほって、ながい したで シロアリを なめとるよ。1ばんに 25まんびきも の シロアリをたべるんだ。",
    habitat: "アフリカの サバンナや かんそうち",
    stageId: "savanna",
    lifespanYears: 10,
  },
  // ── イカの なかまを もっと あつめる ──
  {
    animalId: "cuttlefish_common",
    genericName: "イカ",
    specificName: "コウイカ",
    emoji: "🦑",
    rarity: "RARE",
    description:
      "からだの いろを 3びょういないに かえられる、とても かしこい イカ。かいそうに まぎれたり きもちを つたえるためにも いろを かえるんだ。からだのなかに かたい ほねを もつ めずらしい イカだよ。",
    habitat: "にほんや ヨーロッパの うみのそこ",
    stageId: "deep_sea",
    lifespanYears: 2,
  },
  // ── あたらしい なかま：コウカンチョウ ──
  {
    animalId: "bird_painted_bunting",
    genericName: "とり",
    specificName: "コウカンチョウ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "オスは あたまが あおむらさき、むねが まっか、せなかが みどりの「アメリカで いちばん カラフルな とり」。「ゆめの とり」とも よばれているよ。メスは みどりいろで めだたないんだ。",
    habitat: "きたアメリカの くさはらや もり",
    stageId: "savanna",
    lifespanYears: 10,
  },
  // ── さるの なかまを もっと あつめる ──
  {
    animalId: "monkey_squirrel_common",
    genericName: "さる",
    specificName: "コモンリスザル",
    emoji: "🐒",
    rarity: "COMMON",
    description:
      "みなみアメリカの もりに すむ てのひらサイズの ちいさな サル。むれで 500わ いじょうも あつまって くらすよ。からだのおおきさの わりに のうが とても おおきく、とても かしこいんだ。",
    habitat: "みなみアメリカの ねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "monkey_golden_tamarin",
    genericName: "さる",
    specificName: "ゴールデンライオンタマリン",
    emoji: "🦁",
    rarity: "EPIC",
    description:
      "からだじゅうが きんいろの けに おおわれた、まるで ライオンの たてがみみたいな ちいさな サル。ブラジルの もりにしか すんでいない めずらしい どうぶつで、ほごかつどうで かずが ふえてきたんだよ。",
    habitat: "ブラジルの ねったいうりん",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "monkey_mandrill",
    genericName: "さる",
    specificName: "マンドリル",
    emoji: "🐒",
    rarity: "EPIC",
    description:
      "オスの かおが あおと あかで カラフルな、せかいで いちばん おおきな サルの なかま。からだが げんきなほど いろが あざやかになるよ。むれにいるためには つよくて カラフルな かおが だいじなんだ。",
    habitat: "ちゅうおうアフリカの ねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "fox_corsac",
    genericName: "きつね",
    specificName: "コルサックギツネ",
    emoji: "🦊",
    rarity: "COMMON",
    description:
      "ちゅうおうアジアの そうげんに すむ ちいさな キツネ。さむさに たえるため あたたかい はいいろっぽい けを もつよ。あなを じぶんで ほらずに ほかの どうぶつの あなを かりてすむ、かしこい どうぶつなんだ。",
    habitat: "ちゅうおうアジアの そうげん",
    stageId: "savanna",
    lifespanYears: 10,
  },
  {
    animalId: "penguin_snares",
    genericName: "ペンギン",
    specificName: "スネアーズペンギン",
    emoji: "🐧",
    rarity: "RARE",
    description:
      "ニュージーランドの ちいさな スネアーズしまだけに すむ ペンギン。あたまの きいろい かざりばねが とくちょうで、もりの なかに すを つくる めずらしい ペンギンだよ。",
    habitat: "ニュージーランドの スネアーズしま",
    stageId: "ice_age",
    lifespanYears: 16,
  },
  {
    animalId: "eagle_bateleur",
    genericName: "わし",
    specificName: "バテルール",
    emoji: "🦅",
    rarity: "RARE",
    description:
      "アフリカの サバンナを 1にちに 300キロも とびつづける ワシ。しっぽが とても みじかいので とびかたが ゆらゆらしていて、フランス語で「おおぜいどりし」という なまえがついたんだよ。",
    habitat: "アフリカの サバンナ",
    stageId: "savanna",
    lifespanYears: 27,
  },
  {
    animalId: "eagle_african_fish",
    genericName: "わし",
    specificName: "アフリカウオワシ",
    emoji: "🦅",
    rarity: "RARE",
    description:
      "アフリカの みずうみや かわに すむ ワシ。「ウォウォウォ」という おおきな なきごえが ゆうめいで アフリカの シンボルの とり。みずめんの さかなを めで みつけて つめで つかまえるよ。",
    habitat: "アフリカの みずうみや かわ",
    stageId: "savanna",
    lifespanYears: 24,
  },
  {
    animalId: "dolphin_irrawaddy",
    genericName: "イルカ",
    specificName: "イラワジイルカ",
    emoji: "🐬",
    rarity: "EPIC",
    description:
      "くちばしが なく まるい かおの ふしぎな イルカ。うみだけでなく アジアの かわの なかにも すんでいて、くちから みずを ふきだして さかなを おいやりながら つかまえるよ。",
    habitat: "とうなんアジアの かわや えんがん",
    stageId: "forest",
    lifespanYears: 30,
  },
  {
    animalId: "shark_nurse",
    genericName: "サメ",
    specificName: "ネムリブカ",
    emoji: "🦈",
    rarity: "COMMON",
    description:
      "うみのそこで じっと ねていることが おおい おとなしい サメ。ひるまは いわのかげで ねむって よるに かつどうするよ。「ナースシャーク」とも よばれ、さかなを すいこんで たべるんだ。",
    habitat: "あたたかい うみのそこ",
    stageId: "deep_sea",
    lifespanYears: 25,
  },
  {
    animalId: "shark_bull",
    genericName: "サメ",
    specificName: "オオメジロザメ",
    emoji: "🦈",
    rarity: "RARE",
    description:
      "うみだけでなく かわの なかにも はいってくる めずらしい サメ。ミシシッピがわや アマゾンがわでも みつかっているよ！がんじょうな からだが ウシみたいで「ブルシャーク」ともよばれているんだ。",
    habitat: "せかいじゅうの うみや かわ",
    stageId: "deep_sea",
    lifespanYears: 25,
  },
  {
    animalId: "dino_sinosauropteryx",
    genericName: "きょうりゅう",
    specificName: "シノサウロプテリクス",
    emoji: "🦖",
    rarity: "RARE",
    description:
      "はじめて けの はえた きょうりゅうと わかった、とても だいじな かせき。からだが オレンジいろだったと わかっているよ。「とりに そっくりな ちゅうごくの とかげ」という なまえの、とりの せんぞの なかまなんだ。",
    habitat: "ちゅうごく（りゃおにん）",
    stageId: "cretaceous",
    isExtinct: true,
  },
  {
    animalId: "insect_goliath_beetle",
    genericName: "かぶとむし",
    specificName: "ゴライアスオオツノハナムグリ",
    emoji: "🪲",
    rarity: "EPIC",
    description:
      "せかいで いちばん おもい こんちゅうで、おもさが 100グラムを こえることも！アフリカの もりに すむ おおきな コウチュウで、ようちゅうのときは さらにおおきくなって 200グラムにもなるんだよ。",
    habitat: "アフリカの ねったいうりん",
    stageId: "savanna",
    lifespanYears: 1,
  },
  {
    animalId: "snake_paradise_flying",
    genericName: "へび",
    specificName: "パラダイスフライングスネーク",
    emoji: "🐍",
    rarity: "RARE",
    description:
      "きから きへ、からだを ひらべったくして とびうつる めずらしい へび。はねは ないのに からだを S字に くねらせながら さいたいで 10メートルも とべるんだよ。",
    habitat: "とうなんアジアの もり",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "lizard_nile_monitor",
    genericName: "とかげ",
    specificName: "ナイルオオトカゲ",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "アフリカに すむ おおきな トカゲで、ながさ 2メートルにもなるよ。およぐのが とくいで ナイルがわの ちかくに すんでいるんだ。したを すばやく ぺろぺろして においを かぎとって えものを さがすよ。",
    habitat: "アフリカの かわや みずうみのほとり",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "turtle_pig_nosed",
    genericName: "カメ",
    specificName: "ブタバナガメ",
    emoji: "🐢",
    rarity: "RARE",
    description:
      "はなが ぶたみたいに まるくて かわいい カメ。こうらが やわらかい スッポンみたいな めずらしい カメで、オーストラリアと ニューギニアの かわにしか すんでいないんだよ。",
    habitat: "オーストラリア・ニューギニアの かわ",
    stageId: "forest",
    lifespanYears: 25,
  },
  {
    animalId: "turtle_softshell_japanese",
    genericName: "カメ",
    specificName: "スッポン",
    emoji: "🐢",
    rarity: "COMMON",
    description:
      "こうらが やわらかい かわの カメ。ながい くびを のばして えものを ぱくっと つかまえるよ。「スッポンに かまれたら かみなりが なっても はなさない」といわれるほど しっかり かみつくんだ。",
    habitat: "にほんや アジアの かわや いけ",
    stageId: "forest",
    lifespanYears: 50,
  },
  {
    animalId: "frog_purple_pig",
    genericName: "かえる",
    specificName: "ムラサキガエル",
    emoji: "🐸",
    rarity: "EPIC",
    description:
      "インドのやまなかでしか みつからない ふしぎな カエル。からだが むらさきいろで はなが ぶたのように まるく とびだしているよ。じめんのなかで くらし うつくしいあめのきせつにだけ でてくるんだ。",
    habitat: "インドの にしガーツさんみゃく",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "cat_clouded_leopard",
    genericName: "ねこ",
    specificName: "ウンピョウ",
    emoji: "🐆",
    rarity: "EPIC",
    description:
      "くもの もようみたいな まだらが ある きれいな ネコかどうぶつ。からだのおおきさに くらべて きばが とても ながい。きのうえを あしのうらを ひっくりかえして くだれる、すごい のぼりじょうずなんだ。",
    habitat: "とうなんアジアの ねったいうりん",
    stageId: "forest",
    lifespanYears: 17,
  },
  {
    animalId: "antelope_oryx_arabian",
    genericName: "アンテロープ",
    specificName: "アラビアオリックス",
    emoji: "🦌",
    rarity: "EPIC",
    description:
      "まっしろな からだに まっすぐな ながい つのを もつ アンテロープ。やせいで いちど ぜつめつしたが、どうぶつえんで そだてて さばくに もどす とりくみで ぶっかつしたんだよ。さばくの てんしと よばれているよ。",
    habitat: "アラビアはんとうの さばく",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "antelope_sable",
    genericName: "アンテロープ",
    specificName: "セーブルアンテロープ",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "オスは まっくろで おおきく うしろに そりかえった つのが かっこいい アンテロープ。つのは 1.5メートルにも なり、ライオンでも こわれると つので たたかって にがしてしまうことがあるよ。",
    habitat: "みなみ・ひがしアフリカの サバンナ",
    stageId: "savanna",
    lifespanYears: 17,
  },
  {
    animalId: "platypus",
    genericName: "カモノハシ",
    specificName: "カモノハシ",
    emoji: "🦆",
    rarity: "EPIC",
    description:
      "カモの くちばし・ビーバーの しっぽ・カワウソの からだをもつ ふしぎな どうぶつ。ほにゅうるいなのに たまごを うむんだ！おすの あしには どくの とげがあって、あしのうらで でんきを かんじて えものをさがすよ。",
    habitat: "オーストラリアの きれいな かわや いけ",
    stageId: "forest",
    lifespanYears: 17,
  },
  {
    animalId: "jellyfish_immortal",
    genericName: "くらげ",
    specificName: "ベニクラゲ",
    emoji: "🪼",
    rarity: "LEGENDARY",
    description:
      "せかいで ゆいいつ、しんじゃうまえに からだを こどもの すがたに もどして わかがえることが できる クラゲ！「ふしぎな えいえんの いのちをもつ」と けんきゅうしゃに しらべられているんだよ。",
    habitat: "ちちゅうかい・せかいじゅうの あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 100,
  },
  {
    animalId: "crab_horseshoe_japanese",
    genericName: "カブトガニ",
    specificName: "カブトガニ",
    emoji: "🦀",
    rarity: "EPIC",
    description:
      "4おくねんもまえから すがたが ほとんど かわっていない「いきた かせき」。ちが あおいろなので ちりょうや けんきゅうに とても やくだっているよ。にほんでも かぞくで のこっている たいせつな どうぶつなんだ。",
    habitat: "にほん・とうなんアジアの あさい うみ",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  {
    animalId: "bird_turaco_violet",
    genericName: "とり",
    specificName: "スミレエボシドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "アフリカの もりに すむ むらさきや みどりの きれいな とり。とりのなかでも めずらしい「ほんもの」の あかと みどりの しきそを もつ ゆいいつの グループで、にじのように かがやくんだ。",
    habitat: "アフリカ にしぶの もり",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "bird_hornbill_great",
    genericName: "とり",
    specificName: "オオサイチョウ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "くちばしのうえに おおきな きいろい かぶとがある とり。オスは メスが きのほらあなで たまごをあたためるあいだ、えさを くちばしではこんで かきとぐちから わたすやさしい おとうさんなんだ。",
    habitat: "インド・とうなんアジアの もり",
    stageId: "forest",
    lifespanYears: 35,
  },
  {
    animalId: "bird_ground_hornbill_south",
    genericName: "とり",
    specificName: "ミナミジサイチョウ",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "アフリカの サバンナを あるいて ヘビや トカゲを たべる おおきな とり。のどが まっかで かっこいい。こどもは 9さいくらいまで しんせきの とりに たすけてもらって そだつんだ。",
    habitat: "アフリカ なんぶの サバンナ",
    stageId: "savanna",
    lifespanYears: 50,
  },
  {
    animalId: "bird_bee_eater_rainbow",
    genericName: "とり",
    specificName: "ニジハチクイ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "あお・みどり・きいろ・オレンジと にじのような うつくしい いろの とり。そらで むしを つかまえて どくばりを とるために えだで とんとんたたいてから たべるよ。オーストラリアの そらの たまだよ。",
    habitat: "オーストラリアの もりや いけのそば",
    stageId: "savanna",
    lifespanYears: 10,
  },
  {
    animalId: "deer_chinese_water",
    genericName: "しか",
    specificName: "キバノロ",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "つのを もたないのに オスは ながい きばを もつ めずらしい シカ。きばを つかって なわばりを まもるよ。「ドラキュラじか」とも よばれ、ちゅうごくと かんこくの かわべに すんでいるんだ。",
    habitat: "ちゅうごく・かんこくの かわべや しっち",
    stageId: "forest",
    lifespanYears: 12,
  },
  {
    animalId: "mongoose_indian_gray",
    genericName: "マングース",
    specificName: "インドハイイロマングース",
    emoji: "🐾",
    rarity: "COMMON",
    description:
      "むかしばなしで コブラと たたかう ゆうきある どうぶつ。すばやい はんのうで コブラの こうげきを よけて かみつくんだ。コブラの どくに たいして すこし たいせいが あるんだよ。",
    habitat: "インド・とうなんアジアの くさはら",
    stageId: "savanna",
    lifespanYears: 12,
  },
  {
    animalId: "bat_straw_colored",
    genericName: "こうもり",
    specificName: "ムギイロオオコウモリ",
    emoji: "🦇",
    rarity: "RARE",
    description:
      "まいとし ザンビアに なんびゃくまんわも あつまって わたりを する コウモリ。てんに おおきな くろいくもが わくように みえる、せかいさいだいの ほにゅうるいの むれなんだよ！",
    habitat: "アフリカの もりや サバンナ",
    stageId: "savanna",
    lifespanYears: 21,
  },
  {
    animalId: "ray_electric_torpedo",
    genericName: "エイ",
    specificName: "シビレエイ",
    emoji: "🐡",
    rarity: "RARE",
    description:
      "からだに でんきを おこす きかんを もつ エイ。えものに ちかづいて 220ボルトの でんきで びりっと しびれさせて つかまえるよ。にほんのうみにも いるんだ。",
    habitat: "にほんを ふくむ あたたかい うみのそこ",
    stageId: "deep_sea",
    lifespanYears: 16,
  },
  {
    animalId: "whale_sei",
    genericName: "クジラ",
    specificName: "ニタリクジラ",
    emoji: "🐳",
    rarity: "RARE",
    description:
      "ながさ 18メートルにも なる おおきな クジラ。はの ある クジラで さんばんめに はやく、じそく 50キロで およぐよ。むかし たくさん とられてしまい いまは かずが すくないんだ。",
    habitat: "せかいじゅうの おんたいの うみ",
    stageId: "deep_sea",
    lifespanYears: 70,
  },
  {
    animalId: "fish_lungfish_african",
    genericName: "さかな",
    specificName: "アフリカハイギョ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "はいで こきゅうできる めずらしい さかな。かわが かれると じめんのなかに もぐって、ねんまくで からだを まいて かわが みちるまで ねむりつづけるよ。4おくねんまえから すがたが かわっていないんだ。",
    habitat: "アフリカの かわや ぬま",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "insect_cicada_periodical",
    genericName: "セミ",
    specificName: "ジュウシチネンゼミ",
    emoji: "🦗",
    rarity: "EPIC",
    description:
      "17ねんかん じめんのなかで よう虫として すごし、いっせいに ちじょうに でてきて なく ふしぎな セミ。なんびゃくまんわが いちどに でてくるので てきは たべきれず、たくさん なかまが いきのびられるんだ。",
    habitat: "きたアメリカの もり",
    stageId: "forest",
    lifespanYears: 17,
  },
  {
    animalId: "dino_magyarosaurus",
    genericName: "きょうりゅう",
    specificName: "マジャロサウルス",
    emoji: "🦕",
    rarity: "RARE",
    description:
      "しまに すんでいたため、えものが すくなくて ちいさく しんかした くびながきょうりゅう。ふつうの くびながきょうりゅうより ずっと ちいさい。「しまのどうぶつが ちいさくなる」ふしぎな れいなんだ。",
    habitat: "ヨーロッパ（ルーマニア）のしま",
    stageId: "cretaceous",
    isExtinct: true,
  },

  // ── うしの なかまを もっと あつめる ──
  {
    animalId: "cow_gaur",
    genericName: "うし",
    specificName: "ガウル",
    emoji: "🐂",
    rarity: "RARE",
    description:
      "インドや とうなんアジアの もりに すむ、せかいさいだいの やせいの ウシ。かたのたかさが 2メートルをこえる きょだいな からだで、ジャングルの かみなりと よばれているよ。",
    habitat: "インドや とうなんアジアの もり",
    stageId: "forest",
    lifespanYears: 30,
  },
  {
    animalId: "cow_wisent",
    genericName: "うし",
    specificName: "ヨーロッパバイソン",
    emoji: "🐂",
    rarity: "RARE",
    description:
      "ヨーロッパで いちばん おおきな りくの どうぶつ。むかし ぜつめつしかけたが どうぶつえんで まもって ふっかつした。いまは ポーランドの もりで やせい ぐらしを しているよ。",
    habitat: "ヨーロッパのもり",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── しかの なかまを もっと あつめる ──
  {
    animalId: "deer_white_tailed",
    genericName: "しか",
    specificName: "オジロジカ",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "しっぽの うらが まっしろな きたアメリカの シカ。きけんを かんじると しっぽを たかく あげて しろい うらを みせ、なかまに しらせるんだよ。はしる はやさは じそく 50キロにもなるんだ。",
    habitat: "きたアメリカの もりや そうげん",
    stageId: "forest",
    lifespanYears: 14,
  },
  {
    animalId: "deer_pere_davids",
    genericName: "しか",
    specificName: "ダビデジカ",
    emoji: "🦌",
    rarity: "EPIC",
    description:
      "ちゅうごくで いちど やせいぜつめつしたシカ。ヨーロッパの どうぶつえんで まもられて のこり、いまは ちゅうごくの しぜんに もどす とりくみが すすんでいるよ。ながいしっぽが とくちょうなんだ。",
    habitat: "ちゅうごくの しっちや かわべ",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "deer_barasingha",
    genericName: "しか",
    specificName: "バラシンガ",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "インドのしっちや くさはらに すむシカ。オスのつのは えだわかれが 12ほん いじょうになることもあるよ。「じゅうにほんつのしか」とも よばれる、とても めずらしい インドのシカなんだ。",
    habitat: "インドの しっちや くさはら",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── とりの なかまを もっと あつめる ──
  {
    animalId: "bird_kookaburra",
    genericName: "とり",
    specificName: "ワライカワセミ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "「ワッハッハ！」と ひとの わらいごえみたいに なく オーストラリアの とり。その なきごえが もりに ひびくので「もりの とけい」ともよばれているよ。トカゲや へびも たべる たよりになる ハンターなんだ。",
    habitat: "オーストラリアの もりやにわ",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "bird_robin_european",
    genericName: "とり",
    specificName: "ヨーロッパコマドリ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "むねが あかくて かわいい ちいさな とり。クリスマスカードに よくかかれる、ヨーロッパで しんあいされている とり。ひとの ちかくで すをつくり、じめんの むしを さがして たべているよ。",
    habitat: "ヨーロッパのもりやにわ",
    stageId: "forest",
    lifespanYears: 5,
  },
  {
    animalId: "bird_swan_whooper",
    genericName: "つる",
    specificName: "オオハクチョウ",
    emoji: "🦢",
    rarity: "COMMON",
    description:
      "くちばしの ねもとが きいろい おおきな ハクチョウ。まいとし シベリアから にほんへ わたってきて、みずうみや かわで ふゆを すごすよ。「コウコウ」とおおきな こえで なきながら たかく とぶんだ。",
    habitat: "シベリアとにほんのみずうみやかわ",
    stageId: "ice_age",
    lifespanYears: 25,
  },
  {
    animalId: "bird_blue_jay",
    genericName: "とり",
    specificName: "アオカケス",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "あおと しろの きれいな もようの きたアメリカの とり。タカの なきごえを まねして てきをおどかし えさをよこどりすることがあるんだ！あたまにすこしのかんむりばねがある かしこいとりだよ。",
    habitat: "きたアメリカのもりやこうえん",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "bird_frigatebird_magnificent",
    genericName: "とり",
    specificName: "グンカンドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "オスは のどの まっかな ふくろを おおきく ふくらませて メスを よぶ とり。ほかの とりから えさを うばうことで ゆうめいで、かいめんを ほとんど ぬらさずに えさをとれるんだよ。",
    habitat: "ねったいのうみのしまじま",
    stageId: "deep_sea",
    lifespanYears: 25,
  },
  {
    animalId: "bird_kingfisher_malachite",
    genericName: "とり",
    specificName: "マラカイトカワセミ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "アフリカのかわや いけのそばに すむ、こうせきの マラカイトみたいに キラキラ かがやく あおみどりの ちいさな とり。にほんの カワセミの しんせきで、さかなつりの めいじんなんだよ。",
    habitat: "アフリカのかわやいけ",
    stageId: "savanna",
    lifespanYears: 7,
  },
  {
    animalId: "bird_roller_lilac_breasted",
    genericName: "とり",
    specificName: "ライラックニシブッポウソウ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "むねが やさしい むらさきいろの、ケニアの こっかの とり。みどり・あお・きいろ・むらさきと たくさんの いろが あって「アフリカで いちばんきれいなとり」ともよばれているんだよ。",
    habitat: "アフリカのサバンナ",
    stageId: "savanna",
    lifespanYears: 10,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_tigerfish_goliath",
    genericName: "さかな",
    specificName: "ゴライアスタイガーフィッシュ",
    emoji: "🐟",
    rarity: "EPIC",
    description:
      "コンゴがわに すむ、するどい きばが ならぶ きょだいな さかな。ながさ 1.5メートルにもなり、ワニにも かみつくほどのちからもち！「アフリカで いちばんおそろしいたんすいぎょ」と いわれているよ。",
    habitat: "アフリカ コンゴがわ",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "fish_arctic_char",
    genericName: "さかな",
    specificName: "イワナ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "にほんの きれいな やまのかわや、きたのつめたいうみに すむサケのなかま。からだのもように あかい てんてんが きれい。うみにくだっていくものは「アメマス」ともよばれる たびびとのさかなだよ。",
    habitat: "きたのうみやきれいなかわ",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  {
    animalId: "fish_pike_northern",
    genericName: "さかな",
    specificName: "カワカマス",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "かわや みずうみに すむ、するどいきばと ながいからだの ほくたいの さかな。えものに じっとちかづいて ロケットのようにおそう ハンターで、ヨーロッパでは「みずのおおかみ」とよばれているんだ。",
    habitat: "ユーラシア・きたアメリカのかわやみずうみ",
    stageId: "forest",
    lifespanYears: 25,
  },
  {
    animalId: "fish_white_sturgeon",
    genericName: "さかな",
    specificName: "シロチョウザメ",
    emoji: "🐟",
    rarity: "EPIC",
    description:
      "きたアメリカのかわにすむ、たんすいぎょで さいだいきゅうの さかな。ながさ 6メートル・おもさ 600キロを こえることも！100ねん いじょう いきる ながいきさんで、きちょうな たまごがキャビアになるんだ。",
    habitat: "きたアメリカのかわやえんがん",
    stageId: "deep_sea",
    lifespanYears: 100,
  },
  {
    animalId: "fish_tarpon",
    genericName: "さかな",
    specificName: "ターポン",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "おおきな ぎんいろのうろこが かがやく さかな。つりびとに とてもにんきで、かかると なんどもみずから たかくとびあがるよ。えらが はったつしていて、みずのそとでもすこしのあいだいきられるんだ。",
    habitat: "カリブかいやたいせいようのうみやかわぞい",
    stageId: "deep_sea",
    lifespanYears: 55,
  },
  // ── へびの なかまを もっと あつめる ──
  {
    animalId: "snake_inland_taipan",
    genericName: "へび",
    specificName: "インランドタイパン",
    emoji: "🐍",
    rarity: "EPIC",
    description:
      "いっかい かむだけで 100にんを たおせるほどの どくをもつ、せかいで もっとも どくが つよい ヘビ。オーストラリアの さばくに すみ、おとなしいので ひとをかむことは めったにないんだよ。",
    habitat: "オーストラリアのかんそうしたさばく",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── とかげの なかまを もっと あつめる ──
  {
    animalId: "lizard_chinese_water_dragon",
    genericName: "とかげ",
    specificName: "ウォータードラゴン",
    emoji: "🦎",
    rarity: "COMMON",
    description:
      "あおみどりの からだで かわのそばの きのうえに すむ トカゲ。てきにおわれると かわにとびこんで みずのなかに かくれるよ。みずのなかで いきをとめたまま 30ぷんも いられるんだよ。",
    habitat: "ちゅうごく・とうなんアジアのかわべ",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── カメの なかまを もっと あつめる ──
  {
    animalId: "turtle_alligator_snapping",
    genericName: "カメ",
    specificName: "ワニガメ",
    emoji: "🐢",
    rarity: "RARE",
    description:
      "かわの そこで じっとまって、したの さきの あかい ぶぶんを えさに みせかけて さかなをおびきよせる カメ。おもさ 100キロにも なるきたアメリカ いちの かわのカメだよ。",
    habitat: "きたアメリカのかわやぬま",
    stageId: "forest",
    lifespanYears: 60,
  },
  // ── サンショウウオの なかまを もっと あつめる ──
  {
    animalId: "salamander_axolotl",
    genericName: "サンショウウオ",
    specificName: "アホロートル",
    emoji: "🦎",
    rarity: "EPIC",
    description:
      "えらがふさふさで おとなになっても こどものようなすがたの サンショウウオのなかま。てあしをなくしても また はえてくる「さいせいのちから」をもつ。メキシコのみずうみにしかすまない めずらしいどうぶつなんだよ。",
    habitat: "メキシコのみずうみ",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── かえるの なかまを もっと あつめる ──
  {
    animalId: "frog_wood",
    genericName: "かえる",
    specificName: "アメリカモリアマガエル",
    emoji: "🐸",
    rarity: "RARE",
    description:
      "ふゆに からだが こおりついて「こおったまま」ふゆごしをする ふしぎな カエル。こころぞうが とまって しんでいるように みえても、はるになると とけて また うごきだすんだよ！",
    habitat: "きたアメリカのもり",
    stageId: "ice_age",
    lifespanYears: 5,
  },
  // ── サメの なかまを もっと あつめる ──
  {
    animalId: "shark_thresher",
    genericName: "サメ",
    specificName: "オナガザメ",
    emoji: "🦈",
    rarity: "RARE",
    description:
      "しっぽが からだと ほぼ おなじ ながさのサメ。そのながいしっぽをムチのようにふりまわして、ちいさなさかなをしびれさせてから たべるよ。うみから たかくジャンプすることでも ゆうめいなんだ。",
    habitat: "あたたかいうみ",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  // ── あたらしい なかま：ウミウシ ──
  {
    animalId: "sea_slug_nudibranch",
    genericName: "ウミウシ",
    specificName: "ウミウシ",
    emoji: "🐌",
    rarity: "RARE",
    description:
      "ナメクジのなかまで、あか・きいろ・むらさきなど あざやかないろと ふしぎなかたちで うみのそこを ゆっくりあるくよ。からだのいろで どくをもっていると てきにしらせるんだ。「うみのほうせき」だよ。",
    habitat: "せかいじゅうのうみのそこ",
    stageId: "deep_sea",
    lifespanYears: 1,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_blue_tang",
    genericName: "さかな",
    specificName: "ナンヨウハギ",
    emoji: "🐠",
    rarity: "COMMON",
    description:
      "まっさおな からだに きいろい しっぽのさかな。アニメの キャラクターの モデルになった ことで ゆうめいで、サンゴしょうの かいそうをたべながら くらすよ。しっぽのつけねに するどいとげがあるんだ。",
    habitat: "インドたいへいようのサンゴしょう",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  {
    animalId: "eel_electric",
    genericName: "さかな",
    specificName: "デンキウナギ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "じぶんの からだで 600ボルトの でんきを おこすことができる、みなみアメリカのかわのさかな。えものを しびれさせて つかまえるよ。じつは ウナギではなく、ぎょもくの べつのなかまなんだよ。",
    habitat: "みなみアメリカのアマゾンがわ",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── あたらしい なかま：タガメ ──
  {
    animalId: "insect_giant_water_bug",
    genericName: "むし",
    specificName: "タガメ",
    emoji: "🦗",
    rarity: "RARE",
    description:
      "にほんの たんぼや いけに すんでいた おおきな みずのむし。かえるやさかなを つかまえ、さして とかして たべるよ。こうもりを つかまえることもあるんだ！きれいな みずのシンボルなんだよ。",
    habitat: "にほんのたんぼやいけ",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── ガの なかまを もっと あつめる ──
  {
    animalId: "insect_atlas_moth",
    genericName: "ガ",
    specificName: "アトラスガ",
    emoji: "🦋",
    rarity: "RARE",
    description:
      "つばさを ひろげると 30センチにもなる、せかいさいだいきゅうのガ。つばさのさきが ヘビのあたまみたいなもようで てきを おどかすよ。おとなになると くちがなくなって なにもたべないまま いきるんだ。",
    habitat: "とうなんアジアのもり",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── かわうその なかまを もっと あつめる ──
  {
    animalId: "otter_giant",
    genericName: "かわうそ",
    specificName: "オオカワウソ",
    emoji: "🦦",
    rarity: "EPIC",
    description:
      "ながさ 2メートルにもなる、せかいさいだいの カワウソ。みなみアメリカの アマゾンがわにすんで、おおきな こえで「ワォン」となくよ。かぞくで かわを なわばりにして いっしょにいきる やさしいどうぶつなんだ。",
    habitat: "みなみアメリカのかわ",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── ヤマアラシの なかまを もっと あつめる ──
  {
    animalId: "porcupine_north_american",
    genericName: "ヤマアラシ",
    specificName: "アメリカヤマアラシ",
    emoji: "🦔",
    rarity: "COMMON",
    description:
      "きたアメリカのもりにすむ、ながいとげをもつどうぶつ。きのうえにのぼるのがとくいで、とげはぬけやすく てきのからだにさして みをまもるよ。1まんぽんいじょうのとげをもっているんだよ。",
    habitat: "きたアメリカのもり",
    stageId: "forest",
    lifespanYears: 18,
  },
  // ── あたらしい なかま：エトルリアトガリネズミ ──
  {
    animalId: "shrew_etruscan",
    genericName: "ねずみ",
    specificName: "エトルリアトガリネズミ",
    emoji: "🐭",
    rarity: "RARE",
    description:
      "おもさ わずか 1.5グラムで せかいで いちばん ちいさいほにゅうるい。でも こころぞうが 1ふんに 1000かい以上も とくほど すごくはやい！じぶんの からだとおなじくらいの むしを たべるんだよ。",
    habitat: "ちゅうかいちいき・アジアのやぶ",
    stageId: "forest",
    lifespanYears: 2,
  },
  // ── あたらしい なかま：コモンジェネット ──
  {
    animalId: "genet_common",
    genericName: "ジャコウネコ",
    specificName: "コモンジェネット",
    emoji: "🐾",
    rarity: "RARE",
    description:
      "ヒョウのような てんてんもようと、しまの ながいしっぽをもつ スリムなどうぶつ。ネコのようなすがたをしているが マングースのなかまなんだ。よるに かつどうして きをのぼり、とりやむしをとるよ。",
    habitat: "ヨーロッパ・アフリカのもりやさばく",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── あたらしい なかま：テンレック ──
  {
    animalId: "tenrec_common",
    genericName: "テンレック",
    specificName: "テンレック",
    emoji: "🦔",
    rarity: "COMMON",
    description:
      "マダガスカルにすむ、ハリネズミに すがたが にているどうぶつ。でも しんせきは ハリネズミではなく、ぞうや カバのなかまのほうが ちかいんだよ！せなかに かたいはりが はえて みをまもるんだ。",
    habitat: "マダガスカルのもりやそうげん",
    stageId: "forest",
    lifespanYears: 6,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_carp_common",
    genericName: "さかな",
    specificName: "コイ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "にほんのかわや いけに ひろくすむ おおきなさかな。「にしきごい」として きれいないろのものが かわれるよ。おそれずに ひとのそばに きてえさを たべる、なれやすくて ながいきな さかなだよ。",
    habitat: "アジアのかわやいけ",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── あたらしい なかま：チーター ──
  {
    animalId: "cheetah_african",
    genericName: "ねこ",
    specificName: "チーター",
    emoji: "🐆",
    rarity: "RARE",
    description:
      "りくのどうぶつで いちばん はやく、じそく 110キロで はしれるよ！はしるとき からだが おおきくのびて そらに うきあがるんだ。えものを こっそり ちかづいて いっきに おいかけるが、すぐ つかれてしまうんだよ。",
    habitat: "アフリカの サバンナ",
    stageId: "savanna",
    lifespanYears: 12,
  },
  {
    animalId: "gorilla_western_lowland",
    genericName: "さる",
    specificName: "ニシローランドゴリラ",
    emoji: "🦍",
    rarity: "EPIC",
    description:
      "せかいで いちばん おおきな サルのなかま。おとなの オスは 200キロに もなるよ。ふだんは おだやかで むれで なかよく くらしているんだ。にんげんと いでんしが 98%いじょう おなじなんだよ。",
    habitat: "ちゅうおうアフリカのねったいうりん",
    stageId: "forest",
    lifespanYears: 35,
  },
  {
    animalId: "orangutan_bornean",
    genericName: "さる",
    specificName: "ボルネオオランウータン",
    emoji: "🦧",
    rarity: "EPIC",
    description:
      "ボルネオじまにすむ あかいけの おおきなサル。1にちのほとんどを きのうえで すごし、えだからえだへ わたりながら くだものをたべる。「もりのひと」という いみの なまえがついているよ。",
    habitat: "ボルネオじまのねったいうりん",
    stageId: "forest",
    lifespanYears: 35,
  },
  {
    animalId: "chimpanzee_common",
    genericName: "さる",
    specificName: "チンパンジー",
    emoji: "🐒",
    rarity: "EPIC",
    description:
      "にんげんと いでんしが 98.7% おなじ サル。いしで きのみをわったり、えだでアリをとる どうぐをつかうちえがある。むれで こえをあわせて ドラミングしたり、かりをするほど かしこいんだよ。",
    habitat: "アフリカのもりやサバンナ",
    stageId: "forest",
    lifespanYears: 40,
  },
  {
    animalId: "baboon_olive",
    genericName: "さる",
    specificName: "アヌビスヒヒ",
    emoji: "🐒",
    rarity: "COMMON",
    description:
      "アフリカの サバンナに すむ おおきな サル。100わ いじょうのむれで くらし、かしこく なかまどうしで たすけあう。オスは けんかのとき するどい きばを みせて あいてを おどかすよ。",
    habitat: "アフリカのサバンナやもり",
    stageId: "savanna",
    lifespanYears: 30,
  },
  {
    animalId: "macaque_japanese",
    genericName: "さる",
    specificName: "ニホンザル",
    emoji: "🐒",
    rarity: "COMMON",
    description:
      "にほんにすむ、かおとおしりがまっかなサル。ゆきのなかで おんせんにつかるすがたがゆうめいで、このならわしはおかあさんからこどもへつたわる「ぶんか」なんだよ！",
    habitat: "にほんのもりやさんがく",
    stageId: "forest",
    lifespanYears: 25,
  },
  {
    animalId: "bear_polar",
    genericName: "くま",
    specificName: "ホッキョクグマ",
    emoji: "🐻‍❄️",
    rarity: "EPIC",
    description:
      "くまのなかで いちばんおおきく、きたきょくにすむ しろいクマ。かわのけはとうめいで ひかりをあつめてからだをあたためるよ。こおりのうえで アザラシをまちぶせして つかまえるハンターなんだ。",
    habitat: "きたきょくのこおりのうみ",
    stageId: "ice_age",
    lifespanYears: 25,
  },
  {
    animalId: "meerkat_common",
    genericName: "マングース",
    specificName: "ミーアキャット",
    emoji: "🐾",
    rarity: "COMMON",
    description:
      "アフリカのさばくで むれでくらす ちいさな どうぶつ。みはりが にあしでたちあがってテキをみはりけいこくするよ。サソリのどくにも たいせいがあり、コブラとも たたかえるんだ。",
    habitat: "みなみアフリカのさばく",
    stageId: "savanna",
    lifespanYears: 13,
  },
  {
    animalId: "hyena_spotted",
    genericName: "ハイエナ",
    specificName: "ブチハイエナ",
    emoji: "🦡",
    rarity: "RARE",
    description:
      "アフリカで かずがいちばんおおい にくしょくどうぶつ。なきごえが わらいごえに にているので「わらうどうぶつ」ともよばれる。かみつくちからが とても つよくて、ほねもバリバリ たべてしまうよ。",
    habitat: "アフリカのサバンナ",
    stageId: "savanna",
    lifespanYears: 22,
  },
  {
    animalId: "wild_dog_african",
    genericName: "いぬ",
    specificName: "リカオン",
    emoji: "🐕",
    rarity: "EPIC",
    description:
      "アフリカに すむ まだらもようの イヌのなかま。むれでこうりつよくかりをして えものをほぼかならずつかまえるハンター！けがしたなかまに えさをはこんであげる やさしいどうぶつなんだよ。",
    habitat: "アフリカのサバンナやもり",
    stageId: "savanna",
    lifespanYears: 11,
  },
  {
    animalId: "raccoon_dog_japanese",
    genericName: "いぬ",
    specificName: "タヌキ",
    emoji: "🦝",
    rarity: "COMMON",
    description:
      "にほんにすむ、まるっこい からだとくろいめのまわりが とくちょうのイヌのなかま。むかしばなしに よくでてくる どうぶつ。よるにかつどうして きのみや むし・かえるなど なんでもたべるよ。",
    habitat: "にほんのもりやたんぼのそば",
    stageId: "forest",
    lifespanYears: 8,
  },
  {
    animalId: "musk_ox_arctic",
    genericName: "うし",
    specificName: "ジャコウウシ",
    emoji: "🐂",
    rarity: "RARE",
    description:
      "きたきょくの ツンドラにすむ どうぶつ。ながくてあついけのかさなりで マイナス40どのさむさでもへいき！てきがくると むれのオスがかべのようにならんでこどもをまもるんだよ。",
    habitat: "きたきょくのツンドラ",
    stageId: "ice_age",
    lifespanYears: 20,
  },
  {
    animalId: "giraffe_reticulated",
    genericName: "キリン",
    specificName: "アミメキリン",
    emoji: "🦒",
    rarity: "RARE",
    description:
      "からだのもようが あみ目のように なっているキリン。ひがしアフリカに すんでいるよ。ほかのキリンより もようのりんかくがはっきりしていて、おとなになっても もようのかたちはかわらないんだ。",
    habitat: "ひがしアフリカのサバンナ",
    stageId: "savanna",
    lifespanYears: 25,
  },
  {
    animalId: "snow_leopard",
    genericName: "ヒョウ",
    specificName: "ユキヒョウ",
    emoji: "🐆",
    rarity: "LEGENDARY",
    description:
      "ヒマラヤや ちゅうおうアジアのたかいやまにすむ ヒョウ。ながいしっぽをまくらのようにまいてねるよ。しずかにけわしいいわばをはしりまわる「まぼろしのヒョウ」とよばれているんだ。",
    habitat: "ちゅうおうアジア・ヒマラヤのこうざん",
    stageId: "ice_age",
    lifespanYears: 16,
  },
  {
    animalId: "echidna_short_beaked",
    genericName: "ハリモグラ",
    specificName: "ハリモグラ",
    emoji: "🦔",
    rarity: "EPIC",
    description:
      "カモノハシとおなじく たまごをうむほにゅうるい。せなかにするどいはりをもち、てきにおわれるとまるくなってみをまもるよ。ながーいしたで アリをなめとってたべる、かわいい オーストラリアのどうぶつ。",
    habitat: "オーストラリアのもりやそうげん",
    stageId: "forest",
    lifespanYears: 45,
  },
  {
    animalId: "woodpecker_great_spotted",
    genericName: "きつつき",
    specificName: "アカゲラ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "くちばしで きをコツコツたたいてむしをさがすとり。1びょうに 20かいたたくよ！あたまがまっかで、ながいしたで きのなかのよう虫をとりだす。にほんの きたぶんのもりでもみられるよ。",
    habitat: "ヨーロッパ・アジア・にほんのもり",
    stageId: "forest",
    lifespanYears: 11,
  },
  {
    animalId: "ostrich_common",
    genericName: "とり",
    specificName: "ダチョウ",
    emoji: "🦤",
    rarity: "COMMON",
    description:
      "とびないとりで せかいでいちばんおおきく、たかさ 2.7メートルにもなる。はしるはやさはじそく70キロで とりのなかでいちばんはやい！うむたまごも せかいいちおおきいんだよ。",
    habitat: "アフリカのサバンナ",
    stageId: "savanna",
    lifespanYears: 40,
  },
  {
    animalId: "flamingo_greater",
    genericName: "とり",
    specificName: "オオフラミンゴ",
    emoji: "🦩",
    rarity: "RARE",
    description:
      "フラミンゴのなかまで いちばんおおきいしゅるい。あかいピンクのいろは たべているえびやそうのしきそからくるんだ。くびをSじにまげながら みずのなかのえさをこしてたべるよ。",
    habitat: "ちちゅうかい・アフリカのしおあじみずうみ",
    stageId: "savanna",
    lifespanYears: 40,
  },
  {
    animalId: "egret_great_white",
    genericName: "とり",
    specificName: "ダイサギ",
    emoji: "🦢",
    rarity: "COMMON",
    description:
      "まっしろな おおきなサギ。にほんのかわやたんぼでもよくみられるよ。くびをのばしてじっとまち、さかなをみつけるとおもいきりくびをのばしてつついてつかまえるんだ。",
    habitat: "にほんをふくむせかいじゅうのかわやいけ",
    stageId: "savanna",
    lifespanYears: 15,
  },
  {
    animalId: "vulture_whitebacked",
    genericName: "とり",
    specificName: "シロセスジハゲワシ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "アフリカで いちばんかずのおおいハゲワシ。しにものをたべてかんきょうをきれいにする「しぜんのそうじや」。おおきなはねで たかくとびあがり、えものを さがしてあちこちとぶんだよ。",
    habitat: "アフリカのサバンナ",
    stageId: "savanna",
    lifespanYears: 25,
  },
  {
    animalId: "beaver_north_american",
    genericName: "ビーバー",
    specificName: "アメリカビーバー",
    emoji: "🦫",
    rarity: "COMMON",
    description:
      "じょうぶなまえばで きをきりたおして かわに「ダム」をつくる どうぶつ。このダムでみずがたまってしっちになり、たくさんのいきものがすめるようになるよ。「しぜんのエンジニア」なんだ。",
    habitat: "きたアメリカのかわやいけ",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "wildebeest_blue",
    genericName: "アンテロープ",
    specificName: "アオヌー",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "アフリカのサバンナで なんびゃくまんとうのむれでいどうする。みずやくさをもとめて 2000キロもたびをする「だいいどう」は せかいさいだいのどうぶつのながめのひとつなんだよ！",
    habitat: "アフリカのサバンナ",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "seal_weddell",
    genericName: "あざらし",
    specificName: "ウェッデルアザラシ",
    emoji: "🦭",
    rarity: "RARE",
    description:
      "なんきょくのこおりのした、ふかさ700メートルまでもぐってさかなをとる。まえばでこおりにあなをあけて、そのあなからいきをするためにあがってくるよ。80ぷんもいきをとめられるんだ。",
    habitat: "なんきょくのこおりのうみ",
    stageId: "ice_age",
    lifespanYears: 30,
  },
  {
    animalId: "sea_lion_galapagos",
    genericName: "アシカ",
    specificName: "ガラパゴスアシカ",
    emoji: "🦭",
    rarity: "RARE",
    description:
      "ガラパゴスしょとうだけにすむかわいいアシカ。こどもたちはうみであそびながら およぎをおぼえるよ。おかあさんが1ねんかけてこどもをていねいにそだてる やさしいどうぶつなんだ。",
    habitat: "ガラパゴスしょとうのかいがん",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  {
    animalId: "eagle_crowned_african",
    genericName: "わし",
    specificName: "アフリカカンムリワシ",
    emoji: "🦅",
    rarity: "EPIC",
    description:
      "「アフリカでいちばんつよいワシ」とよばれるもうきん。あたまのかんむりばねをひろげておそいかかるよ。サルまでもつかまえる ちからをもち、「アフリカの くうのおうさま」とよばれているんだ。",
    habitat: "アフリカのもりやサバンナ",
    stageId: "savanna",
    lifespanYears: 14,
  },
  {
    animalId: "condor_california",
    genericName: "わし",
    specificName: "カリフォルニアコンドル",
    emoji: "🦅",
    rarity: "LEGENDARY",
    description:
      "きたアメリカでいちばんおおきなとびとり。つばさをひろげると3メートルをこえる。1987ねんにやせいでぜつめつしかけたが、ほごかつどうでもどってきた！「しぜんのそうじや」として だいじなとりだよ。",
    habitat: "きたアメリカのがけやひらたいち",
    stageId: "savanna",
    lifespanYears: 60,
  },
  {
    animalId: "coypu_nutria",
    genericName: "ねずみ",
    specificName: "ヌートリア",
    emoji: "🦫",
    rarity: "COMMON",
    description:
      "みなみアメリカうまれのおおきなネズミのなかま。かわやぬまでくらして、みずくさをたべるよ。みずかきがあってよくおよぐ。にほんのかわでも みられるようになった どうぶつなんだよ。",
    habitat: "みなみアメリカのかわやぬま",
    stageId: "forest",
    lifespanYears: 6,
  },
  {
    animalId: "tamandua_southern",
    genericName: "アリクイ",
    specificName: "ミナミコアリクイ",
    emoji: "🐾",
    rarity: "RARE",
    description:
      "オオアリクイより ちいさいアリクイ。きのうえでもじめんでもくらして、ながいしたとつよいつめで アリやシロアリをほってたべるよ。こどもは おかあさんのせなかにのってはこんでもらうんだ。",
    habitat: "みなみアメリカのもりやくさはら",
    stageId: "savanna",
    lifespanYears: 9,
  },
  {
    animalId: "serow_japanese",
    genericName: "ヤギ",
    specificName: "カモシカ",
    emoji: "🐐",
    rarity: "RARE",
    description:
      "にほんのやまにすむ、ウシとヤギのなかまのどうぶつ。けわしいいわばをひとりですんでいて、なわばりをまもるよ。にほんの こっかのどうぶつとしてほごされている、めずらしいどうぶつなんだ。",
    habitat: "にほんのやまやいわば",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "deer_musk_siberian",
    genericName: "しか",
    specificName: "ジャコウジカ",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "オスがおなかに「じゃこう」というにおいのするぶくろをもつめずらしいシカ。つのはないけど おおきなきばをもつよ。そのにおいはとてもたかくとりひきされ、ずっとかりられてきたんだよ。",
    habitat: "シベリア・ちゅうおうアジアのもり",
    stageId: "forest",
    lifespanYears: 12,
  },
  {
    animalId: "babirusa_sulawesi",
    genericName: "イノシシ",
    specificName: "バビルサ",
    emoji: "🐗",
    rarity: "RARE",
    description:
      "スラウェシじまにすむふしぎな イノシシ。オスはかみつけないほどおおきな、からだのうえにはえるつのが4ほんもあるよ。このつのはなかまに みせるかざりと かんがえられているんだ。",
    habitat: "インドネシアのスラウェシじまのもり",
    stageId: "forest",
    lifespanYears: 24,
  },
  {
    animalId: "tree_kangaroo_lumholtz",
    genericName: "カンガルー",
    specificName: "キノボリカンガルー",
    emoji: "🦘",
    rarity: "EPIC",
    description:
      "きのうえでくらす めずらしいカンガルー。ふつうのカンガルーより あしがみじかくて、えだをつかむのがとくいなんだ。きのうえで くだものをたべて、じゅうしょくのぶらさがりもできるよ。",
    habitat: "オーストラリアとニューギニアのねったいうりん",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "narwhal",
    genericName: "クジラ",
    specificName: "イッカク",
    emoji: "🐳",
    rarity: "LEGENDARY",
    description:
      "オスのあたまから ながいつのがにょきっとはえている「うみのユニコーン」。このつのはじつははが ながくそだったもの。3メートルをこえるつので なにをするかは まだなぞなんだよ！",
    habitat: "きたきょくのつめたいうみ",
    stageId: "ice_age",
    lifespanYears: 50,
  },
  {
    animalId: "pika_american",
    genericName: "うさぎ",
    specificName: "アメリカナキウサギ",
    emoji: "🐇",
    rarity: "RARE",
    description:
      "ウサギのなかまだけどかわいいまるいからだと、みじかいまるいミミのちいさないきもの。「ピカ！」とこえをだして なかまにきけんをつたえるよ。たかいやまにすんでいるので、きおんが あがるとにげばがなくなる。",
    habitat: "きたアメリカのロッキーさんみゃく",
    stageId: "ice_age",
    lifespanYears: 6,
  },
  // ── きつつきの なかまを あつめる ──
  {
    animalId: "woodpecker_black",
    genericName: "きつつき",
    specificName: "クマゲラ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "「ドドドドド」と ものすごいおとで きをたたく、からすほどの おおきなキツツキ。あたまに まっかなはちまきがある。ながいしたで きのなかのカミキリムシのよう虫を とりだしてたべるよ。",
    habitat: "にほん・ヨーロッパ・アジアのもり",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── とりの なかまを あつめる（新種）──
  {
    animalId: "bird_stork_white",
    genericName: "とり",
    specificName: "コウノトリ",
    emoji: "🦢",
    rarity: "EPIC",
    description:
      "ヨーロッパの むかしばなしで「あかちゃんをはこぶとり」として ゆうめい。たかさ 1.2メートルのしろいおおきなとり。にほんでは いちど9わまで へったが ほごかつどうで ふえてきたよ。",
    habitat: "ヨーロッパ・アジアのそうげんやたんぼ",
    stageId: "savanna",
    lifespanYears: 39,
  },
  {
    animalId: "bird_gannet_northern",
    genericName: "とり",
    specificName: "カツオドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "たかさ 30メートルのそらから じそく100キロで まっさかさまに「ドボン！」とうみにとびこんでさかなをとる。うみにとびこむとき、くちばしはぴったり とじて みずをきるよ。",
    habitat: "きたたいせいようのおきあいのかいがん",
    stageId: "deep_sea",
    lifespanYears: 16,
  },
  {
    animalId: "bird_wren_eurasian",
    genericName: "とり",
    specificName: "ミソサザイ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "にほんでいちばんちいさいとりのひとつで、てのひらにのるくらい。でもこえはとても おおきく、たにまにひびく きれいなうたをうたうよ。ふゆもにほんに のこるとりなんだ。",
    habitat: "にほん・ヨーロッパのやまのもり",
    stageId: "forest",
    lifespanYears: 5,
  },
  {
    animalId: "bird_tern_arctic",
    genericName: "とり",
    specificName: "キョクアジサシ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "きたきょくから なんきょくまで まいとし 7万キロも とびつづける、せかいで いちばん ながいきょりを いどうするとり！1年のうちに たいようが しずまないきせつを 2かいも たいけんするよ。",
    habitat: "きたきょく・なんきょくのうみ",
    stageId: "ice_age",
    lifespanYears: 30,
  },
  {
    animalId: "bird_waxwing_bohemian",
    genericName: "とり",
    specificName: "レンジャク",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "あたまに たかいかんむりをもつ きれいなとり。なんびきもあつまって きのみをたべ、たべすぎて よっぱらったようにフラフラすることがあるんだって！あかい きのみが だいすきなんだよ。",
    habitat: "きたヨーロッパ・アジアのもり",
    stageId: "forest",
    lifespanYears: 13,
  },
  {
    animalId: "bird_kingfisher_japanese",
    genericName: "とり",
    specificName: "ヤマセミ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "にほんのきれいな やまのかわにすむ カワセミのなかまの おおきいとり。からだに まだらのもようがあって、いわのうえから すいめんにとびこんで さかなをつかまえるよ。",
    habitat: "にほんのきれいなやまのかわ",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── さかなの なかまを あつめる（新種）──
  {
    animalId: "fish_stonefish",
    genericName: "さかな",
    specificName: "オニダルマオコゼ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "まわりのいわに そっくりなみためで うみのそこで じっとしている さかな。せなかのトゲに せかいいちきけんな どくがある。ふまれると ものすごくいたいので うみでは きをつけてね！",
    habitat: "インドようのかいがん・さんごしょう",
    stageId: "deep_sea",
    lifespanYears: 15,
  },
  {
    animalId: "fish_flounder",
    genericName: "さかな",
    specificName: "ヒラメ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "うまれたときは めが からだのりょうがわにあるが、そだつと からだがよこになって めが かたほうに よってくる！すなのなかに かくれて ちかくをとおるさかなを パクッとつかまえるよ。",
    habitat: "にほんをふくむきたたいへいようのかいてい",
    stageId: "deep_sea",
    lifespanYears: 10,
  },
  {
    animalId: "fish_lamprey",
    genericName: "さかな",
    specificName: "ヤツメウナギ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "からだに 7つのあながある ふしぎないきもの。えらのあなが めのように みえるので「ヤツメ（8つのめ）」のなまえがついた。あごがなく、まるいくちで さかなにすいついて えいようをすうよ。",
    habitat: "きたはんきゅうのかわとうみ",
    stageId: "deep_sea",
    lifespanYears: 7,
  },
  {
    animalId: "fish_mahimahi",
    genericName: "さかな",
    specificName: "シイラ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "おどろくほど いろがあざやかな うみのさかな。しんでいくと からだのいろが きいろやみどりに かわっていくよ。よくとびあがって えものをおいかけ、じそく90キロで およぐんだよ！",
    habitat: "せかいじゅうのたいようのうみ",
    stageId: "deep_sea",
    lifespanYears: 4,
  },
  {
    animalId: "fish_perch_nile",
    genericName: "さかな",
    specificName: "ナイルパーチ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "アフリカのヴィクトリアこに もちこまれた おおきなさかな。こゆうのさかなをたくさんたべて ぜつめつさせてしまったよ。おもさ200キロになるものもいて、いまはアフリカでよくたべられているよ。",
    habitat: "アフリカのかわやみずうみ",
    stageId: "savanna",
    lifespanYears: 16,
  },
  {
    animalId: "fish_blobfish",
    genericName: "さかな",
    specificName: "ニュウドウカジカ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "ふかいうみに すむぷにょぷにょのさかな。すいあつがひくい ちじょうでとりあげると ぷにょっとした なにがなんだかわからないかおになる。でも ふかいうみでは ふつうのすがたをしているよ。",
    habitat: "にほん・オーストラリアのふかいかいてい",
    stageId: "deep_sea",
    lifespanYears: 12,
  },
  {
    animalId: "fish_scorpionfish",
    genericName: "さかな",
    specificName: "カサゴ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "いわのあいだに かくれている あか・ちゃいろの さかな。せなかのトゲにどくがある。うきぶくろがなく うみのそこで じっとしているが、えものが きたら いっきに パクッと とびかかるよ。",
    habitat: "にほん・インドようのかいがん",
    stageId: "deep_sea",
    lifespanYears: 15,
  },
  {
    animalId: "fish_gurnard_flying",
    genericName: "さかな",
    specificName: "ホウボウ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "むなびれが おおきなつばさのようで、まるで とんでいるような さかな。このつばさは うみのそこをあるく「あし」のかわりにもなるよ。「グーグー」となきごえをだすため「ホウボウ」のなまえがついたんだ。",
    habitat: "にほんをふくむたいへいようのかいてい",
    stageId: "deep_sea",
    lifespanYears: 15,
  },
  {
    animalId: "fish_needlefish",
    genericName: "さかな",
    specificName: "ダツ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "ながいくちばしのような するどいくちをもつ、すいめんをはしるようにはやくおよぐさかな。よるのひかりにむかって とびあがるせいしつがあり、みどりに ひかるほそながいからだがうつくしいよ。",
    habitat: "たいへいよう・インドようのあたたかいうみ",
    stageId: "deep_sea",
    lifespanYears: 5,
  },
  // ── えびの なかまを あつめる ──
  {
    animalId: "shrimp_pistol",
    genericName: "えび",
    specificName: "テッポウエビ",
    emoji: "🦐",
    rarity: "COMMON",
    description:
      "ハサミをすばやくとじると しょうげきはがでて ちかくのえものをしとめるエビ。このおとは 218デシベルにもなり、プチッとした せんこうが たいようのひかりよりもあつい ひがでるんだよ！",
    habitat: "たいへいよう・インドようのかいがん",
    stageId: "deep_sea",
    lifespanYears: 3,
  },
  {
    animalId: "shrimp_cleaner",
    genericName: "えび",
    specificName: "クリーナーシュリンプ",
    emoji: "🦐",
    rarity: "COMMON",
    description:
      "さかなのからだのよごれや きずをきれいにしてあげる えび。おおきなさかなも「クリーニングステーション」に きて えびに そうじしてもらうよ。えびはたべられず、さかなはきれいになるんだ。",
    habitat: "せかいじゅうのさんごしょう",
    stageId: "deep_sea",
    lifespanYears: 2,
  },
  // ── ヒトデ・イソギンチャクの なかまを あつめる ──
  {
    animalId: "starfish_crown_thorns",
    genericName: "ヒトデ",
    specificName: "オニヒトデ",
    emoji: "⭐",
    rarity: "RARE",
    description:
      "うでが 10〜20ほんある おおきなヒトデ。サンゴをたべてしまうため、たくさんふえると サンゴしょうがこわされてしまう。でも しぜんでは サンゴしょうのバランスをたもつ やくわりもあるんだよ。",
    habitat: "インドよう・たいへいようのさんごしょう",
    stageId: "deep_sea",
    lifespanYears: 17,
  },
  {
    animalId: "sea_anemone_giant",
    genericName: "イソギンチャク",
    specificName: "センジュイソギンチャク",
    emoji: "🪸",
    rarity: "RARE",
    description:
      "カクレクマノミが すみかにする、ながいしょくしゅが ゆらゆらうごくうみのいきもの。しょくしゅのどくで えものをつかまえるが、クマノミには どくがきかないので なかよくすんでいるよ。",
    habitat: "インドよう・たいへいようのさんごしょう",
    stageId: "deep_sea",
    lifespanYears: 80,
  },
  // ── やもり・へびの なかまを あつめる（新種）──
  {
    animalId: "gecko_satanic_leaf",
    genericName: "やもり",
    specificName: "サタンフシギヤモリ",
    emoji: "🦎",
    rarity: "EPIC",
    description:
      "マダガスカルの もりにすむ、かれはに まるごとそっくりな ヤモリ。みためが こわすぎて「サタン（あくま）」のなまえがついた。きのうえで じっとしているので ほとんど みつけられないよ。",
    habitat: "マダガスカルのねったいうりん",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "snake_vine_asian",
    genericName: "へび",
    specificName: "アジアムチヘビ",
    emoji: "🐍",
    rarity: "RARE",
    description:
      "アジアのもりにすむ、ながくてすごくほそい みどりのヘビ。えだにすんでいて むちのように ほそく、みどりのえだそっくりなのでみつけにくいよ。めが とても おおきいのが とくちょうなんだ。",
    habitat: "とうなんアジアのねったいうりん",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── わに・とかげの なかまを あつめる（新種）──
  {
    animalId: "crocodile_mugger",
    genericName: "わに",
    specificName: "マグレワニ",
    emoji: "🐊",
    rarity: "RARE",
    description:
      "インドや スリランカのかわや こにすむ ワニ。ほかのワニより ひろめのくちで えがおのように みえるよ。むれで いっしょにさかなをとることもある、かしこいワニなんだ。",
    habitat: "インド・スリランカのかわやみずうみ",
    stageId: "savanna",
    lifespanYears: 40,
  },
  {
    animalId: "monitor_bengal",
    genericName: "とかげ",
    specificName: "ベンガルオオトカゲ",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "インドや スリランカにすむ おおきなトカゲ。コモドオオトカゲのしんせきで、みずにもよくもぐり さかなや かめのたまごなどをたべる。ながいしたで においをかいで えものをみつけるよ。",
    habitat: "インド・スリランカのもりやかわのほとり",
    stageId: "savanna",
    lifespanYears: 25,
  },
  // ── ねずみの なかまを あつめる（新種）──
  {
    animalId: "rat_naked_mole",
    genericName: "ねずみ",
    specificName: "ハダカデバネズミ",
    emoji: "🐾",
    rarity: "EPIC",
    description:
      "アフリカの ちかにすむ、けのない ふしぎなネズミ。くつうをかんじず「じょおう」が こどもをうむ アリのような せいかつをする。ネズミのなかで いちばんながいき（30ねん）なんだよ！",
    habitat: "ひがしアフリカのかんそうした そうげんのちか",
    stageId: "savanna",
    lifespanYears: 30,
  },
  // ── いぬの なかまを あつめる（新種）──
  {
    animalId: "dog_dhole",
    genericName: "いぬ",
    specificName: "ドール",
    emoji: "🐕",
    rarity: "RARE",
    description:
      "アジアのもりにすむ あかいけのワイルドドッグ。むれでかりをして、じぶんたちより おおきいトラのえものを うばうことも！なきごえが「キャーン」と とりみたいなのが とくちょうなんだよ。",
    habitat: "アジアのもりやそうげん",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── あらいぐまの なかまを あつめる ──
  {
    animalId: "kinkajou",
    genericName: "あらいぐま",
    specificName: "キンカジュー",
    emoji: "🐾",
    rarity: "RARE",
    description:
      "なんべいのもりにすむ、アライグマのなかまの きのうえせいかつするどうぶつ。ながいしたで はなのみつをなめ くだものをたべる。しっぽを えだにまきつけて ぶらさがることができるよ！",
    habitat: "なんべいのねったいうりん",
    stageId: "savanna",
    lifespanYears: 23,
  },
  // ── オーストラリアの どうぶつを あつめる（新種）──
  {
    animalId: "numbat",
    genericName: "ナンバット",
    specificName: "ナンバット",
    emoji: "🐾",
    rarity: "EPIC",
    description:
      "オーストラリアのもりにすむ、はなにしまもようの ちいさいどうぶつ。1日に 20000ひきもの シロアリをたべるよ！ほかのフクロるいとちがって おなかに ふくろがない めずらしいどうぶつなんだ。",
    habitat: "オーストラリアにしぶのもり",
    stageId: "forest",
    lifespanYears: 5,
  },
  {
    animalId: "bandicoot_long_nosed",
    genericName: "バンディクート",
    specificName: "ナガハナバンディクート",
    emoji: "🐾",
    rarity: "COMMON",
    description:
      "オーストラリアに すむ、とがったはなの フクロるい。じめんをほって こんちゅうや いもをたべる。ふつうのほにゅうるいよりずっとみじかい きかんで、ちいさな たいじをうむ めずらしいどうぶつだよ。",
    habitat: "オーストラリアのもりやそうげん",
    stageId: "forest",
    lifespanYears: 3,
  },
  // ── アンテロープの なかまを あつめる（新種）──
  {
    animalId: "antelope_gerenuk",
    genericName: "アンテロープ",
    specificName: "ジェレヌク",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "くびが とてもながく、うしろあしで たちあがって きのはをたべる アンテロープ。キリンのような たちあがりかたができる めずらしいどうぶつ。ほとんどみずをのまなくても だいじょうぶなんだよ。",
    habitat: "ひがしアフリカのかんそうしたサバンナ",
    stageId: "savanna",
    lifespanYears: 13,
  },
  {
    animalId: "antelope_pronghorn",
    genericName: "アンテロープ",
    specificName: "プロングホーン",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "きたアメリカにすむ、チーターにつぎ せかいで2ばんめにはやく はしれるどうぶつ！じそく88キロで はしれる。チーターより ながいきょりをはしりつづけられる、すごいスタミナのどうぶつなんだよ。",
    habitat: "きたアメリカのへいげんやさばく",
    stageId: "savanna",
    lifespanYears: 10,
  },
  // ── やぎ・ひつじの なかまを あつめる（新種）──
  {
    animalId: "goat_markhor",
    genericName: "やぎ",
    specificName: "マルコール",
    emoji: "🐐",
    rarity: "EPIC",
    description:
      "パキスタンや アフガニスタンのたかいやまにすむ ヤギ。オスは らせんじょうにねじれた ながいつのをもつ。ものすごくけわしいいわばをらくらくのぼる「やまのかみさん」ともよばれているよ。",
    habitat: "パキスタン・アフガニスタンのこうざん",
    stageId: "ice_age",
    lifespanYears: 12,
  },
  {
    animalId: "sheep_himalayan_blue",
    genericName: "ひつじ",
    specificName: "バラル",
    emoji: "🐑",
    rarity: "RARE",
    description:
      "チベットの たかいやまにすむ、あおみがかったいろの ヒツジ。オスは おおきなつのをもつ。ユキヒョウの しゅような えさで、どこにバラルがいるか みれば ユキヒョウもちかくにいるよ。",
    habitat: "チベット・ヒマラヤのこうざん",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  // ── うしの なかまを あつめる（新種）──
  {
    animalId: "ox_takin",
    genericName: "うし",
    specificName: "タキン",
    emoji: "🐂",
    rarity: "RARE",
    description:
      "チベットや ちゅうごくのやまにすむ、ウシとヤギのあいだのような どうぶつ。ジャイアントパンダとおなじ ちいきにすんでいる。「ゴールデンフリース」のでんせつに でてくるどうぶつのもでるともいわれるよ。",
    habitat: "ちゅうごく・チベット・インドのこうざん",
    stageId: "ice_age",
    lifespanYears: 18,
  },
  // ── ハイエナの なかまを あつめる（新種）──
  {
    animalId: "hyena_brown",
    genericName: "ハイエナ",
    specificName: "チャイロハイエナ",
    emoji: "🦡",
    rarity: "RARE",
    description:
      "アフリカの 3しゅのハイエナのひとつ。よるに かつどうして しにものや のこりものをあさる「しぜんのそうじや」。ブチハイエナとちがい ひとりでいどうすることが おおく、しずかなどうぶつだよ。",
    habitat: "みなみアフリカのさばくやかんそうそうげん",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── センザンコウの なかまを あつめる（新種）──
  {
    animalId: "pangolin_chinese",
    genericName: "センザンコウ",
    specificName: "チュウゴクセンザンコウ",
    emoji: "🐾",
    rarity: "EPIC",
    description:
      "ちゅうごくや アジアにすむ センザンコウ。からだをおおう かたいウロコは にんげんのつめとおなじ成分！きけんをかんじると まるくなってみをまもるが、にんげんに よりすぎて いまきょくめんにたっているよ。",
    habitat: "ちゅうごく・とうなんアジアのもりやそうげん",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── さるの なかまを あつめる（新種）──
  {
    animalId: "marmoset_pygmy",
    genericName: "さる",
    specificName: "コビトマーモセット",
    emoji: "🐒",
    rarity: "EPIC",
    description:
      "せかいでいちばんちいさいサル。おとなでも からだのおもさが 100グラムにみたない！おやゆびほどのおもさなのに、きのかわをかじって しるをなめるくちばしのような こうどうがおもしろいよ。",
    habitat: "なんべいのアマゾンのもり",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── テナガザルの なかまを あつめる ──
  {
    animalId: "gibbon_siamang",
    genericName: "テナガザル",
    specificName: "シアマン",
    emoji: "🐒",
    rarity: "EPIC",
    description:
      "アジアのもりにすむ、くびに おおきなのどぶくろをもつ テナガザル。このふくろをふくらませて すごくおおきなこえをだし、まいあさ なかまのなわばりをしらせるんだよ。うたがとてもうつくしいよ。",
    habitat: "とうなんアジアのねったいうりん",
    stageId: "forest",
    lifespanYears: 40,
  },
  // ── あざらしの なかまを あつめる（新種）──
  {
    animalId: "seal_bearded",
    genericName: "あざらし",
    specificName: "アゴヒゲアザラシ",
    emoji: "🦭",
    rarity: "RARE",
    description:
      "きたきょくのこおりのうみにすむ、ひげがふさふさした おおきいアザラシ。このふさふさのひげは えものをさがすためのセンサー！「ウー」とながいうたをうたって こおりのしたで なかまとれんらくするよ。",
    habitat: "きたきょくのこおりのうみ",
    stageId: "ice_age",
    lifespanYears: 25,
  },
  // ── ちょうちょの なかまを あつめる（新種）──
  {
    animalId: "butterfly_glasswing",
    genericName: "ちょうちょ",
    specificName: "グラスウィング",
    emoji: "🦋",
    rarity: "EPIC",
    description:
      "なんべいのもりにすむ、つばさが とうめいな（すけすけの）チョウ。つばさのほとんどが まるでガラスのようにすきとおっているよ！まわりにとけこんで てきからみをまもるための すごいのーちゅうなんだ。",
    habitat: "なんべい・ちゅうべいのねったいうりん",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── ちょうちょの なかまを あつめる（追加）──
  {
    animalId: "butterfly_ulysses",
    genericName: "ちょうちょ",
    specificName: "オオルリアゲハ",
    emoji: "🦋",
    rarity: "RARE",
    description:
      "オーストラリアや とうなんアジアの もりにすむ、まぶしいほど あざやかな あおいつばさの チョウ。このあおは いろのついた りんぷんではなく、ひかりの はんしゃで かがやく こうぞうしょくなんだ！",
    habitat: "オーストラリア・とうなんアジアのねったいうりん",
    stageId: "forest",
    lifespanYears: 1,
  },
  {
    animalId: "butterfly_apollo",
    genericName: "ちょうちょ",
    specificName: "アポロチョウ",
    emoji: "🦋",
    rarity: "RARE",
    description:
      "ヨーロッパの たかい やまにすむ、しろくて あかい もようが うつくしいチョウ。さむい やまの うえでも とべるように、からだは もふもふの うぶげにおおわれているよ。ぜつめつきぐしゅにもなっているんだ。",
    habitat: "ヨーロッパのこうさんたいのやまおか",
    stageId: "ice_age",
    lifespanYears: 1,
  },
  {
    animalId: "butterfly_painted_lady",
    genericName: "ちょうちょ",
    specificName: "ヒメアカタテハ",
    emoji: "🦋",
    rarity: "COMMON",
    description:
      "せかいじゅうの ほぼ すべての たいりくで みられる、せかいで いちばん ひろく ぶんぷする チョウ。だいだいいろと くろのもようがきれいで、まいとし すごいきょりを わたりするよ！",
    habitat: "せかいじゅうのそうげん・はたけ・にわ",
    stageId: "savanna",
    lifespanYears: 1,
  },
  {
    animalId: "butterfly_rajah_brooke",
    genericName: "ちょうちょ",
    specificName: "ラジャーブルックトリバネアゲハ",
    emoji: "🦋",
    rarity: "EPIC",
    description:
      "マレーシアの こっちょう（くにのチョウ）で、まっくろのつばさに あざやかな みどりのV じもようが はいる とても おおきなチョウ。はねをひろげると 17センチにもなるよ！",
    habitat: "ボルネオとう・マレーしまのねったいうりん",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── かえるの なかまを あつめる（追加）──
  {
    animalId: "frog_japanese_tree",
    genericName: "かえる",
    specificName: "モリアオガエル",
    emoji: "🐸",
    rarity: "COMMON",
    description:
      "にほんの さとやまの もりにすむ きれいな みどりのカエル。いけや ぬまのうえの えだに しろいあわのかたまり（あわのす）をつくり、その なかにたまごをうむ。ふかったあとに おたまじゃくしが みずに おちるんだ。",
    habitat: "にほんのさとやまのもりといけ",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "frog_argentine_horned",
    genericName: "かえる",
    specificName: "ベルツノガエル",
    emoji: "🐸",
    rarity: "COMMON",
    description:
      "みなみアメリカの みどりや ちゃいろの まるまるとした カエル。「パックマンガエル」のあだなをもち、じぶんのたいちょうとほぼおなじおおきさのえものでもまるごとたべてしまうほど くいしんぼうなんだ！",
    habitat: "アルゼンチン・ウルグアイのそうげん",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "frog_waxy_monkey",
    genericName: "かえる",
    specificName: "ロウイロサルガエル",
    emoji: "🐸",
    rarity: "RARE",
    description:
      "みなみアメリカにすむ、みどりいろのカエル。からだから ろうじょうの ぶんぴつぶつをだして、かわいたきのうえでも かわかないようにみをまもるちえをもつ。あるいてゆっくりいどうするめずらしいカエルだよ。",
    habitat: "みなみアメリカのそうげん・かんそうしたもり",
    stageId: "forest",
    lifespanYears: 8,
  },
  // ── へびの なかまを あつめる（追加）──
  {
    animalId: "snake_bushmaster",
    genericName: "へび",
    specificName: "ブッシュマスター",
    emoji: "🐍",
    rarity: "EPIC",
    description:
      "ちゅうべい・みなみアメリカにすむ、ながさ 3メートルにもなる どくへびのなかまでもっともおおきい。しっぽをぶるぶるふるわせておとをだし、けいかいのサインをおくるよ。もりのそうちょうてきなどくへびだ。",
    habitat: "ちゅうべい・みなみアメリカのねったいうりん",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "snake_green_tree_python",
    genericName: "へび",
    specificName: "ミドリニシキヘビ",
    emoji: "🐍",
    rarity: "RARE",
    description:
      "ニューギニアや オーストラリアのもりにすむ、あざやかなみどりいろのヘビ。きのえだにSじにからみついてきりはなれたすがたでやすむ。こどものころはきいろやあかで、おとなになるとみどりになるよ！",
    habitat: "ニューギニア・オーストラリアのねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "snake_mozambique_cobra",
    genericName: "へび",
    specificName: "モザンビークコブラ",
    emoji: "🐍",
    rarity: "EPIC",
    description:
      "アフリカにすむどくへびで、てきにむかってどくを「ふきつける」すごいのうりょくをもつ。めをねらってどくをふいてくるので、かわのどうぶつにとってもあぶないんだ。",
    habitat: "アフリカのさばんな・やぶち",
    stageId: "savanna",
    lifespanYears: 20,
  },
  // ── カメの なかまを あつめる（追加）──
  {
    animalId: "turtle_leopard_tortoise",
    genericName: "カメ",
    specificName: "ヒョウモンガメ",
    emoji: "🐢",
    rarity: "COMMON",
    description:
      "アフリカのさばんなにすむ、こうらにヒョウのもようににたくろいてんてんがあるリクガメ。アフリカで4ばんめにおおきいリクガメで、ながいきなのがとくちょう。おとなしくてじっくりとくさをたべるよ。",
    habitat: "サブサハラアフリカのさばんな",
    stageId: "savanna",
    lifespanYears: 100,
  },
  {
    animalId: "turtle_russian",
    genericName: "カメ",
    specificName: "ロシアリクガメ",
    emoji: "🐢",
    rarity: "COMMON",
    description:
      "ちゅうおうアジアのかんそうちたいにすむ、ちいさくてかわいいリクガメ。かんそうやさむさにもつよく、ふゆはじめんにもぐってなつみんするよ。かんきょうへのてきおうりょくがとてもたかいんだ。",
    habitat: "ちゅうおうアジアのかんそうしたそうげん",
    stageId: "savanna",
    lifespanYears: 40,
  },
  {
    animalId: "turtle_eastern_box",
    genericName: "カメ",
    specificName: "ハコガメ",
    emoji: "🐢",
    rarity: "COMMON",
    description:
      "きたアメリカにすむ、こうらをきっちりととじることができるめずらしいリクガメ。てきがせめてくるとこうらのふたをとじて、なかにかんぜんにもぐりこんでみをまもるよ。まるでよろいのようなこうらだね。",
    habitat: "きたアメリカのもりやそうげん",
    stageId: "forest",
    lifespanYears: 100,
  },
  // ── こうもりの なかまを あつめる（追加）──
  {
    animalId: "bat_malayan_flying_fox",
    genericName: "こうもり",
    specificName: "マレーオオコウモリ",
    emoji: "🦇",
    rarity: "RARE",
    description:
      "とうなんアジアにすむ、つばさをひろげると1.5メートルをこえるおおきなコウモリ。よるになるとおおぐんれでそらをとびまわり、くだもののはながとてもすきで、かふんをうんぶするやくめもになっているよ。",
    habitat: "とうなんアジア・フィリピン・マレーしまのもり",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "bat_free_tailed_brazilian",
    genericName: "こうもり",
    specificName: "ブラジルオヒキコウモリ",
    emoji: "🦇",
    rarity: "COMMON",
    description:
      "きたアメリカからみなみアメリカにひろくすむちいさなコウモリ。どうくつにおくまんびきがあつまることもある！まいばんこうだいなむれでとびだして、むしをだいりょうにたべるよ。",
    habitat: "きた・なんべいのどうくつやしんりん",
    stageId: "forest",
    lifespanYears: 18,
  },
  {
    animalId: "bat_greater_horseshoe",
    genericName: "こうもり",
    specificName: "ウマゴテバコウモリ",
    emoji: "🦇",
    rarity: "RARE",
    description:
      "ヨーロッパからアジアにかけてすむコウモリで、はなのまわりにてつかたちの「はなかたち」をもつ。このはなかたちはこうはおんぱをだすためのアンテナで、やみのなかでもこんちゅうをせいかくにつかまえられるよ。",
    habitat: "ヨーロッパ・アジアのどうくつやもり",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── とりの なかまを あつめる（追加）──
  {
    animalId: "bird_mandarin_duck",
    genericName: "とり",
    specificName: "オシドリ",
    emoji: "🦆",
    rarity: "RARE",
    description:
      "にほんやちゅうごくのかわやいけにすむカモ。おすはあかやみどり・むらさきのごうかなはねをもち、せかいいちうつくしいカモともいわれる。「おしどりふうふ」ということばは、なかのよいカップルのだいめいしだよ。",
    habitat: "にほん・ちゅうごくのかわやいけ・もり",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "bird_great_cormorant",
    genericName: "とり",
    specificName: "カワウ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "にほんのかわやうみべにすむくろいとり。つばさをひろげてかわかしているすがたがよくみられる。くちばしがかぎがたにまがっており、もぐってさかなをつかまえるのがとくい。にほんではふえすぎてもんだいになることも。",
    habitat: "にほん・アジアのかわ・うみべ",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "bird_common_starling",
    genericName: "とり",
    specificName: "ムクドリ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "にほんのまちやさとやまにすむちゅうくらいのサイズのとり。おおきなむれでそらをとびまわり、まるでひとつのいきもののようなうごきをみせる「マーメーション」はせかいじゅうでふしぎがられているよ！",
    habitat: "にほん・ユーラシアのまちやさとやま",
    stageId: "savanna",
    lifespanYears: 15,
  },
  {
    animalId: "bird_skylark",
    genericName: "とり",
    specificName: "ヒバリ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "はるのそらにたかくたかくとびあがりながらうたいつづけるちいさなとり。「ピーチクパーチク」となきながら、まるでそらにうたをかきこむようにとぶよ。にほんのたんぼやそうげんでよくみられるよ。",
    habitat: "にほん・ユーラシアのたんぼ・そうげん",
    stageId: "savanna",
    lifespanYears: 8,
  },
  {
    animalId: "bird_white_wagtail",
    genericName: "とり",
    specificName: "ハクセキレイ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "しろとくろのもようで、しっぽをじょうずに「フリフリ」ふりながらあるくかわいいとり。にほんのまちのかわやこうえんでもみられ、じめんをすばしっこくあるきまわってむしをさがすよ。",
    habitat: "にほん・ユーラシアのかわべ・まちなか",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "bird_kentish_plover",
    genericName: "とり",
    specificName: "シロチドリ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "にほんのかいがんやかわらでこどもをそだてるちいさなシギのなかま。すなはまにちょくせつすをつくり、たまごがすなのいろにているのでみつけにくい。すなはまのかいはつでとくにすがたがへっているよ。",
    habitat: "にほん・ユーラシアのかいがんやかわら",
    stageId: "savanna",
    lifespanYears: 12,
  },
  // ── クモの なかまを あつめる（追加）──
  {
    animalId: "spider_sydney_funnel_web",
    genericName: "クモ",
    specificName: "シドニージョウゴグモ",
    emoji: "🕷️",
    rarity: "EPIC",
    description:
      "オーストラリア・シドニーのちかくにすむ、せかいでもっときけんといわれるクモのひとつ。こうどくで、かまれるととてもあぶない。でもゆしゅつしたどくからかいはつされたこうどくそがたくさんのいのちをすくっているよ。",
    habitat: "オーストラリア・シドニー周辺のもり・にわ",
    stageId: "forest",
    lifespanYears: 5,
  },
  {
    animalId: "spider_golden_silk_orb",
    genericName: "クモ",
    specificName: "コガネグモ",
    emoji: "🕷️",
    rarity: "RARE",
    description:
      "にほんのたんぼやもりのはずれにはる、まるいあみのようなくものす。きいろとくろのしまもようがきれいなクモで、おすとめすのおおきさがきわだってちがう。にほんのなつ・あきによくみかけるよ。",
    habitat: "にほん・アジアのたんぼ・もりのはずれ",
    stageId: "forest",
    lifespanYears: 1,
  },
  {
    animalId: "spider_black_widow",
    genericName: "クモ",
    specificName: "クロゴケグモ",
    emoji: "🕷️",
    rarity: "RARE",
    description:
      "きたアメリカにすむ、くろいからだのおなかにあかいひしがたのもようがあるこうどくグモ。めすはおすよりもずっとおおきく、どくももつ。きけんだが、じつはこうぜんとうにはそうそうちかよってこないんだ。",
    habitat: "きたアメリカのいわばやくさむら・いえのまわり",
    stageId: "forest",
    lifespanYears: 3,
  },
  // ── カニの なかまを あつめる（追加）──
  {
    animalId: "crab_christmas_red",
    genericName: "カニ",
    specificName: "クリスマスアカガニ",
    emoji: "🦀",
    rarity: "EPIC",
    description:
      "クリスマスとうにすむまっかなカニ。まいとし1000まん〜1.2おくひきもがいちどにかいがんへこうしんし、たまごをうみにいく。このいどうは「せかいのしぜんのふしぎ10」にもえらばれているよ！",
    habitat: "インドよう・クリスマスとうのもり",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "crab_fiddler",
    genericName: "カニ",
    specificName: "シオマネキ",
    emoji: "🦀",
    rarity: "COMMON",
    description:
      "にほんのかいがんのひがたにすむカニ。おすはかたほうのはさみがからだよりもおおきく、そのはさみをまるで「まねく」ようにふってめすにアピールするよ。にほんのなわらべうたにもなっているんだ。",
    habitat: "にほん・アジアのかいがん・ひがた",
    stageId: "forest",
    lifespanYears: 3,
  },
  {
    animalId: "crab_blue_swimmer",
    genericName: "カニ",
    specificName: "ガザミ",
    emoji: "🦀",
    rarity: "COMMON",
    description:
      "にほんのかいがんやアジアのうみにすむカニ。あとあしがひれのようにへんかしていて、うみをスイスイすいえいできる。おいしいカニとしてしょくようにもつかわれ、しゅんはあき。あおっぽいこうらがきれいだよ。",
    habitat: "にほん・アジアのあさいうみ・かいがん",
    stageId: "deep_sea",
    lifespanYears: 3,
  },
  // ── さるの なかまを あつめる（追加）──
  {
    animalId: "monkey_red_howler",
    genericName: "さる",
    specificName: "アカホエザル",
    emoji: "🐒",
    rarity: "RARE",
    description:
      "みなみアメリカのねったいうりんにすむ、あかっぽいちゃいろのサル。のどにおおきなこっかくがあり、そこをふるわせて「ガオーッ」というものすごいこえをだす。このこえは5キロさきまでとどくよ！",
    habitat: "みなみアメリカのねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "monkey_diana",
    genericName: "さる",
    specificName: "ダイアナモンキー",
    emoji: "🐒",
    rarity: "RARE",
    description:
      "にしアフリカのうりんにすむ、くろとしろのコントラストがきれいなサル。ほっぺがしろく、むねからおなかにかけてしろいもようがはいる。めがみ「ダイアナ」のゆみのかたちににているところからなまえがついたよ。",
    habitat: "にしアフリカのねったいうりん",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "monkey_golden_snub_nosed",
    genericName: "さる",
    specificName: "キンシコウ",
    emoji: "🐒",
    rarity: "EPIC",
    description:
      "ちゅうごくのさむいやまにすむ、きんいろのふさふさのけをもつサル。はなのあながてんをむいているのがとくちょう。さむいやまでくらすために、もふもふのけでからだをあたためるちえをもつ。ぜつめつきぐしゅだよ。",
    habitat: "ちゅうごくのやまがちのもり",
    stageId: "forest",
    lifespanYears: 25,
  },
  // ── さかなの なかまを あつめる（追加）──
  {
    animalId: "fish_red_lionfish",
    genericName: "さかな",
    specificName: "ミノカサゴ",
    emoji: "🐡",
    rarity: "RARE",
    description:
      "インドよう・たいへいようのさんごしょうにすむ、ひれがきれいなハネのようにひろがるさかな。このひれのとげにはどくがある！ゆっくりとおよぎてきをあまりこわがらないので、すいちゅうしゃしんにもよくうつる。",
    habitat: "インドよう・たいへいようのさんごしょう",
    stageId: "deep_sea",
    lifespanYears: 15,
  },
  {
    animalId: "fish_threadfin_butterflyfish",
    genericName: "さかな",
    specificName: "フウライチョウチョウウオ",
    emoji: "🐠",
    rarity: "RARE",
    description:
      "たいへいようやインドようのさんごしょうにすむ、きいろとしろのうつくしいもようのさかな。さんごをたべていきていて、ペアでなかよくよりそっておよぶすがたがよくみられるよ。さんごしょうのきれいさをあらわすさかなだ。",
    habitat: "インドよう・たいへいようのさんごしょう",
    stageId: "deep_sea",
    lifespanYears: 7,
  },
  {
    animalId: "fish_longtooth_grouper",
    genericName: "さかな",
    specificName: "クエ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "にほんのきゅうしゅうやおきなわのうみにすむおおきなさかな。ながさ1.5メートル・おもさ50キログラムをこえることも！「さかなの王様」とよばれ、おなべりょうりがたいへんおいしい。にんきがあってしぜんすうはへっているよ。",
    habitat: "にほん・アジアのがんしょたいのうみ",
    stageId: "deep_sea",
    lifespanYears: 50,
  },
  {
    animalId: "fish_weedy_seadragon",
    genericName: "さかな",
    specificName: "ウィーディーシードラゴン",
    emoji: "🐟",
    rarity: "EPIC",
    description:
      "オーストラリアのうみにすむ、からだじゅうにかいそうのようなひれがはえているふしぎなさかな。タツノオトシゴのなかまで、おすがたまごをおなかにつけてかえすよ。オーストラリアのけんのさかなでもあるんだ！",
    habitat: "オーストラリアのみなみかいがんのうみそう",
    stageId: "deep_sea",
    lifespanYears: 7,
  },
  {
    animalId: "fish_barreleye",
    genericName: "さかな",
    specificName: "デメニギス",
    emoji: "🐟",
    rarity: "EPIC",
    description:
      "ふかいうみにすむ、あたまがとうめい（すきとおっている）というふしぎなさかな。みどりいろのめだまがとうめいのあたまのなかでよくみえる。このめをじょうにむけて、うえからおちてくるたべものをまつんだよ！",
    habitat: "たいへいよう・ちゅういかいせんよりしんかいのうみ",
    stageId: "deep_sea",
    lifespanYears: 5,
  },
  // ── きょうりゅうの なかまを あつめる（追加）──
  {
    animalId: "dinosaur_nigersaurus",
    genericName: "きょうりゅう",
    specificName: "ニジェールサウルス",
    emoji: "🦕",
    rarity: "RARE",
    description:
      "アフリカのニジェールにすんでいたくびのながいしょくぶつしょくのきょうりゅう。くちのまえに500本いじょうのちいさなはがならんでいて、まるで「おそうじきのブラシ」みたいにくさをかりとってたべていたよ。",
    habitat: "ねったいアフリカのしっちたい（はくあきごろ）",
    stageId: "cretaceous",
    lifespanYears: 30,
    isExtinct: true,
  },
  {
    animalId: "dinosaur_baryonyx",
    genericName: "きょうりゅう",
    specificName: "バリオニクス",
    emoji: "🦕",
    rarity: "RARE",
    description:
      "イギリスなどでかせきがみつかった、さかなをしゅしょくにするにくしょくのきょうりゅう。まえあしにでかいかぎづめがあり、かわにはいってさかなをひっかけてとる。スピノサウルスとなかまのようなきょうりゅうだよ。",
    habitat: "にしヨーロッパのかわベやしっち（はくあき）",
    stageId: "cretaceous",
    lifespanYears: 30,
    isExtinct: true,
  },
  // ── サソリの なかまを あつめる ──
  {
    animalId: "scorpion_emperor",
    genericName: "サソリ",
    specificName: "テナガサソリ",
    emoji: "🦂",
    rarity: "RARE",
    description:
      "アフリカの ねったいりんに すむ、せかいさいだいきゅうの サソリ。たいちょうは20センチ いじょう！どくは よわくて ひとに きけんではないよ。くろくて ぴかぴかの からだが かっこいい。",
    habitat: "アフリカの ねったいりん",
    stageId: "forest",
    lifespanYears: 8,
  },
  {
    animalId: "scorpion_arizona_bark",
    genericName: "サソリ",
    specificName: "アリゾナバークサソリ",
    emoji: "🦂",
    rarity: "RARE",
    description:
      "アメリカの さばくに すむ、きたアメリカで いちばん どくが つよい サソリ。よるに こうどうして いわの したや きのかわの うらに かくれているよ。からだは こいちゃいろで ちいさめ。",
    habitat: "アメリカ・メキシコの さばく",
    stageId: "savanna",
    lifespanYears: 6,
  },
  // ── ワニの なかまを あつめる ──
  {
    animalId: "crocodile_gharial",
    genericName: "ワニ",
    specificName: "ガビアル",
    emoji: "🐊",
    rarity: "EPIC",
    description:
      "インドの かわに すむ、ほそながい くちばしが とくちょうの ワニ。くちばしには 100本いじょうの はが ならんでいて、さかなを ひっかけて たべるよ。オスの はなさきには たまごのような こぶが あるんだ。",
    habitat: "インドの おおきなかわ",
    stageId: "forest",
    lifespanYears: 60,
  },
  // ── カニの なかまを あつめる ──
  {
    animalId: "crab_snow",
    genericName: "カニ",
    specificName: "ズワイガニ",
    emoji: "🦀",
    rarity: "COMMON",
    description:
      "にほんかいの つめたい うみの そこに すむ カニ。あしが とても ながくて、ひろげると80センチ いじょうに なることも。ふゆは おいしい かにりょうりの ざいりょうとして しられているよ。",
    habitat: "にほんかいの しんかい",
    stageId: "deep_sea",
    lifespanYears: 14,
  },
  {
    animalId: "crab_king",
    genericName: "カニ",
    specificName: "タラバガニ",
    emoji: "🦀",
    rarity: "RARE",
    description:
      "アラスカや ほっかいどうの つめたい うみに すむ おおきな カニ。あしを ひろげると1メートルをこえることも！じつは カニより ヤドカリに ちかい なかまなんだって。",
    habitat: "きたの つめたい うみ",
    stageId: "deep_sea",
    lifespanYears: 25,
  },
  {
    animalId: "crab_mangrove",
    genericName: "カニ",
    specificName: "マングローブガニ",
    emoji: "🦀",
    rarity: "COMMON",
    description:
      "ねったいの マングローブりんの どろの なかに すむ カニ。はさみが とても つよくて、マングローブの きのみを わって たべるよ。よるに こうどうして かわの なかも じょうずに うごきまわる。",
    habitat: "ねったいの マングローブりん",
    stageId: "forest",
    lifespanYears: 5,
  },
  // ── チンチラの なかまを あつめる ──
  {
    animalId: "chinchilla_long_tailed",
    genericName: "チンチラ",
    specificName: "チンチラ",
    emoji: "🐭",
    rarity: "RARE",
    description:
      "みなみアメリカの アンデスさんみゃくに すむ ふわふわの けが とくちょうの げっ歯るい。その やわらかさは ねこの けの 30ばいとも いわれるよ。すずしい やまの うえに すんでいるんだ。",
    habitat: "アンデスさんみゃくの こうさん",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  // ── プレーリードッグの なかまを あつめる ──
  {
    animalId: "prairie_dog_black_tailed",
    genericName: "プレーリードッグ",
    specificName: "クロオビプレーリードッグ",
    emoji: "🐿️",
    rarity: "COMMON",
    description:
      "きたアメリカの くさはらに すむ、リスの なかまの どうぶつ。じめんに トンネルを ほって そうじゅんの まちを つくるよ。なかまに きけんを しらせる こえが「わん」と きこえることから この なまえに なった。",
    habitat: "きたアメリカの だいへいげん",
    stageId: "savanna",
    lifespanYears: 5,
  },
  // ── ツルの なかまを あつめる ──
  {
    animalId: "crane_white_naped",
    genericName: "ツル",
    specificName: "マナヅル",
    emoji: "🦢",
    rarity: "RARE",
    description:
      "にほんにも ふゆに やってくる うつくしい ツル。くびの うしろが しろくて、ほほが あかいのが めじるし。かごしまけんの いずみに まいとし1まんわ いじょう あつまることで ゆうめいだよ。",
    habitat: "ひがしアジアの しっち・そうげん",
    stageId: "savanna",
    lifespanYears: 30,
  },
  {
    animalId: "crane_siberian",
    genericName: "ツル",
    specificName: "ソデグロヅル",
    emoji: "🦢",
    rarity: "LEGENDARY",
    description:
      "まっしろな はねが うつくしい、せかいで いちばん きけつな ツルのひとつ。ロシアの シベリアで そだち、インドや ちゅうごくで ふゆを すごすよ。せかいぜんたいで 3000わ いないと いわれているんだ。",
    habitat: "シベリアの しっち・インドのこうすいち",
    stageId: "ice_age",
    lifespanYears: 60,
  },
  // ── エイの なかまを あつめる ──
  {
    animalId: "ray_sawfish",
    genericName: "エイ",
    specificName: "ノコギリエイ",
    emoji: "🐟",
    rarity: "EPIC",
    description:
      "くちさきから のこぎりのような ながい とっきが でていて、それで さかなを はたいて つかまえる。サメと エイの なかまで、いまは げきへりして せかいてきに ほごされているよ。",
    habitat: "ねったい・ねったいせいきの うみや かわ",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  // ── さかなの なかまを あつめる ──
  {
    animalId: "fish_porcupinefish",
    genericName: "さかな",
    specificName: "ハリセンボン",
    emoji: "🐡",
    rarity: "COMMON",
    description:
      "きけんを かんじると からだを ふくらませて まるくなり、とげを たてるさかな。「ハリセンボン」とよばれるが とげの かずは やく400ほんほどだよ。ないぞうに つよい どくを もっているんだ。",
    habitat: "ねったい・ねったいせいきの うみ",
    stageId: "deep_sea",
    lifespanYears: 12,
  },
  {
    animalId: "fish_coelacanth",
    genericName: "さかな",
    specificName: "シーラカンス",
    emoji: "🐟",
    rarity: "LEGENDARY",
    description:
      "6600まんねん まえの きょうりゅうじだいから すがたを かえていない「いきている かせき」。インドようの ふかいうみに すんでいて、1938ねんに ひとが はじめて みつけて せかいが おどろいた。",
    habitat: "インドようの しんかい",
    stageId: "deep_sea",
    lifespanYears: 60,
  },
  {
    animalId: "fish_chum_salmon",
    genericName: "さかな",
    specificName: "シロザケ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "にほんで いちばん よく とれる サケ。うまれた かわに もどってきて たまごを うむよ。うみで おおきく そだち、かわに もどるとき からだが あかと みどりの もように かわるんだ。",
    habitat: "きたたいへいようと にほんの かわ",
    stageId: "forest",
    lifespanYears: 5,
  },
  {
    animalId: "fish_sockeye_salmon",
    genericName: "さかな",
    specificName: "ベニザケ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "うみで そだつあいだは ぎんいろだが、かわに もどるとき からだが あかく はっきり かわる サケ。にくの いろが あざやかな あかいろで、とても えいようが ゆたかだよ。",
    habitat: "きたたいへいようと アラスカの かわ",
    stageId: "deep_sea",
    lifespanYears: 5,
  },
  {
    animalId: "fish_rainbow_trout",
    genericName: "さかな",
    specificName: "ニジマス",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "からだの よこに あざやかな にじいろの すじが はいっている きれいな さかな。もともとは きたアメリカの さかなで、いまは にほんの かわや ようしょくじょうで そだてられているよ。",
    habitat: "きたアメリカ・にほんの きれいな かわ",
    stageId: "forest",
    lifespanYears: 7,
  },
  {
    animalId: "fish_japanese_mackerel",
    genericName: "さかな",
    specificName: "マサバ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "にほんの うみで よく とれる、あおと くろの しまもようが きれいな さかな。さばの みそにや しめさばが ゆうめいだね。おおきな むれで うみを およぐよ。",
    habitat: "にほん・ちょうせんはんとうの うみ",
    stageId: "deep_sea",
    lifespanYears: 5,
  },
  {
    animalId: "fish_japanese_sardine",
    genericName: "さかな",
    specificName: "マイワシ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "にほんの うみで たくさん とれる、むれて およぐ さかな。おなかに くろいてんが ならんでいるのが めじるし。ちいさいけれど カルシウムや DHA など えいようが たっぷりなんだ。",
    habitat: "にほん・きたたいへいようの うみ",
    stageId: "deep_sea",
    lifespanYears: 5,
  },
  {
    animalId: "fish_red_sea_bream",
    genericName: "さかな",
    specificName: "マダイ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "あざやかな ピンクいろの からだが きれいな、にほんで めでたいさかなとして しられている さかな。「おめでたい」の「たい」として、おいわいの ときに よく つかわれるよ。",
    habitat: "にほん・ひがしシナかいの うみ",
    stageId: "deep_sea",
    lifespanYears: 30,
  },
  {
    animalId: "fish_japanese_seabass",
    genericName: "さかな",
    specificName: "スズキ",
    emoji: "🐟",
    rarity: "COMMON",
    description:
      "にほんの うみや かわぐちに すむ、からだが ぎんいろの さかな。こどものとき「セイゴ」、そだつと「フッコ」、おとなになると「スズキ」と よびかたが かわる「しゅっせうお」として しられているよ。",
    habitat: "にほんの うみ・かわぐち",
    stageId: "deep_sea",
    lifespanYears: 12,
  },
  // ── とりの なかまを あつめる ──
  {
    animalId: "bird_japanese_green_woodpecker",
    genericName: "とり",
    specificName: "アオゲラ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "にほんだけに すむ キツツキのなかま。みどりがかった からだと あかい ずきんが きれいなとり。コツコツと きに あなを あけて、ながい したで むしを つかまえて たべるよ。",
    habitat: "にほんの しりゅうりん",
    stageId: "forest",
    lifespanYears: 8,
  },
  {
    animalId: "bird_japanese_pygmy_woodpecker",
    genericName: "とり",
    specificName: "コゲラ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "にほんで いちばん ちいさい キツツキ。ちゃいろと しろの まだらもようで、スズメぐらいの おおきさ。まちなかの こうえんでも みられて、コッコッコと きを つつく おとが きこえるよ。",
    habitat: "にほんの りんや こうえん",
    stageId: "forest",
    lifespanYears: 6,
  },
  // ── ウミウシの なかまを あつめる ──
  {
    animalId: "nudibranch_spanish_dancer",
    genericName: "ウミウシ",
    specificName: "スペインダンサーウミウシ",
    emoji: "🌊",
    rarity: "RARE",
    description:
      "よるに うみを およぐとき、あかくて ひらひらした からだが フラメンコダンサーの スカートのように みえる ウミウシ。サンゴしょうに すんでいる からだ20センチいじょうの おおきなウミウシだよ。",
    habitat: "インドようから たいへいようの サンゴしょう",
    stageId: "deep_sea",
    lifespanYears: 1,
  },
  {
    animalId: "nudibranch_blue_glaucus",
    genericName: "ウミウシ",
    specificName: "アオミノウミウシ",
    emoji: "🌊",
    rarity: "RARE",
    description:
      "うみの ひょうめんを さかさまで ただよう、ちいさくて あざやかな あおと ぎんいろの ウミウシ。カツオノエボシなど どくを もつ いきものを たべて、その どくを じぶんの ぶきに するんだ。",
    habitat: "せかいじゅうの あたたかい うみ",
    stageId: "deep_sea",
    lifespanYears: 1,
  },
  // ── こうちゅうの なかまを あつめる ──
  {
    animalId: "beetle_diving_great",
    genericName: "こうちゅう",
    specificName: "ゲンゴロウ",
    emoji: "🪲",
    rarity: "RARE",
    description:
      "たんすいに すむ こうちゅうで、みずの なかを すいすい およぐ。にほんの むかしの たんぼや ため池に ふつうに いたが、いまは すくなくなっている。おなかに ためた くうきで みずに もぐるよ。",
    habitat: "にほんの ため池・たんぼ",
    stageId: "forest",
    lifespanYears: 3,
  },
  {
    animalId: "beetle_stag_saw",
    genericName: "くわがた",
    specificName: "ノコギリクワガタ",
    emoji: "🪲",
    rarity: "RARE",
    description:
      "おおきな あごが のこぎりのように でこぼこしている クワガタムシ。にほんの りんや こうえんに すんでいて、なつに よく みられるよ。オスどうしで あごを ぶつけて たたかうよ。",
    habitat: "にほんのりん・きゅうしゅうから ほっかいどう",
    stageId: "forest",
    lifespanYears: 3,
  },
  {
    animalId: "moth_atlas",
    genericName: "が",
    specificName: "ヨナグニサン",
    emoji: "🦋",
    rarity: "EPIC",
    description:
      "よなぐにじまなど にほんの なんせいしょとうに すむ、せかいさいだいきゅうの ガ。はねをひろげると30センチちかくにもなるよ！おとなに なると くちが なく、なにも たべずに いきているんだって。",
    habitat: "にほんのなんせいしょとうのりん",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── ほたるの なかまを あつめる ──
  {
    animalId: "firefly_heike",
    genericName: "ほたる",
    specificName: "ヘイケボタル",
    emoji: "✨",
    rarity: "COMMON",
    description:
      "たんぼや みぞに すむ ちいさな ほたる。ゲンジボタルより ちいさくて、よわい ひかりで ぴかぴかひかる。こどもは みずの なかで カタツムリを たべて そだつんだよ。",
    habitat: "にほんの たんぼ・みぞ",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── ハチの なかまを あつめる ──
  {
    animalId: "bee_japanese_honey",
    genericName: "ハチ",
    specificName: "ニホンミツバチ",
    emoji: "🐝",
    rarity: "COMMON",
    description:
      "にほんに もともと いる ミツバチ。スズメバチが きたとき、まわりを いっぱいの はちが かこんで ねつで やっつける「ねつだま」という わざが すごい！セイヨウミツバチより ちいさくて おとなしいよ。",
    habitat: "にほんのりん・くさはら",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── テナガザルの なかまを あつめる ──
  {
    animalId: "gibbon_bornean",
    genericName: "テナガザル",
    specificName: "ボルネオテナガザル",
    emoji: "🐒",
    rarity: "RARE",
    description:
      "ボルネオとうの りんに すむ テナガザル。きのえだを ながい うでで じゅうじざいに うごきまわる。あさに なると おとこが おおきな こえで なきごえを ひびかせて、なわばりを せんげんするよ。",
    habitat: "ボルネオとうのりん",
    stageId: "forest",
    lifespanYears: 45,
  },
  // ── へびの なかまを あつめる ──
  {
    animalId: "snake_paradise_flying",
    genericName: "へび",
    specificName: "ミドリトビヘビ",
    emoji: "🐍",
    rarity: "RARE",
    description:
      "とうなんアジアの りんに すむ ヘビ。きのうえから とびおりて、からだを たいらにして くうきを つかまえながら「そらをとぶ」ようにグライドするよ。10メートルいじょうとぶことも！",
    habitat: "とうなんアジアのりん",
    stageId: "forest",
    lifespanYears: 10,
  },
  // ── センザンコウの なかまを あつめる ──
  {
    animalId: "pangolin_sunda",
    genericName: "センザンコウ",
    specificName: "マレーセンザンコウ",
    emoji: "🦔",
    rarity: "EPIC",
    description:
      "とうなんアジアの りんに すむ センザンコウ。ウロコに おおわれた からだで まるまって みを まもる。せかいで いちばん みつりょうされている ほにゅうるいで、ぜつめつの きけんが あるよ。",
    habitat: "とうなんアジアのりん",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── イルカの なかまを あつめる ──
  {
    animalId: "dolphin_ganges",
    genericName: "イルカ",
    specificName: "ガンジスカワイルカ",
    emoji: "🐬",
    rarity: "LEGENDARY",
    description:
      "インドの ガンジスかわに すむ めが ほとんど みえない イルカ。よごれた かわの なかで ちょうおんぱだけを つかって さかなを さがすよ。にんげんの かつどうで いまは 2500とう いないとも いわれている。",
    habitat: "インドのガンジスかわ・ブラマプトラかわ",
    stageId: "forest",
    lifespanYears: 30,
  },
  // ── バクの なかまを あつめる ──
  {
    animalId: "tapir_mountain",
    genericName: "バク",
    specificName: "マウンテンバク",
    emoji: "🦏",
    rarity: "EPIC",
    description:
      "みなみアメリカの アンデスさんみゃくの こうちに すむ バク。ふかい むねと あつい けが さむい やまの きこうに あっている。きけつで ぜつめつのきけんに さらされているんだ。",
    habitat: "アンデスさんみゃくのこうさん（ペルー・コロンビア）",
    stageId: "ice_age",
    lifespanYears: 30,
  },
  // ── カバの なかまを あつめる ──
  {
    animalId: "hippo_pygmy",
    genericName: "カバ",
    specificName: "コビトカバ",
    emoji: "🦛",
    rarity: "EPIC",
    description:
      "にしアフリカの りんに すむ、ふつうの カバの10ぶんの1の おおきさしかない コビトカバ。よるに でてきて、りんの なかを ひとりで こうどうするよ。せかいに 2000とう いないと いわれているんだ。",
    habitat: "にしアフリカのりん（コートジボワールなど）",
    stageId: "forest",
    lifespanYears: 35,
  },
  // ── かわうその なかまを あつめる ──
  {
    animalId: "otter_african_clawless",
    genericName: "かわうそ",
    specificName: "ツメナシカワウソ",
    emoji: "🦦",
    rarity: "RARE",
    description:
      "アフリカに すむ、つめが ほとんどない カワウソ。ゆびが じゆうに うごくので、かにや カエルを じょうずに つかまえられる。アフリカで 2ばんめに おおきい カワウソだよ。",
    habitat: "アフリカの かわ・しっち",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── サイの なかまを あつめる ──
  {
    animalId: "rhino_javan",
    genericName: "サイ",
    specificName: "ジャワサイ",
    emoji: "🦏",
    rarity: "LEGENDARY",
    description:
      "インドネシアの ジャワとうだけに のこっている、せかいで いちばん きけつな おおがた どうぶつ。せかいで やく80とうしか いないんだって。かわの もようが よろいのように みえるよ。",
    habitat: "インドネシア・ジャワとうの りん",
    stageId: "forest",
    lifespanYears: 45,
  },
  // ── マーモットの なかまを あつめる ──
  {
    animalId: "marmot_alpine",
    genericName: "マーモット",
    specificName: "アルプスマーモット",
    emoji: "🐿️",
    rarity: "COMMON",
    description:
      "ヨーロッパの アルプスさんみゃくに すむ、おおきなリスの なかま。なかまが きけんを みつけると かんだかい こえで しらせるよ。ふゆは あなの なかで かぞくで かたまって ねむる、ながい とうみんを するんだ。",
    habitat: "ヨーロッパ・アルプスの こうさん",
    stageId: "ice_age",
    lifespanYears: 15,
  },
  // ── ザリガニの なかまを あつめる ──
  {
    animalId: "crayfish_american",
    genericName: "ザリガニ",
    specificName: "アメリカザリガニ",
    emoji: "🦞",
    rarity: "COMMON",
    description:
      "もともとは きたアメリカの さかなで、にほんのたんぼや かわでも よく みかけるようになった。あかいろのからだと おおきなはさみが とくちょう。こどもたちに ひもで つって あそばれることが おおいよ。",
    habitat: "きたアメリカ・にほんのたんぼや かわ",
    stageId: "forest",
    lifespanYears: 5,
  },
  // ── カエル・サンショウウオを もっと あつめる ──
  {
    animalId: "frog_african_bullfrog",
    genericName: "かえる",
    specificName: "アフリカウシガエル",
    emoji: "🐸",
    rarity: "RARE",
    description:
      "アフリカの サバンナに すむ、とても おおきな カエル。オスの からだは テニスボールより ずっと おおきく、1kgを こえることも！きけんを かんじると おおきな こえで「ウォー！」と なくよ。",
    habitat: "アフリカ南部の 草原・湿地",
    stageId: "savanna",
    lifespanYears: 35,
  },
  {
    animalId: "frog_wallaces_flying",
    genericName: "かえる",
    specificName: "ウォーレスタコアシガエル",
    emoji: "🐸",
    rarity: "RARE",
    description:
      "マレーシアや インドネシアの ジャングルに すむ カエル。4本の あしの あいだに おおきな みずかきが あり、木から 木へ グライダーのように とんで いどうするんだ。",
    habitat: "マレーシア・インドネシアの 熱帯雨林",
    stageId: "forest",
    lifespanYears: 10,
  },
  {
    animalId: "salamander_hellbender",
    genericName: "サンショウウオ",
    specificName: "ヘルベンダー",
    emoji: "🦎",
    rarity: "EPIC",
    description:
      "きたアメリカに すむ、せかいで 3ばんめに おおきい サンショウウオ。からだの ながさは 70cmにも なるよ。ひふで きゅうそくするから、きれいな 川の みずが ないと いきられないんだ。",
    habitat: "北アメリカ東部の 清流",
    stageId: "forest",
    lifespanYears: 30,
  },
  {
    animalId: "salamander_tiger",
    genericName: "サンショウウオ",
    specificName: "タイガーサラマンダー",
    emoji: "🦎",
    rarity: "COMMON",
    description:
      "きたアメリカに すむ おおがたの サンショウウオ。きいろと くろの しまもようが トラのように みえることから その なまえがついた。ちかの あなで せいかつするよ。",
    habitat: "北アメリカの 草原・森林",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── やまねこの なかまを あつめる ──
  {
    animalId: "cat_iberian_lynx",
    genericName: "やまねこ",
    specificName: "イベリアオオヤマネコ",
    emoji: "🐱",
    rarity: "LEGENDARY",
    description:
      "スペインと ポルトガルにだけ すむ、せかいで いちばん きけつな ネコ科の どうぶつ。ひとたびは 100とうを きるほど へったが、ほごかつどうで ふえてきているよ。ウサギが おもな えさだよ。",
    habitat: "スペイン・ポルトガルの 低木林",
    stageId: "forest",
    lifespanYears: 13,
  },
  {
    animalId: "cat_jaguarundi",
    genericName: "やまねこ",
    specificName: "ジャガランディ",
    emoji: "🐱",
    rarity: "RARE",
    description:
      "ちゅうおう・みなみアメリカに すむ こがたの ヤマネコ。からだが ほそながく イタチに にた すがた。あかむらさきや はいいろなど かわいらしい みかけだが すばやく えものを おえるよ。",
    habitat: "中南米の 草原・低木林",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "cat_rusty_spotted",
    genericName: "やまねこ",
    specificName: "サビイロネコ",
    emoji: "🐱",
    rarity: "EPIC",
    description:
      "スリランカや インドに すむ、せかいで もっとも ちいさい ヤマネコ。からだのながさは 45cmほどで、いえネコより ずっと ちいさい。ちいさいのに すばやく きのぼりが とくいだよ。",
    habitat: "スリランカ・インドの 草原・低木林",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── ふくろうの なかまを もっと あつめる ──
  {
    animalId: "owl_long_eared",
    genericName: "ふくろう",
    specificName: "トラフズク",
    emoji: "🦉",
    rarity: "COMMON",
    description:
      "ユーラシアと きたアメリカに すむ ちゅうがたの フクロウ。あたまに ながい ミミばねが あり、トラのような しまもようが からだにあるのが とくちょう。ちいさな ねずみを おもに たべるよ。",
    habitat: "ユーラシア・北アメリカの 森林・草原",
    stageId: "forest",
    lifespanYears: 12,
  },
  {
    animalId: "owl_short_eared",
    genericName: "ふくろう",
    specificName: "コミミズク",
    emoji: "🦉",
    rarity: "COMMON",
    description:
      "ほぼ 世界中に すむ フクロウ。ひるまも かつどうし、ひろい そうげんを ていくうひこうして ねずみを さがす。ミミばねが ほとんど みえないほど みじかいのが なまえの ゆらいだよ。",
    habitat: "世界の 草原・湿地",
    stageId: "savanna",
    lifespanYears: 12,
  },
  // ── たかの なかまを もっと あつめる ──
  {
    animalId: "hawk_merlin",
    genericName: "たか",
    specificName: "コチョウゲンボウ",
    emoji: "🦅",
    rarity: "COMMON",
    description:
      "きたアメリカや ユーラシアに すむ ちいさな ハヤブサ。コウモリや ツバメも おそうほど すばやい ひこうぎじゅつを もつよ。なまえの「マーリン」は アーサーおうの まほうつかいと おなじだよ。",
    habitat: "北アメリカ・ユーラシアの 草原・北方林",
    stageId: "forest",
    lifespanYears: 13,
  },
  {
    animalId: "hawk_eurasian_sparrowhawk",
    genericName: "たか",
    specificName: "ハイタカ",
    emoji: "🦅",
    rarity: "COMMON",
    description:
      "ヨーロッパや アジアに すむ こがたの タカ。すばやい たいあたりで ことりを つかまえる。メスは オスより ずっと おおきく、2ばいくらい おもいことも あるよ。",
    habitat: "ユーラシアの 森林・農地",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── おうむの なかまを もっと あつめる ──
  {
    animalId: "parrot_eclectus",
    genericName: "おうむ",
    specificName: "エクレクタスインコ",
    emoji: "🦜",
    rarity: "RARE",
    description:
      "ニューギニアや オーストラリアに すむ インコ。オスは みどりいろ、メスは あかと あおむらさきと まったく ちがう いろで、かつては べつの しゅだと おもわれていたほどだよ。",
    habitat: "ニューギニア・オーストラリアの 熱帯雨林",
    stageId: "forest",
    lifespanYears: 30,
  },
  {
    animalId: "parrot_palm_cockatoo",
    genericName: "おうむ",
    specificName: "ヤシオウム",
    emoji: "🦜",
    rarity: "EPIC",
    description:
      "オーストラリア北部と ニューギニアに すむ おおがたの オウム。まっくろな はねと おおきな とさかが とくちょう。なんと えだを つかって たいこのように じめんを たたく、とくいわざを もつよ。",
    habitat: "オーストラリア・ニューギニアの 熱帯雨林",
    stageId: "forest",
    lifespanYears: 60,
  },
  // ── いるかの なかまを もっと あつめる ──
  {
    animalId: "dolphin_striped",
    genericName: "いるか",
    specificName: "シマイルカ",
    emoji: "🐬",
    rarity: "COMMON",
    description:
      "ちちゅうかいや たいへいように すむ、あざやかな しまもようの イルカ。むれで ダイナミックな ジャンプをする。からだの よこに あおと しろの きれいな しまが はいっているよ。",
    habitat: "地中海・太平洋の 外洋",
    stageId: "deep_sea",
    lifespanYears: 55,
  },
  // ── オランウータンの なかまを あつめる ──
  {
    animalId: "orangutan_sumatran",
    genericName: "オランウータン",
    specificName: "スマトラオランウータン",
    emoji: "🦧",
    rarity: "EPIC",
    description:
      "インドネシアの スマトラとうにだけ すむ オランウータン。ボルネオオランウータンより かみの毛が ながく かおに しわが おおい。ほぼ じゅじょう せいかつを するよ。",
    habitat: "インドネシア・スマトラ島の 熱帯雨林",
    stageId: "forest",
    lifespanYears: 45,
  },
  // ── さるの なかまを もっと あつめる ──
  {
    animalId: "monkey_guereza",
    genericName: "さる",
    specificName: "ゲレザ",
    emoji: "🐒",
    rarity: "RARE",
    description:
      "アフリカに すむ しろと くろの あざやかな もようの サル。ながい しろい しっぽが まるで マントのよう。きのはが おもなえさで、はっこうした いを もつので かたい はっぱでも こなせるよ。",
    habitat: "アフリカ中部・東部の 森林",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── キツネザルの なかまを あつめる ──
  {
    animalId: "lemur_indri",
    genericName: "キツネザル",
    specificName: "インドリ",
    emoji: "🐒",
    rarity: "EPIC",
    description:
      "マダガスカルに すむ もっとも おおきな キツネザル。しっぽが ほとんどなく、その こえは 4km さきまで とどく。現地では「もりの かみさま」として ありがたがられているよ。",
    habitat: "マダガスカルの 雨林",
    stageId: "forest",
    lifespanYears: 15,
  },
  {
    animalId: "lemur_black_white_ruffed",
    genericName: "キツネザル",
    specificName: "エリマキキツネザル",
    emoji: "🐒",
    rarity: "EPIC",
    description:
      "マダガスカルにだけ すむ、しろと くろの まだらもようの キツネザル。くびまわりに ふさふさの しろい えりまきのような けが あるのが とくちょう。かじつや はなみつが すきだよ。",
    habitat: "マダガスカルの 熱帯雨林",
    stageId: "forest",
    lifespanYears: 20,
  },
  // ── とりの なかまを もっと あつめる ──
  {
    animalId: "bird_spoonbill_roseate",
    genericName: "とり",
    specificName: "バラいろヘラサギ",
    emoji: "🦩",
    rarity: "RARE",
    description:
      "アメリカ大陸に すむ、ピンクいろの はねが うつくしい とり。くちばしの さきが スプーンのように ひろがっていて、みずの なかを ゆっくり ふり えさを さがすよ。フラミンゴと まちがえられることがあるよ。",
    habitat: "南北アメリカの 湿地・沿岸",
    stageId: "savanna",
    lifespanYears: 15,
  },
  {
    animalId: "bird_bee_eater_european",
    genericName: "とり",
    specificName: "ヨーロッパハチクイ",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "ヨーロッパから アフリカに すむ、あざやかな たくさんの いろを もつ とり。ハチや アブを つかまえ、たべる まえに どくばりを いわに たたきつけて とるんだ。",
    habitat: "ヨーロッパ・アフリカの 草原・崖",
    stageId: "savanna",
    lifespanYears: 10,
  },
  {
    animalId: "bird_scarlet_ibis",
    genericName: "とき",
    specificName: "ショウジョウトキ",
    emoji: "🦩",
    rarity: "RARE",
    description:
      "みなみアメリカや カリブかいに すむ まっかな からだの トキ。その あかいろは えさの こうかくるいに ふくまれる いろそで うまれる。むれで いっせいに とぶ すがたが うつくしいよ。",
    habitat: "南アメリカ・カリブ海の 湿地・沿岸",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "bird_malachite_sunbird",
    genericName: "とり",
    specificName: "マラカイトタイヨウチョウ",
    emoji: "🐦",
    rarity: "RARE",
    description:
      "アフリカに すむ、みどりいろに きらきら ひかる はねを もつ ちいさな とり。オスは とても ながい 2ほんの おうばねを もつ。はなのみつが だいすきで、くちばしで はなを ついばむよ。",
    habitat: "アフリカ南部・東部の 草原・高地",
    stageId: "savanna",
    lifespanYears: 5,
  },
  {
    animalId: "bird_african_jacana",
    genericName: "とり",
    specificName: "アフリカレンカク",
    emoji: "🐦",
    rarity: "COMMON",
    description:
      "アフリカの 水べに すむ とり。あしゆびが とても ながく、スイレンの うえを あるける「みずの うえを あるく とり」。オスが たまごを あたため ひなを そだてる めずらしい とりだよ。",
    habitat: "アフリカの 湖沼・湿地",
    stageId: "savanna",
    lifespanYears: 10,
  },
  {
    animalId: "bird_kori_bustard",
    genericName: "とり",
    specificName: "オオノガン",
    emoji: "🦆",
    rarity: "RARE",
    description:
      "アフリカの サバンナに すむ、とべる とりのなかで せかい さいだいきゅうの おもさを もつ とり。オスは 19kgをこえることも！なわばりを まもるとき くびを ふくらませて りっぱな かみかざりを みせる。",
    habitat: "アフリカ東部・南部の 草原",
    stageId: "savanna",
    lifespanYears: 30,
  },
  {
    animalId: "bird_raggiana",
    genericName: "ふうちょう",
    specificName: "ラギアナフウチョウ",
    emoji: "🐦",
    rarity: "EPIC",
    description:
      "ニューギニアに すむ、あざやかな あかとき いろの フウチョウ。オスは もりの なかで えだに とまり、おおきな こえで なきながら かがやく はねを ひろげて メスに アピールする ダンスをするよ。",
    habitat: "ニューギニアの 熱帯雨林",
    stageId: "forest",
    lifespanYears: 15,
  },
  // ── とかげの なかまを もっと あつめる ──
  {
    animalId: "lizard_uromastyx",
    genericName: "とかげ",
    specificName: "ウロマスティクス",
    emoji: "🦎",
    rarity: "RARE",
    description:
      "アフリカや ちゅうとうの さばくに すむ、しっぽに とげが ならんだ トカゲ。ほとんど しょくぶつ食で、かんそうした はっぱや たねを たべる。きけんを かんじると しっぽで てきを たたくよ。",
    habitat: "北アフリカ・中東の 砂漠",
    stageId: "savanna",
    lifespanYears: 20,
  },
  {
    animalId: "lizard_bearded_dragon",
    genericName: "とかげ",
    specificName: "フトアゴヒゲトカゲ",
    emoji: "🦎",
    rarity: "COMMON",
    description:
      "オーストラリアの かんそうした ちほうに すむ、ひとなつっこい トカゲ。あごのしたに ひげのような とがったうろこがあり、きけんを かんじると くびを ふくらませて まっくろに かえる。",
    habitat: "オーストラリアの 乾燥地・砂漠",
    stageId: "savanna",
    lifespanYears: 15,
  },
  // ── へびの なかまを もっと あつめる ──
  {
    animalId: "snake_kingsnake_california",
    genericName: "へび",
    specificName: "カリフォルニアキングスネーク",
    emoji: "🐍",
    rarity: "COMMON",
    description:
      "きたアメリカに すむ くろと しろの しまもようの ヘビ。「キング」の なまえのとおり、ほかの どくへびも たべる。ガラガラヘビの どくにも つよい めんえきを もつよ。",
    habitat: "北アメリカ西部の 草原・低木林",
    stageId: "forest",
    lifespanYears: 20,
  },
  {
    animalId: "snake_cottonmouth",
    genericName: "へび",
    specificName: "コットンマウス",
    emoji: "🐍",
    rarity: "RARE",
    description:
      "きたアメリカの みずべに すむ どくへびのなかま。みずにはいることが とくいで、かわや ぬまに すむ。きけんを かんじると くちを おおきくあけ しろい うちがわを みせて おどかすよ。",
    habitat: "北アメリカ南東部の 水辺・沼地",
    stageId: "forest",
    lifespanYears: 25,
  },
  {
    animalId: "snake_hognose_eastern",
    genericName: "へび",
    specificName: "ヒガシホグノーズスネーク",
    emoji: "🐍",
    rarity: "COMMON",
    description:
      "きたアメリカに すむ、くちさきが ブタのように そりかえったふしぎな ヘビ。きけんを かんじると しんだふりをして ひっくりかえり、くさいにおいを だして てきを おどかす とくわざを もつよ。",
    habitat: "北アメリカ東部の 森林・草原",
    stageId: "forest",
    lifespanYears: 12,
  },
  // ── さかなの なかまを もっと あつめる ──
  {
    animalId: "fish_alligator_gar",
    genericName: "さかな",
    specificName: "アリゲーターガー",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "きたアメリカの かわに すむ、ながさ 3mにも なる きょだいな さかな。ワニのような ながい くちに するどい きばが ならんでいることから その なまえがついた。2おくねんまえから すがたが かわっていないよ。",
    habitat: "北アメリカ南部の 大型河川・湖",
    stageId: "forest",
    lifespanYears: 50,
  },
  {
    animalId: "fish_bichir_senegal",
    genericName: "さかな",
    specificName: "セネガルビキール",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "アフリカの かわに すむ、きょりゅうのような すがたの さかな。うきぶくろで くうきこきゅうが でき、りくを はって いどうも できる。3おくねんいじょうも すがたが かわっていない「いきた かせき」だよ。",
    habitat: "西アフリカ・ナイル川の 河川",
    stageId: "savanna",
    lifespanYears: 30,
  },
  {
    animalId: "fish_atlantic_wolffish",
    genericName: "さかな",
    specificName: "オオカミウオ",
    emoji: "🐟",
    rarity: "RARE",
    description:
      "きたたいせいようの つめたい うみの そこに すむ さかな。おおきな くちに どうぶつのような するどい きばが たくさん ならんでいる。このきばで かたい かいがらや うにまで たべてしまうよ。",
    habitat: "北大西洋の 冷たい海底",
    stageId: "deep_sea",
    lifespanYears: 20,
  },
  // ── こうちゅうの なかまを もっと あつめる ──
  {
    animalId: "beetle_atlas_beetle",
    genericName: "こうちゅう",
    specificName: "アトラスオオカブト",
    emoji: "🪲",
    rarity: "RARE",
    description:
      "東南アジアに すむ おおがたの カブトムシ。オスには 3ほんの つのが あり、みきのしるを めぐって ほかのオスと たたかう。ヘラクレスオオカブトと ならぶ だいにんきの カブトムシだよ。",
    habitat: "東南アジアの 熱帯雨林",
    stageId: "forest",
    lifespanYears: 1,
  },
  {
    animalId: "insect_titan_beetle",
    genericName: "こうちゅう",
    specificName: "タイタンオオウスバカミキリ",
    emoji: "🪲",
    rarity: "EPIC",
    description:
      "みなみアメリカの アマゾンに すむ、せかい さいだいきゅうの カミキリムシ。からだのながさが 17cmにも なることがある。あごの 力が とても つよく、えんぴつを かみきれるほどだよ。",
    habitat: "南アメリカ・アマゾンの 熱帯雨林",
    stageId: "forest",
    lifespanYears: 1,
  },
  // ── アンテロープの なかまを もっと あつめる ──
  {
    animalId: "antelope_blesbok",
    genericName: "アンテロープ",
    specificName: "ブレスボック",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "みなみアフリカに すむ、ひたいに しろい もようがある アンテロープ。かつては かすうが へったが ほごかつどうで かいふくした。のばなが とくいで むれを つくって くらすよ。",
    habitat: "南アフリカの 草原",
    stageId: "savanna",
    lifespanYears: 17,
  },
  {
    animalId: "antelope_blackbuck",
    genericName: "アンテロープ",
    specificName: "ブラックバック",
    emoji: "🦌",
    rarity: "RARE",
    description:
      "インドの そうげんに すむ、オスが こいちゃいろ と しろの ツートーンの アンテロープ。75km/hで はしれる きゅうそくのもちぬし。インドでは しんせいな どうぶつとして まもられているよ。",
    habitat: "インド・パキスタンの 草原",
    stageId: "savanna",
    lifespanYears: 16,
  },
  {
    animalId: "antelope_dik_dik",
    genericName: "アンテロープ",
    specificName: "ディクディク",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "アフリカに すむ、てのひらサイズの とても ちいさな アンテロープ。きけんを かんじると「ディック！ディック！」と なくことから その なまえがついた。つがいで なわばりを まもって くらすよ。",
    habitat: "アフリカ東部・南部の 低木林",
    stageId: "savanna",
    lifespanYears: 10,
  },
  // ── しかの なかまを もっと あつめる ──
  {
    animalId: "deer_wapiti",
    genericName: "しか",
    specificName: "ワピチ",
    emoji: "🦌",
    rarity: "COMMON",
    description:
      "きたアメリカや アジアに すむ おおがたのシカ。オスの つのは 1.5mにも なり、こうびきに「ブィーン！」という おおきな こえで なく。さむい ふゆには むれで ひなんするよ。",
    habitat: "北アメリカ・中央アジアの 森林・草原",
    stageId: "forest",
    lifespanYears: 20,
  },
];
// （ここまでで 607 種 / 目標 1000 種）
