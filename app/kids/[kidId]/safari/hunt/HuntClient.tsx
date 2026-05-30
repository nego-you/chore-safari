"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSafariStore } from "@/store/useSafariStore";
import { useWeather } from "@/app/kids/[kidId]/WeatherContext";
import { recordActiveHuntCatch } from "@/features/safari/actions";

// ════════════════════════════════════════════════════════════════
//  型定義
// ════════════════════════════════════════════════════════════════

type RouteTag =
  | "large" | "fast" | "flying" | "water"
  | "carnivore" | "herbivore" | "legendary"
  | "poop" | "recovery" | "hazard" | "neutral";

interface EventWeight {
  large:     number; fast:      number; flying:   number;
  water:     number; legendary: number; carnivore:number;
  herbivore: number; poop:      number; recovery: number;
  hazard:    number; encounter: number;
}

interface RouteOption {
  id:          string;
  hintEmoji:   string;
  hintText:    string;
  dirLabel:    string;
  staminaCost: number;
  eventWeight: EventWeight;
  tags:        RouteTag[];
  logText:     string;
  btnColor:    string;
}
type RouteTemplate = Omit<RouteOption, "id" | "dirLabel">;

interface Quiz { q: string; choices: string[]; ans: number; }

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
  quiz:        Quiz;
}

interface TimeState {
  id:     string;
  name:   string;
  skyTop: string;
  skyBot: string;
}

interface LogEntry  { text: string; color?: string; }
interface Footprint { id: number; x: number; }
interface Heart     { id: number; x: number; }

// ════════════════════════════════════════════════════════════════
//  マスターデータ
// ════════════════════════════════════════════════════════════════

const ANIMALS: Animal[] = [
  { id:"rabbit",    name:"ウサギ",          emoji:"🐰", trait:"FAST",   traitName:"すばやい",   rarity:"COMMON",    activeTime:"DAY",   waterAnimal:false,
    description:"ながい みみで とおくの おとを キャッチ！かたむければ おとが きた ほうこうも わかるよ。じそく 50キロで かけぬける しぜんかいの スプリンター！",
    quiz:{ q:"ウサギの ながい みみは なんの ため？",            choices:["おとを よくきくため","かざりのため","まくらに なるため"], ans:0 } },
  { id:"deer",      name:"シカ",            emoji:"🦌", trait:"FAST",   traitName:"すばやい",   rarity:"COMMON",    activeTime:"DAY",   waterAnimal:false,
    description:"オスだけが もつ ツノは まいとし はえかわる！わかれ目の かずで だいたいの とし が わかるよ。あきに でっかい こえで なく「もうそう」が かっこいい！",
    quiz:{ q:"シカの つので わかること は？",                  choices:["オスかメスか","なんさいか","なにを たべるか"], ans:1 } },
  { id:"lion",      name:"ライオン",        emoji:"🦁", trait:"LARGE",  traitName:"おおきい",   rarity:"EPIC",      activeTime:"ANY",   waterAnimal:false,
    description:"むれの リーダーは じつは メスたち！えものを つかまえるのも メスの しごと。オスは ライオンの なかで いちばん あぶない てきと たたかって むれを まもるよ！",
    quiz:{ q:"ライオンの むれの リーダーは？",                  choices:["いちばん おおきい オス","メスたち","いちばん つよい コ"], ans:1 } },
  { id:"crocodile_nile", name:"ワニ",            emoji:"🐊", trait:"LARGE",  traitName:"おおきい",   rarity:"RARE",      activeTime:"ANY",   waterAnimal:true,
    description:"きょうりゅうと おなじ じだいから すがたが ほとんど かわっていない「いきた かせき」！くちを あけて じっとしているのは、たいおんを あげるため なんだよ。",
    quiz:{ q:"ワニが じっと うごかない りゆうは？",             choices:["ねむっている","たいおんを あげるため","こわいから"], ans:1 } },
  { id:"hippopotamus", name:"カバ",            emoji:"🦛", trait:"LARGE",  traitName:"おおきい",   rarity:"RARE",      activeTime:"NIGHT", waterAnimal:true,
    description:"あかい「あせ」は じつは あせじゃない！ひふを まもる にゅうえきで、こうきんこうかも あるよ。みずの なかで えいおよぎが とくい！ひるは みずで ひなたぼっこ、よるに くさを たべに いくよ。",
    quiz:{ q:"カバが あかい あせを かく りゆうは？",            choices:["あつくて あせが でる","ひふを まもるため","おこっているサイン"], ans:1 } },
  { id:"owl_horned", name:"ワシミミズク",    emoji:"🦉", trait:"FLYING", traitName:"そらをとぶ", rarity:"RARE",      activeTime:"NIGHT", waterAnimal:false,
    description:"めが おおきすぎて うごかせない！だから くびを 270どまで まわして まわりを みるよ。はねに とくしゅな こうぞうで、とぶ ときの おとが ほぼ ゼロ。しずかな よるの かりうどだ！",
    quiz:{ q:"フクロウは くびを どのくらい まわせる？",         choices:["90ど","180ど","270ど"], ans:2 } },
  { id:"eagle",     name:"ワシ",            emoji:"🦅", trait:"FLYING", traitName:"そらをとぶ", rarity:"RARE",      activeTime:"DAY",   waterAnimal:false,
    description:"しりょくは にんげんの ８ばい！たかい そらから じめんを はしる ウサギが みえるよ。はばたかずに かぜに のって くるくる まわる「サーマル」で らくに たかく とべる！",
    quiz:{ q:"ワシの しりょく は ひとの なんばい？",            choices:["２ばい","５ばい","８ばい"], ans:2 } },
  { id:"frog",      name:"アマガエル",      emoji:"🐸", trait:"FAST",   traitName:"すばやい",   rarity:"COMMON",    activeTime:"ANY",   waterAnimal:true,
    description:"ひふで こきゅうも できるし みずも のめるよ！あしの ゆびに すいばんが あって、かがみも のぼれる。あめの まえに よく なくので「てんきよほう カエル」ともよばれるよ！",
    quiz:{ q:"カエルは ひふで なにを するの？",                choices:["こきゅうする","みずをのむ","りょうほう"], ans:2 } },
  { id:"yeti",      name:"イエティ",        emoji:"🦍", trait:"LARGE",  traitName:"おおきい",   rarity:"LEGENDARY", activeTime:"ANY",   waterAnimal:false,
    description:"ヒマラヤさんみゃくに すむと いわれる しんぴの きょじん！でっかい あしあとが みつかっているけど、しょうたいは いまも なぞ。「せつじんおに」と おそれられる せかい さいきょうクラスの UMA！",
    quiz:{ q:"イエティが すむ といわれるのは？",               choices:["アマゾン","ヒマラヤさんみゃく","しんかい"], ans:1 } },
  { id:"trex",      name:"ティラノサウルス",emoji:"🦖", trait:"LARGE",  traitName:"おおきい",   rarity:"LEGENDARY", activeTime:"ANY",   waterAnimal:false,
    description:"かみつく ちからは ちきゅうの いきもの ざんしで さいきょうクラス！みじかい うでは じつは きんにくもりもりで つよかった。いまの とりは この この しそんと いわれているよ！",
    quiz:{ q:"ティラノサウルスの うでは なぜ みじかい？",       choices:["そだたなかった","こうかがえきだった","たべものを とるため"], ans:1 } },
];

