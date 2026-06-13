"use client";

// app/kids/WorldMapPortal.tsx
// ワールドマップ UI ポータル — KidsPortal のプレイヤー選択後に表示される画面。
// 2026-05-20 (v2): iPad（タブレット）対応
//   - maxWidth 1024px・マップ高さ min(75vh,680px)
//   - ピン座標を全面再配置（密集解消・サファリ 2 ピン距離を拡大）
//   - walkTo アニメをマップ実寸 ref 計測ベースに修正

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useWeather, type WeatherInfo } from "./[kidId]/WeatherContext";
import { KizunaManager } from "@/components/KizunaManager";
import { HIDDEN_PIN_IDS, TRAP_COST } from "./config";

// ── CSS アニメーション（一度だけ <head> に注入） ──────────────
const MAP_CSS = `
@keyframes rainDrop{0%{transform:translateY(-10px) translateX(0);opacity:0}10%{opacity:.7}90%{opacity:.7}100%{transform:translateY(620px) translateX(-80px);opacity:0}}
@keyframes leafSpin{0%{transform:translateX(-20px) translateY(0) rotate(0deg);opacity:0}15%{opacity:.85}85%{opacity:.85}100%{transform:translateX(500px) translateY(300px) rotate(540deg);opacity:0}}
@keyframes heatWave{0%,100%{transform:scaleY(1) translateY(0);opacity:.18}50%{transform:scaleY(1.04) translateY(-3px);opacity:.28}}
@keyframes bobble{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes walkTo{0%{transform:translate(var(--ex-start),var(--ey-start))}100%{transform:translate(var(--ex-end),var(--ey-end))}}
@keyframes slideUp{0%{transform:translateY(110%);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes emphasizePulse{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.09)}}
@keyframes twinkle{0%,100%{opacity:.2}50%{opacity:.95}}
@keyframes nightGlow{0%,100%{box-shadow:0 0 14px rgba(253,224,71,.5),0 6px 18px rgba(0,0,0,.25)}50%{box-shadow:0 0 26px rgba(253,224,71,.85),0 6px 18px rgba(0,0,0,.25)}}
@keyframes driveRL{0%{left:110%;transform:translateY(0)}25%{transform:translateY(-2px)}50%{transform:translateY(0)}75%{transform:translateY(-2px)}100%{left:-12%;transform:translateY(0)}}
@keyframes flyLR{0%{left:-12%;transform:translateY(0)}50%{transform:translateY(-5px)}100%{left:112%;transform:translateY(0)}}

/* ── iPad レスポンシブ ── */
.wm-root {
  --wm-max-w:     1024px;
  --wm-px:          16px;
  --wm-map-h:     min(calc(76vh - var(--header-h, 56px)), 680px);
  --wm-pin-sz:      52px;
  --wm-pin-r:       18px;
  --wm-pin-em:      24px;
  --wm-pin-lbl:      9px;
  --wm-pin-lbl-w:   90px;
  --wm-av-sz:       44px;
  --wm-av-em:       24px;
  --wm-av-r:        22px;
  --wm-av-name:      9px;
  --wm-npc-em:      18px;
  --wm-npc-name:     8px;
  --wm-status-sz:   11px;
  --wm-status-pad: 5px 16px;
  --wm-deco-sz:     24px;
  --wm-flow-sz:     12px;
  --wm-flow-chip:  10px;
  --wm-new-sz:       8px;
  --wm-badge-top:   -8px;
  --wm-badge-right: -8px;
  --wm-mute-sz:     36px;
  --wm-mute-em:     18px;
}
@media (min-width: 768px) {
  .wm-root {
    --wm-max-w:    1280px;
    --wm-px:         28px;
    --wm-map-h:    min(calc(78vh - var(--header-h, 80px)), 840px);
    --wm-pin-sz:     72px;
    --wm-pin-r:      24px;
    --wm-pin-em:     34px;
    --wm-pin-lbl:    12px;
    --wm-pin-lbl-w: 110px;
    --wm-av-sz:      64px;
    --wm-av-em:      36px;
    --wm-av-r:       32px;
    --wm-av-name:    12px;
    --wm-npc-em:     28px;
    --wm-npc-name:   11px;
    --wm-status-sz:  14px;
    --wm-status-pad: 8px 24px;
    --wm-deco-sz:    36px;
    --wm-flow-sz:    14px;
    --wm-flow-chip:  12px;
    --wm-new-sz:     10px;
    --wm-badge-top:  -10px;
    --wm-badge-right:-10px;
    --wm-mute-sz:    48px;
    --wm-mute-em:    24px;
  }
}
/* ゲームセンターモーダル: sm以上でセンター表示 */
@media (min-width: 768px) {
  .wm-arcade-sheet {
    border-radius: 28px !important;
    max-width: 560px !important;
    margin: auto !important;
    margin-bottom: 0 !important;
  }
}
`;

function injectMapCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("cs-world-css")) return;
  const s = document.createElement("style");
  s.id = "cs-world-css";
  s.textContent = MAP_CSS;
  document.head.appendChild(s);
}

// ── 時間帯（夜間おやすみモード / docs/DESIGN_PRINCIPLES.md 2） ──────────
//   現実の生活リズムに寄り添い、夜は「ガチで稼ぐ時間」から
//   「捕まえた子を眺める・図鑑を読む時間」へ自然にシフトさせる。
//   - day      06:00〜19:30  通常
//   - twilight 19:30〜20:00  夕暮れ（ロックなし・静かなBGM＋夕焼け）
//   - night    20:00〜翌06:00 夜（家/図鑑だけ開放、ほかは暗転ロック）
type DayPhase = "day" | "twilight" | "night";

