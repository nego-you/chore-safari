"use client";

// /kids/[kidId]/safari/hunt — アクティブ狩り（エンカウント版）
//
// 2026-06-15 全面刷新（Notion: アクティブ狩り（エンカウント版）新仕様）
//   ワールドマップ上で直接どうぶつとエンカウントして遷移してくる設計に合わせ、
//   冗長な「探索（ルート選択・スタミナ）」を撤廃。知識向上にフォーカスした
//   「コミュニケーション（クイズ）」で“ともだち”になる体験へ集約する。
//
//   フロー:
//     1. エンカウント … 環境(バイオーム/天候/時間帯)に合うどうぶつが出現
//     2. 観察(ヒント) … 鳴き声・動き・みためを じっくり観察してクイズの手がかりに
//     3. クイズ       … 制限時間なしの3択。せいかいで“ともだち”に
//        - 正解 → リッチ演出(ファンファーレ/紙吹雪/大きなハート) + 豆知識(全文) + 図鑑登録 + 1日回数を消費
//        - 不正解 → にげられるが 豆知識(全文)で前向きな学びに
//     4. 終了       … ワールドマップへ戻る
//
//   ※ 旧仕様の「探索フェーズ」「スタミナ」「出発前クイズゲート」は廃止。
//     クイズ自体が捕獲の鍵になるため、二重のクイズは設けない（DESIGN_PRINCIPLES 4・5）。

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWeather, type WeatherId } from "@/app/kids/[kidId]/WeatherContext";
import { recordActiveHuntCatch } from "@/features/safari/actions";

// ════════════════════════════════════════════════════════════════
//  型定義
// ════════════════════════════════════════════════════════════════

type Biome = "grass" | "forest" | "mountain" | "desert" | "water" | "unknown";

interface Quiz { q: string; choices: string[]; ans: number; }

// 観察ヒント：鳴き声(文字表現)・動き・みための特徴。クイズの手がかりにする。
interface Observe { cry: string; move: string; look: string; }

interface Animal {
  id:          string;
  name:        string;
  emoji:       string;
  trait:       "FAST" | "LARGE" | "FLYING";
  traitName:   string;
  rarity:      "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  activeTime:  "DAY" | "NIGHT" | "ANY";
  waterAnimal: boolean;
  description: string;
  observe:     Observe;
  quiz:        Quiz;
}

interface TimeState {
  id:     string;
  name:   string;
  skyTop: string;
  skyBot: string;
}

interface Heart { id: number; x: number; }

// ════════════════════════════════════════════════════════════════
//  マスターデータ（既存の動物マスタ。id は Animal.animalId と一致）
// ════════════════════════════════════════════════════════════════