const RARITY_COLOR: Record<string, string> = {
  COMMON:"#6b7280", RARE:"#3b82f6", EPIC:"#8b5cf6", LEGENDARY:"#f59e0b",
};
const RARITY_JP: Record<string, string> = {
  COMMON:"ふつう", RARE:"めずらしい", EPIC:"すごい！", LEGENDARY:"でんせつ！！",
};

const TIMES: TimeState[] = [
  { id:"MORNING", name:"よあけ",   skyTop:"#2d1b69", skyBot:"#9333ea" },
  { id:"NOON",    name:"ひるま",   skyTop:"#87CEEB", skyBot:"#B3E5FC" },
  { id:"EVENING", name:"ゆうがた", skyTop:"#7f1d1d", skyBot:"#ea580c" },
  { id:"NIGHT",   name:"よる",     skyTop:"#000020", skyBot:"#0f172a" },
];

const ROUTE_TEMPLATES: RouteTemplate[] = [
  { hintEmoji:"🐾", hintText:"じめんに おおきな あしあとが ある",         staminaCost:5, tags:["large","legendary"], btnColor:"amber",
    logText:"おおきな あしあとを たどって すすんだ。",
    eventWeight:{ large:2.5, fast:0.6, flying:0.4, water:0.3, legendary:1.8, carnivore:1.2, herbivore:0.8, poop:0.5, recovery:0.5, hazard:0.4, encounter:1.6 } },
  { hintEmoji:"🐾", hintText:"ちいさな あしあとが ちらばっている",         staminaCost:5, tags:["fast","herbivore"],  btnColor:"green",
    logText:"ちいさな あしあとを たどって すすんだ。",
    eventWeight:{ large:0.4, fast:2.2, flying:0.8, water:0.5, legendary:0.4, carnivore:0.5, herbivore:2.0, poop:0.8, recovery:1.2, hazard:0.5, encounter:1.4 } },
  { hintEmoji:"💧", hintText:"むこうから みずの おとが する",               staminaCost:6, tags:["water","fast"],      btnColor:"blue",
    logText:"みずの おとを たよりに すすんだ。",
    eventWeight:{ large:1.0, fast:1.5, flying:0.6, water:3.5, legendary:0.6, carnivore:1.0, herbivore:1.0, poop:0.8, recovery:1.5, hazard:0.6, encounter:1.3 } },
  { hintEmoji:"💩", hintText:"くさい ニオイが プンプンする…",               staminaCost:4, tags:["poop","large"],      btnColor:"yellow",
    logText:"においを かぎながら すすんだ。",
    eventWeight:{ large:1.8, fast:0.7, flying:0.3, water:0.5, legendary:0.8, carnivore:1.5, herbivore:0.8, poop:3.0, recovery:0.3, hazard:0.8, encounter:1.2 } },
  { hintEmoji:"🌿", hintText:"おいしそうな きのみが なっている",             staminaCost:3, tags:["herbivore","recovery"], btnColor:"green",
    logText:"きのみを たべながら のんびり すすんだ。",
    eventWeight:{ large:0.5, fast:1.2, flying:1.0, water:0.8, legendary:0.3, carnivore:0.4, herbivore:2.5, poop:0.5, recovery:3.0, hazard:0.3, encounter:1.0 } },
  { hintEmoji:"⚠️", hintText:"しげみが ガサガサ はげしく ゆれている！",     staminaCost:7, tags:["carnivore","hazard"], btnColor:"red",
    logText:"ガサガサいう しげみの ほうへ ふみこんだ…！",
    eventWeight:{ large:1.8, fast:1.2, flying:0.5, water:0.3, legendary:1.5, carnivore:3.0, herbivore:0.3, poop:0.4, recovery:0.2, hazard:2.5, encounter:1.8 } },
  { hintEmoji:"🌑", hintText:"くらい かげが おちている…",                   staminaCost:5, tags:["flying","legendary"], btnColor:"purple",
    logText:"かげを たよりに うす暗いほうへ すすんだ。",
    eventWeight:{ large:1.0, fast:0.8, flying:3.0, water:0.4, legendary:2.0, carnivore:1.2, herbivore:0.5, poop:0.3, recovery:0.4, hazard:1.0, encounter:1.5 } },
  { hintEmoji:"🍄", hintText:"ふしぎな きのこが はえている",                 staminaCost:4, tags:["recovery","hazard"], btnColor:"purple",
    logText:"きのこの においに さそわれて すすんだ。",
    eventWeight:{ large:0.6, fast:0.9, flying:0.8, water:0.6, legendary:0.8, carnivore:0.5, herbivore:1.0, poop:0.5, recovery:2.0, hazard:2.0, encounter:1.1 } },
  { hintEmoji:"🪶", hintText:"はねが おちている",                           staminaCost:5, tags:["flying"],            btnColor:"blue",
    logText:"はねを みつけて その ほうへ すすんだ。",
    eventWeight:{ large:0.5, fast:0.8, flying:3.5, water:0.5, legendary:1.0, carnivore:0.6, herbivore:0.8, poop:0.4, recovery:0.8, hazard:0.5, encounter:1.4 } },
  { hintEmoji:"🌬️", hintText:"つめたい かぜが ふいてくる",                  staminaCost:8, tags:["legendary","hazard"], btnColor:"red",
    logText:"つめたい かぜの むこうへ すすんだ。",
    eventWeight:{ large:1.5, fast:0.7, flying:1.0, water:0.4, legendary:2.5, carnivore:1.5, herbivore:0.5, poop:0.3, recovery:0.4, hazard:1.8, encounter:1.3 } },
];