const TWILIGHT_START_MIN = 19 * 60 + 30; // 19:30
const NIGHT_START_MIN = 20 * 60; // 20:00
const DAY_START_MIN = 6 * 60; // 06:00

// JST（Asia/Tokyo）での「0時からの経過分」を返す。
// 端末のタイムゾーンに依存せず、図鑑/狩りの日次リセット（JST）と判定軸を揃える。
function jstMinutesOfDay(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

function dayPhaseNow(): DayPhase {
  const min = jstMinutesOfDay();
  if (min >= NIGHT_START_MIN || min < DAY_START_MIN) return "night";
  if (min >= TWILIGHT_START_MIN) return "twilight";
  return "day";
}

// 夜でも開いている施設（家・図鑑）。原則4：夜は学び・鑑賞の時間。
const NIGHT_OPEN_IDS = ["house", "dictionary"];

// 時間帯ごとの BGM（トワイライト/夜は静かな「家」BGMへ）と音量。
const BGM_DAY_SRC = "/sounds/Beyond_The_Tall_Grass.mp3";
const BGM_CALM_SRC = "/sounds/bgm/家.mp3";
function bgmSrcFor(phase: DayPhase): string {
  return phase === "day" ? BGM_DAY_SRC : BGM_CALM_SRC;
}
function bgmVolFor(phase: DayPhase): number {
  return phase === "day" ? 0.45 : phase === "twilight" ? 0.3 : 0.2;
}

// ── 夕暮れ・夜のオーバーレイ（ピンより下・terrain を染める） ──────────
function DayPhaseOverlay({ phase }: { phase: DayPhase }) {
  if (phase === "day") return null;
  if (phase === "twilight") {
    return (
      <div style={{
        position: "absolute", inset: 0, borderRadius: "inherit",
        pointerEvents: "none", zIndex: 11,
        background:
          "linear-gradient(180deg,rgba(251,146,60,.30),rgba(244,114,182,.18) 55%,rgba(99,102,241,.24))",
      }} />
    );
  }
  // night
  return (
    <div style={{
      position: "absolute", inset: 0, borderRadius: "inherit",
      pointerEvents: "none", zIndex: 11, overflow: "hidden",
      background:
        "linear-gradient(180deg,rgba(15,23,42,.74),rgba(30,27,75,.66) 60%,rgba(15,23,42,.80))",
    }}>
      {/* 星（またたき） */}
      {Array.from({ length: 18 }, (_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: ((i * 41) % 97) + "%",
          top: ((i * 29) % 52) + "%",
          width: 2 + (i % 3), height: 2 + (i % 3), borderRadius: "50%",
          background: "rgba(255,255,255,.92)",
          animation: `twinkle ${1.6 + (i % 5) * 0.5}s ease-in-out ${(i * 0.17) % 1.5}s infinite`,
        }} />
      ))}
      {/* 月 */}
      <div style={{
        position: "absolute", top: "8%", right: "9%", fontSize: 34,
        filter: "drop-shadow(0 0 12px rgba(253,224,71,.65))",
      }}>🌙</div>
    </div>
  );
}

// ── うんぱんミッション演出（背景の道を走る車両 / docs/DESIGN_PRINCIPLES.md 3） ──
//   「あ、うんぱんが来てる！」とワクワク気づける環境アニメ。
//   静的な急かしバッジ（旧 isNew）の代わりに、視線をうんぱん導線へ誘導する。
//   ピンより後ろ（zIndex 6）を走り、夜（おやすみ中）は走らせない。
function RoadTraffic({ phase }: { phase: DayPhase }) {
  if (phase === "night") return null;
  return (
    <div style={{
      position: "absolute", inset: 0, borderRadius: "inherit",
      pointerEvents: "none", zIndex: 6, overflow: "hidden",
    }}>
      {/* お助けトラック（右→左・地上の道） */}
      <div style={{
        position: "absolute", top: "54%",
        fontSize: "calc(var(--wm-deco-sz) * 0.95)",
        animation: "driveRL 17s linear infinite",
        filter: "drop-shadow(0 2px 2px rgba(0,0,0,.18))",
      }}>🚚</div>
      {/* 配送ヘリ（左→右・上空） */}
      <div style={{
        position: "absolute", top: "14%",
        fontSize: "calc(var(--wm-deco-sz) * 0.8)",
        animation: "flyLR 24s linear 5s infinite",
        filter: "drop-shadow(0 3px 3px rgba(0,0,0,.15))",
      }}>🚁</div>
    </div>
  );
}

// ── 子供ごとのアバター・テーマカラー ──────────────────────────
const KID_AVATAR: Record<string, { emoji: string; color: string }> = {
  "美琴": { emoji: "🦭", color: "#0ea5e9" }, // アザラシ
  "幸仁": { emoji: "🐹", color: "#f472b6" }, // ハムスター
  "叶泰": { emoji: "🦦", color: "#34d399" }, // カワウソ
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};


// ── マップピン型 ───────────────────────────────────────────────
type MapPin = {
  id: string;
  icon: string;
  label: string;
  sub: string;
  x: number; // % (left)
  y: number; // % (top)
  color: string;
  route: string | null;
  query?: string;
  action: "route" | "arcade";
  ready: boolean;
  comingSoon?: boolean;
};

