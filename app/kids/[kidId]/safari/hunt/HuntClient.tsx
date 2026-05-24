"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSafariStore } from "@/store/useSafariStore";
import type { AnimalRarity } from "@/types/safari";

// ════════════════════════════════════════════════════════════════
//  型定義
// ════════════════════════════════════════════════════════════════

type RouteTag =
  | "large" | "fast" | "flying" | "water"
  | "carnivore" | "herbivore" | "legendary"
  | "poop" | "recovery" | "hazard" | "neutral";

interface EventWeight {
  large:      number;
  fast:       number;
  flying:     number;
  water:      number;
  legendary:  number;
  carnivore:  number;
  herbivore:  number;
  poop:       number;
  recovery:   number;
  hazard:     number;
  encounter:  number;
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
  btnClass:    string;
}

type RouteTemplate = Omit<RouteOption, "id" | "dirLabel">;

interface Quiz {
  q:       string;
  choices: string[];
  ans:     number;
}

interface Animal {
  id:          string;
  name:        string;
  emoji:       string;
  trait:       "FAST" | "LARGE" | "FLYING";
  traitName:   string;
  rarity:      "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  activeTime:  "DAY" | "NIGHT" | "ANY";
  waterAnimal: boolean;
  quiz:        Quiz;
}

interface HappeningItem {
  emoji: string;
  name:  string;
}

interface Happening {
  id:           string;
  baseWeight:   number;
  tag:          RouteTag;
  staminaDelta: number;
  fx:           "poop" | "bigshake" | "shake" | "rainbow" | "none";
  color:        string;
  text:         string;
  item:         HappeningItem | null;
}

interface TimeState {
  id:       string;
  name:     string;
  skyTop:   string;
  skyMid:   string;
  skyBot:   string;
  vignet:   number;
  fogAlpha: number;
}

interface Weather {
  id:   string;
  name: string;
  icon: string;
}

interface LogEntry {
  text:  string;
  color: string | undefined;
}

interface Footprint {
  id: number;
  x:  number;
}

interface CombatResult {
  hit:    boolean;
  animal: Animal;
  bonus:  string | null;
}

interface TimingResult {
  label: string;
  score: number;
}

// ════════════════════════════════════════════════════════════════
//  マスターデータ
// ════════════════════════════════════════════════════════════════

const ANIMALS: Animal[] = [
  { id:"rabbit",    name:"ウサギ",          emoji:"🐰", trait:"FAST",   traitName:"すばやい",   rarity:"COMMON",    activeTime:"DAY",   waterAnimal:false,
    quiz:{ q:"ウサギの ながい みみは なんの ため？", choices:["おとを よくきくため","かざりのため","まくらに なるため"], ans:0 } },
  { id:"deer",      name:"シカ",            emoji:"🦌", trait:"FAST",   traitName:"すばやい",   rarity:"COMMON",    activeTime:"DAY",   waterAnimal:false,
    quiz:{ q:"シカの つので わかること は？", choices:["オスかメスか","なんさいか","なにを たべるか"], ans:1 } },
  { id:"lion",      name:"ライオン",        emoji:"🦁", trait:"LARGE",  traitName:"おおきい",   rarity:"EPIC",      activeTime:"ANY",   waterAnimal:false,
    quiz:{ q:"ライオンの むれの リーダーは？", choices:["いちばん おおきい オス","メスたち","いちばん つよい コ"], ans:1 } },
  { id:"crocodile", name:"ワニ",            emoji:"🐊", trait:"LARGE",  traitName:"おおきい",   rarity:"RARE",      activeTime:"ANY",   waterAnimal:true,
    quiz:{ q:"ワニが じっと うごかない りゆうは？", choices:["ねむっている","たいおんを あげるため","こわいから"], ans:1 } },
  { id:"hippo",     name:"カバ",            emoji:"🦛", trait:"LARGE",  traitName:"おおきい",   rarity:"RARE",      activeTime:"NIGHT", waterAnimal:true,
    quiz:{ q:"カバが あかい あせを かく りゆうは？", choices:["あつくて あせが でる","ひふを まもるため","おこっているサイン"], ans:1 } },
  { id:"owl",       name:"ワシミミズク",    emoji:"🦉", trait:"FLYING", traitName:"そらをとぶ", rarity:"RARE",      activeTime:"NIGHT", waterAnimal:false,
    quiz:{ q:"フクロウは くびを どのくらい まわせる？", choices:["90ど","180ど","270ど"], ans:2 } },
  { id:"eagle",     name:"ワシ",            emoji:"🦅", trait:"FLYING", traitName:"そらをとぶ", rarity:"RARE",      activeTime:"DAY",   waterAnimal:false,
    quiz:{ q:"ワシの しりょく は ひとの なんばい？", choices:["２ばい","５ばい","８ばい"], ans:2 } },
  { id:"frog",      name:"アマガエル",      emoji:"🐸", trait:"FAST",   traitName:"すばやい",   rarity:"COMMON",    activeTime:"ANY",   waterAnimal:true,
    quiz:{ q:"カエルは ひふで なにを するの？", choices:["こきゅうする","みずをのむ","りょうほう"], ans:2 } },
  { id:"yeti",      name:"イエティ",        emoji:"🦍", trait:"LARGE",  traitName:"おおきい",   rarity:"LEGENDARY", activeTime:"ANY",   waterAnimal:false,
    quiz:{ q:"イエティが すむ といわれるのは？", choices:["アマゾン","ヒマラヤさんみゃく","しんかい"], ans:1 } },
  { id:"trex",      name:"ティラノサウルス",emoji:"🦖", trait:"LARGE",  traitName:"おおきい",   rarity:"LEGENDARY", activeTime:"ANY",   waterAnimal:false,
    quiz:{ q:"ティラノサウルスの うでは なぜ みじかい？", choices:["そだたなかった","こうかがえきだった","たべものを とるため"], ans:1 } },
];

const RARITY_COLOR: Record<string, string> = {
  COMMON:"#6b7280", RARE:"#3b82f6", EPIC:"#8b5cf6", LEGENDARY:"#f59e0b",
};
const RARITY_JP: Record<string, string> = {
  COMMON:"ふつう", RARE:"めずらしい", EPIC:"すごい！", LEGENDARY:"でんせつ！！",
};

const TIMES: TimeState[] = [
  { id:"MORNING", name:"よあけ",   skyTop:"#1a0a2e", skyMid:"#2d1b69", skyBot:"#7c3aed", vignet:0.35, fogAlpha:0.15 },
  { id:"NOON",    name:"ひるま",   skyTop:"#0c4a6e", skyMid:"#0369a1", skyBot:"#38bdf8", vignet:0.15, fogAlpha:0.05 },
  { id:"EVENING", name:"ゆうがた", skyTop:"#1c0a0a", skyMid:"#7f1d1d", skyBot:"#ea580c", vignet:0.55, fogAlpha:0.25 },
  { id:"NIGHT",   name:"よる",     skyTop:"#000000", skyMid:"#0a0a1a", skyBot:"#0f172a", vignet:0.85, fogAlpha:0.55 },
];

const WEATHERS: Weather[] = [
  { id:"SUNNY", name:"はれ", icon:"☀️" },
  { id:"RAIN",  name:"あめ", icon:"🌧" },
  { id:"SNOW",  name:"ゆき", icon:"❄️" },
];