// 簡略化したハプニング（4種）
const SIMPLE_HAPPENINGS = [
  { text:"💩 どうぶつの フンを みつけた！ のうじょうで つかえそう！", staminaDelta:0,   color:"#d97706" },
  { text:"💥 きのねっこに つまずいた！ いたた…！",                    staminaDelta:-8,  color:"#f87171" },
  { text:"🍄 ふしぎな きのこを たべた！ げんきが でてきた！",          staminaDelta:+18, color:"#86efac" },
  { text:"💧 きれいな みずを のんだ！ さっぱりした！",                 staminaDelta:+8,  color:"#67e8f9" },
];

// ════════════════════════════════════════════════════════════════
//  ユーティリティ
// ════════════════════════════════════════════════════════════════

function generateRoutes(turn: number): RouteOption[] {
  const dirs = ["みぎ", "ひだり", "まえ", "けわしい みち", "ひろい みち"];
  const shuffled = [...ROUTE_TEMPLATES].sort(() => Math.random() - 0.5);
  const count = Math.random() < 0.4 ? 2 : 3;
  return shuffled.slice(0, count).map((tpl, i) => ({
    ...tpl,
    id:       `route_${turn}_${i}`,
    dirLabel: dirs[i] ?? "まえ",
  }));
}

function pickAnimal(ew: EventWeight, isNight: boolean, isWater: boolean): Animal | null {
  const candidates = ANIMALS.filter((a) => {
    const timeOk =
      a.activeTime === "ANY" ||
      (a.activeTime === "NIGHT" &&  isNight) ||
      (a.activeTime === "DAY"   && !isNight);
    const wOk = !a.waterAnimal || isWater;
    return timeOk && wOk;
  });
  if (!candidates.length) return null;
  // レアリティ重みで選出
  const weights: Record<string, number> = {
    COMMON: 1.0, RARE: ew.large * 0.5 + ew.flying * 0.5,
    EPIC: ew.carnivore * 0.6, LEGENDARY: ew.legendary * 0.4,
  };
  const pool = candidates.map(a => ({ a, w: Math.max(0.1, weights[a.rarity] ?? 1) }));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) return p.a; }
  return pool[pool.length - 1].a;
}

