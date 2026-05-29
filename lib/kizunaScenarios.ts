// lib/kizunaScenarios.ts
// ─────────────────────────────────────────────────────────────────────────────
// 「おたがいさま」イベントのシナリオ・プール
//
// 設計方針（Notion「助ける」より）:
//   - 助ける選択肢は たくさん。アイテムが無くても 善意で 助けられる。
//   - 見返りを ほのめかさない（「何かあるかも」は出さない）。
//   - お返しは「恩着せがましくない」＝ おたがいさま の対等なトーンで。
//
// ASK   … だれかが こまっている。プレイヤーは善意で手助けする。
// RETURN … 以前 助けた おかげで、だれかが さりげなく 手を貸してくれる。
// ─────────────────────────────────────────────────────────────────────────────

export interface KizunaAsk {
  id: string;
  /** 立ち絵の絵文字 */
  emoji: string;
  /** 名前プレート */
  name: string;
  /** プレート／枠の色 */
  color: string;
  /** こまっている人のセリフ（\n で改行） */
  plea: string;
  /** 手助けボタンのラベル */
  action: string;
  /** 手助けしたあとの お礼（純粋な善意・見返りを匂わせない） */
  thanks: string;
}

export interface KizunaReturn {
  id: string;
  emoji: string;
  name: string;
  color: string;
  /** 登場のあいさつ */
  arrive: string;
  /** さりげなく手伝ってくれる内容（おたがいさま・恩着せがましくない） */
  deed: string;
}

// ─── お願い（ASK）：すべて アイテム不要。タップひとつで 善意で 助けられる ──────
export const KIZUNA_ASKS: KizunaAsk[] = [
  {
    id: "grandma-bag",
    emoji: "👵",
    name: "おばあちゃん",
    color: "#e8c87a",
    plea: "にもつが おもくてね…\nそこまで はこぶのを\nてつだって くれないかい？",
    action: "🤲 にもつを はこぶ",
    thanks: "ありがとう！\nたすかったよ、いい子だねぇ。",
  },
  {
    id: "lost-child",
    emoji: "🧒",
    name: "まいごの子",
    color: "#8ad0e8",
    plea: "ママと はぐれちゃった…\nいっしょに さがすの\nてつだって くれる？",
    action: "🙋 いっしょに さがす",
    thanks: "ママ みつかった！\nきみの おかげだよ、ありがとう！",
  },
  {
    id: "kitten-tree",
    emoji: "🐈",
    name: "こねこ",
    color: "#f0b6c8",
    plea: "（き の うえで\nおりられず ないている…）\nたすけて あげる？",
    action: "🐾 そっと おろす",
    thanks: "ニャー♪\nこねこは うれしそうに\nすりよってきた。",
  },
  {
    id: "grandpa-bench",
    emoji: "👴",
    name: "おじいさん",
    color: "#c8b89a",
    plea: "ベンチまで あるくのに\nちょっと てを かして\nもらえるかのう？",
    action: "🤝 てを かす",
    thanks: "おお、ありがとう。\nやさしい子じゃのう。",
  },
  {
    id: "bird-nest",
    emoji: "🐦",
    name: "ことり",
    color: "#9ad0a0",
    plea: "（ひな が す から\nおちてしまった…）\nもどして あげる？",
    action: "🪶 すに もどす",
    thanks: "チチチッ♪\nおやどり が とんできて\nおれいに さえずった。",
  },
  {
    id: "farmer-water",
    emoji: "🧑‍🌾",
    name: "となりの のうかさん",
    color: "#b6d98a",
    plea: "みずやりが おわらなくて\nこまってるんだ。\nちょっと てつだって くれる？",
    action: "💧 みずやりを てつだう",
    thanks: "はやく おわった！\nありがとう、おかげで\nひとやすみ できるよ。",
  },
  {
    id: "kid-toy",
    emoji: "🧎",
    name: "ちいさい子",
    color: "#e8b8e0",
    plea: "おもちゃが みぞに\nおっこちちゃった…\nとって くれる？",
    action: "✋ ひろって あげる",
    thanks: "わーい！\nありがとう、おにいちゃん／おねえちゃん！",
  },
];

// ─── お返し（RETURN）：以前 助けた おかげで、さりげなく 手を貸してくれる ────────
// すべて「おたがいさま」の対等なトーン。恩着せがましくしない。
export const KIZUNA_RETURNS: KizunaReturn[] = [
  {
    id: "carpenter",
    emoji: "👨‍🔧",
    name: "だいくの さぶろう",
    color: "#7ab8e8",
    arrive: "やあ！ とおりかかったから\nちょっと よってみたよ。",
    deed: "さくが ゆるんでたから\nなおしといたよ。\nこまった ときは おたがいさま！🔨",
  },
  {
    id: "neighbor",
    emoji: "🧑‍🌾",
    name: "となりの のうかさん",
    color: "#b6d98a",
    arrive: "おーい、げんき にしてた？\nちょうど みずやり ついでさ。",
    deed: "きみの ぶんも みず やっといたよ。\nきにしないで、おたがいさまだろ？💧",
  },
  {
    id: "granddaughter",
    emoji: "👧",
    name: "おばあちゃんの まご",
    color: "#f0b6c8",
    arrive: "おばあちゃんが\nよろしく って いってたよ！",
    deed: "おすそわけ もってきた。\nいっしょに はこぶの てつだうね。\nまた こまったら いってね😊",
  },
  {
    id: "mailcat",
    emoji: "🐈",
    name: "あのときの こねこ",
    color: "#f0b6c8",
    arrive: "ニャー！\n（おおきく なって もどってきた）",
    deed: "おもい にもつ、いっしょに\nひっぱって くれたよ。\nもう ひとり じゃ ないね🐾",
  },
  {
    id: "birdfriend",
    emoji: "🐦",
    name: "ことりの むれ",
    color: "#9ad0a0",
    arrive: "チチチッ♪\n（なかまを つれて とんできた）",
    deed: "たかい ところの みを\nつついて おとして くれた。\nおたがいさま だね🪶",
  },
  {
    id: "kidgrown",
    emoji: "🧒",
    name: "あのときの 子",
    color: "#8ad0e8",
    arrive: "みつけた！\nまえに たすけて くれた人だ！",
    deed: "こんどは ぼくが てつだう ばん！\nいっしょに やろう、おたがいさま！🤝",
  },
];

// ─── ランダム選択ヘルパー ────────────────────────────────────────────────────
export function pickAsk(): KizunaAsk {
  return KIZUNA_ASKS[Math.floor(Math.random() * KIZUNA_ASKS.length)];
}

export function pickReturn(): KizunaReturn {
  return KIZUNA_RETURNS[Math.floor(Math.random() * KIZUNA_RETURNS.length)];
}