const ANIMALS: Animal[] = [
  { id:"rabbit", name:"ウサギ", emoji:"🐰", trait:"FAST", traitName:"すばやい", rarity:"COMMON", activeTime:"DAY", waterAnimal:false,
    description:"ながい みみで とおくの おとを キャッチ！かたむければ おとが きた ほうこうも わかるよ。じそく 50キロで かけぬける しぜんかいの スプリンター！",
    observe:{ cry:"「キュッ」と ちいさく なく", move:"ぴょんぴょん とびはねる", look:"ながい みみと まるい しっぽ" },
    quiz:{ q:"ウサギの ながい みみは なんの ため？", choices:["おとを よくきくため","かざりのため","まくらに なるため"], ans:0 } },
  { id:"deer", name:"シカ", emoji:"🦌", trait:"FAST", traitName:"すばやい", rarity:"COMMON", activeTime:"DAY", waterAnimal:false,
    description:"オスだけが もつ ツノは まいとし はえかわる！わかれ目の かずで だいたいの とし が わかるよ。あきに でっかい こえで なく「もうそう」が かっこいい！",
    observe:{ cry:"「ピャー」と たかい こえで なく", move:"すらりと はしって とびこえる", look:"あたまに えだのような ツノ" },
    quiz:{ q:"シカの つので わかること は？", choices:["オスかメスか","なんさいか","なにを たべるか"], ans:1 } },
  { id:"lion", name:"ライオン", emoji:"🦁", trait:"LARGE", traitName:"おおきい", rarity:"EPIC", activeTime:"ANY", waterAnimal:false,
    description:"むれの リーダーは じつは メスたち！えものを つかまえるのも メスの しごと。オスは ライオンの なかで いちばん あぶない てきと たたかって むれを まもるよ！",
    observe:{ cry:"「ガオー」と おなかに ひびく こえ", move:"どっしり ゆっくり あるく", look:"くびまわりの ふさふさ たてがみ" },
    quiz:{ q:"ライオンの むれの リーダーは？", choices:["いちばん おおきい オス","メスたち","いちばん つよい コ"], ans:1 } },
  { id:"crocodile_nile", name:"ワニ", emoji:"🐊", trait:"LARGE", traitName:"おおきい", rarity:"RARE", activeTime:"ANY", waterAnimal:true,
    description:"きょうりゅうと おなじ じだいから すがたが ほとんど かわっていない「いきた かせき」！くちを あけて じっとしているのは、たいおんを あげるため なんだよ。",
    observe:{ cry:"ほとんど なかず とても しずか", move:"みずぎわで じっと まちぶせ", look:"ごつごつの せなかと ながい くち" },
    quiz:{ q:"ワニが じっと うごかない りゆうは？", choices:["ねむっている","たいおんを あげるため","こわいから"], ans:1 } },
  { id:"hippopotamus", name:"カバ", emoji:"🦛", trait:"LARGE", traitName:"おおきい", rarity:"RARE", activeTime:"NIGHT", waterAnimal:true,
    description:"あかい「あせ」は じつは あせじゃない！ひふを まもる にゅうえきで、こうきんこうかも あるよ。みずの なかで えいおよぎが とくい！ひるは みずで ひなたぼっこ、よるに くさを たべに いくよ。",
    observe:{ cry:"「ブフォッ」と はなを ならす", move:"みずの なかを のっそり あるく", look:"おおきな くちと まるい からだ" },
    quiz:{ q:"カバが あかい あせを かく りゆうは？", choices:["あつくて あせが でる","ひふを まもるため","おこっているサイン"], ans:1 } },
  { id:"owl_horned", name:"ワシミミズク", emoji:"🦉", trait:"FLYING", traitName:"そらをとぶ", rarity:"RARE", activeTime:"NIGHT", waterAnimal:false,
    description:"めが おおきすぎて うごかせない！だから くびを 270どまで まわして まわりを みるよ。はねに とくしゅな こうぞうで、とぶ ときの おとが ほぼ ゼロ。しずかな よるの かりうどだ！",
    observe:{ cry:"「ホー ホー」と しずかに なく", move:"おとを たてずに すーっと とぶ", look:"おおきな まんまるの めと あたまの はね" },
    quiz:{ q:"フクロウは くびを どのくらい まわせる？", choices:["90ど","180ど","270ど"], ans:2 } },
  { id:"eagle", name:"ワシ", emoji:"🦅", trait:"FLYING", traitName:"そらをとぶ", rarity:"RARE", activeTime:"DAY", waterAnimal:false,
    description:"しりょくは にんげんの ８ばい！たかい そらから じめんを はしる ウサギが みえるよ。はばたかずに かぜに のって くるくる まわる「サーマル」で らくに たかく とべる！",
    observe:{ cry:"「ピーィ」と するどく なく", move:"つばさを ひろげて かぜに のる", look:"するどい くちばしと つよい つめ" },
    quiz:{ q:"ワシの しりょく は ひとの なんばい？", choices:["２ばい","５ばい","８ばい"], ans:2 } },
  { id:"frog", name:"アマガエル", emoji:"🐸", trait:"FAST", traitName:"すばやい", rarity:"COMMON", activeTime:"ANY", waterAnimal:true,
    description:"ひふで こきゅうも できるし みずも のめるよ！あしの ゆびに すいばんが あって、かがみも のぼれる。あめの まえに よく なくので「てんきよほう カエル」ともよばれるよ！",
    observe:{ cry:"「ゲコゲコ」と なく", move:"ぺたぺた のぼって ジャンプ", look:"みどりいろの つるんとした はだ" },
    quiz:{ q:"カエルは ひふで なにを するの？", choices:["こきゅうする","みずをのむ","りょうほう"], ans:2 } },
  { id:"gorilla", name:"ニシローランドゴリラ", emoji:"🦍", trait:"LARGE", traitName:"おおきい", rarity:"LEGENDARY", activeTime:"ANY", waterAnimal:false,
    description:"アフリカの ねったいうりんに すむ さいだいきゅうの サル！おとなの オスは せなかが しろくなり「シルバーバック」と よばれ、むれを まもる ボスに なる。ちからもち だけど やさしくて、かぞくを とても たいせつに するんだ！",
    observe:{ cry:"むねを「ポコポコ」たたく", move:"うでを じめんに ついて あるく", look:"くろくて おおきい からだ・せなかが しろい" },
    quiz:{ q:"せなかが しろい おとなの オスゴリラの よびなは？", choices:["ホワイトバック","シルバーバック","ゴールドバック"], ans:1 } },
  { id:"trex", name:"ティラノサウルス", emoji:"🦖", trait:"LARGE", traitName:"おおきい", rarity:"LEGENDARY", activeTime:"ANY", waterAnimal:false,
    description:"かみつく ちからは ちきゅうの いきもの ざんしで さいきょうクラス！みじかい うでは じつは きんにくもりもりで つよかった。いまの とりは この この しそんと いわれているよ！",
    observe:{ cry:"「グオオ」と じめんが ゆれる", move:"どしんどしんと あるく", look:"おおきな あたまと みじかい うで" },
    quiz:{ q:"ティラノサウルスの うでは なぜ みじかい？", choices:["そだたなかった","こうかがえきだった","たべものを とるため"], ans:1 } },
];

const RARITY_COLOR: Record<string, string> = {
  COMMON:"#6b7280", RARE:"#3b82f6", EPIC:"#8b5cf6", LEGENDARY:"#f59e0b",
};
const RARITY_JP: Record<string, string> = {
  COMMON:"ふつう", RARE:"めずらしい", EPIC:"すごい！", LEGENDARY:"でんせつ！！",
};

const TIMES: TimeState[] = [
  { id:"MORNING", name:"あさ",     skyTop:"#2d1b69", skyBot:"#9333ea" },
  { id:"NOON",    name:"ひるま",   skyTop:"#87CEEB", skyBot:"#B3E5FC" },
  { id:"EVENING", name:"ゆうがた", skyTop:"#7f1d1d", skyBot:"#ea580c" },
  { id:"NIGHT",   name:"よる",     skyTop:"#000020", skyBot:"#0f172a" },
];

const BIOME_LABEL: Record<Biome, string> = {
  grass:"くさはら", forest:"もり", mountain:"やま",
  desert:"さばく", water:"みずべ", unknown:"しぜんの なか",
};