// ════════════════════════════════════════════════════════════════
//  CSS
// ════════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --font: 'Kosugi Maru', sans-serif;
    --pink:        #FF69B4; --pink-light:  #FFD6E7; --pink-shadow:  #C2185B;
    --green:       #4CAF50; --green-light: #C8F5CE; --green-shadow: #2E7D32;
    --yellow:      #FFCA28; --yellow-light:#FFF9C4; --yellow-shadow:#F57F17;
    --blue:        #42A5F5; --blue-light:  #BBDEFB; --blue-shadow:  #1565C0;
    --red:         #EF5350; --red-light:   #FFCDD2; --red-shadow:   #B71C1C;
    --purple:      #AB47BC; --purple-light:#EDE7F6; --purple-shadow:#6A1B9A;
    --amber:       #FFA726; --amber-light: #FFE0B2; --amber-shadow: #E65100;
  }

  /* ── Pop ボタン ── */
  .pop-btn {
    font-family: var(--font);
    border: none; outline: none; cursor: pointer;
    border-radius: 18px;
    padding: 12px 16px;
    font-size: 14px; font-weight: bold;
    width: 100%; text-align: left;
    transition: transform 0.08s, box-shadow 0.08s;
    transform: translateY(0);
    display: block;
  }
  .pop-btn:active:not(:disabled) {
    transform: translateY(4px);
  }
  .pop-btn:disabled { opacity: 0.42; cursor: not-allowed; pointer-events: none; }

  .pop-btn.pink   { background:var(--pink-light);   color:#880e4f; box-shadow:0 5px 0 var(--pink-shadow);   }
  .pop-btn.pink:active:not(:disabled)   { box-shadow:0 1px 0 var(--pink-shadow);   }
  .pop-btn.green  { background:var(--green-light);  color:#1b5e20; box-shadow:0 5px 0 var(--green-shadow);  }
  .pop-btn.green:active:not(:disabled)  { box-shadow:0 1px 0 var(--green-shadow);  }
  .pop-btn.yellow { background:var(--yellow-light); color:#5d4037; box-shadow:0 5px 0 var(--yellow-shadow); }
  .pop-btn.yellow:active:not(:disabled) { box-shadow:0 1px 0 var(--yellow-shadow); }
  .pop-btn.blue   { background:var(--blue-light);   color:#0d47a1; box-shadow:0 5px 0 var(--blue-shadow);   }
  .pop-btn.blue:active:not(:disabled)   { box-shadow:0 1px 0 var(--blue-shadow);   }
  .pop-btn.red    { background:var(--red-light);    color:#b71c1c; box-shadow:0 5px 0 var(--red-shadow);    }
  .pop-btn.red:active:not(:disabled)    { box-shadow:0 1px 0 var(--red-shadow);    }
  .pop-btn.purple { background:var(--purple-light); color:#4a148c; box-shadow:0 5px 0 var(--purple-shadow); }
  .pop-btn.purple:active:not(:disabled) { box-shadow:0 1px 0 var(--purple-shadow); }
  .pop-btn.amber  { background:var(--amber-light);  color:#bf360c; box-shadow:0 5px 0 var(--amber-shadow);  }
  .pop-btn.amber:active:not(:disabled)  { box-shadow:0 1px 0 var(--amber-shadow);  }

  /* ── タグバッジ ── */
  .tag-badge {
    display:inline-block; font-size:10px; padding:2px 8px;
    border-radius:12px; font-family:var(--font); font-weight:bold;
    white-space:nowrap;
  }

  /* ── ログ行 ── */
  .log-line {
    padding:3px 0; line-height:1.75; font-size:12px;
    font-family:var(--font);
    border-bottom:1px solid rgba(0,0,0,0.05);
    animation:logFadeIn 0.25s ease;
  }
  .log-line:last-child { border-bottom:none; }

  /* ── クイズボタン ── */
  .quiz-btn {
    background:#fff; border:2px solid #e2e8f0; color:#374151;
    font-family:var(--font); font-size:14px; font-weight:bold;
    padding:11px 14px; cursor:pointer; border-radius:14px;
    text-align:left; width:100%;
    transition:background 0.12s, border-color 0.12s, transform 0.08s;
  }
  .quiz-btn:hover:not(:disabled) { background:#f8fafc; border-color:#93c5fd; }
  .quiz-btn:active:not(:disabled) { transform:scale(0.98); }
  .quiz-btn:disabled { cursor:default; }
  .quiz-btn.correct  { background:#dcfce7; border-color:#22c55e; color:#15803d; }
  .quiz-btn.wrong    { background:#fee2e2; border-color:#ef4444; color:#b91c1c; }

  /* ── HP バー ── */
  .hp-bar-track { width:100%; height:10px; background:#e5e7eb; border-radius:8px; overflow:hidden; }
  .hp-bar-fill  { height:100%; border-radius:8px; transition:width 0.4s, background 0.4s; }

  /* ── Keyframes ── */
  @keyframes logFadeIn   { from{opacity:0;transform:translateX(-6px);}  to{opacity:1;transform:none;} }
  @keyframes aBounce     { 0%,100%{transform:translateY(0);}            50%{transform:translateY(-10px);} }
  @keyframes friendBounce{ 0%,100%{transform:scale(1);}                 40%{transform:scale(1.18);} }
  @keyframes pulse       { 0%,100%{opacity:1;}                          50%{opacity:0.35;} }
  @keyframes winPop      { 0%{transform:scale(0.4);opacity:0;}          65%{transform:scale(1.12);} 100%{transform:scale(1);opacity:1;} }
  @keyframes fpFade      { 0%{opacity:0.9;transform:scale(1);}          100%{opacity:0;transform:scale(2)translateY(-8px);} }
  @keyframes heartFloat  { 0%{transform:translateY(0)scale(1);opacity:1;} 100%{transform:translateY(-70px)scale(0.6);opacity:0;} }
  @keyframes rainFall    { 0%{transform:translateY(-10px);opacity:0;}   15%{opacity:0.7;} 85%{opacity:0.7;} 100%{transform:translateY(320px);opacity:0;} }
  @keyframes snowDrift   { 0%{transform:translateY(-8px)translateX(0)rotate(0deg);opacity:0;} 20%{opacity:0.85;} 100%{transform:translateY(320px)translateX(28px)rotate(360deg);opacity:0;} }
  @keyframes rainDiag    { 0%{transform:translateY(-10px)translateX(0);opacity:0;} 15%{opacity:0.8;} 85%{opacity:0.8;} 100%{transform:translateY(320px)translateX(90px);opacity:0;} }
  @keyframes quizAppear  { from{transform:translateY(18px);opacity:0;}  to{transform:translateY(0);opacity:1;} }
  @keyframes approachIn  { 0%{transform:scale(0.2)translateY(30px);opacity:0;} 60%{transform:scale(1.12)translateY(-6px);opacity:1;} 100%{transform:scale(1)translateY(0);opacity:1;} }
  @keyframes encFlash    { 0%{filter:brightness(1);}  18%{filter:brightness(2.8)saturate(0);} 100%{filter:brightness(1);} }
  @keyframes cloudDrift  { 0%,100%{transform:translateX(0);} 50%{transform:translateX(14px);} }
  @keyframes starTwinkle { 0%,100%{opacity:0.8;} 50%{opacity:0.2;} }
`;

// ════════════════════════════════════════════════════════════════
//  タグ定義
// ════════════════════════════════════════════════════════════════

const TAG_LABELS: Record<RouteTag, string> = {
  large:"おおきい", fast:"すばやい", flying:"そら", water:"みずべ",
  carnivore:"にくしょく", herbivore:"くさしょく", legendary:"でんせつ",
  poop:"フン", recovery:"かいふく", hazard:"きけん", neutral:"ふつう",
};
const TAG_BG: Record<RouteTag, string> = {
  large:"#fef3c7", fast:"#d1fae5", flying:"#e0e7ff", water:"#dbeafe",
  carnivore:"#fee2e2", herbivore:"#d1fae5", legendary:"#fef9c3",
  poop:"#fef3c7", recovery:"#dcfce7", hazard:"#fee2e2", neutral:"#f3f4f6",
};
const TAG_TEXT: Record<RouteTag, string> = {
  large:"#92400e", fast:"#065f46", flying:"#3730a3", water:"#1e40af",
  carnivore:"#991b1b", herbivore:"#065f46", legendary:"#78350f",
  poop:"#92400e", recovery:"#166534", hazard:"#991b1b", neutral:"#374151",
};

// ════════════════════════════════════════════════════════════════
//  ForestView
// ════════════════════════════════════════════════════════════════

interface ForestViewProps {
  timeId:       string;
  weatherLabel: string;
  weatherIcon:  string;
  showAnimal:   boolean;
  animal:       Animal | null;
  footprints:   Footprint[];
  hearts:       Heart[];
  isEncFlash:   boolean;
}

function ForestView({
  timeId, weatherLabel, weatherIcon,
  showAnimal, animal, footprints, hearts, isEncFlash,
}: ForestViewProps) {

  // 天気に応じた空グラデーション & エフェクト種別
  type FxType = "none" | "rain" | "snow" | "typhoon";
  let skyGrad  = "";
  let fx: FxType = "none";

  if (weatherLabel === "あめ") {
    skyGrad = "linear-gradient(to bottom,#546E7A 0%,#78909C 100%)";
    fx = "rain";
  } else if (weatherLabel === "ゆき") {
    skyGrad = "linear-gradient(to bottom,#B0BEC5 0%,#CFD8DC 100%)";
    fx = "snow";
  } else if (weatherLabel === "たいふう") {
    skyGrad = "linear-gradient(to bottom,#1a1a2e 0%,#4a3a6e 100%)";
    fx = "typhoon";
  } else {
    // はれ / もうしょ / くもり → 時間帯グラデーション
    const TIME_SKY: Record<string, string> = {
      MORNING: "linear-gradient(to bottom,#2d1b69 0%,#9333ea 100%)",
      NOON:    "linear-gradient(to bottom,#87CEEB 0%,#B3E5FC 100%)",
      EVENING: "linear-gradient(to bottom,#7f1d1d 0%,#ea580c 100%)",
      NIGHT:   "linear-gradient(to bottom,#000020 0%,#0f172a 100%)",
    };
    skyGrad = TIME_SKY[timeId] ?? TIME_SKY["NOON"];
    fx = "none";
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
          left:`${(i * 41 + 7) % 100}%`,
          top:`${(i * 29 + 5) % 55}%`,
          width: i % 4 === 0 ? 3 : 2,
          height: i % 4 === 0 ? 3 : 2,
          borderRadius:"50%",
          background:"#fff",
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
          position:"absolute", top:c.t, left:c.l,
          width:c.w, height:c.h,
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
      ].map(layer => (
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
          width: fx === "typhoon" ? 2 : 1.5,
          height: fx === "typhoon" ? 22 : 14,
          background: fx === "typhoon"
            ? "rgba(140,160,220,0.65)"
            : "rgba(160,205,255,0.6)",
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
          width:7, height:7, borderRadius:"50%",
          background:"rgba(255,255,255,0.88)",
          animation:`snowDrift ${2.3 + (i % 5) * 0.4}s linear ${(i * 0.14) % 2.2}s infinite`,
        }} />
      ))}

      {/* エンカウント中の動物 */}
      {showAnimal && animal && (
        <div style={{
          position:"absolute", inset:0,
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:20,
        }}>
          <div style={{
            fontSize:86, lineHeight:1,
            filter:"drop-shadow(0 4px 18px rgba(0,0,0,0.28))",
            animation:"aBounce 2.2s ease-in-out infinite",
          }}>
            {animal.emoji}
          </div>
        </div>
      )}

      {/* 足跡 */}
      {footprints.map(fp => (
        <div key={fp.id} style={{
          position:"absolute", bottom:"12%", left:`${fp.x}%`,
          fontSize:14, zIndex:25, pointerEvents:"none",
          animation:"fpFade 0.9s ease-out forwards",
        }}>👣</div>
      ))}

      {/* ハートエフェクト */}
      {hearts.map(h => (
        <div key={h.id} style={{
          position:"absolute", bottom:"28%", left:`${h.x}%`,
          fontSize:22, zIndex:30, pointerEvents:"none",
          animation:"heartFloat 1.3s ease-out forwards",
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
//  ログ行
// ════════════════════════════════════════════════════════════════

function LogLine({ text, color }: { text: string; color?: string }) {
  return (
    <div className="log-line" style={{ color: color || "#374151" }}>
      <span style={{ marginRight:5, opacity:0.35 }}>▷</span>
      {text}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  ルートカード
// ════════════════════════════════════════════════════════════════

interface RouteCardProps {
  route:      RouteOption;
  onClick:    (r: RouteOption) => void;
  disabled:   boolean;
}

function RouteCard({ route, onClick, disabled }: RouteCardProps) {
  return (
    <button
      className={`pop-btn ${route.btnColor || "green"}`}
      onClick={() => onClick(route)}
      disabled={disabled}
    >
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
        <span style={{ fontSize:22, flexShrink:0 }}>{route.hintEmoji}</span>
        <span style={{ flex:1, fontSize:13, lineHeight:1.4 }}>{route.hintText}</span>
        <span style={{ fontSize:12, fontWeight:"bold", flexShrink:0, opacity:0.75 }}>
          💚 -{route.staminaCost}
        </span>
      </div>
      <div style={{ display:"flex", gap:5, alignItems:"center", flexWrap:"wrap" }}>
        {route.tags.slice(0, 2).map(t => (
          <span key={t} className="tag-badge"
            style={{ background:TAG_BG[t], color:TAG_TEXT[t] }}>
            {TAG_LABELS[t]}
          </span>
        ))}
        <span style={{ fontSize:10, opacity:0.55, marginLeft:"auto" }}>{route.dirLabel}</span>
      </div>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
//  クイズパネル
// ════════════════════════════════════════════════════════════════

interface QuizPanelProps {
  animal:   Animal;
  onResult: (correct: boolean) => void;
}

function QuizPanel({ animal, onResult }: QuizPanelProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const q = animal.quiz;

  const handleSelect = useCallback((i: number) => {
    if (selected !== null) return;
    setSelected(i);
    setTimeout(() => onResult(i === q.ans), 950);
  }, [selected, q.ans, onResult]);

  const getBtnClass = (i: number) => {
    if (selected === null) return "";
    if (i === q.ans)      return " correct";   // 正解を緑表示（自分が選んだかどうかに関わらず）
    if (i === selected)   return " wrong";      // 選んだ間違いを赤表示
    return "";
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:9, animation:"quizAppear 0.28s ease" }}>
      {/* 動物絵文字 */}
      <div style={{ textAlign:"center", fontSize:56, lineHeight:1,
        animation:"aBounce 2s ease-in-out infinite" }}>
        {animal.emoji}
      </div>

      {/* 問題文（黄色カード） */}
      <div style={{
        fontFamily:"var(--font)", fontSize:14, fontWeight:"bold", color:"#1f2937",
        padding:"11px 14px", background:"#fef9c3",
        borderRadius:14, lineHeight:1.55,
        border:"2px solid #fde047",
      }}>
        {q.q}
      </div>

      {/* 選択肢 */}
      {q.choices.map((c, i) => (
        <button key={i}
          className={`quiz-btn${getBtnClass(i)}`}
          onClick={() => handleSelect(i)}
          disabled={selected !== null}>
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
//  スタミナバー
// ════════════════════════════════════════════════════════════════

function StaminaBar({ stamina }: { stamina: number }) {
  const pct   = Math.max(0, stamina);
  const color = pct > 60 ? "#22c55e" : pct > 30 ? "#f59e0b" : "#ef4444";
  const bg    = pct > 60 ? "#dcfce7" : pct > 30 ? "#fef3c7" : "#fee2e2";
  return (
    <div>
      <div style={{
        display:"flex", justifyContent:"space-between",
        fontFamily:"var(--font)", fontSize:11, color:"#6b7280", marginBottom:3,
      }}>
        <span>💚 たいりょく</span>
        <span style={{ color, fontWeight:"bold" }}>{stamina} / 100</span>
      </div>
      <div className="hp-bar-track" style={{ background:bg }}>
        <div className="hp-bar-fill" style={{ width:`${pct}%`, background:color }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  メインコンポーネント
// ════════════════════════════════════════════════════════════════

type Phase = "EXPLORE" | "ENCOUNTER" | "APPROACHING" | "QUIZ" | "RESULT" | "GAMEOVER";

export default function HuntClient({ kidId }: { kidId: string }) {
  const stamina        = useSafariStore((s) => s.stamina);
  const consumeStamina = useSafariStore((s) => s.consumeStamina);
  const restoreStamina = useSafariStore((s) => s.restoreStamina);
  const recoverStamina = useSafariStore((s) => s.recoverStamina);
  const weather        = useWeather();

  const [phase,         setPhase]        = useState<Phase>("EXPLORE");
  const [turn,          setTurn]         = useState(0);
  const [friends,       setFriends]      = useState<string[]>([]);
  const [animal,        setAnimal]       = useState<Animal | null>(null);
  const [quizCorrect,   setQuizCorrect]  = useState<boolean | null>(null);
  const [logs,          setLogs]         = useState<LogEntry[]>([
    { text:"みちが まえに つづいている。どこへ すすむ？", color:"#059669" },
  ]);
  const [routes,        setRoutes]       = useState<RouteOption[]>(() => generateRoutes(0));
  const [selectedRoute, setSelectedRoute]= useState<string | null>(null);
  const [isEncounter,   setIsEncounter]  = useState(false);
  const [isEncFlash,    setIsEncFlash]   = useState(false);
  const [footprints,    setFootprints]   = useState<Footprint[]>([]);
  const [hearts,        setHearts]       = useState<Heart[]>([]);
  const [busy,          setBusy]         = useState(false);

  const logRef     = useRef<HTMLDivElement>(null);
  const currentTime = TIMES[turn % 4];

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const addLog = useCallback((text: string, color?: string) => {
    setLogs(prev => [...prev.slice(-22), { text, color }]);
  }, []);

  const spawnFootprint = useCallback(() => {
    const id = Date.now();
    const x  = 28 + Math.random() * 44;
    setFootprints(prev => [...prev, { id, x }]);
    setTimeout(() => setFootprints(prev => prev.filter(f => f.id !== id)), 950);
  }, []);

  const spawnHearts = useCallback(() => {
    const batch = Array.from({ length: 5 }, (_, i) => ({
      id: Date.now() + i,
      x:  15 + Math.random() * 70,
    }));
    setHearts(prev => [...prev, ...batch]);
    setTimeout(() => setHearts(prev => prev.filter(h => !batch.find(b => b.id === h.id))), 1400);
  }, []);

  // ── ルート選択 ──────────────────────────────────────────────
  const chooseRoute = useCallback((route: RouteOption) => {
    if (busy) return;
    setBusy(true);
    setSelectedRoute(route.id);

    if (stamina - route.staminaCost <= 0) {
      consumeStamina(stamina);
      addLog("たいりょくが なくなった…", "#ef4444");
      setTimeout(() => { setPhase("GAMEOVER"); setBusy(false); }, 600);
      return;
    }
    consumeStamina(route.staminaCost);

    const nextTurn = turn + 1;
    setTurn(nextTurn);
    spawnFootprint();
    addLog(`${route.hintEmoji} ${route.logText}`);

    const nextTime = TIMES[nextTurn % 4];
    if (turn % 4 === 3) {
      setTimeout(() => addLog(`── ${nextTime.name}に なった。 ──`, "#94a3b8"), 420);
    }

    // ハプニング（30%）
    let hapDelay = 0;
    if (Math.random() < 0.30) {
      hapDelay = 260;
      const hap = SIMPLE_HAPPENINGS[Math.floor(Math.random() * SIMPLE_HAPPENINGS.length)];
      setTimeout(() => {
        addLog(hap.text, hap.color);
        if      (hap.staminaDelta > 0) restoreStamina(hap.staminaDelta);
        else if (hap.staminaDelta < 0) consumeStamina(-hap.staminaDelta);
      }, hapDelay);
    }

    // エンカウント判定
    const isNight = nextTime.id === "NIGHT";
    const isWater = weather.id === "rainy" || weather.id === "typhoon"
                 || route.eventWeight.water > 1.5;
    const ew      = route.eventWeight;
    const chance  = Math.min((isNight ? 0.50 : 0.38) * (ew.encounter ?? 1), 0.92);

    setTimeout(() => {
      if (Math.random() < chance) {
        const enc = pickAnimal(ew, isNight, isWater);
        if (enc) {
          setAnimal(enc);
          setIsEncFlash(true);
          setTimeout(() => setIsEncFlash(false), 480);
          setIsEncounter(true);
          setTimeout(() => {
            addLog(`💕 ${enc.name}が あらわれた！`, "#ec4899");
            addLog(`${RARITY_JP[enc.rarity]}のどうぶつ！`, RARITY_COLOR[enc.rarity]);
            setPhase("ENCOUNTER");
            setBusy(false);
            setSelectedRoute(null);
          }, 320);
          return;
        }
      }
      // エンカウントなし → 次のルートへ
      const next = generateRoutes(nextTurn);
      setRoutes(next);
      addLog("みちが まえに つづいている。どっちへ すすむ？", "#059669");
      setPhase("EXPLORE");
      setBusy(false);
      setSelectedRoute(null);
    }, Math.max(hapDelay + 680, 720));
  }, [busy, stamina, turn, weather, spawnFootprint, addLog, consumeStamina, restoreStamina]);

  // ── はなしかける → APPROACHING → QUIZ ───────────────────────
  const doTalk = useCallback(() => {
    if (!animal) return;
    addLog(`💬 ${animal.name}に そっと はなしかけた…`, "#7c3aed");
    setPhase("APPROACHING");
    setTimeout(() => setPhase("QUIZ"), 850);
  }, [animal, addLog]);

  // ── そっとはなれる ─────────────────────────────────────────
  const doFlee = useCallback(() => {
    addLog("🌿 そっと その場を はなれた。", "#6b7280");
    setIsEncounter(false);
    setAnimal(null);
    const next = generateRoutes(turn);
    setRoutes(next);
    addLog("みちが まえに つづいている。どっちへ すすむ？", "#059669");
    setPhase("EXPLORE");
  }, [addLog, turn]);

  // ── クイズ結果 ─────────────────────────────────────────────
  const onQuizResult = useCallback((correct: boolean) => {
    if (!animal) return;
    setIsEncounter(false);
    if (correct) {
      setFriends(prev => [...prev, animal.emoji]);
      // 図鑑(DB CaughtAnimal)へ永続化。失敗してもゲーム進行は止めない（ログのみ）。
      void recordActiveHuntCatch(kidId, animal.id).then((r) => {
        if (!r.success) console.warn("[hunt] catch not recorded:", r.error);
      });
      addLog(`💖 せいかい！ ${animal.name}と ともだちになれた！`, "#ec4899");
      spawnHearts();
    } else {
      addLog(`😢 ざんねん… ${animal.name}は にげちゃった。`, "#ef4444");
    }
    setQuizCorrect(correct);
    setPhase("RESULT");
  }, [animal, addLog, kidId, spawnHearts]);

  // ── たんけんをつづける ─────────────────────────────────────
  const doContinue = useCallback(() => {
    setAnimal(null);
    setQuizCorrect(null);
    const next = generateRoutes(turn);
    setRoutes(next);
    addLog("みちが まえに つづいている。どっちへ すすむ？", "#059669");
    setPhase("EXPLORE");
  }, [addLog, turn]);

  // ── キャンプへかえる ───────────────────────────────────────
  const doRetreat = useCallback(() => {
    addLog("🏕️ キャンプへ かえった。", "#6b7280");
    setTimeout(() => setPhase("GAMEOVER"), 500);
  }, [addLog]);

  // ── もういちどはじめる ─────────────────────────────────────
  const doRestart = useCallback(() => {
    recoverStamina();
    setPhase("EXPLORE");
    setTurn(0);
    setFriends([]);
    setAnimal(null);
    setQuizCorrect(null);
    setIsEncounter(false);
    setIsEncFlash(false);
    setSelectedRoute(null);
    setBusy(false);
    setRoutes(generateRoutes(0));
    setLogs([{ text:"あたらしい たんけんが はじまった！ どこへ すすむ？", color:"#059669" }]);
  }, [recoverStamina]);

  // ── ForestView に渡す showAnimal フラグ ───────────────────
  const showAnimalInForest = isEncounter &&
    (phase === "ENCOUNTER" || phase === "APPROACHING" || phase === "QUIZ");

  // ════════════════════════════════════════════════════════════
  //  レンダリング
  // ════════════════════════════════════════════════════════════

  return (
    <div style={{
      width:"100%", minHeight:"100vh",
      background:"#f0fdf4",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <style>{CSS}</style>

      {/* ── メインシェル（iPad縦向き最適化） ── */}
      <div style={{
        width:"100%", maxWidth:768, height:"100svh",
        display:"flex", flexDirection:"column",
        background:"#ffffff",
        fontFamily:"var(--font)",
        overflow:"hidden",
      }}>

        {/* ══ 森ビュー（300px） ══ */}
        <div style={{ flex:"0 0 300px", position:"relative", overflow:"hidden",
          borderBottom:"3px solid #e2e8f0" }}>
          <ForestView
            timeId={currentTime.id}
            weatherLabel={weather.label}
            weatherIcon={weather.icon}
            showAnimal={showAnimalInForest}
            animal={animal}
            footprints={footprints}
            hearts={hearts}
            isEncFlash={isEncFlash}
          />

          {/* 時間帯バッジ（左上） */}
          <div style={{
            position:"absolute", top:8, left:8, zIndex:50,
            fontFamily:"var(--font)", fontSize:11, fontWeight:"bold",
            background:"rgba(255,255,255,0.88)", color:"#374151",
            padding:"3px 10px", borderRadius:12,
            boxShadow:"0 1px 4px rgba(0,0,0,0.12)",
          }}>
            {currentTime.name}　{turn}ターンめ
          </div>

          {/* エンカウントバッジ（下部） */}
          {isEncounter && animal && (
            <div style={{
              position:"absolute", bottom:9, left:0, right:0,
              textAlign:"center", zIndex:50,
              fontFamily:"var(--font)", fontSize:14, fontWeight:"bold",
              color:"#fff",
              textShadow:"0 2px 10px rgba(0,0,0,0.55)",
              animation:"pulse 0.65s ease-in-out infinite",
            }}>
              💕 なかよくなりたい！
            </div>
          )}
        </div>

        {/* ══ ログエリア（120px） ══ */}
        <div ref={logRef} style={{
          flex:"0 0 120px",
          background:"#f8fafc",
          overflowY:"auto",
          padding:"7px 14px",
          borderBottom:"2px solid #e2e8f0",
          scrollbarWidth:"thin",
          scrollbarColor:"#cbd5e1 transparent",
        }}>
          {logs.map((l, i) => (
            <LogLine key={i} text={l.text} color={l.color} />
          ))}
        </div>

        {/* ══ コマンドパネル（flex:1） ══ */}
        <div style={{
          flex:1, minHeight:0,
          background:"#ffffff",
          display:"flex", flexDirection:"column",
          padding:"10px 14px 16px",
          gap:8, overflowY:"auto",
        }}>

          {/* スタミナ + ともだちカウンター */}
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ flex:1 }}><StaminaBar stamina={stamina} /></div>
            <div style={{
              fontFamily:"var(--font)", fontSize:12, fontWeight:"bold",
              color:"#059669",
              background:"#f0fdf4", padding:"4px 10px",
              borderRadius:12, border:"1px solid #bbf7d0",
              flexShrink:0, whiteSpace:"nowrap",
            }}>
              🐾 {friends.length}ともだち
            </div>
          </div>

          {/* ─── EXPLORE フェーズ ─── */}
          {phase === "EXPLORE" && (
            <div style={{
              display:"flex", flexDirection:"column", gap:8, flex:1,
              animation:"quizAppear 0.22s ease",
            }}>
              <div style={{
                fontFamily:"var(--font)", fontSize:11, color:"#9ca3af",
                letterSpacing:"0.04em",
              }}>
                どの みちに すすむ？
              </div>
              {routes.map(r => (
                <RouteCard key={r.id} route={r} onClick={chooseRoute}
                  disabled={busy || selectedRoute === r.id} />
              ))}
              <button className="pop-btn red"
                onClick={doRetreat} disabled={busy}
                style={{ marginTop:"auto" }}>
                🏕️ キャンプへ かえる
              </button>
            </div>
          )}

          {/* ─── ENCOUNTER フェーズ ─── */}
          {phase === "ENCOUNTER" && animal && (
            <div style={{
              display:"flex", flexDirection:"column", gap:10,
              animation:"quizAppear 0.25s ease",
            }}>
              {/* 動物カード */}
              <div style={{
                textAlign:"center", padding:"14px 16px",
                background:"#fdf2f8", borderRadius:18,
                border:"2px solid #fce7f3",
              }}>
                <div style={{ fontSize:66, lineHeight:1, marginBottom:6 }}>
                  {animal.emoji}
                </div>
                <div style={{
                  fontFamily:"var(--font)", fontSize:16, fontWeight:"bold",
                  color:"#9d174d", marginBottom:6,
                }}>
                  💕 {animal.name} が あらわれた！
                </div>
                {/* 動物説明（fun fact） */}
                <div style={{
                  fontFamily:"var(--font)", fontSize:12, color:"#374151",
                  lineHeight:1.7, textAlign:"left",
                  background:"#fff7ed", borderRadius:12,
                  padding:"10px 12px", marginBottom:6,
                  border:"1px solid #fed7aa",
                }}>
                  <span style={{ fontSize:11, color:"#ea580c", fontWeight:"bold", display:"block", marginBottom:3 }}>
                    📖 しってた？
                  </span>
                  {animal.description}
                </div>
                <div style={{
                  fontFamily:"var(--font)", fontSize:12, color:"#9d174d",
                  fontWeight:"bold",
                }}>
                  クイズに こたえて なかよくなろう！
                </div>
              </div>

              {/* はなしかける */}
              <button className="pop-btn pink" onClick={doTalk}>
                💬 はなしかける（クイズに チャレンジ！）
              </button>

              {/* その場をはなれる */}
              <button className="pop-btn red" onClick={doFlee}>
                🌿 そっと その場を はなれる
              </button>
            </div>
          )}

          {/* ─── APPROACHING フェーズ ─── */}
          {phase === "APPROACHING" && animal && (
            <div style={{
              flex:1, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:10,
            }}>
              <div style={{
                fontFamily:"var(--font)", fontSize:18, fontWeight:"bold",
                color:"#9d174d",
                animation:"pulse 0.55s ease-in-out infinite",
              }}>
                ちかづいています…
              </div>
              <div style={{ display:"flex", gap:6, fontSize:22 }}>
                {["🐾","🐾","🐾"].map((c, i) => (
                  <span key={i} style={{
                    display:"inline-block",
                    animation:`pulse 0.55s ${i * 0.16}s ease-in-out infinite`,
                  }}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* ─── QUIZ フェーズ ─── */}
          {phase === "QUIZ" && animal && (
            <div style={{ flex:1, overflowY:"auto" }}>
              <QuizPanel animal={animal} onResult={onQuizResult} />
            </div>
          )}

          {/* ─── RESULT フェーズ ─── */}
          {phase === "RESULT" && animal && (
            <div style={{
              flex:1, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:12,
              animation:"quizAppear 0.3s ease",
            }}>
              {quizCorrect ? (
                <>
                  <div style={{
                    fontFamily:"var(--font)", fontSize:22, fontWeight:"bold",
                    color:"#ec4899", textAlign:"center",
                    animation:"winPop 0.4s ease",
                  }}>
                    💖 ともだちになれた！
                  </div>
                  <div style={{
                    fontSize:66, lineHeight:1,
                    animation:"friendBounce 0.85s ease-in-out infinite",
                  }}>
                    {animal.emoji}
                  </div>
                  {/* 正解後：動物説明カード */}
                  <div style={{
                    fontFamily:"var(--font)", fontSize:12, color:"#374151",
                    lineHeight:1.7, textAlign:"left",
                    background:"#f0fdf4", borderRadius:14,
                    padding:"12px 14px", width:"100%",
                    border:"2px solid #bbf7d0",
                  }}>
                    <span style={{ fontSize:11, color:"#059669", fontWeight:"bold", display:"block", marginBottom:4 }}>
                      ✨ {animal.name} の すごい ところ
                    </span>
                    {animal.description}
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontFamily:"var(--font)", fontSize:18, fontWeight:"bold",
                    color:"#9ca3af", textAlign:"center",
                  }}>
                    ── にげちゃった… ──
                  </div>
                  {/* 不正解後：説明で学べる */}
                  <div style={{
                    fontFamily:"var(--font)", fontSize:12, color:"#374151",
                    lineHeight:1.7, textAlign:"left",
                    background:"#fefce8", borderRadius:14,
                    padding:"12px 14px", width:"100%",
                    border:"2px solid #fde047",
                  }}>
                    <span style={{ fontSize:11, color:"#ca8a04", fontWeight:"bold", display:"block", marginBottom:4 }}>
                      📖 おぼえておこう！ {animal.emoji} {animal.name}
                    </span>
                    {animal.description}
                  </div>
                </>
              )}
              <button className="pop-btn green" onClick={doContinue}
                style={{ width:"100%", marginTop:6 }}>
                🌿 たんけんを つづける
              </button>
            </div>
          )}

          {/* ─── GAMEOVER フェーズ ─── */}
          {phase === "GAMEOVER" && (
            <div style={{
              flex:1, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:12,
              animation:"quizAppear 0.35s ease",
            }}>
              <div style={{
                fontFamily:"var(--font)", fontSize:13, color:"#6b7280",
                textAlign:"center",
              }}>
                {stamina <= 0
                  ? "── たいりょく ゼロ！ ──"
                  : "── キャンプに かえった ──"}
              </div>

              {/* ともだちリスト */}
              <div style={{
                background:"#f0fdf4", border:"2px solid #bbf7d0",
                borderRadius:18, padding:"16px 24px",
                textAlign:"center", width:"100%",
              }}>
                <div style={{
                  fontFamily:"var(--font)", fontSize:11,
                  color:"#6b7280", marginBottom:8,
                }}>
                  ともだちになった どうぶつ
                </div>
                <div style={{
                  fontSize:28, minHeight:36,
                  letterSpacing:6, marginBottom:6,
                }}>
                  {friends.length > 0 ? friends.join(" ") : "──"}
                </div>
                <div style={{
                  fontFamily:"var(--font)", fontSize:14,
                  fontWeight:"bold", color:"#059669",
                }}>
                  {friends.length}ひきと ともだちになれた！
                </div>
              </div>

              {/* もういちどはじめる */}
              <button className="pop-btn blue" onClick={doRestart}
                style={{ width:"100%" }}>
                🔄 もういちど はじめる
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
