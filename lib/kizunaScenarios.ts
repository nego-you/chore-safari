// lib/kizunaScenarios.ts
// ─────────────────────────────────────────────────────────────────────────────
// 「おたがいさま」イベントのシナリオ・プール
//
// ASK   … だれかが こまっている。プレイヤーは 3つの選択肢（やさしい／ふつう／いじわる）で答える。
//         → 相手の顔（嬉しい・ふつう・かなしい）と反応が変わり、やさしい選択のときだけ
//           「恩返し（お返し）」がたまる。
// RETURN … 以前 やさしくした おかげで、だれかが さりげなく 手を貸してくれる。
// ─────────────────────────────────────────────────────────────────────────────

export type KizunaChoiceKind = "kind" | "normal" | "mean";

export interface KizunaChoice {
  /** ボタンのラベル */
  label: string;
  /** 選んだ後の相手のセリフ */
  reaction: string;
}

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
  /** 3つの選択肢 */
  kind: KizunaChoice;
  normal: KizunaChoice;
  mean: KizunaChoice;
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

// ─── 選択の結果メタ：顔・トーン・恩返しの有無・善行ポイント ──────────────────
export const KIZUNA_CHOICE_META: Record<
  KizunaChoiceKind,
  {
    /** 選んだ後に立ち絵に重ねる「顔」 */
    face: string;
    tone: "happy" | "normal" | "sad";
    /** この選択で「お返し」がたまるか（やさしい時だけ true） */
    grantReturn: boolean;
    /** 善行ポイントの増分 */
    points: number;
    /** 結果バナーの一言 */
    note: string;
  }
> = {
  kind:   { face: "😊", tone: "happy",  grantReturn: true,  points: 10, note: "やさしくすると こころが あったかく なるね 💚" },
  normal: { face: "🙂", tone: "normal", grantReturn: false, points: 3,  note: "ちょっとの しんせつも うれしいね 🙂" },
  mean:   { face: "😢", tone: "sad",    grantReturn: false, points: 0,  note: "つぎは やさしく できると いいね…" },
};

// ─── お願い（ASK）：3択（やさしい／ふつう／いじわる）───────────────────────────
export const KIZUNA_ASKS: KizunaAsk[] = [
  {
    id: "grandma-bag",
    emoji: "👵",
    name: "おばあちゃん",
    color: "#e8c87a",
    plea: "にもつが おもくてね…\nそこまで はこぶのを\nてつだって くれないかい？",
    kind:   { label: "🤲 ぜんぶ はこんで あげる", reaction: "ありがとう！\nたすかったよ、いい子だねぇ。" },
    normal: { label: "🙂 ちょっとだけ もつ",       reaction: "ありがとうね。\nすこし らくに なったよ。" },
    mean:   { label: "🙅 むしして とおる",         reaction: "そう…。\nしょんぼり して しまった…" },
  },
  {
    id: "lost-child",
    emoji: "🧒",
    name: "まいごの子",
    color: "#8ad0e8",
    plea: "ママと はぐれちゃった…\nいっしょに さがすの\nてつだって くれる？",
    kind:   { label: "🙋 いっしょに さがす",   reaction: "ママ みつかった！\nきみの おかげだよ、ありがとう！" },
    normal: { label: "🙂 ばしょを おしえる",   reaction: "うん、いってみる。\nありがとう。" },
    mean:   { label: "🙅 しらんぷり する",     reaction: "…ひとりで さがすね。\nなきそうな かおを している…" },
  },
  {
    id: "kitten-tree",
    emoji: "🐈",
    name: "こねこ",
    color: "#f0b6c8",
    plea: "（き の うえで\nおりられず ないている…）\nたすけて あげる？",
    kind:   { label: "🐾 そっと おろす",     reaction: "ニャー♪\nこねこは うれしそうに\nすりよってきた。" },
    normal: { label: "🙂 したで みまもる",   reaction: "ニャ…\nなんとか じぶんで おりてきた。" },
    mean:   { label: "🙅 そのまま いく",     reaction: "ニャーン…\nこねこは さみしそう…" },
  },
  {
    id: "grandpa-bench",
    emoji: "👴",
    name: "おじいさん",
    color: "#c8b89a",
    plea: "ベンチまで あるくのに\nちょっと てを かして\nもらえるかのう？",
    kind:   { label: "🤝 てを かす",         reaction: "おお、ありがとう。\nやさしい子じゃのう。" },
    normal: { label: "🙂 ペースを あわせる", reaction: "うむ、たすかるよ。\nありがとうな。" },
    mean:   { label: "🙅 さきに いく",       reaction: "…そうか。\nさみしそうに ためいき。" },
  },
  {
    id: "bird-nest",
    emoji: "🐦",
    name: "ことり",
    color: "#9ad0a0",
    plea: "（ひな が す から\nおちてしまった…）\nもどして あげる？",
    kind:   { label: "🪶 すに もどす",       reaction: "チチチッ♪\nおやどり が とんできて\nおれいに さえずった。" },
    normal: { label: "🙂 おやどりを よぶ",   reaction: "チチ…\nおやどりが きて くれた。" },
    mean:   { label: "🙅 みなかった ことに", reaction: "ピヨ…\nひなが ふるえて いる…" },
  },
  {
    id: "farmer-water",
    emoji: "🧑‍🌾",
    name: "となりの のうかさん",
    color: "#b6d98a",
    plea: "みずやりが おわらなくて\nこまってるんだ。\nちょっと てつだって くれる？",
    kind:   { label: "💧 みずやりを てつだう", reaction: "はやく おわった！\nありがとう、おかげで\nひとやすみ できるよ。" },
    normal: { label: "🙂 はんぶん てつだう",   reaction: "たすかるよ、ありがとう。" },
    mean:   { label: "🙅 ことわる",            reaction: "そうか…。\nがっかり した みたい…" },
  },
  {
    id: "kid-toy",
    emoji: "🧎",
    name: "ちいさい子",
    color: "#e8b8e0",
    plea: "おもちゃが みぞに\nおっこちちゃった…\nとって くれる？",
    kind:   { label: "✋ ひろって あげる",     reaction: "わーい！\nありがとう、おにいちゃん／おねえちゃん！" },
    normal: { label: "🙂 とりかたを おしえる", reaction: "じぶんで とれた！\nありがとう。" },
    mean:   { label: "🙅 むしする",            reaction: "…ぐすん。\nかなしそう だ…" },
  },
];

// ─── お返し（RETURN）：以前 やさしくした おかげで、さりげなく 手を貸してくれる ───
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