// ════════════════════════════════════════════════════════════════
//  ユーティリティ
// ════════════════════════════════════════════════════════════════

function normalizeBiome(b: string | null | undefined): Biome {
  switch (b) {
    case "grass": case "forest": case "mountain":
    case "desert": case "water": return b;
    default: return "unknown";
  }
}

// JST の「いまの時刻」から時間帯を判定（ワールドマップの夜判定 20:00〜 と整合）。
function jstHour(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo", hourCycle: "h23", hour: "2-digit",
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? "12");
}

function currentTimeState(): TimeState {
  const h = jstHour();
  if (h >= 20 || h < 5) return TIMES[3]; // よる
  if (h < 9)  return TIMES[0];           // あさ
  if (h < 16) return TIMES[1];           // ひるま
  return TIMES[2];                       // ゆうがた
}

// バイオーム親和（traitベース）。そのバイオームに「いそうな」どうぶつを重め に。
// 2026-06-16（Notion「エンカウント率と出てくる動物」）: 倍率の幅が大きく
// 「いそうな種」ばかり出ていたため、各倍率を 1.0 寄りに圧縮して、同じ環境でも
// いろいろな種に出会える（バラツキが出る）ようにする。
function biomeAffinity(a: Animal, biome: Biome): number {
  switch (biome) {
    case "water":    return a.waterAnimal ? 2.0 : 0.6;
    case "forest":   return a.trait === "FLYING" ? 1.5 : a.trait === "LARGE" ? 1.25 : 1.0;
    case "grass":    return a.trait === "FAST" ? 1.35 : a.rarity === "COMMON" ? 1.1 : 0.95;
    case "mountain": return a.trait === "LARGE" ? 1.4 : a.trait === "FLYING" ? 1.2 : 0.9;
    case "desert":   return a.trait === "LARGE" ? 1.25 : 1.0;
    default:         return 1.0;
  }
}

// 出現重み：レアリティ基礎 × バイオーム親和 × 天候/難易度補正。
// 2026-06-16（Notion「エンカウント率と出てくる動物」）: レアリティの傾斜が急で
// ふつう種ばかり出ていた偏りを是正。罠スタイル(features/safari/actions.ts)で
// 実績のある 10:7:5:3 の比に平準化（最大でも約3.3倍差）し、天候・地形のレア補正も
// 控えめにして、いろいろな種が出る「バラツキ」を増やす。
function weightFor(a: Animal, biome: Biome, weatherId: WeatherId): number {
  const RAR: Record<string, number> = { COMMON:1.0, RARE:0.7, EPIC:0.5, LEGENDARY:0.3 };
  let w = (RAR[a.rarity] ?? 0.5) * biomeAffinity(a, biome);

  // 天候・マップ難易度で 高レアリティ（EPIC/LEGENDARY）の確率を制御（控えめ）。
  if (weatherId === "typhoon") {
    if (a.rarity === "EPIC")      w *= 1.5;
    if (a.rarity === "LEGENDARY") w *= 1.7;
  }
  if (weatherId === "rainy" && a.waterAnimal) w *= 1.5;
  if (biome === "mountain") {
    if (a.rarity === "EPIC")      w *= 1.3;
    if (a.rarity === "LEGENDARY") w *= 1.4;
  }
  if ((weatherId === "sunny" || weatherId === "hot") && a.rarity === "COMMON") w *= 1.1;

  return Math.max(0.02, w);
}

// 環境（バイオーム/天候/時間帯）に応じて1体を選出。必ず1体は返す。
function pickAnimalForEnv(
  biome: Biome, weatherId: WeatherId, isNight: boolean, isDark: boolean,
): Animal {
  const isWater = biome === "water" || weatherId === "rainy" || weatherId === "typhoon";

  let candidates = ANIMALS.filter((a) => {
    const timeOk =
      a.activeTime === "ANY" ||
      (a.activeTime === "NIGHT" && isDark) ||
      (a.activeTime === "DAY"   && !isNight);
    const waterOk = !a.waterAnimal || isWater;
    return timeOk && waterOk;
  });
  if (candidates.length === 0) {
    candidates = ANIMALS.filter((a) => !a.waterAnimal && a.activeTime !== "NIGHT");
  }
  if (candidates.length === 0) candidates = [...ANIMALS];

  const pool = candidates.map((a) => ({ a, w: weightFor(a, biome, weatherId) }));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) return p.a; }
  return pool[pool.length - 1].a;
}

// 正解時のファンファーレ（音源不要・WebAudio で短い上昇アルペジオ）。
function playFanfare() {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = now + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.42);
    });
    setTimeout(() => { void ctx.close().catch(() => {}); }, 1300);
  } catch {
    /* 音が出せない環境でも演出（紙吹雪/ハート）は続行 */
  }
}

// 正解時の紙吹雪（canvas-confetti を動的import。SafariClient と同じ流儀）。
async function fireConfetti(rarity: string) {
  try {
    const mod = await import("canvas-confetti");
    const confetti = mod.default;
    const hi = rarity === "LEGENDARY" || rarity === "EPIC";
    const palette = hi
      ? ["#ffd700", "#ff8800", "#fff0a0", "#ff4500", "#ffe066", "#ffffff"]
      : ["#fda4af", "#fcd34d", "#a7f3d0", "#bae6fd", "#ddd6fe", "#fbcfe8"];
    confetti({
      particleCount: hi ? 200 : 140, spread: hi ? 120 : 90,
      origin: { y: 0.55 }, colors: palette, zIndex: 9999,
      startVelocity: hi ? 50 : 40,
    });
    if (hi) {
      setTimeout(() => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6, x: 0.25 }, colors: palette, zIndex: 9999 });
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6, x: 0.75 }, colors: palette, zIndex: 9999 });
      }, 350);
    }
  } catch {
    /* 動的import 失敗時は静かにスキップ */
  }
}