const ROUTE_TEMPLATES: RouteTemplate[] = [
  {
    hintEmoji:"🐾", hintText:"じめんに おおきな あしあとが ある",
    staminaCost:5, tags:["large","legendary"], btnClass:"amber",
    logText:"おおきな あしあとを たどって すすんだ。",
    eventWeight:{ large:2.5, fast:0.6, flying:0.4, water:0.3, legendary:1.8, carnivore:1.2, herbivore:0.8, poop:0.5, recovery:0.5, hazard:0.4, encounter:1.6 },
  },
  {
    hintEmoji:"🐾", hintText:"ちいさな あしあとが ちらばっている",
    staminaCost:5, tags:["fast","herbivore"], btnClass:"",
    logText:"ちいさな あしあとを たどって すすんだ。",
    eventWeight:{ large:0.4, fast:2.2, flying:0.8, water:0.5, legendary:0.4, carnivore:0.5, herbivore:2.0, poop:0.8, recovery:1.2, hazard:0.5, encounter:1.4 },
  },
  {
    hintEmoji:"💧", hintText:"むこうから みずの おとが する",
    staminaCost:6, tags:["water","fast"], btnClass:"blue",
    logText:"みずの おとを たよりに すすんだ。",
    eventWeight:{ large:1.0, fast:1.5, flying:0.6, water:3.5, legendary:0.6, carnivore:1.0, herbivore:1.0, poop:0.8, recovery:1.5, hazard:0.6, encounter:1.3 },
  },
  {
    hintEmoji:"💩", hintText:"くさい ニオイが プンプンする…",
    staminaCost:4, tags:["poop","large"], btnClass:"",
    logText:"においを かぎながら すすんだ。",
    eventWeight:{ large:1.8, fast:0.7, flying:0.3, water:0.5, legendary:0.8, carnivore:1.5, herbivore:0.8, poop:3.0, recovery:0.3, hazard:0.8, encounter:1.2 },
  },
  {
    hintEmoji:"🌿", hintText:"おいしそうな きのみが なっている",
    staminaCost:3, tags:["herbivore","recovery"], btnClass:"green",
    logText:"きのみを たべながら のんびり すすんだ。",
    eventWeight:{ large:0.5, fast:1.2, flying:1.0, water:0.8, legendary:0.3, carnivore:0.4, herbivore:2.5, poop:0.5, recovery:3.0, hazard:0.3, encounter:1.0 },
  },
  {
    hintEmoji:"⚠️", hintText:"しげみが ガサガサ はげしく ゆれている！",
    staminaCost:7, tags:["carnivore","hazard"], btnClass:"danger",
    logText:"ガサガサいう しげみの ほうへ ふみこんだ…！",
    eventWeight:{ large:1.8, fast:1.2, flying:0.5, water:0.3, legendary:1.5, carnivore:3.0, herbivore:0.3, poop:0.4, recovery:0.2, hazard:2.5, encounter:1.8 },
  },
  {
    hintEmoji:"🌑", hintText:"くらい かげが おちている…",
    staminaCost:5, tags:["flying","legendary"], btnClass:"purple",
    logText:"かげを たよりに うす暗いほうへ すすんだ。",
    eventWeight:{ large:1.0, fast:0.8, flying:3.0, water:0.4, legendary:2.0, carnivore:1.2, herbivore:0.5, poop:0.3, recovery:0.4, hazard:1.0, encounter:1.5 },
  },
  {
    hintEmoji:"🍄", hintText:"ふしぎな きのこが はえている",
    staminaCost:4, tags:["recovery","hazard"], btnClass:"purple",
    logText:"きのこの においに さそわれて すすんだ。",
    eventWeight:{ large:0.6, fast:0.9, flying:0.8, water:0.6, legendary:0.8, carnivore:0.5, herbivore:1.0, poop:0.5, recovery:2.0, hazard:2.0, encounter:1.1 },
  },
  {
    hintEmoji:"🪶", hintText:"はねが おちている",
    staminaCost:5, tags:["flying"], btnClass:"",
    logText:"はねを みつけて その ほうへ すすんだ。",
    eventWeight:{ large:0.5, fast:0.8, flying:3.5, water:0.5, legendary:1.0, carnivore:0.6, herbivore:0.8, poop:0.4, recovery:0.8, hazard:0.5, encounter:1.4 },
  },
  {
    hintEmoji:"🌬️", hintText:"つめたい かぜが ふいてくる",
    staminaCost:8, tags:["legendary","hazard"], btnClass:"danger",
    logText:"つめたい かぜの むこうへ すすんだ。",
    eventWeight:{ large:1.5, fast:0.7, flying:1.0, water:0.4, legendary:2.5, carnivore:1.5, herbivore:0.5, poop:0.3, recovery:0.4, hazard:1.8, encounter:1.3 },
  },
];

const HAPPENINGS: Happening[] = [
  { id:"poop",             baseWeight:12, tag:"poop",      staminaDelta:0,   fx:"poop",     color:"#d97706",
    text:"💩 どうぶつの フンを みつけた！ のうじょうで つかえそう！", item:{ emoji:"💩", name:"フン" } },
  { id:"trip",             baseWeight:14, tag:"hazard",    staminaDelta:-8,  fx:"bigshake", color:"#f87171",
    text:"💥 きのねっこに つまずいた！ いたた…！", item:null },
  { id:"carnivore_scare",  baseWeight:8,  tag:"carnivore", staminaDelta:-6,  fx:"shake",    color:"#ef4444",
    text:"😱 なにかに おどかされた！ こわくて にげまわった…！", item:null },
  { id:"mushroom_lucky",   baseWeight:7,  tag:"recovery",  staminaDelta:+18, fx:"rainbow",  color:"#86efac",
    text:"🍄 ふしぎな きのこを たべた！ げんきが でてきた！", item:null },
  { id:"mushroom_dizzy",   baseWeight:6,  tag:"hazard",    staminaDelta:-5,  fx:"rainbow",  color:"#c084fc",
    text:"🍄 きのこを たべたら めが まわる～！", item:null },
  { id:"berries",          baseWeight:10, tag:"recovery",  staminaDelta:+10, fx:"none",     color:"#818cf8",
    text:"🫐 きのみを たべた！ あまくて おいしい！ たいりょく かいふく！", item:null },
  { id:"water_drink",      baseWeight:9,  tag:"water",     staminaDelta:+8,  fx:"none",     color:"#67e8f9",
    text:"💧 きれいな みずを のんだ！ さっぱりした！", item:null },
  { id:"bird",             baseWeight:11, tag:"neutral",   staminaDelta:0,   fx:"none",     color:"#67e8f9",
    text:"🐦 きれいな とりが とんでいった。", item:null },
  { id:"mudhole",          baseWeight:9,  tag:"hazard",    staminaDelta:-4,  fx:"shake",    color:"#a8a29e",
    text:"💦 どろみずに はまった！ くつが どろどろだ…", item:null },
  { id:"feather",          baseWeight:8,  tag:"flying",    staminaDelta:0,   fx:"none",     color:"#e2e8f0",
    text:"🪶 おおきな はねが おちていた！ どんな とりの ものだろう？", item:{ emoji:"🪶", name:"はね" } },
  { id:"nothing",          baseWeight:35, tag:"neutral",   staminaDelta:0,   fx:"none",     color:"",
    text:"", item:null },
];

// ════════════════════════════════════════════════════════════════
//  ユーティリティ
// ════════════════════════════════════════════════════════════════