// ── 全ピン定義 ────────────────────────────────────────────────
// 一本道化（2026-06-12 / docs/DESIGN_PRINCIPLES.md 3）:
//   表示するのは HIDDEN_PIN_IDS（app/kids/config.ts）に含まれない6ピンのみ。
//   隠したピンの定義・ページは残してあるので、config から ID を外せば復活する。
//
// 表示中の一本道（コアループ）:
//   🏰ギルド → 📦うんぱんミッション → 🦁罠 / 🏹狩り（クイズ必須）→ 🏠家 → 📚図鑑
//
const ALL_MAP_PINS: MapPin[] = [
  // ── 左上：ギルド（スタート地点）
  {
    id: "guild",
    icon: "🏰",
    label: "クエストギルド",
    sub: "おてつだい・クエスト",
    x: 9,
    y: 14,
    color: "#c084fc",
    route: "quests",
    action: "route",
    ready: true,
  },
  // ── 左中：農場
  {
    id: "farm",
    icon: "🌾",
    label: "農場",
    sub: "そざいをしゅうかく",
    x: 14,
    y: 46,
    color: "#86efac",
    route: "farm",
    action: "route",
    ready: true,  },
  // ── 中左上：クラフト工房
  {
    id: "craft",
    icon: "🔨",
    label: "クラフト工房",
    sub: "わなや どうぐをつくる",
    x: 36,
    y: 20,
    color: "#4ade80",
    route: "craft",
    action: "route",
    ready: true,
  },
  // ── 中央：罠スタイル（密林エリア・craft から南下）
  {
    id: "safari-passive",
    icon: "🦁",
    label: "罠スタイル",
    sub: "そざいと ワナを えらんで、どうぶつが くるのを まとう！",
    x: 44,
    y: 55,
    color: "#fbbf24",
    route: "safari",
    query: "style=passive",
    action: "route",
    ready: true,
  },
  // ── 右上：アクティブ狩り（山岳・開けたフィールド）
  {
    id: "safari-active",
    icon: "🏹",
    label: "アクティブ狩り",
    sub: "ぶきを もって、しゅんかんで どうぶつを つかまえよう！",
    x: 74,
    y: 12,
    color: "#fb7185",
    route: "safari",
    query: "style=active",
    action: "route",
    ready: true,
  },
  // ── 右中：牧場
  {
    id: "ranch",
    icon: "🐄",
    label: "牧場",
    sub: "どうぶつをそだてる",
    x: 76,
    y: 38,
    color: "#fde68a",
    route: "ranch",
    action: "route",
    ready: true,  },
  // ── 右下寄り：動物園
  {
    id: "zoo",
    icon: "🐘",
    label: "動物園",
    sub: "みせて・まなぶ",
    x: 82,
    y: 60,
    color: "#f472b6",
    route: "zoo",
    action: "route",
    ready: true,  },
  // ── うんぱんミッション（旧 物流センター）：現実の運搬おてつだい
  {
    id: "logistics",
    icon: "📦",
    label: "うんぱんミッション",
    sub: "にもつを はこんで レアわなを ゲット！",
    x: 52,
    y: 72,
    color: "#60a5fa",
    route: "logistics",
    action: "route",
    ready: true,  },
  // ── 左下：博物図鑑
  {
    id: "dictionary",
    icon: "📚",
    label: "博物図鑑",
    sub: "どうぶつのひみつ",
    x: 12,
    y: 74,
    color: "#f59e0b",
    route: "dictionary",
    action: "route",
    ready: true,
  },
  // ── 中下：カオスレース（NEW）
  {
    id: "race",
    icon: "🏁",
    label: "カオスレース",
    sub: "どうぶつレースで さいそく",
    x: 32,
    y: 86,
    color: "#f97316",
    route: "race",
    action: "route",
    ready: true,  },
  // ── 右端下：ゲームセンター（NEW）
  {
    id: "arcade",
    icon: "🕹️",
    label: "ゲームセンター",
    sub: "クレーンゲームなど",
    x: 90,
    y: 80,
    color: "#34d399",
    route: null,
    action: "arcade",
    ready: true,  },
  // ── 左下：ぜんぶの ながれ（NEW）
  {
    id: "flow",
    icon: "🧭",
    label: "ながれ",
    sub: "ぜんぶの ながれを みる",
    x: 26,
    y: 62,
    color: "#14b8a6",
    route: "flow",
    action: "route",
    ready: true,  },
  // ── 中央：自分の家（トリアージハブ）
  {
    id: "house",
    icon: "🏠",
    label: "自分の家",
    sub: "つかまえた どうぶつが まってるよ！",
    x: 57,
    y: 36,
    color: "#f97316",
    route: "house",
    action: "route",
    ready: true,
  },
];

// ── 表示ピン：一本道に合わせて座標を再配置 ─────────────────────
// 左上（スタート）から右下（ゴール）へ流れる「読む順番」のレイアウト。
const VISIBLE_PIN_POS: Record<string, { x: number; y: number }> = {
  guild:            { x: 12, y: 16 }, // ① おてつだい（スタート）
  logistics:        { x: 32, y: 38 }, // ② うんぱんミッション
  "safari-active":  { x: 58, y: 16 }, // ③a アクティブ狩り（山岳）
  "safari-passive": { x: 52, y: 58 }, // ③b 罠スタイル（密林）
  house:            { x: 76, y: 42 }, // ④ 自分の家
  dictionary:       { x: 86, y: 76 }, // ⑤ 博物図鑑（ゴール）
};

const MAP_PINS: MapPin[] = ALL_MAP_PINS.filter(
  (p) => !HIDDEN_PIN_IDS.includes(p.id),
).map((p) => ({ ...p, ...(VISIBLE_PIN_POS[p.id] ?? {}) }));