// ════════════════════════════════════════════════════════════════
//  CSS
// ════════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --font: 'Kosugi Maru', sans-serif;
    --pink:   #FF69B4; --pink-light:  #FFD6E7; --pink-shadow:  #C2185B;
    --green:  #4CAF50; --green-light: #C8F5CE; --green-shadow: #2E7D32;
    --blue:   #42A5F5; --blue-light:  #BBDEFB; --blue-shadow:  #1565C0;
    --red:    #EF5350; --red-light:   #FFCDD2; --red-shadow:   #B71C1C;
    --amber:  #FFA726; --amber-light: #FFE0B2; --amber-shadow: #E65100;
  }

  /* ── Pop ボタン ── */
  .pop-btn {
    font-family: var(--font);
    border: none; outline: none; cursor: pointer;
    border-radius: 18px;
    padding: 14px 16px;
    font-size: 15px; font-weight: bold;
    width: 100%; text-align: center;
    transition: transform 0.08s, box-shadow 0.08s;
    transform: translateY(0);
    display: block;
  }
  .pop-btn:active:not(:disabled) { transform: translateY(4px); }
  .pop-btn:disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
  .pop-btn.pink   { background:var(--pink-light);   color:#880e4f; box-shadow:0 5px 0 var(--pink-shadow);   }
  .pop-btn.pink:active:not(:disabled)   { box-shadow:0 1px 0 var(--pink-shadow);   }
  .pop-btn.green  { background:var(--green-light);  color:#1b5e20; box-shadow:0 5px 0 var(--green-shadow);  }
  .pop-btn.green:active:not(:disabled)  { box-shadow:0 1px 0 var(--green-shadow);  }
  .pop-btn.blue   { background:var(--blue-light);   color:#0d47a1; box-shadow:0 5px 0 var(--blue-shadow);   }
  .pop-btn.blue:active:not(:disabled)   { box-shadow:0 1px 0 var(--blue-shadow);   }
  .pop-btn.red    { background:var(--red-light);    color:#b71c1c; box-shadow:0 5px 0 var(--red-shadow);    }
  .pop-btn.red:active:not(:disabled)    { box-shadow:0 1px 0 var(--red-shadow);    }
  .pop-btn.amber  { background:var(--amber-light);  color:#bf360c; box-shadow:0 5px 0 var(--amber-shadow);  }
  .pop-btn.amber:active:not(:disabled)  { box-shadow:0 1px 0 var(--amber-shadow);  }

  /* ── クイズボタン ── */
  .quiz-btn {
    background:#fff; border:2px solid #e2e8f0; color:#374151;
    font-family:var(--font); font-size:15px; font-weight:bold;
    padding:13px 14px; cursor:pointer; border-radius:14px;
    text-align:left; width:100%;
    transition:background 0.12s, border-color 0.12s, transform 0.08s;
  }
  .quiz-btn:hover:not(:disabled) { background:#f8fafc; border-color:#93c5fd; }
  .quiz-btn:active:not(:disabled) { transform:scale(0.98); }
  .quiz-btn:disabled { cursor:default; }
  .quiz-btn.correct  { background:#dcfce7; border-color:#22c55e; color:#15803d; }
  .quiz-btn.wrong    { background:#fee2e2; border-color:#ef4444; color:#b91c1c; }

  /* ── 観察ヒント行 ── */
  .obs-row {
    display:flex; align-items:flex-start; gap:8px;
    font-family:var(--font); font-size:13px; color:#374151; line-height:1.6;
    background:#fff; border:1px solid #e2e8f0; border-radius:12px;
    padding:8px 11px; animation:obsIn 0.4s ease both;
  }

  /* ── Keyframes ── */
  @keyframes aBounce      { 0%,100%{transform:translateY(0);}            50%{transform:translateY(-10px);} }
  @keyframes friendBounce { 0%,100%{transform:scale(1);}                 40%{transform:scale(1.18);} }
  @keyframes pulse        { 0%,100%{opacity:1;}                          50%{opacity:0.4;} }
  @keyframes winPop       { 0%{transform:scale(0.4);opacity:0;}          65%{transform:scale(1.14);} 100%{transform:scale(1);opacity:1;} }
  @keyframes bigHeart     { 0%{transform:scale(0);opacity:0;} 45%{transform:scale(1.25);opacity:1;} 70%{transform:scale(0.92);} 100%{transform:scale(1);opacity:1;} }
  @keyframes heartFloat   { 0%{transform:translateY(0)scale(1);opacity:1;} 100%{transform:translateY(-90px)scale(0.6);opacity:0;} }
  @keyframes quizAppear   { from{transform:translateY(18px);opacity:0;}  to{transform:translateY(0);opacity:1;} }
  @keyframes obsIn        { from{transform:translateX(-8px);opacity:0;}  to{transform:translateX(0);opacity:1;} }
  @keyframes encFlash     { 0%{filter:brightness(1);} 18%{filter:brightness(2.8)saturate(0);} 100%{filter:brightness(1);} }
  @keyframes rainFall     { 0%{transform:translateY(-10px);opacity:0;} 15%{opacity:0.7;} 85%{opacity:0.7;} 100%{transform:translateY(320px);opacity:0;} }
  @keyframes snowDrift    { 0%{transform:translateY(-8px)translateX(0)rotate(0deg);opacity:0;} 20%{opacity:0.85;} 100%{transform:translateY(320px)translateX(28px)rotate(360deg);opacity:0;} }
  @keyframes rainDiag     { 0%{transform:translateY(-10px)translateX(0);opacity:0;} 15%{opacity:0.8;} 85%{opacity:0.8;} 100%{transform:translateY(320px)translateX(90px);opacity:0;} }
  @keyframes cloudDrift   { 0%,100%{transform:translateX(0);} 50%{transform:translateX(14px);} }
  @keyframes starTwinkle  { 0%,100%{opacity:0.8;} 50%{opacity:0.2;} }
  @keyframes peek         { 0%,100%{transform:translateY(6px);} 50%{transform:translateY(0);} }
`;

// ════════════════════════════════════════════════════════════════
//  ForestView（背景：空・天候・どうぶつ・ハート）
// ════════════════════════════════════════════════════════════════

interface ForestViewProps {
  timeId:       string;
  weatherLabel: string;
  weatherIcon:  string;
  showAnimal:   boolean;
  peeking:      boolean;
  animal:       Animal | null;
  hearts:       Heart[];
  isEncFlash:   boolean;
}

function ForestView({
  timeId, weatherLabel, weatherIcon,
  showAnimal, peeking, animal, hearts, isEncFlash,
}: ForestViewProps) {
  type FxType = "none" | "rain" | "snow" | "typhoon";
  let skyGrad = "";
  let fx: FxType = "none";

  if (weatherLabel === "あめ") {
    skyGrad = "linear-gradient(to bottom,#546E7A 0%,#78909C 100%)"; fx = "rain";
  } else if (weatherLabel === "ゆき") {
    skyGrad = "linear-gradient(to bottom,#B0BEC5 0%,#CFD8DC 100%)"; fx = "snow";
  } else if (weatherLabel === "たいふう") {
    skyGrad = "linear-gradient(to bottom,#1a1a2e 0%,#4a3a6e 100%)"; fx = "typhoon";
  } else {
    const TIME_SKY: Record<string, string> = {
      MORNING: "linear-gradient(to bottom,#2d1b69 0%,#9333ea 100%)",
      NOON:    "linear-gradient(to bottom,#87CEEB 0%,#B3E5FC 100%)",
      EVENING: "linear-gradient(to bottom,#7f1d1d 0%,#ea580c 100%)",
      NIGHT:   "linear-gradient(to bottom,#000020 0%,#0f172a 100%)",
    };
    skyGrad = TIME_SKY[timeId] ?? TIME_SKY["NOON"];
  }

  const rainCount = fx === "typhoon" ? 32 : 18;
  const isNightTime = timeId === "NIGHT" || timeId === "EVENING";

  return (
    <div style={{
      position:"relative", width:"100%", height:"100%", overflow:"hidden",
      ...(isEncFlash ? { animation:"encFlash 0.45s ease-out" } : {}),
    }}>
      {/* 空 */}
      <div style={{ position:"absolute", inset:0, background:skyGrad, transition:"background 1.5s ease" }} />

      {/* 星（夜・夕方） */}
      {isNightTime && Array.from({ length: 22 }).map((_, i) => (
        <div key={i} style={{
          position:"absolute",
          left:`${(i * 41 + 7) % 100}%`, top:`${(i * 29 + 5) % 55}%`,
          width: i % 4 === 0 ? 3 : 2, height: i % 4 === 0 ? 3 : 2,
          borderRadius:"50%", background:"#fff",
          opacity: timeId === "NIGHT" ? 0.85 : 0.4,
          animation:`starTwinkle ${1.4 + (i % 7) * 0.35}s ${(i * 0.19) % 2}s ease-in-out infinite`,
        }} />
      ))}

      {/* 雲（ひるま） */}
      {fx === "none" && timeId === "NOON" && [
        { t:"14%", l:"8%",  w:70, h:22, delay:"0s"   },
        { t:"20%", l:"55%", w:90, h:26, delay:"1.5s" },
        { t:"10%", l:"35%", w:50, h:16, delay:"3s"   },
      ].map((c, i) => (
        <div key={i} style={{
          position:"absolute", top:c.t, left:c.l, width:c.w, height:c.h,
          background:"rgba(255,255,255,0.82)", borderRadius:20,
          animation:`cloudDrift ${6 + i * 2}s ease-in-out ${c.delay} infinite`,
        }} />
      ))}

      {/* 地面 */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, height:"34%",
        background:"linear-gradient(to top,#3d7a42 0%,#52a058 40%,rgba(72,140,78,0) 100%)",
      }} />

      {/* 木々（3レイヤー） */}
      {[
        { z:0, scaleFactor:0.30, bottom:"28%", count:9, trunk:"#4e342e", leaf:"#2d6a2d" },
        { z:1, scaleFactor:0.52, bottom:"20%", count:6, trunk:"#5d4037", leaf:"#388e3c" },
        { z:2, scaleFactor:0.80, bottom:"10%", count:4, trunk:"#6d4c41", leaf:"#43a047" },
      ].map((layer) => (
        <div key={layer.z} style={{
          position:"absolute", bottom:layer.bottom, width:"100%",
          display:"flex", justifyContent:"space-around",
          paddingLeft:"4%", paddingRight:"4%",
        }}>
          {Array.from({ length: layer.count }).map((_, ti) => {
            const h = (55 + ti * 9) * layer.scaleFactor;
            const w = (20 + ti * 5) * layer.scaleFactor;
            return (
              <div key={ti} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ width:0, height:0,
                  borderLeft:`${w * 0.7}px solid transparent`,
                  borderRight:`${w * 0.7}px solid transparent`,
                  borderBottom:`${h * 0.5}px solid ${layer.leaf}` }} />
                <div style={{ width:0, height:0,
                  borderLeft:`${w * 0.55}px solid transparent`,
                  borderRight:`${w * 0.55}px solid transparent`,
                  borderBottom:`${h * 0.4}px solid ${layer.leaf}`,
                  marginTop:`-${h * 0.14}px` }} />
                <div style={{ width:w * 0.16, height:h * 0.22, background:layer.trunk }} />
              </div>
            );
          })}
        </div>
      ))}

      {/* 雨粒 / 斜め雨 */}
      {(fx === "rain" || fx === "typhoon") && Array.from({ length: rainCount }).map((_, i) => (
        <div key={i} style={{
          position:"absolute", left:`${(i * 6.3 + 2) % 100}%`, top:"-14px",
          width: fx === "typhoon" ? 2 : 1.5, height: fx === "typhoon" ? 22 : 14,
          background: fx === "typhoon" ? "rgba(140,160,220,0.65)" : "rgba(160,205,255,0.6)",
          borderRadius:1,
          animation:`${fx === "typhoon" ? "rainDiag" : "rainFall"} ${
            fx === "typhoon" ? 0.45 + (i % 3) * 0.09 : 0.72 + (i % 4) * 0.12
          }s linear ${(i * 0.08) % 1.4}s infinite`,
        }} />
      ))}

      {/* 雪 */}
      {fx === "snow" && Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position:"absolute", left:`${(i * 5.8 + 3) % 100}%`, top:"-10px",
          width:7, height:7, borderRadius:"50%", background:"rgba(255,255,255,0.88)",
          animation:`snowDrift ${2.3 + (i % 5) * 0.4}s linear ${(i * 0.14) % 2.2}s infinite`,
        }} />
      ))}

      {/* どうぶつ */}
      {showAnimal && animal && (
        <div style={{
          position:"absolute", inset:0,
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:20,
        }}>
          <div style={{
            fontSize:90, lineHeight:1,
            filter:"drop-shadow(0 4px 18px rgba(0,0,0,0.28))",
            animation: peeking ? "peek 1.6s ease-in-out infinite" : "aBounce 2.2s ease-in-out infinite",
          }}>
            {animal.emoji}
          </div>
        </div>
      )}

      {/* ハートエフェクト */}
      {hearts.map((h) => (
        <div key={h.id} style={{
          position:"absolute", bottom:"28%", left:`${h.x}%`,
          fontSize:24, zIndex:30, pointerEvents:"none",
          animation:"heartFloat 1.4s ease-out forwards",
        }}>💖</div>
      ))}

      {/* 天気アイコン（右上） */}
      <div style={{ position:"absolute", top:8, right:10, fontSize:20, zIndex:40 }}>
        {weatherIcon}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  クイズパネル（制限時間なし・じっくり考えられる）
// ════════════════════════════════════════════════════════════════

function QuizPanel({ animal, onResult }: { animal: Animal; onResult: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const q = animal.quiz;

  const handleSelect = useCallback((i: number) => {
    if (selected !== null) return;
    setSelected(i);
    setTimeout(() => onResult(i === q.ans), 1000);
  }, [selected, q.ans, onResult]);

  const getBtnClass = (i: number) => {
    if (selected === null) return "";
    if (i === q.ans)    return " correct";
    if (i === selected) return " wrong";
    return "";
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, animation:"quizAppear 0.28s ease" }}>
      <div style={{ textAlign:"center", fontSize:54, lineHeight:1, animation:"aBounce 2s ease-in-out infinite" }}>
        {animal.emoji}
      </div>
      <div style={{
        fontFamily:"var(--font)", fontSize:15, fontWeight:"bold", color:"#1f2937",
        padding:"12px 14px", background:"#fef9c3", borderRadius:14, lineHeight:1.6,
        border:"2px solid #fde047",
      }}>
        💬 {q.q}
      </div>
      {q.choices.map((c, i) => (
        <button key={i} className={`quiz-btn${getBtnClass(i)}`}
          onClick={() => handleSelect(i)} disabled={selected !== null}>
          <span style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            width:24, height:24, borderRadius:"50%", marginRight:8, flexShrink:0,
            background: i === 0 ? "#fde68a" : i === 1 ? "#bbf7d0" : "#c7d2fe",
            fontSize:12, fontWeight:"bold",
          }}>
            {["①","②","③"][i]}
          </span>
          {c}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  メインコンポーネント
// ════════════════════════════════════════════════════════════════

type Phase = "ENCOUNTER" | "OBSERVE" | "QUIZ" | "RESULT";

export default function HuntClient({
  kidId,
  huntRemaining,
  huntLimit,
  biome: biomeRaw = null,
}: {
  kidId: string;
  huntRemaining: number;
  huntLimit: number;
  biome?: string | null;
}) {
  const router = useRouter();
  const weather = useWeather();

  // 環境（マウント時に1回だけ確定。出会ったあとに天気で揺れない）。
  const biome = useMemo(() => normalizeBiome(biomeRaw), [biomeRaw]);
  const time  = useMemo(() => currentTimeState(), []);
  const isNight = time.id === "NIGHT";
  const isDark  = isNight || time.id === "EVENING" || weather.id === "typhoon" || biome === "forest";

  // 出現どうぶつ（1回だけ抽選）。
  const [animal] = useState<Animal>(() => pickAnimalForEnv(biome, weather.id, isNight, isDark));

  const [phase,        setPhase]        = useState<Phase>("ENCOUNTER");
  const [quizCorrect,  setQuizCorrect]  = useState<boolean | null>(null);
  const [catchRemaining, setCatchRemaining] = useState(huntRemaining);
  const [catchError,   setCatchError]   = useState<string | null>(null);
  const [isEncFlash,   setIsEncFlash]   = useState(true);
  const [hearts,       setHearts]       = useState<Heart[]>([]);
  const savedRef = useRef(false); // 二重記録ガード

  // エンカウント入場フラッシュ。
  useEffect(() => {
    const t = setTimeout(() => setIsEncFlash(false), 480);
    return () => clearTimeout(t);
  }, []);

  const spawnHearts = useCallback(() => {
    const batch = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i, x: 12 + Math.random() * 74,
    }));
    setHearts((prev) => [...prev, ...batch]);
    setTimeout(
      () => setHearts((prev) => prev.filter((h) => !batch.find((b) => b.id === h.id))),
      1500,
    );
  }, []);

  // ── クイズ結果 ─────────────────────────────────────────────
  const onQuizResult = useCallback((correct: boolean) => {
    setQuizCorrect(correct);
    setPhase("RESULT");
    if (!correct) return;

    // 正解：リッチ演出 + 図鑑へ永続化（1日の回数はサーバ側で消費・判定）。
    void fireConfetti(animal.rarity);
    playFanfare();
    spawnHearts();
    if (savedRef.current) return;
    savedRef.current = true;
    void recordActiveHuntCatch(kidId, animal.id).then((r) => {
      if (r.success) setCatchRemaining(r.remaining);
      else setCatchError(r.error);
    });
  }, [animal, kidId, spawnHearts]);

  // ── ワールドマップへ戻る ───────────────────────────────────
  const goToMap = useCallback(() => {
    router.push(`/kids/${kidId}`);
  }, [router, kidId]);

  const showAnimalInForest =
    phase === "ENCOUNTER" || phase === "OBSERVE" || phase === "QUIZ" ||
    (phase === "RESULT" && quizCorrect === true);

  // ════════════════════════════════════════════════════════════
  //  レンダリング
  // ════════════════════════════════════════════════════════════

  return (
    <div style={{
      width:"100%", minHeight:"100vh", background:"#f0fdf4",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <style>{CSS}</style>

      <div style={{
        width:"100%", maxWidth:768, height:"100svh",
        display:"flex", flexDirection:"column",
        background:"#ffffff", fontFamily:"var(--font)", overflow:"hidden",
      }}>

        {/* ══ 背景ビュー（300px） ══ */}
        <div style={{ flex:"0 0 300px", position:"relative", overflow:"hidden",
          borderBottom:"3px solid #e2e8f0" }}>
          <ForestView
            timeId={time.id}
            weatherLabel={weather.label}
            weatherIcon={weather.icon}
            showAnimal={showAnimalInForest}
            peeking={phase === "OBSERVE"}
            animal={animal}
            hearts={hearts}
            isEncFlash={isEncFlash}
          />

          {/* 環境バッジ（左上） */}
          <div style={{
            position:"absolute", top:8, left:8, zIndex:50,
            fontFamily:"var(--font)", fontSize:11, fontWeight:"bold",
            background:"rgba(255,255,255,0.88)", color:"#374151",
            padding:"3px 10px", borderRadius:12,
            boxShadow:"0 1px 4px rgba(0,0,0,0.12)",
          }}>
            {BIOME_LABEL[biome]}　{time.name}
          </div>

          {/* エンカウント／観察 ラベル（下部） */}
          {(phase === "ENCOUNTER" || phase === "OBSERVE") && (
            <div style={{
              position:"absolute", bottom:9, left:0, right:0,
              textAlign:"center", zIndex:50,
              fontFamily:"var(--font)", fontSize:14, fontWeight:"bold",
              color:"#fff", textShadow:"0 2px 10px rgba(0,0,0,0.55)",
              animation:"pulse 0.9s ease-in-out infinite",
            }}>
              {phase === "ENCOUNTER" ? "💕 なにか あらわれた！" : "🔎 じっと かんさつちゅう…"}
            </div>
          )}
        </div>

        {/* ══ コマンドパネル（flex:1） ══ */}
        <div style={{
          flex:1, minHeight:0, background:"#ffffff",
          display:"flex", flexDirection:"column",
          padding:"12px 14px 16px", gap:10, overflowY:"auto",
        }}>

          {/* ともだち（きょうの のこり）カウンター */}
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <div
              title="きょう おうちに つれて かえれる のこり かいすう"
              style={{
                fontFamily:"var(--font)", fontSize:12, fontWeight:"bold",
                color: catchRemaining > 0 ? "#b45309" : "#9ca3af",
                background: catchRemaining > 0 ? "#fffbeb" : "#f3f4f6",
                padding:"4px 10px", borderRadius:12,
                border:"1px solid " + (catchRemaining > 0 ? "#fde68a" : "#e5e7eb"),
                whiteSpace:"nowrap",
              }}>
              🎯 きょうの のこり {catchRemaining}/{huntLimit}
            </div>
          </div>

          {/* ─── ENCOUNTER ─── */}
          {phase === "ENCOUNTER" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"quizAppear 0.25s ease" }}>
              <div style={{
                textAlign:"center", padding:"16px",
                background:"#fdf2f8", borderRadius:18, border:"2px solid #fce7f3",
              }}>
                <div style={{ fontSize:64, lineHeight:1, marginBottom:6 }}>{animal.emoji}</div>
                <div style={{ fontFamily:"var(--font)", fontSize:18, fontWeight:"bold", color:"#9d174d", marginBottom:4 }}>
                  {animal.name} が あらわれた！
                </div>
                <div style={{ fontFamily:"var(--font)", fontSize:13, fontWeight:"bold", color:RARITY_COLOR[animal.rarity] }}>
                  {RARITY_JP[animal.rarity]} の どうぶつ！
                </div>
              </div>
              <button className="pop-btn pink" onClick={() => setPhase("OBSERVE")}>
                👀 そっと かんさつする
              </button>
              <button className="pop-btn red" onClick={goToMap} style={{ marginTop:"auto" }}>
                🗺️ マップへ もどる
              </button>
            </div>
          )}

          {/* ─── OBSERVE（観察ヒント） ─── */}
          {phase === "OBSERVE" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, animation:"quizAppear 0.25s ease" }}>
              <div style={{ fontFamily:"var(--font)", fontSize:14, fontWeight:"bold", color:"#9d174d", textAlign:"center" }}>
                {animal.name} を じっと みつめている…
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div className="obs-row" style={{ animationDelay:"0.05s" }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>🔊</span>
                  <span><b style={{ color:"#0e7490" }}>なきごえ：</b>{animal.observe.cry}</span>
                </div>
                <div className="obs-row" style={{ animationDelay:"0.20s" }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>🐾</span>
                  <span><b style={{ color:"#15803d" }}>うごき：</b>{animal.observe.move}</span>
                </div>
                <div className="obs-row" style={{ animationDelay:"0.35s" }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>👀</span>
                  <span><b style={{ color:"#b45309" }}>みため：</b>{animal.observe.look}</span>
                </div>
              </div>
              <div style={{
                fontFamily:"var(--font)", fontSize:12, color:"#6b7280",
                background:"#f8fafc", borderRadius:12, padding:"9px 12px",
                border:"1px solid #e2e8f0", lineHeight:1.6,
              }}>
                💡 ヒントを よく みて、つぎの クイズに こたえると「ともだち」に なれるよ。
              </div>
              <button className="pop-btn pink" onClick={() => setPhase("QUIZ")}>
                💬 はなしかけて クイズに チャレンジ！
              </button>
            </div>
          )}

          {/* ─── QUIZ ─── */}
          {phase === "QUIZ" && (
            <div style={{ flex:1, overflowY:"auto" }}>
              <QuizPanel animal={animal} onResult={onQuizResult} />
            </div>
          )}

          {/* ─── RESULT ─── */}
          {phase === "RESULT" && (
            <div style={{
              flex:1, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:12,
              animation:"quizAppear 0.3s ease",
            }}>
              {quizCorrect ? (
                <>
                  <div style={{
                    fontFamily:"var(--font)", fontSize:24, fontWeight:"bold",
                    color:"#ec4899", textAlign:"center", animation:"winPop 0.45s ease",
                  }}>
                    💖 ともだちに なれた！
                  </div>
                  <div style={{ fontSize:72, lineHeight:1, animation:"bigHeart 0.7s ease, friendBounce 0.9s 0.7s ease-in-out infinite" }}>
                    {animal.emoji}
                  </div>
                  <div style={{
                    fontFamily:"var(--font)", fontSize:13, color:"#374151",
                    lineHeight:1.75, textAlign:"left",
                    background:"#f0fdf4", borderRadius:14, padding:"12px 14px", width:"100%",
                    border:"2px solid #bbf7d0",
                  }}>
                    <span style={{ fontSize:11, color:"#059669", fontWeight:"bold", display:"block", marginBottom:4 }}>
                      ✨ {animal.name} の すごい ところ
                    </span>
                    {animal.description}
                  </div>
                  {catchError ? (
                    <div style={{ fontFamily:"var(--font)", fontSize:12, color:"#b45309", textAlign:"center" }}>
                      🙅 {catchError}
                    </div>
                  ) : (
                    <div style={{ fontFamily:"var(--font)", fontSize:13, fontWeight:"bold", color:"#059669", textAlign:"center" }}>
                      📖 ずかんに とうろくしたよ！（きょうの のこり {catchRemaining}/{huntLimit}）
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontFamily:"var(--font)", fontSize:18, fontWeight:"bold", color:"#9ca3af", textAlign:"center" }}>
                    ── にげちゃった… ──
                  </div>
                  <div style={{ fontSize:60, lineHeight:1, opacity:0.6, filter:"grayscale(0.4)" }}>
                    {animal.emoji}
                  </div>
                  <div style={{
                    fontFamily:"var(--font)", fontSize:13, color:"#374151",
                    lineHeight:1.75, textAlign:"left",
                    background:"#fefce8", borderRadius:14, padding:"12px 14px", width:"100%",
                    border:"2px solid #fde047",
                  }}>
                    <span style={{ fontSize:11, color:"#ca8a04", fontWeight:"bold", display:"block", marginBottom:4 }}>
                      📖 おぼえておこう！ {animal.emoji} {animal.name}
                    </span>
                    {animal.description}
                  </div>
                  <div style={{ fontFamily:"var(--font)", fontSize:12, color:"#6b7280", textAlign:"center", lineHeight:1.6 }}>
                    つぎは こういう とくちょうに ちゅうもく してみよう！
                  </div>
                </>
              )}
              <button className="pop-btn blue" onClick={goToMap} style={{ width:"100%", marginTop:6 }}>
                🗺️ ワールドマップへ もどる
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
