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
];
// （ここまでで 100 種 / 目標 100 種）