// ── PATHS（一本道：ギルド → うんぱん → サファリ → 家 → 図鑑） ──
const PATHS = [
  // ① 現実のおてつだい（ギルド）→ ② うんぱんミッション
  { from: "guild",          to: "logistics"      },
  // ② うんぱん → ③ サファリ（罠 / 狩り。どちらも直前にクイズ必須）
  { from: "logistics",      to: "safari-passive" },
  { from: "logistics",      to: "safari-active"  },
  // ③ サファリ → ④ 自分の家（つかまえた どうぶつ）
  { from: "safari-passive", to: "house"          },
  { from: "safari-active",  to: "house"          },
  // ④ 家 → ⑤ 博物図鑑（コアループの出口）
  { from: "house",          to: "dictionary"     },
];

// ── ゲームセンター内ゲーム ─────────────────────────────────────
const ARCADE_GAMES = [
  { id: "crane", icon: "🎁", name: "クレーンゲーム", sub: "UFOキャッチャー", route: "crane", ready: true,  color: "#34d399" },
  { id: "quiz",  icon: "❓", name: "はやおしクイズ", sub: "せいかいで20コイン！", route: "quiz",  ready: true,  color: "#a78bfa" },
  { id: "slot",  icon: "🎰", name: "サファリスロット",sub: "レアなどうぶつをゲット", route: "slot", ready: false, color: "#f59e0b" },
];

// ── 型 ────────────────────────────────────────────────────────
type Player = {
  id: string;
  name: string;
  yomi: string;
  coins: number;
  avatar: string;
  color: string;
};
type ChildLite = { id: string; name: string; coinBalance: number };

function buildPlayers(children: ChildLite[]): Player[] {
  return children.map((c) => {
    const av = KID_AVATAR[c.name] ?? { emoji: "👤", color: "#9ca3af" };
    return {
      id: c.id,
      name: c.name,
      yomi: NAME_READING[c.name] ?? c.name,
      coins: c.coinBalance,
      avatar: av.emoji,
      color: av.color,
    };
  });
}

// ── 天気エフェクト（WeatherContext から WeatherInfo を受け取る） ──
function WeatherEffect({ weather }: { weather: WeatherInfo }) {
  if (weather.id === "sunny" || weather.id === "cloudy") return null;
  if (weather.id === "hot")
    return (
      <div style={{
        position: "absolute", inset: 0, borderRadius: "inherit",
        pointerEvents: "none", zIndex: 10,
        background: "linear-gradient(180deg,rgba(251,146,60,.22),rgba(253,186,116,.12))",
        animation: "heatWave 3s ease-in-out infinite",
      }} />
    );
  // rainy / typhoon — 雨粒
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", zIndex: 10, overflow: "hidden" }}>
      {Array.from({ length: 20 }, (_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: (4 + (i * 5) % 93) + "%",
          top: (-10 - (i % 5) * 8) + "%",
          width: 2, height: 12 + (i % 9),
          background: "rgba(147,197,253,.7)", borderRadius: 4,
          animation: `rainDrop ${0.65 + (i % 5) * 0.18}s linear ${(i * 0.11) % 1}s infinite`,
        }} />
      ))}
      {weather.id === "typhoon" && ["🍃", "🌿", "🍂", "🍀"].map((l, i) => (
        <div key={i} style={{
          position: "absolute", fontSize: 16,
          left: ((i * 27) % 78) + "%",
          top: (8 + (i * 14) % 38) + "%",
          animation: `leafSpin ${3 + i * 0.7}s linear ${i * 0.8}s infinite`,
        }}>{l}</div>
      ))}
    </div>
  );
}

// ── もうすぐ開通トースト ──────────────────────────────────────
function ComingSoonToast({ pin, onClose }: { pin: MapPin; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{
      position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
      background: "rgba(20,20,20,.90)", color: "#fff", borderRadius: 18,
      padding: "10px 22px", fontSize: 13, fontWeight: 700, zIndex: 30,
      whiteSpace: "nowrap", backdropFilter: "blur(8px)",
      boxShadow: "0 4px 20px rgba(0,0,0,.3)",
    }}>
      🚧 {pin.label} は もうすぐ かいつう！
    </div>
  );
}

// ── ロック中ピンの案内トースト（プログレッシブ・マップ） ───────
function LockToast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [msg]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{
      position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
      background: "rgba(20,20,20,.90)", color: "#fff", borderRadius: 18,
      padding: "10px 22px", fontSize: 13, fontWeight: 700, zIndex: 30,
      whiteSpace: "nowrap", backdropFilter: "blur(8px)",
      boxShadow: "0 4px 20px rgba(0,0,0,.3)",
    }}>
      {msg}
    </div>
  );
}

