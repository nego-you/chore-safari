// POST /api/race/generate
// ローカルOllamaを叩いて30秒カオスレースのシナリオ（JSON）を生成して返す。
// Ollamaが落ちているかJSONパースに失敗した場合はフォールバックシナリオを返す。

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OLLAMA_URL =
  process.env.OLLAMA_URL ?? "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3";

// ─── Ollamaに渡すプロンプト ───────────────────────────────────
const SYSTEM_PROMPT = `みこと、ゆきと、かなたの3人が参加する30秒間のサバイバル動物レースの台本を作成して。
「相手を丸呑みするが吐き出される」「途中で昼寝する」「UFOに攫われる」「隕石が降ってくる」「タイムスリップする」「巨大化する」「縮小する」「テレポートする」などのカオスなイレギュラー展開を必ず3つ以上含めること。
勝者は毎回ランダムに変わること。同じシナリオを繰り返さないこと。
出力は必ず以下のJSONフォーマットのみとすること。日本語で書くこと。余計な説明文・コードブロック・マークダウン記法は一切書かないこと。

{"winner":"名前","events":[{"time":秒数,"character":"対象者名またはall","action":"pause|speed_up|speed_down|chaotic|finish","message":"実況テキスト"}]}

eventsは8〜12件含めること。timeは0〜30の整数。最後のイベントはtime:30でaction:finishとすること。`;

// ─── フォールバック（Ollamaが落ちている場合） ────────────────