function weightedRandom<T>(items: T[], weightFn: (item: T) => number): T {
  const total = items.reduce((s, i) => s + weightFn(i), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= weightFn(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function generateRoutes(turn: number): RouteOption[] {
  const dirs = ["みぎ", "ひだり", "まえ", "けわしい みち", "ひろい みち"];
  const shuffled = [...ROUTE_TEMPLATES].sort(() => Math.random() - 0.5);
  const count = Math.random() < 0.4 ? 2 : 3;
  return shuffled.slice(0, count).map((tpl, i) => ({
    ...tpl,
    id: `route_${turn}_${i}`,
    dirLabel: dirs[i] ?? "まえ",
  }));
}

function rollHappening(ew: EventWeight): Happening {
  return weightedRandom(HAPPENINGS, (h) => {
    const mult = (ew as Record<string, number>)[h.tag] ?? 1.0;
    return Math.max(0.1, h.baseWeight * mult);
  });
}

function rollAnimal(ew: EventWeight, isNight: boolean, weatherId: string): Animal | null {
  const candidates = ANIMALS.filter((a) => {
    const timeOk =
      a.activeTime === "ANY" ||
      (a.activeTime === "NIGHT" && isNight) ||
      (a.activeTime === "DAY" && !isNight);
    const wOk = !a.waterAnimal || weatherId === "RAIN" || weatherId === "SNOW" || ew.water > 1.5;
    return timeOk && wOk;
  });
  if (!candidates.length) return null;
  return weightedRandom(candidates, (a) => {
    let w = 1.0;
    if (a.trait === "LARGE")      w *= ew.large;
    if (a.trait === "FAST")       w *= ew.fast;
    if (a.trait === "FLYING")     w *= ew.flying;
    if (a.waterAnimal)            w *= ew.water;
    if (a.rarity === "LEGENDARY") w *= ew.legendary;
    return Math.max(0.1, w);
  });
}

// ════════════════════════════════════════════════════════════════
//  フック
// ════════════════════════════════════════════════════════════════

function useTypewriter(text: string | null, speed = 26): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed(""); setDone(false);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return { displayed, done };
}

// ════════════════════════════════════════════════════════════════
//  CSS
// ════════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DotGothic16&family=Kosugi+Maru&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --green:#00ff88;--amber:#ffb020;--red:#ff4444;
    --yellow:#ffd700;--blue:#60a5fa;--purple:#c084fc;
    --dim:#4a5568;--border:rgba(0,255,136,0.18);
    --font-dot:'DotGothic16',monospace;--font-kids:'Kosugi Maru',sans-serif;
  }
  body{background:#000;}
  .scanlines::after{content:"";position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(to bottom,transparent 0,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);z-index:100;}
  .forest-wrap{position:relative;width:100%;height:100%;overflow:hidden;}
  .log-line{padding:3px 0;line-height:1.75;border-bottom:1px solid rgba(0,255,136,0.04);animation:logFadeIn 0.3s ease;font-size:12px;}
  .log-line:last-child{border-bottom:none;}
  .cursor{display:inline-block;width:7px;height:1em;background:var(--green);margin-left:2px;vertical-align:middle;animation:blink 0.75s step-end infinite;}
  .route-btn{background:rgba(0,0,0,0.4);border:1px solid rgba(0,255,136,0.22);color:rgba(0,255,136,0.9);
    font-family:var(--font-kids);font-size:13px;padding:0;cursor:pointer;text-align:left;
    transition:background 0.18s,border-color 0.18s,transform 0.1s;border-radius:3px;overflow:hidden;width:100%;display:flex;flex-direction:column;}
  .route-btn:hover{background:rgba(0,255,136,0.08);border-color:var(--green);}
  .route-btn:active{transform:scale(0.985);}
  .route-btn:disabled{opacity:0.35;cursor:not-allowed;pointer-events:none;}
  .route-hint{display:flex;align-items:center;gap:8px;padding:8px 12px 4px;font-size:13px;font-weight:bold;line-height:1.4;}
  .route-meta{padding:3px 12px 7px;font-size:10px;color:rgba(0,255,136,0.45);border-top:1px solid rgba(0,255,136,0.08);display:flex;justify-content:space-between;align-items:center;}
  .route-btn.amber{border-color:rgba(255,176,32,0.35);color:var(--amber);}
  .route-btn.amber:hover{background:rgba(255,176,32,0.08);border-color:var(--amber);}
  .route-btn.blue{border-color:rgba(96,165,250,0.35);color:var(--blue);}
  .route-btn.blue:hover{background:rgba(96,165,250,0.08);border-color:var(--blue);}
  .route-btn.green{border-color:rgba(0,255,136,0.40);color:#86efac;}
  .route-btn.green:hover{background:rgba(0,255,136,0.12);border-color:var(--green);}
  .route-btn.danger{border-color:rgba(255,68,68,0.35);color:#ff8888;}
  .route-btn.danger:hover{background:rgba(255,68,68,0.08);border-color:var(--red);}
  .route-btn.purple{border-color:rgba(192,132,252,0.35);color:var(--purple);}
  .route-btn.purple:hover{background:rgba(192,132,252,0.08);border-color:var(--purple);}
  .tag-badge{display:inline-block;font-size:9px;padding:1px 6px;border-radius:2px;border:1px solid;opacity:0.75;}
  .cmd-btn{background:transparent;border:1px solid var(--border);color:var(--green);font-family:var(--font-kids);
    font-size:13px;padding:10px 14px;cursor:pointer;text-align:left;transition:background 0.15s,border-color 0.15s;border-radius:2px;width:100%;}
  .cmd-btn::before{content:"▶ ";color:var(--dim);}
  .cmd-btn:hover{background:rgba(0,255,136,0.08);border-color:var(--green);color:#fff;}
  .cmd-btn.danger{border-color:rgba(255,68,68,0.3);color:#ff8888;}
  .cmd-btn.danger::before{color:rgba(255,68,68,0.5);}
  .cmd-btn.danger:hover{background:rgba(255,68,68,0.08);border-color:var(--red);}
  .cmd-btn.yellow{border-color:rgba(255,215,0,0.4);color:var(--yellow);}
  .cmd-btn.yellow::before{color:var(--yellow);}
  .cmd-btn.yellow:hover{background:rgba(255,215,0,0.08);}
  .cmd-btn.amber{border-color:rgba(255,176,32,0.4);color:var(--amber);}
  .cmd-btn.amber::before{color:var(--amber);}
  .cmd-btn.amber:hover{background:rgba(255,176,32,0.08);}
  .cmd-btn:disabled{opacity:0.35;cursor:not-allowed;pointer-events:none;}
  .hp-bar-track{width:100%;height:7px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin-top:3px;}
  .hp-bar-fill{height:100%;border-radius:4px;transition:width 0.4s,background 0.4s;}
  .timing-bar-outer{width:100%;height:28px;background:rgba(0,0,0,0.5);border:1px solid rgba(0,255,136,0.25);border-radius:4px;overflow:hidden;position:relative;}
  .timing-cursor{position:absolute;top:0;bottom:0;width:4px;background:#fff;border-radius:2px;box-shadow:0 0 8px #fff;}
  .timing-zone{position:absolute;top:0;bottom:0;background:rgba(255,215,0,0.3);border-left:2px solid #ffd700;border-right:2px solid #ffd700;}
  .timing-btn{background:rgba(0,255,136,0.1);border:1px solid var(--green);color:var(--green);font-family:var(--font-kids);font-size:15px;padding:10px;cursor:pointer;border-radius:3px;width:100%;}
  .timing-btn:active{background:rgba(0,255,136,0.22);transform:scale(0.97);}
  .quiz-btn{background:rgba(0,255,136,0.04);border:1px solid rgba(0,255,136,0.18);color:rgba(0,255,136,0.88);
    font-family:var(--font-kids);font-size:13px;padding:9px 12px;cursor:pointer;border-radius:3px;text-align:left;width:100%;transition:background 0.15s;}
  .quiz-btn:hover{background:rgba(0,255,136,0.1);border-color:var(--green);}
  .quiz-btn.correct{background:rgba(0,255,136,0.2);border-color:var(--green);color:#fff;}
  .quiz-btn.wrong{background:rgba(255,68,68,0.1);border-color:var(--red);color:#ff8888;}
  .panel-slide{animation:panelSlide 0.22s ease-out;}
  .result-reveal{animation:resultReveal 0.35s ease;}
  .fx-bigshake{animation:bigShake 0.5s ease-out;}
  .fx-shake{animation:stepShake 0.38s ease-out;}
  .fx-rainbow{animation:rainbowFilter 2.6s ease forwards;}
  .fx-poop-bounce{position:absolute;font-size:28px;pointer-events:none;z-index:80;animation:poopBounce 1.1s cubic-bezier(0.22,1,0.36,1) forwards;}
  .route-selecting{animation:routePulse 0.3s ease;}
  @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
  @keyframes logFadeIn{from{opacity:0;transform:translateX(-4px);}to{opacity:1;transform:none;}}
  @keyframes stepShake{0%{transform:translateY(0);}20%{transform:translateY(4px) scale(0.993);}50%{transform:translateY(-2px);}80%{transform:translateY(1px);}100%{transform:translateY(0);}}
  @keyframes bigShake{0%{transform:translate(0,0)rotate(0);}15%{transform:translate(-6px,5px)rotate(-2deg);}30%{transform:translate(6px,-4px)rotate(2deg);}45%{transform:translate(-5px,3px)rotate(-1deg);}60%{transform:translate(4px,-3px)rotate(1deg);}75%{transform:translate(-3px,2px);}100%{transform:none;}}
  @keyframes encounterFlash{0%{filter:brightness(1);}18%{filter:brightness(4) saturate(0);}38%{filter:brightness(1.2);}55%{filter:brightness(0.6);}75%{filter:brightness(1.3);}100%{filter:brightness(1);}}
  @keyframes animalPop{0%{transform:scale(0.05)translateY(30px);opacity:0;filter:brightness(5);}55%{transform:scale(1.18)translateY(-8px);opacity:1;filter:brightness(1.4);}100%{transform:scale(1)translateY(0);opacity:1;filter:brightness(1);}}
  @keyframes poopBounce{0%{transform:translateY(40px)scale(0.2);opacity:0;}35%{transform:translateY(-60px)scale(1.3);opacity:1;}55%{transform:translateY(-30px)scale(0.9);}70%{transform:translateY(-50px)scale(1.1);}85%{transform:translateY(-38px)scale(0.95);}100%{transform:translateY(-44px)scale(1);opacity:0;}}
  @keyframes rainbowFilter{0%{filter:hue-rotate(0deg)saturate(1);}20%{filter:hue-rotate(90deg)saturate(2);}40%{filter:hue-rotate(180deg)saturate(2.5);}60%{filter:hue-rotate(270deg)saturate(2);}80%{filter:hue-rotate(320deg)saturate(1.5);}100%{filter:hue-rotate(360deg)saturate(1);}}
  @keyframes panelSlide{from{transform:translateY(10px);opacity:0;}to{transform:translateY(0);opacity:1;}}
  @keyframes resultReveal{from{opacity:0;transform:scale(0.92)translateY(8px);}to{opacity:1;transform:none;}}
  @keyframes footprint{0%{opacity:0.9;transform:scale(1);}100%{opacity:0;transform:scale(1.9)translateY(-5px);}}
  @keyframes rainDrop{0%{transform:translateY(-10px);opacity:0;}15%{opacity:0.7;}85%{opacity:0.7;}100%{transform:translateY(260px);opacity:0;}}
  @keyframes snowDrift{0%{transform:translateY(-8px)translateX(0)rotate(0deg);opacity:0;}20%{opacity:0.85;}100%{transform:translateY(260px)translateX(24px)rotate(360deg);opacity:0;}}
  @keyframes pulseGlow{0%,100%{box-shadow:0 0 6px rgba(0,255,136,0.12);}50%{box-shadow:0 0 18px rgba(0,255,136,0.28);}}
  @keyframes routePulse{0%{transform:scale(1);}40%{transform:scale(1.02);}100%{transform:scale(1);}}
  @keyframes starPop{0%{transform:scale(0)rotate(-20deg);opacity:0;}60%{transform:scale(1.3)rotate(5deg);opacity:1;}100%{transform:scale(1)rotate(0);opacity:1;}}
  @keyframes tagFadeIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}
`;

// ════════════════════════════════════════════════════════════════
//  ForestView
// ════════════════════════════════════════════════════════════════

interface ForestViewProps {
  timeState:   TimeState;
  weather:     Weather;
  isEncounter: boolean;
  isEncFlash:  boolean;
  animal:      Animal | null;
  shakeFx:     string;
  rainbowFx:   boolean;
}

function ForestView({ timeState, weather, isEncounter, isEncFlash, animal, shakeFx, rainbowFx }: ForestViewProps) {
  const isNight   = timeState.id === "NIGHT";
  const isEvening = timeState.id === "EVENING";
  const fxClass   = shakeFx === "bigshake" ? "fx-bigshake" : shakeFx === "shake" ? "fx-shake" : "";
  const flashStyle: React.CSSProperties = isEncFlash ? { animation: "encounterFlash 0.45s ease-out" } : {};

  const treeLayers = [
    { z:0, scale:0.28, opacity:0.35, bottom:"50%", trees:11, color:"#000" },
    { z:1, scale:0.42, opacity:0.55, bottom:"42%", trees:9,  color:"#040d04" },
    { z:2, scale:0.62, opacity:0.75, bottom:"32%", trees:7,  color:"#071207" },
    { z:3, scale:0.88, opacity:0.90, bottom:"18%", trees:5,  color:"#0a1a0a" },
    { z:4, scale:1.20, opacity:1.00, bottom:"0%",  trees:3,  color:"#0d200d" },
  ];

  return (
    <div
      className={`forest-wrap scanlines ${fxClass} ${rainbowFx ? "fx-rainbow" : ""}`}
      style={{ transition: "all 1.2s ease", ...flashStyle }}
    >
      <div style={{ position:"absolute", inset:0,
        background:`linear-gradient(to bottom,${timeState.skyTop} 0%,${timeState.skyMid} 55%,${timeState.skyBot} 100%)`,
        transition:"background 2s ease" }} />

      {(isNight || isEvening) && Array.from({ length: 26 }).map((_, i) => (
        <div key={i} style={{ position:"absolute", left:`${(i*37+11)%100}%`, top:`${(i*23+7)%55}%`,
          width:i%5===0?3:2, height:i%5===0?3:2, borderRadius:"50%", background:"#fff",
          opacity:isNight?0.7:0.3, animation:`blink ${1.5+(i%7)*0.4}s ${(i*0.17)%2}s step-end infinite` }} />
      ))}
      {(isNight || isEvening) && (
        <div style={{ position:"absolute", top:"8%", right:"14%", width:28, height:28, borderRadius:"50%",
          background:isNight?"#e2e8f0":"#fde68a",
          boxShadow:isNight?"0 0 20px rgba(226,232,240,0.4)":"0 0 24px rgba(253,230,138,0.5)", opacity:0.9 }} />
      )}

      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"28%",
        background:"linear-gradient(to top,#0a1a0a 0%,rgba(10,20,10,0) 100%)" }} />

      {treeLayers.map(layer => (
        <div key={layer.z} style={{ position:"absolute", bottom:layer.bottom, width:"100%",
          display:"flex", justifyContent:"center", gap:`${8+layer.z*4}px` }}>
          {Array.from({ length: layer.trees }).map((_, ti) => {
            const h = (80 + layer.z*30 + (ti%3)*18) * layer.scale;
            const w = (30 + layer.z*14 + (ti%2)*8)  * layer.scale;
            const tilt = (ti - Math.floor(layer.trees/2)) * 1.8;
            return (
              <div key={ti} style={{ display:"flex", flexDirection:"column", alignItems:"center",
                transform:`rotate(${tilt}deg)`, transformOrigin:"bottom center",
                opacity:layer.opacity - (ti%3)*0.05 }}>
                <div style={{ width:0, height:0,
                  borderLeft:`${w*0.6}px solid transparent`, borderRight:`${w*0.6}px solid transparent`,
                  borderBottom:`${h*0.45}px solid ${layer.color}`,
                  filter:`drop-shadow(0 ${layer.z*2}px ${layer.z*6}px rgba(0,0,0,0.5))` }} />
                <div style={{ width:0, height:0,
                  borderLeft:`${w*0.5}px solid transparent`, borderRight:`${w*0.5}px solid transparent`,
                  borderBottom:`${h*0.4}px solid ${layer.color}`, marginTop:`-${h*0.15}px` }} />
                <div style={{ width:w*0.14, height:h*0.22, background:layer.color, borderRadius:"1px" }} />
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ position:"absolute", bottom:"14%", left:0, right:0, height:"22%",
        background:`linear-gradient(to top,rgba(200,220,200,${timeState.fogAlpha}) 0%,rgba(200,220,200,0) 100%)`,
        transition:"opacity 2s ease" }} />

      {weather.id !== "SUNNY" && Array.from({ length: 18 }).map((_, i) => {
        const isRain = weather.id === "RAIN";
        return (
          <div key={i} style={{ position:"absolute", left:`${(i*6.2+3)%100}%`, top:"-12px",
            width:isRain?1.5:5, height:isRain?14:5,
            background:isRain?"rgba(180,220,255,0.55)":"rgba(255,255,255,0.8)", borderRadius:isRain?1:"50%",
            animation:`${isRain?"rainDrop":"snowDrift"} ${isRain?0.75+(i%4)*0.12:2.4+(i%6)*0.35}s linear ${(i*0.11)%1.8}s infinite` }} />
        );
      })}

      {isEncounter && animal && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:20 }}>
          <div style={{ fontSize:96, lineHeight:1,
            filter:"drop-shadow(0 0 32px rgba(255,80,0,0.65)) drop-shadow(0 0 64px rgba(255,160,0,0.3))",
            animation:"animalPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
            {animal.emoji}
          </div>
        </div>
      )}

      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:10,
        background:`radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,${timeState.vignet}) 100%)` }} />
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", boxShadow:"inset 0 0 40px rgba(0,0,0,0.7)", zIndex:11 }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  ログ行
// ════════════════════════════════════════════════════════════════

interface LogLineProps {
  text:     string;
  color:    string | undefined;
  isLatest: boolean;
}

function LogLine({ text, color, isLatest }: LogLineProps) {
  const { displayed, done } = useTypewriter(isLatest ? text : null, 24);
  const shown = isLatest ? displayed : text;
  return (
    <div className="log-line" style={{ color: color || "rgba(0,255,136,0.82)", fontFamily:"var(--font-kids)" }}>
      <span style={{ color:"rgba(0,255,136,0.28)", marginRight:6 }}>{">"}</span>
      {shown}{isLatest && !done && <span className="cursor" />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  ルートカード
// ════════════════════════════════════════════════════════════════

const TAG_LABELS: Record<RouteTag, string> = {
  large:"おおきい", fast:"すばやい", flying:"そら", water:"みずべ",
  carnivore:"にくしょく", herbivore:"くさしょく", legendary:"でんせつ",
  poop:"フン", recovery:"かいふく", hazard:"きけん", neutral:"ふつう",
};
const TAG_COLOR: Record<RouteTag, string> = {
  large:"#f59e0b", fast:"#34d399", flying:"#818cf8", water:"#60a5fa",
  carnivore:"#f87171", herbivore:"#86efac", legendary:"#fbbf24",
  poop:"#d97706", recovery:"#4ade80", hazard:"#ef4444", neutral:"#6b7280",
};

interface RouteCardProps {
  route:      RouteOption;
  onClick:    (r: RouteOption) => void;
  disabled:   boolean;
  isSelected: boolean;
}

function RouteCard({ route, onClick, disabled, isSelected }: RouteCardProps) {
  return (
    <button
      className={`route-btn ${route.btnClass} ${isSelected ? "route-selecting" : ""}`}
      onClick={() => onClick(route)}
      disabled={disabled}
    >
      <div className="route-hint">
        <span style={{ fontSize:20, flexShrink:0 }}>{route.hintEmoji}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, lineHeight:1.4 }}>{route.hintText}</div>
        </div>
      </div>
      <div className="route-meta">
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {route.tags.slice(0, 2).map(t => (
            <span key={t} className="tag-badge"
              style={{ color:TAG_COLOR[t], borderColor:TAG_COLOR[t], animation:"tagFadeIn 0.3s ease" }}>
              {TAG_LABELS[t]}
            </span>
          ))}
        </div>
        <span style={{ opacity:0.55, fontSize:10 }}>
          {route.dirLabel}　たいりょく -{route.staminaCost}
        </span>
      </div>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
//  タイミングゲーム
// ════════════════════════════════════════════════════════════════

interface TimingGameProps {
  onResult: (score: number) => void;
}

function TimingGame({ onResult }: TimingGameProps) {
  const [pos,    setPos]    = useState(0);
  const [result, setResult] = useState<TimingResult | null>(null);
  const dirRef  = useRef(1);
  const posRef  = useRef(0);
  const rafRef  = useRef<number>(0);
  const prevRef = useRef<number | null>(null);
  const SPEED   = 0.115;

  useEffect(() => {
    function tick(now: number) {
      const dt = prevRef.current != null ? now - prevRef.current : 16;
      prevRef.current = now;
      posRef.current += SPEED * dt * dirRef.current;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0)   { posRef.current = 0;   dirRef.current = 1; }
      setPos(posRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleTap = useCallback(() => {
    if (result) return;
    cancelAnimationFrame(rafRef.current);
    const p = posRef.current;
    const hit  = p >= 35 && p <= 65;
    const near = (p >= 20 && p < 35) || (p > 65 && p <= 80);
    const label = hit ? "ちょうどいい！" : near ? "おしい！" : "はずれ…";
    const score = hit ? 2 : near ? 1 : 0;
    setResult({ label, score });
    setTimeout(() => onResult(score), 900);
  }, [result, onResult]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ fontFamily:"var(--font-kids)", fontSize:11, color:"rgba(0,255,136,0.5)" }}>
        きいろの ゾーンで タップ！
      </div>
      <div className="timing-bar-outer">
        <div className="timing-zone" style={{ left:"35%", width:"30%" }} />
        {!result && <div className="timing-cursor" style={{ left:`calc(${pos}% - 2px)` }} />}
        {result && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"var(--font-kids)", fontSize:13, fontWeight:"bold",
            color:result.score===2?"#ffd700":result.score===1?"#86efac":"#f87171" }}>
            {result.label}
          </div>
        )}
      </div>
      {!result && (
        <button className="timing-btn" onClick={handleTap}>
          🎯 いま だ！ タップ！
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  クイズ
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
    setTimeout(() => onResult(i === q.ans), 1000);
  }, [selected, q.ans, onResult]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }} className="panel-slide">
      <div style={{ fontFamily:"var(--font-kids)", fontSize:12, color:"rgba(0,255,136,0.65)",
        padding:"6px 8px", background:"rgba(0,255,136,0.04)", border:"1px solid rgba(0,255,136,0.1)",
        borderRadius:2, lineHeight:1.55 }}>
        {q.q}
      </div>
      {q.choices.map((c, i) => (
        <button key={i}
          className={`quiz-btn${selected===i ? (i===q.ans ? " correct" : " wrong") : ""}`}
          onClick={() => handleSelect(i)}>
          {["①","②","③"][i]} {c}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  HP バー
// ════════════════════════════════════════════════════════════════

function StaminaBar({ stamina }: { stamina: number }) {
  const pct   = Math.max(0, stamina);
  const color = pct > 60 ? "#00ff88" : pct > 30 ? "#ffb020" : "#ff4444";
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--font-kids)",
        fontSize:11, color:"rgba(0,255,136,0.6)", marginBottom:2 }}>
        <span>たいりょく</span><span style={{ color }}>{stamina}/100</span>
      </div>
      <div className="hp-bar-track">
        <div className="hp-bar-fill" style={{ width:`${pct}%`, background:color }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  メインコンポーネント
// ════════════════════════════════════════════════════════════════

type Phase = "EXPLORE" | "ENCOUNTER" | "QUIZ" | "TIMING" | "RESULT" | "GAMEOVER";

// HuntClient 内で Animal.rarity を GameAnimal.rarity に変換する
const toStoreRarity = (r: Animal["rarity"]): AnimalRarity =>
  r === "LEGENDARY" ? "でんせつ" : r === "COMMON" ? "ふつう" : "レア";

export default function HuntClient() {
  // ★ Zustand ストアからスタミナ管理
  const stamina        = useSafariStore((s) => s.stamina);
  const consumeStamina = useSafariStore((s) => s.consumeStamina);
  const restoreStamina = useSafariStore((s) => s.restoreStamina);
  const recoverStamina = useSafariStore((s) => s.recoverStamina);
  const catchAnimal    = useSafariStore((s) => s.catchAnimal);
  // ★ DELETED: const [stamina, setStamina] = useState(100)

  const [phase,         setPhase]        = useState<Phase>("EXPLORE");
  const [turn,          setTurn]         = useState(0);
  const [weather,       setWeather]      = useState<Weather>(WEATHERS[0]);
  const [caught,        setCaught]       = useState<string[]>([]);
  const [items,         setItems]        = useState<string[]>([]);
  const [animal,        setAnimal]       = useState<Animal | null>(null);
  const [logs,          setLogs]         = useState<LogEntry[]>([
    { text:"みちが まえに つづいている。どこへ すすむ？", color:"rgba(0,255,136,0.6)" },
  ]);
  const [routes,        setRoutes]       = useState<RouteOption[]>(() => generateRoutes(0));
  const [selectedRoute, setSelectedRoute]= useState<string | null>(null);
  const [shakeFx,       setShakeFx]      = useState("");
  const [isEncFlash,    setIsEncFlash]   = useState(false);
  const [isEncounter,   setIsEncounter]  = useState(false);
  const [rainbowFx,     setRainbowFx]    = useState(false);
  const [footprints,    setFootprints]   = useState<Footprint[]>([]);
  const [poopFx,        setPoopFx]       = useState<Footprint[]>([]);
  const [combatResult,  setCombatResult] = useState<CombatResult | null>(null);
  const [busy,          setBusy]         = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const currentTime = TIMES[turn % 4];

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const addLog = useCallback((text: string, color?: string) => {
    setLogs(prev => [...prev.slice(-20), { text, color }]);
  }, []);

  const triggerShake = useCallback((type = "shake") => {
    setShakeFx(type);
    setTimeout(() => setShakeFx(""), 500);
  }, []);

  const spawnFootprint = useCallback(() => {
    const id = Date.now(); const x = 30 + Math.random() * 40;
    setFootprints(prev => [...prev, { id, x }]);
    setTimeout(() => setFootprints(prev => prev.filter(f => f.id !== id)), 900);
  }, []);

  const spawnPoop = useCallback(() => {
    const id = Date.now(); const x = 20 + Math.random() * 60;
    setPoopFx(prev => [...prev, { id, x }]);
    setTimeout(() => setPoopFx(prev => prev.filter(p => p.id !== id)), 1200);
  }, []);

  // ── ルート選択 ──
  const chooseRoute = useCallback((route: RouteOption) => {
    if (busy) return;
    setBusy(true);
    setSelectedRoute(route.id);

    const newStamina = stamina - route.staminaCost;
    if (newStamina <= 0) {
      consumeStamina(stamina); // → 0 へ
      addLog("たいりょくが なくなった…", "rgba(255,68,68,0.9)");
      setTimeout(() => { setPhase("GAMEOVER"); setBusy(false); }, 600);
      return;
    }
    consumeStamina(route.staminaCost);

    const nextTurn = turn + 1;
    setTurn(nextTurn);
    spawnFootprint();
    addLog(`${route.hintEmoji} ${route.logText}`);

    if (Math.random() < 0.2) {
      const r = Math.random();
      const nw = r < 0.6 ? WEATHERS[0] : r < 0.85 ? WEATHERS[1] : WEATHERS[2];
      if (nw.id !== weather.id) {
        setWeather(nw);
        setTimeout(() => addLog(`${nw.icon} てんきが ${nw.name}に なった。`, "rgba(100,180,255,0.8)"), 350);
      }
    }

    const nextTime = TIMES[nextTurn % 4];
    if (turn % 4 === 3) setTimeout(() => addLog(`── ${nextTime.name}に なった。 ──`, "rgba(0,255,136,0.4)"), 400);

    const isNight = nextTime.id === "NIGHT";
    const ew = route.eventWeight;
    const happening = rollHappening(ew);

    let happeningDelay = 0;
    if (happening.id !== "nothing" && happening.text) {
      happeningDelay = 250;
      setTimeout(() => {
        if (happening.fx === "poop")         { triggerShake("shake"); setTimeout(spawnPoop, 100); }
        else if (happening.fx === "bigshake") triggerShake("bigshake");
        else if (happening.fx === "shake")    triggerShake("shake");
        else if (happening.fx === "rainbow")  { setRainbowFx(true); setTimeout(() => setRainbowFx(false), 2700); }
        addLog(happening.text, happening.color || "#ffd700");
        if (happening.item) {
          setItems(prev => [...prev, happening.item!.emoji]);
          setTimeout(() => addLog(`　→「${happening.item!.name}」を ゲット！`, "rgba(217,119,6,0.9)"), 600);
        }
        if (happening.staminaDelta > 0) {
          restoreStamina(happening.staminaDelta);
        } else if (happening.staminaDelta < 0) {
          consumeStamina(-happening.staminaDelta);
        }
      }, happeningDelay);
    }

    const baseChance = isNight ? 0.50 : 0.38;
    const chance = Math.min(baseChance * (ew.encounter ?? 1), 0.92);

    setTimeout(() => {
      if (Math.random() < chance) {
        const enc = rollAnimal(ew, isNight, weather.id);
        if (enc) {
          setAnimal(enc);
          setIsEncFlash(true); setTimeout(() => setIsEncFlash(false), 500);
          setIsEncounter(true);
          setTimeout(() => {
            addLog(`！！  野生の ${enc.name}が あらわれた！`, "rgba(255,80,80,1)");
            addLog(`とくちょう: ${enc.traitName}　／　${RARITY_JP[enc.rarity]}`, `${RARITY_COLOR[enc.rarity]}cc`);
            setPhase("ENCOUNTER"); setBusy(false); setSelectedRoute(null);
          }, 300);
          return;
        }
      }
      const next = generateRoutes(nextTurn);
      setRoutes(next);
      const msgs = [
        `みちが ${next.length}つに わかれている。どっちに すすむ？`,
        `${next.length}つの みちが ひろがっている。よく かんがえて えらぼう！`,
        `あたらしい わかれみち。どの てがかりが きになる？`,
      ];
      addLog(msgs[Math.floor(Math.random() * msgs.length)], "rgba(0,255,136,0.5)");
      setPhase("EXPLORE"); setBusy(false); setSelectedRoute(null);
    }, Math.max(happeningDelay + 650, 700));
  }, [busy, stamina, turn, weather, triggerShake, spawnFootprint, spawnPoop, addLog]);

  // ── キャンプへ ──
  const doRetreat = useCallback(() => {
    addLog("── キャンプへ かえった。 ──", "rgba(0,255,136,0.5)");
    setTimeout(() => setPhase("GAMEOVER"), 500);
  }, [addLog]);

  // ── よくみる ──
  const doLook = useCallback(() => {
    if (!animal) return;
    addLog(`👀 ${animal.name}を じっくり みつめた！`, "rgba(100,200,255,0.9)");
    setPhase("QUIZ");
  }, [animal, addLog]);

  const onQuizResult = useCallback((correct: boolean) => {
    if (!animal) return;
    if (correct) {
      setCaught(prev => [...prev, animal.emoji]);
      // ★ グローバル裏庭へ追加
      catchAnimal({ name: animal.name, emoji: animal.emoji, rarity: toStoreRarity(animal.rarity) });
      addLog(`⭐ せいかい！ ${animal.name}を かんさつ ゲット！`, "#ffd700");
      setCombatResult({ hit:true, animal, bonus:"quiz" });
    } else {
      addLog(`❌ ざんねん… ${animal.name}は にげていった。`, "rgba(255,68,68,0.8)");
      setCombatResult({ hit:false, animal, bonus:null });
    }
    setIsEncounter(false); setPhase("RESULT");
  }, [animal, addLog, catchAnimal]);

  // ── わなをしかける ──
  const doTrap = useCallback(() => {
    if (!animal) return;
    const ns = stamina - 8;
    if (ns <= 0) {
      consumeStamina(stamina); // → 0 へ
      addLog("たいりょくが なくなった…", "rgba(255,68,68,0.9)");
      setTimeout(() => setPhase("GAMEOVER"), 400); return;
    }
    consumeStamina(8);
    addLog("🪤 わなを しかけた！ タイミングを あわせろ！", "rgba(0,255,136,0.8)");
    setPhase("TIMING");
  }, [animal, stamina, addLog, consumeStamina]);

  const onTimingResult = useCallback((score: number) => {
    if (!animal) return;
    const hitChance = score === 2 ? 0.85 : score === 1 ? 0.50 : 0.15;
    if (Math.random() < hitChance) {
      setCaught(prev => [...prev, animal.emoji]);
      // ★ グローバル裏庭へ追加
      catchAnimal({ name: animal.name, emoji: animal.emoji, rarity: toStoreRarity(animal.rarity) });
      addLog(`🎉 やった！ ${animal.name}を つかまえた！`, "#ffd700");
      setCombatResult({ hit:true, animal, bonus:`timing_${score}` });
    } else {
      addLog(`💨 おしい！ ${animal.name}は にげてしまった…`, "rgba(255,68,68,0.8)");
      setCombatResult({ hit:false, animal, bonus:null });
    }
    setIsEncounter(false); setPhase("RESULT");
  }, [animal, addLog, catchAnimal]);

  // ── にげる ──
  const doFlee = useCallback(() => {
    addLog("🏃 にげた！ ふりかえらずに はしった。");
    setIsEncounter(false); setAnimal(null);
    const next = generateRoutes(turn);
    setRoutes(next);
    addLog("みちが まえに つづいている。どっちへ すすむ？", "rgba(0,255,136,0.5)");
    setPhase("EXPLORE");
  }, [addLog, turn]);

  // ── つづける ──
  const doContinue = useCallback(() => {
    setCombatResult(null); setAnimal(null);
    const next = generateRoutes(turn);
    setRoutes(next);
    addLog("みちが まえに つづいている。どっちへ すすむ？", "rgba(0,255,136,0.5)");
    setPhase("EXPLORE");
  }, [addLog, turn]);

  // ── リスタート ──
  const doRestart = useCallback(() => {
    setPhase("EXPLORE"); recoverStamina(); setTurn(0);
    setWeather(WEATHERS[0]); setCaught([]); setItems([]);
    setAnimal(null); setCombatResult(null);
    setIsEncounter(false); setIsEncFlash(false);
    setShakeFx(""); setRainbowFx(false); setSelectedRoute(null);
    setBusy(false); setRoutes(generateRoutes(0));
    setLogs([{ text:"あたらしい たんけんが はじまった！ どこへ すすむ？", color:"rgba(0,255,136,0.6)" }]);
  }, []);

  const CORNER_STYLES: React.CSSProperties[] = [
    { top:0,    left:0,    borderTop:"1px solid rgba(0,255,136,0.22)", borderLeft:"1px solid rgba(0,255,136,0.22)" },
    { top:0,    right:0,   borderTop:"1px solid rgba(0,255,136,0.22)", borderRight:"1px solid rgba(0,255,136,0.22)" },
    { bottom:0, left:0,    borderBottom:"1px solid rgba(0,255,136,0.22)", borderLeft:"1px solid rgba(0,255,136,0.22)" },
    { bottom:0, right:0,   borderBottom:"1px solid rgba(0,255,136,0.22)", borderRight:"1px solid rgba(0,255,136,0.22)" },
  ];

  return (
    <div style={{ width:"100%", minHeight:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{CSS}</style>

      <div style={{ width:"100%", maxWidth:420, height:"100svh", display:"flex", flexDirection:"column",
        background:"#050c06", border:"1px solid rgba(0,255,136,0.12)",
        boxShadow:"0 0 60px rgba(0,0,0,0.9),inset 0 0 80px rgba(0,0,0,0.3)",
        position:"relative", overflow:"hidden", animation:"pulseGlow 4s ease infinite" }}>

        {/* ── 上部：森ビュー ── */}
        <div style={{ flex:"0 0 34%", position:"relative", borderBottom:"2px solid rgba(0,255,136,0.15)", overflow:"hidden" }}>
          <ForestView
            timeState={currentTime} weather={weather}
            isEncounter={isEncounter && ["ENCOUNTER","QUIZ","TIMING"].includes(phase)}
            isEncFlash={isEncFlash} animal={animal} shakeFx={shakeFx} rainbowFx={rainbowFx}
          />
          <div style={{ position:"absolute", top:0, left:0, right:0, display:"flex",
            justifyContent:"space-between", alignItems:"flex-start", padding:"7px 10px", zIndex:30,
            background:"linear-gradient(to bottom,rgba(0,0,0,0.62) 0%,transparent 100%)" }}>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {[
                { label:currentTime.name, style:{color:"rgba(0,255,136,0.9)",border:"1px solid rgba(0,255,136,0.2)"} },
                { label:`${weather.icon}${weather.name}`, style:{color:"rgba(180,210,255,0.9)",border:"1px solid rgba(100,150,255,0.2)"} },
              ].map((b,i)=>(
                <span key={i} style={{ fontFamily:"var(--font-kids)", fontSize:11, background:"rgba(0,0,0,0.65)",
                  padding:"3px 8px", borderRadius:2, ...b.style }}>{b.label}</span>
              ))}
            </div>
            <span style={{ fontFamily:"var(--font-kids)", fontSize:11, color:"rgba(0,255,136,0.7)",
              background:"rgba(0,0,0,0.65)", padding:"3px 8px", borderRadius:2, border:"1px solid rgba(0,255,136,0.15)" }}>
              {turn}ターンめ
            </span>
          </div>

          {footprints.map(fp => (
            <div key={fp.id} style={{ position:"absolute", bottom:"12%", left:`${fp.x}%`,
              fontSize:14, animation:"footprint 0.85s ease-out forwards", zIndex:25, pointerEvents:"none" }}>👣</div>
          ))}
          {poopFx.map(pp => (
            <div key={pp.id} className="fx-poop-bounce" style={{ left:`${pp.x}%`, bottom:"15%" }}>💩</div>
          ))}
          {isEncounter && animal && (
            <div style={{ position:"absolute", bottom:7, left:0, right:0, textAlign:"center", zIndex:35,
              fontFamily:"var(--font-kids)", fontSize:12,
              color:RARITY_COLOR[animal.rarity] ?? "#ffb020", letterSpacing:"0.12em",
              textShadow:`0 0 12px ${RARITY_COLOR[animal.rarity] ?? "#ffb020"}`,
              animation:"blink 0.6s step-end infinite" }}>
              ！！  エンカウント  ！！
            </div>
          )}
        </div>

        {/* ── 中部：テキストログ ── */}
        <div ref={logRef} style={{ flex:"0 0 26%", background:"rgba(0,4,2,0.97)",
          borderBottom:"2px solid rgba(0,255,136,0.15)", overflowY:"auto", padding:"7px 12px",
          scrollbarWidth:"thin", scrollbarColor:"rgba(0,255,136,0.2) transparent" }}>
          <div style={{ fontFamily:"var(--font-dot)", fontSize:9, color:"rgba(0,255,136,0.26)",
            borderBottom:"1px solid rgba(0,255,136,0.1)", paddingBottom:4, marginBottom:5, letterSpacing:"0.1em" }}>
            ━━ たんけん にっき ━━━━━━━━━━━━━━━━━━━━━━
          </div>
          {logs.map((l, i) => (
            <LogLine key={i} text={l.text} color={l.color} isLatest={i === logs.length - 1} />
          ))}
        </div>

        {/* ── 下部：コマンドパネル ── */}
        <div style={{ flex:1, background:"rgba(2,8,3,0.98)", display:"flex", flexDirection:"column",
          padding:"9px 12px 12px", gap:7, overflow:"hidden" }}>

          <div style={{ display:"flex", gap:10, alignItems:"center", paddingBottom:7,
            borderBottom:"1px solid rgba(0,255,136,0.1)" }}>
            <div style={{ flex:1 }}><StaminaBar stamina={stamina} /></div>
            <div style={{ fontFamily:"var(--font-kids)", fontSize:10, color:"rgba(0,255,136,0.5)",
              textAlign:"right", lineHeight:1.6, flexShrink:0 }}>
              <div>🎒 {caught.length}ひき</div>
              {items.length > 0 && <div style={{ fontSize:9, opacity:0.65 }}>{items.slice(-5).join("")}</div>}
            </div>
          </div>

          {phase === "EXPLORE" && (
            <div className="panel-slide" style={{ display:"flex", flexDirection:"column", gap:5, flex:1, overflowY:"auto" }}>
              <div style={{ fontFamily:"var(--font-kids)", fontSize:10, color:"rgba(0,255,136,0.3)", letterSpacing:"0.08em", marginBottom:1 }}>
                ─ みちを えらぼう ─
              </div>
              {routes.map(r => (
                <RouteCard key={r.id} route={r} onClick={chooseRoute}
                  disabled={busy} isSelected={selectedRoute === r.id} />
              ))}
              <button className="cmd-btn danger" onClick={doRetreat} disabled={busy} style={{ marginTop:"auto" }}>
                キャンプへ にげる
              </button>
            </div>
          )}

          {phase === "ENCOUNTER" && animal && (
            <div className="panel-slide" style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ fontFamily:"var(--font-kids)", fontSize:10,
                color:RARITY_COLOR[animal.rarity] ?? "rgba(255,176,32,0.8)", letterSpacing:"0.08em",
                animation:"blink 1s step-end infinite", marginBottom:1 }}>
                ─ {animal.name}が あらわれた！ ─
              </div>
              <button className="cmd-btn yellow" onClick={doLook}>
                👀 よくみる　（クイズに チャレンジ！）
              </button>
              <button className="cmd-btn amber" onClick={doTrap}>
                🪤 わなを しかける　　たいりょく -8
              </button>
              <button className="cmd-btn danger" onClick={doFlee}>
                🏃 にげる
              </button>
            </div>
          )}

          {phase === "QUIZ" && animal && (
            <div style={{ flex:1, overflow:"hidden" }}>
              <div style={{ fontFamily:"var(--font-kids)", fontSize:10, color:"rgba(100,200,255,0.7)", marginBottom:5 }}>
                ─ {animal.name}の クイズ！ ─
              </div>
              <QuizPanel animal={animal} onResult={onQuizResult} />
            </div>
          )}

          {phase === "TIMING" && animal && (
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"var(--font-kids)", fontSize:10, color:"rgba(0,255,136,0.6)", marginBottom:5 }}>
                ─ タイミングを あわせて わなを とばせ！ ─
              </div>
              <TimingGame onResult={onTimingResult} />
            </div>
          )}

          {phase === "RESULT" && combatResult && (
            <div className="result-reveal" style={{ flex:1, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:8 }}>
              <div style={{ fontFamily:"var(--font-kids)", fontSize:combatResult.hit ? 28 : 20,
                color:combatResult.hit ? "#ffd700" : "rgba(255,68,68,0.85)", textAlign:"center",
                letterSpacing:"0.06em",
                textShadow:combatResult.hit ? "0 0 20px rgba(255,215,0,0.5)" : "none",
                animation:combatResult.hit ? "starPop 0.45s ease" : undefined }}>
                {combatResult.hit ? "⭐ ゲット！ ⭐" : "── にがした…──"}
              </div>
              {combatResult.hit && (
                <div style={{ fontSize:52, animation:"animalPop 0.45s ease" }}>{combatResult.animal.emoji}</div>
              )}
              <button className="cmd-btn" style={{ width:"100%" }} onClick={doContinue}>
                たんけんを つづける
              </button>
            </div>
          )}

          {phase === "GAMEOVER" && (
            <div className="result-reveal" style={{ flex:1, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:8 }}>
              <div style={{ fontFamily:"var(--font-kids)", fontSize:12,
                color:stamina <= 0 ? "rgba(255,68,68,0.9)" : "rgba(0,255,136,0.7)",
                letterSpacing:"0.1em", marginBottom:3 }}>
                {stamina <= 0 ? "── たいりょく ゼロ！ ──" : "── キャンプに かえった ──"}
              </div>
              <div style={{ background:"rgba(0,255,136,0.03)", border:"1px solid rgba(0,255,136,0.12)",
                borderRadius:3, padding:"10px 16px", textAlign:"center", width:"100%" }}>
                <div style={{ fontFamily:"var(--font-kids)", fontSize:10, color:"rgba(0,255,136,0.4)", marginBottom:5 }}>
                  つかまえた どうぶつ
                </div>
                <div style={{ fontSize:22, minHeight:28, letterSpacing:6 }}>
                  {caught.length > 0 ? caught.join(" ") : "──"}
                </div>
                <div style={{ fontFamily:"var(--font-kids)", fontSize:11, color:"rgba(0,255,136,0.55)", marginTop:4 }}>
                  {caught.length}ひき ゲット！
                </div>
                {items.length > 0 && (
                  <>
                    <div style={{ fontFamily:"var(--font-kids)", fontSize:10, color:"rgba(217,119,6,0.6)", marginTop:8, marginBottom:3 }}>
                      ひろったもの
                    </div>
                    <div style={{ fontSize:18, letterSpacing:4 }}>{items.join(" ")}</div>
                  </>
                )}
              </div>
              <button className="cmd-btn" style={{ width:"100%", textAlign:"center", marginTop:2 }} onClick={doRestart}>
                ▶ もういちど はじめる
              </button>
            </div>
          )}
        </div>

        {CORNER_STYLES.map((s, i) => (
          <div key={i} style={{ position:"absolute", width:14, height:14, pointerEvents:"none", zIndex:200, ...s }} />
        ))}
      </div>
    </div>
  );
}