// ── ゲームセンターモーダル ─────────────────────────────────────
function ArcadeModal({ onClose, onNavigate }: {
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.55)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
    }}>
      {/* wm-arcade-sheet: タブレットでは @media で中央配置・角丸・幅制限 */}
      <div
        className="wm-arcade-sheet"
        style={{
          width: "100%",
          background: "linear-gradient(180deg,#ecfdf5,#fff)",
          borderRadius: "28px 28px 0 0", animation: "slideUp .32s ease-out", paddingBottom: 36,
          maxHeight: "82vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 44, height: 5, borderRadius: 3, background: "#d1d5db" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "0 24px 14px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 36, marginRight: 16 }}>🕹️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#111827" }}>ゲームセンター</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>あそびたい ゲームを えらんでね！</div>
          </div>
          <button onClick={onClose} style={{
            background: "#f3f4f6", border: "none", borderRadius: 20,
            width: 44, height: 44, fontSize: 20, cursor: "pointer", color: "#6b7280",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {ARCADE_GAMES.map((g) => (
            <button key={g.id} onClick={() => { if (g.ready) onNavigate(g.route); }}
              style={{
                display: "flex", alignItems: "center", gap: 18, padding: "18px 20px",
                borderRadius: 22, border: `2.5px solid ${g.ready ? g.color + "88" : "#e5e7eb"}`,
                background: g.ready ? `linear-gradient(135deg,${g.color}18,${g.color}08)` : "#f9fafb",
                cursor: g.ready ? "pointer" : "not-allowed", textAlign: "left",
                boxShadow: g.ready ? `0 3px 14px ${g.color}22` : "none",
                transition: "all .18s", opacity: g.ready ? 1 : 0.65,
              }}>
              <div style={{
                width: 68, height: 68, borderRadius: 20,
                background: g.ready ? `linear-gradient(135deg,${g.color},${g.color}bb)` : "#e5e7eb",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 34, flexShrink: 0,
                boxShadow: g.ready ? `0 3px 10px ${g.color}44` : "none",
              }}>{g.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#111827", marginBottom: 4 }}>{g.name}</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{g.sub}</div>
                <div style={{ marginTop: 6 }}>
                  {g.ready
                    ? <span style={{ fontSize: 12, fontWeight: 700, color: g.color, background: g.color + "18", borderRadius: 8, padding: "3px 10px" }}>▶ あそぶ</span>
                    : <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", borderRadius: 8, padding: "3px 10px" }}>🚧 準備中</span>}
                </div>
              </div>
              {g.ready && <div style={{ fontSize: 24, color: g.color }}>›</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────
export function WorldMapPortal({
  children,
  selectedId,
  onBack,
  houseAnimalCount = 0,
  dailyLimit,
}: {
  children: ChildLite[];
  selectedId: string;
  onBack: () => void;
  houseAnimalCount?: number;
  // 選択中の子の「1日の上限」状態（プログレッシブ・マップ用）。
  // 未指定（ピッカー経由など）のときは上限演出をスキップする。
  dailyLimit?: {
    trap: { used: number; remaining: number; limit: number };
    hunt: { used: number; remaining: number; limit: number };
  };
}) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);

  // ── 時間帯（夜間おやすみモード）──────────────────────────────
  // ハイドレーション不一致を避けるため初期値は "day" 固定。
  // マウント後に実時刻で更新し、以後1分ごとに再判定する。
  const [phase, setPhase] = useState<DayPhase>("day");
  useEffect(() => {
    // 外部システム（時計）との同期。初期 "day" を実時刻へ補正し、以後1分ごとに再判定。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase(dayPhaseNow());
    const id = setInterval(() => setPhase(dayPhaseNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── BGM ───────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeTrackRef = useRef<string>(BGM_DAY_SRC);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = new Audio(BGM_DAY_SRC);
    audio.loop = true;
    audio.volume = bgmVolFor("day");
    audioRef.current = audio;
    activeTrackRef.current = BGM_DAY_SRC;

    // ユーザー操作後でないと autoplay できないブラウザ対応：
    // コンポーネントマウント後すぐに再生を試み、失敗しても無視。
    audio.play().catch(() => {/* autoplay policy: wait for interaction */});

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // 時間帯に応じて曲・音量を切り替え（夜/夕暮れは静かな家BGMへ）。
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTrack = bgmSrcFor(phase);
    if (nextTrack !== activeTrackRef.current) {
      activeTrackRef.current = nextTrack;
      audio.src = nextTrack;
      audio.load();
      // muted 中は audio.muted=true なので play() しても無音。
      audio.play().catch(() => {});
    }
    audio.volume = bgmVolFor(phase);
  }, [phase]);

  // ミュート切り替え
  const toggleMute = () => {
    if (!audioRef.current) return;
    const next = !muted;
    audioRef.current.muted = next;
    setMuted(next);
    // ミュート解除 → まだ再生されていなければ再生開始
    if (!next) audioRef.current.play().catch(() => {});
  };

  useEffect(() => { injectMapCSS(); }, []);

  const players = buildPlayers(children);
  const activePlayer = Math.max(0, players.findIndex((p) => p.id === selectedId));

  // WeatherContext からグローバル天気を取得（ページ遷移をまたいで一貫した値）
  const weather = useWeather();

  // アバターの現在位置（%）
  const [avatarPos, setAvatarPos] = useState({ x: MAP_PINS[0].x, y: MAP_PINS[0].y });
  const [walking, setWalking] = useState(false);
  const [walkFrom, setWalkFrom] = useState({ x: MAP_PINS[0].x, y: MAP_PINS[0].y });
  const [walkTo, setWalkTo] = useState({ x: MAP_PINS[0].x, y: MAP_PINS[0].y });
  const [pendingPin, setPendingPin] = useState<MapPin | null>(null);
  const [arcadeOpen, setArcadeOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<MapPin | null>(null);
  const [lockToast, setLockToast] = useState<string | null>(null);

  // ── おたがいさまイベントは <KizunaManager />（下部）が全画面共通で制御する ──

  const player = players[activePlayer] ?? players[0];

  // ── プログレッシブ・マップ（docs/DESIGN_PRINCIPLES.md 1,3,5） ──────────
  //   コイン残高・1日の上限に応じてピンの状態を動的に切り替える。
  //   - emphasize : コイン不足 → 「ためる」導線（ギルド/うんぱん）を強調
  //   - needCoins : コイン不足 → コイン消費アクション（罠）を🔒
  //   - dayDone   : 1日の上限到達 → サファリを「おやすみ看板」化
  //   罠だけが TRAP_COST コイン消費。狩りは武器ゲートでコイン非消費なので
  //   コイン不足ではロックせず、上限到達時のみ看板化する。
  type PinMode = "open" | "emphasize" | "needCoins" | "dayDone" | "night";
  const broke = player.coins < TRAP_COST;
  const trapDone = dailyLimit ? dailyLimit.trap.remaining <= 0 : false;
  const huntDone = dailyLimit ? dailyLimit.hunt.remaining <= 0 : false;

  const pinModeOf = (id: string): PinMode => {
    // 夜は家・図鑑以外を暗転ロック（コイン・上限の状態より優先）。
    if (phase === "night" && !NIGHT_OPEN_IDS.includes(id)) return "night";
    switch (id) {
      case "guild":
      case "logistics":
        return broke ? "emphasize" : "open";
      case "safari-passive": // 罠（コイン消費）
        if (trapDone) return "dayDone";
        if (broke) return "needCoins";
        return "open";
      case "safari-active": // 狩り（武器ゲート・コイン非消費）
        return huntDone ? "dayDone" : "open";
      default:
        return "open";
    }
  };

  // ロック中ピンをタップしたときの案内文（タップ＝移動を中断して理由を伝える）。
  const lockMsgOf = (pin: MapPin, mode: PinMode): string | null => {
    if (mode === "night")
      return "🌙 よるは どうぶつも おやすみちゅう。また あした あそぼうね！";
    if (mode === "needCoins")
      return "🪙 まだ コインが たりないよ。おてつだいで ためよう！";
    if (mode === "dayDone")
      return pin.id === "safari-active"
        ? "🌙 きょうの かりは もう おしまい！また あした"
        : "🌙 きょうの わなは もう おしまい！また あした";
    return null;
  };

  // 兄弟 NPC の立ち位置（一本道化後の表示ピンから id で引く）
  const SIBLING_SPOT_IDS = ["safari-passive", "house", "dictionary"];
  const others = players
    .map((p, i) => ({ ...p, origIndex: i }))
    .filter((p) => p.origIndex !== activePlayer)
    .map((p, oi) => ({
      ...p, oi,
      pin:
        MAP_PINS.find((m) => m.id === SIBLING_SPOT_IDS[oi % SIBLING_SPOT_IDS.length]) ??
        MAP_PINS[0],
    }));

  // ── ピンタップ ────────────────────────────────────────────────
  const handlePin = (pin: MapPin) => {
    if (walking) return;
    if (pin.comingSoon) { setComingSoon(pin); return; }
    // ロック中（コイン不足・1日上限）のピンは移動せず、理由をトーストで伝える。
    const lockMsg = lockMsgOf(pin, pinModeOf(pin.id));
    if (lockMsg) { setLockToast(lockMsg); return; }
    setWalkFrom({ x: avatarPos.x, y: avatarPos.y });
    setWalkTo({ x: pin.x, y: pin.y });
    setPendingPin(pin);
    setWalking(true);
  };

  // 歩行アニメ完了後に遷移
  useEffect(() => {
    if (!walking) return;
    const capturedPin = pendingPin;
    const capturedPlayer = player;
    const t = setTimeout(() => {
      setAvatarPos({ x: walkTo.x, y: walkTo.y });
      setWalking(false);
      setPendingPin(null);
      if (!capturedPin) return;
      setTimeout(() => {
        if (capturedPin.action === "arcade") {
          setArcadeOpen(true);
        } else if (capturedPin.route) {
          const base = `/kids/${capturedPlayer.id}/${capturedPin.route}`;
          const url = capturedPin.query ? `${base}?${capturedPin.query}` : base;
          router.push(url);
        }
      }, 150);
    }, 1100);
    return () => clearTimeout(t);
  }, [walking]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleArcadeNavigate = (route: string) => {
    setArcadeOpen(false);
    setTimeout(() => router.push(`/kids/${player.id}/${route}`), 200);
  };

  // ── walkTo アニメ用ピクセル量（マップ実寸から計測） ──────────
  // アバターは left=walkFrom.x%, top=walkFrom.y% に配置済みで
  // @keyframes walkTo で (0→ピクセル変位) まで translate する。
  const mapW = mapRef.current?.clientWidth ?? 960;
  const mapH = mapRef.current?.clientHeight ?? 600;
  const deltaXpx = ((walkTo.x - walkFrom.x) / 100) * mapW;
  const deltaYpx = ((walkTo.y - walkFrom.y) / 100) * mapH;

  // CSS カスタムプロパティを含むスタイルは as React.CSSProperties でキャスト
  const walkAnimStyle = {
    position: "absolute",
    left: (walking ? walkFrom.x : avatarPos.x) + "%",
    top:  (walking ? walkFrom.y : avatarPos.y)  + "%",
    zIndex: 20,
    pointerEvents: "none",
    transform: "translate(-50%,-50%)",
    animation: walking ? "walkTo 1.1s ease-in-out forwards" : undefined,
    "--ex-start": "0px",
    "--ey-start": "0px",
    "--ex-end": walking ? `${deltaXpx}px` : "0px",
    "--ey-end": walking ? `${deltaYpx}px` : "0px",
  } as React.CSSProperties;

  return (
    <div
      className="wm-root"
      style={{
        background: "linear-gradient(135deg,#fef9c3,#dcfce7 40%,#dbeafe)",
        fontFamily: "'Segoe UI',sans-serif",
        minHeight: "calc(100vh - var(--header-h, 56px))",
      }}
    >
      {/* ── maxWidth を CSS var で制御（tablet: 1280px） ── */}
      <div style={{ maxWidth: "var(--wm-max-w)", margin: "0 auto", padding: "14px var(--wm-px) 36px" }}>

        {/* ── マップ本体（GlobalHeader 分を引いた高さ） ── */}
        <div ref={mapRef} style={{
          position: "relative", borderRadius: 32, overflow: "hidden",
          height: "var(--wm-map-h)",
          background: weather.bgGrad,
          boxShadow: "0 10px 40px rgba(0,0,0,.18)",
        }}>
          <WeatherEffect weather={weather} />
          <DayPhaseOverlay phase={phase} />
          <RoadTraffic phase={phase} />

          {/* BGM ミュートボタン */}
          <button
            onClick={toggleMute}
            title={muted ? "BGM をオンにする" : "BGM をオフにする"}
            style={{
              position: "absolute", top: 10, right: 10, zIndex: 30,
              background: "rgba(0,0,0,.38)", border: "none", borderRadius: 14,
              width: "var(--wm-mute-sz)", height: "var(--wm-mute-sz)",
              cursor: "pointer", fontSize: "var(--wm-mute-em)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(6px)", color: "#fff",
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>

          {/* 地形デコレーション（広域に散らす） */}
          {[
            { t: "🌴", x: 3,  y: 5,  s: 1.2 },
            { t: "🌳", x: 90, y: 3,  s: 1.1 },
            { t: "🌿", x: 1,  y: 78, s: 1.0 },
            { t: "🌴", x: 93, y: 82, s: 1.1 },
            { t: "🏔️", x: 60, y: 2,  s: 1.4 },
            { t: "🌊", x: 72, y: 88, s: 0.9 },
            { t: "🌾", x: 20, y: 60, s: 1.0 },
            { t: "🌿", x: 55, y: 87, s: 1.1 },
            { t: "🌲", x: 38, y: 40, s: 1.0 },
            { t: "🌲", x: 48, y: 43, s: 0.9 },
            { t: "🌿", x: 42, y: 65, s: 0.8 },
          ].map((d, i) => (
            <div key={i} style={{
              position: "absolute", left: d.x + "%", top: d.y + "%",
              fontSize: `calc(var(--wm-deco-sz) * ${d.s})`,
              opacity: 0.32, pointerEvents: "none", userSelect: "none",
            }}>{d.t}</div>
          ))}

          {/* パス（SVG 曲線） */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          >
            {PATHS.map((path, i) => {
              const f = MAP_PINS.find((p) => p.id === path.from);
              const t = MAP_PINS.find((p) => p.id === path.to);
              if (!f || !t) return null;
              const mx = (f.x + t.x) / 2;
              const my = (f.y + t.y) / 2;
              // 曲線のカーブ量を距離に応じて調整
              const dist = Math.sqrt((t.x - f.x) ** 2 + (t.y - f.y) ** 2);
              const bend = Math.min(dist * 0.2, 6);
              const d = `M ${f.x} ${f.y} Q ${mx + bend} ${my - bend} ${t.x} ${t.y}`;
              return (
                <g key={i}>
                  <path d={d} stroke="rgba(180,130,60,.22)" strokeWidth="6" fill="none" strokeLinecap="round" />
                  <path d={d} stroke="rgba(210,168,80,.60)" strokeWidth="2.5" fill="none" strokeDasharray="7 5" strokeLinecap="round" />
                </g>
              );
            })}
          </svg>

          {/* 兄弟 NPC */}
          {others.map((op) => (
            <div key={op.id} style={{
              position: "absolute",
              left: (op.pin.x - 3) + "%",
              top:  (op.pin.y + 9) + "%",
              transform: "translate(-50%,-50%)",
              zIndex: 8, textAlign: "center", pointerEvents: "none",
            }}>
              <div style={{ fontSize: "var(--wm-npc-em)", animation: "bobble 3s ease-in-out infinite", animationDelay: op.oi * 0.7 + "s" }}>{op.avatar}</div>
              <div style={{
                fontSize: "var(--wm-npc-name)", fontWeight: 700, color: "#fff",
                background: op.color, borderRadius: 8,
                padding: "1px 5px", marginTop: 2, whiteSpace: "nowrap",
              }}>{op.yomi}</div>
            </div>
          ))}

          {/* マップピン */}
          {MAP_PINS.map((pin, idx) => {
            const mode = pinModeOf(pin.id);
            const comingSoon = !!pin.comingSoon;
            const dimmed = comingSoon || mode === "needCoins" || mode === "dayDone" || mode === "night";
            const emphasize = mode === "emphasize";
            // 夜に開いている家・図鑑は街灯のように温かく光らせて誘導する。
            const nightOpen = phase === "night" && NIGHT_OPEN_IDS.includes(pin.id);
            return (
              <button key={pin.id} onClick={() => handlePin(pin)} aria-label={pin.label}
                style={{
                  position: "absolute", left: pin.x + "%", top: pin.y + "%",
                  transform: "translate(-50%,-50%)", zIndex: emphasize ? 16 : 15,
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  opacity: dimmed ? 0.7 : 1,
                }}>
                {/* ピンのアイコン */}
                <div style={{
                  position: "relative",
                  width: "var(--wm-pin-sz)", height: "var(--wm-pin-sz)",
                  borderRadius: "var(--wm-pin-r)",
                  background: dimmed
                    ? "linear-gradient(135deg,#9ca3af,#6b7280)"
                    : `linear-gradient(135deg,${pin.color},${pin.color}bb)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "var(--wm-pin-em)", border: "3.5px solid white",
                  boxShadow: nightOpen
                    ? `0 0 22px rgba(253,224,71,.75), 0 6px 18px ${pin.color}66`
                    : emphasize
                      ? `0 8px 26px ${pin.color}, 0 0 0 6px ${pin.color}44`
                      : dimmed ? "0 3px 10px rgba(0,0,0,.18)" : `0 5px 16px ${pin.color}66`,
                  // delay は shorthand に畳む（animation と animationDelay の
                  // shorthand/longhand 混在は rerender 時に警告＋スタイル衝突になるため）。
                  animation: nightOpen
                    ? `nightGlow 2.4s ease-in-out ${idx * 0.22}s infinite`
                    : emphasize
                      ? `emphasizePulse 1.15s ease-in-out ${idx * 0.22}s infinite`
                      : `bobble 2.5s ease-in-out ${idx * 0.22}s infinite`,
                  filter: dimmed ? "grayscale(.5)" : "none",
                }}>
                  {pin.icon}
                  {comingSoon && (
                    <div style={{
                      position: "absolute",
                      top: "var(--wm-badge-top)", right: "var(--wm-badge-right)",
                      background: "#9ca3af", color: "#fff",
                      fontSize: "var(--wm-new-sz)", fontWeight: 800, borderRadius: 8, padding: "2px 5px",
                    }}>準備中</div>
                  )}
                  {!comingSoon && mode === "needCoins" && (
                    <div style={{
                      position: "absolute",
                      top: "var(--wm-badge-top)", right: "var(--wm-badge-right)",
                      fontSize: "calc(var(--wm-new-sz) * 1.6)", lineHeight: 1,
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,.4))",
                    }}>🔒</div>
                  )}
                  {!comingSoon && mode === "dayDone" && (
                    <div style={{
                      position: "absolute",
                      top: "var(--wm-badge-top)", right: "var(--wm-badge-right)",
                      fontSize: "calc(var(--wm-new-sz) * 1.6)", lineHeight: 1,
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,.4))",
                    }}>💤</div>
                  )}
                  {!comingSoon && mode === "night" && (
                    <div style={{
                      position: "absolute",
                      top: "var(--wm-badge-top)", right: "var(--wm-badge-right)",
                      fontSize: "calc(var(--wm-new-sz) * 1.6)", lineHeight: 1,
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,.4))",
                    }}>🌙</div>
                  )}
                  {emphasize && (
                    <div style={{
                      position: "absolute",
                      top: "var(--wm-badge-top)", right: "var(--wm-badge-right)",
                      fontSize: "calc(var(--wm-new-sz) * 1.6)", lineHeight: 1,
                    }}>✨</div>
                  )}
                  {pin.id === "house" && houseAnimalCount > 0 && (
                    <div style={{
                      position: "absolute", top: -10, right: -10,
                      background: "#ef4444", color: "#fff",
                      fontSize: 9, fontWeight: 900, borderRadius: 10,
                      padding: "2px 6px", whiteSpace: "nowrap",
                      boxShadow: "0 2px 6px rgba(239,68,68,.5)",
                      border: "2px solid white", zIndex: 5,
                    }}>🔴 {houseAnimalCount}</div>
                  )}
                </div>
                {/* ラベル */}
                <div style={{
                  fontSize: "var(--wm-pin-lbl)", fontWeight: 800, color: "#fff",
                  background: dimmed ? "rgba(80,80,80,.60)" : "rgba(0,0,0,.42)",
                  borderRadius: 8, padding: "2px 7px",
                  whiteSpace: "nowrap", backdropFilter: "blur(4px)",
                  maxWidth: "var(--wm-pin-lbl-w)", textAlign: "center", lineHeight: 1.3,
                }}>{pin.label}</div>
              </button>
            );
          })}

          {/* 歩行アバター */}
          <div style={walkAnimStyle}>
            <div style={{
              width: "var(--wm-av-sz)", height: "var(--wm-av-sz)",
              borderRadius: "var(--wm-av-r)",
              background: player.color + "33",
              border: `3.5px solid ${player.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "var(--wm-av-em)", boxShadow: `0 0 0 5px ${player.color}22`,
              animation: walking ? "bobble .3s ease-in-out infinite" : "bobble 2s ease-in-out infinite",
            }}>{player.avatar}</div>
            {/* 名前バッジ */}
            <div style={{
              position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
              fontSize: "var(--wm-av-name)", fontWeight: 800, color: "#fff",
              background: player.color, borderRadius: 8, padding: "2px 6px", whiteSpace: "nowrap",
            }}>{player.yomi}</div>
            {walking && (
              <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", fontSize: 13 }}>💨</div>
            )}
          </div>

          {/* ステータスバー */}
          <div style={{
            position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
            background: walking ? "rgba(132,94,247,.88)" : "rgba(0,0,0,.38)",
            color: "#fff", fontSize: "var(--wm-status-sz)", fontWeight: 700,
            borderRadius: 14, padding: "var(--wm-status-pad)",
            backdropFilter: "blur(6px)", zIndex: 25, whiteSpace: "nowrap",
            boxShadow: "0 2px 10px rgba(0,0,0,.2)",
          }}>
            {walking
              ? "🐾 いどうちゅう…"
              : phase === "night"
                ? "🌙 よるは どうぶつも おやすみちゅう。おうちと ずかんだけ あいてるよ"
                : phase === "twilight"
                  ? "🌆 そろそろ ゆうがた。どうぶつたちも おやすみの じゅんび…"
                  : broke
                    ? "🪙 まずは おてつだいで コインを ためよう！"
                    : "📍 しせつを タップして いどうしよう！"}
          </div>

          {/* トースト・モーダル */}
          {comingSoon && <ComingSoonToast pin={comingSoon} onClose={() => setComingSoon(null)} />}
          {lockToast && <LockToast msg={lockToast} onClose={() => setLockToast(null)} />}
        </div>

      </div>

      {arcadeOpen && (
        <ArcadeModal onClose={() => setArcadeOpen(false)} onNavigate={handleArcadeNavigate} />
      )}

      {/* ── おたがいさまイベント（全画面共通の制御）──────────────────── */}
      <KizunaManager />
    </div>
  );
}