const FALLBACK_POOL = [
  {
    winner: "かなた",
    events: [
      { time: 0, character: "all", action: "speed_up", message: "🔥 スタートダッシュ！みこと・ゆきと・かなた、3人が砂煙を上げて飛び出したぁーーー！！" },
      { time: 4, character: "みこと", action: "chaotic", message: "😱 みこと！！突然UFOに攫われたーーー！！空中でぐるぐる回っている！！観客騒然！！" },
      { time: 7, character: "みこと", action: "speed_up", message: "🚀 UFOから脱出！みことが謎のブースターで地上に激突帰還！物凄いスピードだ！！" },
      { time: 10, character: "ゆきと", action: "pause", message: "💤 ゆきと、なんとレース中に昼寝を始めたぁーーー！！コース脇でスヤスヤ…観客唖然！！" },
      { time: 14, character: "みこと", action: "chaotic", message: "🦁 みことがかなたを丸呑みにしたーーー！？でもすぐ吐き出された！！かなた無事！！" },
      { time: 16, character: "ゆきと", action: "speed_up", message: "⚡ ゆきと目覚めた！！猛烈な追い上げ！ロケット推進で全員を抜き去る勢いだ！！" },
      { time: 20, character: "かなた", action: "speed_up", message: "🔥🔥 かなたにターボエンジン点火！！炎を纏って疾走！！誰も止められない！！" },
      { time: 24, character: "ゆきと", action: "chaotic", message: "🌀 ゆきとが砂嵐に巻き込まれコースアウト！！コースに戻れるか！？" },
      { time: 27, character: "all", action: "speed_up", message: "🏁 ラスト3秒！！かなた独走！！みことゆきと猛追！！ゴールは目の前だぁーーー！！" },
      { time: 30, character: "かなた", action: "finish", message: "🏆 かなたがゴールしたーーー！！本日の勝者は かなた！！おめでとう！！最高の走りだった！！" },
    ],
  },
  {
    winner: "みこと",
    events: [
      { time: 0, character: "all", action: "speed_up", message: "🔥 スタート！みことが先頭で飛び出したぁーーー！！最初から全力全開！！" },
      { time: 3, character: "ゆきと", action: "chaotic", message: "🛸 ゆきと！！突然空から隕石が！！コースが大爆発ーーー！！ゆきとが吹き飛んだ！！" },
      { time: 7, character: "かなた", action: "pause", message: "🍦 かなたがレース中にアイスを見つけて立ち止まったーーー！！何してるんだ！！" },
      { time: 11, character: "みこと", action: "speed_up", message: "⚡ みことに神風！！背後から謎の突風が！！まるでロケットのように加速中！！" },
      { time: 14, character: "かなた", action: "chaotic", message: "🦦 かなたが突然巨大化した！！コース幅が足りない！！大混乱！！" },
      { time: 17, character: "ゆきと", action: "speed_up", message: "🔥 ゆきとが復活！！テレポートでみことの前方に出た！！ルール違反スレスレだ！！" },
      { time: 21, character: "ゆきと", action: "speed_down", message: "😓 テレポートの反動でゆきとが足がもつれた！！速度ガタ落ち！！" },
      { time: 25, character: "みこと", action: "speed_up", message: "🏁 みことが独走！！誰も追いつけない！！これは勝負あった！！" },
      { time: 28, character: "all", action: "chaotic", message: "🌈 ゴール直前に虹色の竜巻が！！3人全員がぐるぐると！！" },
      { time: 30, character: "みこと", action: "finish", message: "🏆 みことがゴールしたーーー！！本日の勝者は みこと！！圧巻の走りだったぁーーー！！" },
    ],
  },
  {
    winner: "ゆきと",
    events: [
      { time: 0, character: "all", action: "speed_up", message: "🔥 レーススタート！3人が一斉に飛び出した！最初はかなたがリード！！" },
      { time: 4, character: "みこと", action: "pause", message: "💤 みことが突然タイムスリップして過去に飛んだ！！現代に戻るまでストップ！！" },
      { time: 7, character: "ゆきと", action: "speed_up", message: "⚡ ゆきとにスーパーチャージ！！見えない壁を突き破って爆走中！！" },
      { time: 10, character: "みこと", action: "chaotic", message: "🌀 タイムスリップから戻ったみこと！でも恐竜時代から恐竜も一緒に来た！！大パニック！！" },
      { time: 13, character: "かなた", action: "chaotic", message: "🦕 恐竜がかなたを丸呑み！でも恐竜のお腹の中で逆に加速したぁーーー！？" },
      { time: 17, character: "かなた", action: "speed_up", message: "🚀 恐竜から脱出したかなたが猛追！ゆきとに迫る！！" },
      { time: 20, character: "みこと", action: "speed_up", message: "🔥 みことも諦めない！3人横並び！！これは超接戦だぁーーー！！" },
      { time: 24, character: "かなた", action: "pause", message: "😱 かなたが縮小光線を浴びてミクロサイズに！！コースの草に埋もれた！！" },
      { time: 27, character: "ゆきと", action: "speed_up", message: "🏁 ゆきとが抜け出したーーー！！ゴールまでまっしぐら！！" },
      { time: 30, character: "ゆきと", action: "finish", message: "🏆 ゆきとがゴールーーー！！本日の勝者は ゆきと！！信じられない大逆転だったぁーーー！！" },
    ],
  },
];

function pickFallback() {
  return FALLBACK_POOL[Math.floor(Math.random() * FALLBACK_POOL.length)];
}

// ─── API ─────────────────────────────────────────────────────

export async function POST() {
  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: SYSTEM_PROMPT,
        stream: false,
        options: { temperature: 1.3, top_p: 0.95, num_predict: 1024 },
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);

    const data = (await res.json()) as { response?: string };
    const rawText = (data.response ?? "").trim();

    // LLMが余計な前後テキストを出力することがあるのでJSONを抽出する
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Ollama response");

    const scenario = JSON.parse(jsonMatch[0]) as {
      winner?: string;
      events?: unknown[];
    };

    if (!scenario.winner || !Array.isArray(scenario.events) || scenario.events.length === 0) {
      throw new Error("Invalid scenario structure from Ollama");
    }

    console.log(`[/api/race/generate] Ollama OK — winner: ${scenario.winner}, events: ${scenario.events.length}`);
    return NextResponse.json(scenario);
  } catch (err) {
    console.error(
      "[/api/race/generate] Ollama failed, using fallback:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(pickFallback());
  }
}
