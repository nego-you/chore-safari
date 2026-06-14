"use client";

// app/kids/WorldMapPortal.tsx
// ワールドマップ UI ポータル — KidsPortal のプレイヤー選択後に表示される画面。
//
// 2026-06-14 (v3): スーパーファミコン後期風「プログレッシブ・マップ」へ全面刷新
//   （Notion: ワールドマップ変更）。
//   - SVG ピクセルアートの地形テクスチャ（海・草・森・山・砂漠・橋）とドット絵の施設/勇者
//   - センサー（DeviceOrientationEvent の傾き）＋仮想ジョイスティック（ドラッグ）移動
//   - 海は進入不可、傾きに応じたパララックス、草むら/森でランダムエンカウント
//   - 昼夜システム：夜は家・図鑑以外を「Zzz」ロック（docs/DESIGN_PRINCIPLES.md 2）
//
//   実アプリへの統合（モックアップのダミー state を実データへ接続）:
//   - coins    : 選択中の子のコイン残高（children プロップ由来）
//   - huntCount: その日の残りアクティブ狩り回数（dailyLimit.hunt.remaining）。
//                0 ならエンカウントせず、洞窟（狩り）施設にも入れない。
//   - phase    : クライアント現在時刻(JST)から判定（day / twilight=夕方 / night）。
//                プロジェクト既存の dayPhaseNow() を流用し BGM・夜ロックと判定軸を統一。
//   - ルーティング: useRouter で /kids/{kidId}/{route} へ遷移。エンカウントの「かりをする」は
//                  アクティブ狩り（/kids/{kidId}/safari?style=active）へ遷移。
//   - 既存の全画面共通要素を維持：マップ画面用 BGM（このルートは BGMPlayer の対象外）と
//     <KizunaManager />（おたがいさまイベント）。

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { KizunaManager } from "@/components/KizunaManager";
import { TRAP_COST } from "./config";

// ==========================================
// 1. SFC風 ピクセルアート＆テクスチャ定義
// ==========================================
const SVG_NS = "http://www.w3.org/2000/svg";

const PATTERNS = {
  sea: `<svg xmlns="${SVG_NS}" width="16" height="16"><rect width="16" height="16" fill="#1e3a8a"/><path d="M 0 4 Q 4 0 8 4 T 16 4" fill="none" stroke="#2563eb" stroke-width="1.5" opacity="0.6"/><path d="M 0 12 Q 4 8 8 12 T 16 12" fill="none" stroke="#2563eb" stroke-width="1.5" opacity="0.6"/></svg>`,
  grass: `<svg xmlns="${SVG_NS}" width="16" height="16"><rect width="16" height="16" fill="#4ade80"/><path d="M 2 4 L 4 2 L 6 4" fill="none" stroke="#22c55e" stroke-width="1.5"/><path d="M 10 12 L 12 10 L 14 12" fill="none" stroke="#22c55e" stroke-width="1.5"/></svg>`,
  forest: `<svg xmlns="${SVG_NS}" width="16" height="16"><rect width="16" height="16" fill="#4ade80"/><circle cx="0" cy="0" r="5" fill="#15803d"/><circle cx="16" cy="16" r="6" fill="#14532d"/><circle cx="8" cy="8" r="7" fill="#166534"/><circle cx="0" cy="16" r="5" fill="#14532d"/><circle cx="16" cy="0" r="4" fill="#15803d"/></svg>`,
  mountain: `<svg xmlns="${SVG_NS}" width="16" height="16"><rect width="16" height="16" fill="#4ade80"/><path d="M 8 2 L 14 14 L 2 14 Z" fill="#92400e"/><path d="M 8 2 L 11 8 L 8 10 L 14 14 L 8 14 Z" fill="#78350f"/><path d="M 8 2 L 6 6 L 8 8 Z" fill="#d4d4d8"/></svg>`,
  desert: `<svg xmlns="${SVG_NS}" width="16" height="16"><rect width="16" height="16" fill="#fcd34d"/><path d="M 2 4 Q 4 2 6 4" fill="none" stroke="#f59e0b" stroke-width="1"/><path d="M 10 10 Q 12 8 14 10" fill="none" stroke="#f59e0b" stroke-width="1"/></svg>`,
  bridge: `<svg xmlns="${SVG_NS}" width="16" height="16"><rect width="16" height="16" fill="#1e3a8a"/><rect x="0" y="4" width="16" height="8" fill="#92400e"/><line x1="0" y1="6" x2="16" y2="6" stroke="#78350f" stroke-width="1"/><line x1="0" y1="10" x2="16" y2="10" stroke="#78350f" stroke-width="1"/></svg>`,
};

const getSvgUrl = (svgContent: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}")`;

const cloudNoiseUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="${SVG_NS}" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" stitchTiles="stitch"/></filter><rect width="200" height="200" filter="url(#n)"/></svg>`,
)}")`;

const PALETTES: Record<string, Record<string, string>> = {
  hero: { B: "#000", W: "#fff", S: "#fcd34d", R: "#ef4444", L: "#3b82f6", F: "#ffedd5" },
  castle: { B: "#000", W: "#fff", G: "#9ca3af", D: "#4b5563", Y: "#fbbf24" },
  cave: { B: "#000", T: "#78350f" },
  house: { B: "#000", W: "#fff", R: "#b91c1c", b: "#d1d5db" },
  tower: { B: "#000", G: "#9ca3af", b: "#d1d5db", W: "#fff" },
  ship: { B: "#000", W: "#fff", T: "#92400e", L: "#60a5fa" },
  forest: { B: "#000", D: "#14532d", T: "#78350f" },
  monster: { B: "#000", W: "#fff", R: "#ef4444", G: "#22c55e", Y: "#fbbf24", D: "#4b5563" },
};

const ARTS: Record<string, string> = {
  hero: "......BBB.......\n.....BSSSB......\n....BSSSSSBB....\n...BBSFFFSSB....\n...BFFFFFFFBB...\n...BFFBFFBFFB...\n....BFFFFFFB....\n.....BRRRRB.....\n....BBRRWRBB....\n....BLLBBLLB....\n....BLLBBLLB....\n.....BB..BB.....",
  castle: "....Y......Y....\n...BWB....BWB...\n..BWWWB..BWWWB..\n..BWWWB..BWWWB..\n.BBBBBBBBBBBBBB.\n.BWGGBBWBBBWGGB.\n.BWGGBBWBBBWGGB.\n.BBBBBBBBBBBBBB.\n.BWGGBBWBBBWGGB.\n.BWGGBBWBBBWGGB.\n.BBBBBBBBBBBBBB.\n.BWWWB....BWWWB.\n.BWWWB.BB.BWWWB.\n.BWWWB.BB.BWWWB.\n.BBBBBBBBBBBBBB.",
  cave: "................\n...BBBBBBBBBB...\n..BBTTTTTTTTBB..\n.BBTTTTTTTTTTBB.\n.BTTTBBBBBBTTTB.\n.BTTBBBBBBBBTTB.\n.BTTBBBBBBBBTTB.\n.BTTBBBBBBBBTTB.\n.BTTTBBBBBBTTTB.\n.BBTTTTTTTTTTBB.\n..BBTTTTTTTTBB..\n...BBBBBBBBBB...\n................",
  tower: ".......BB.......\n......BWWb......\n.....BWWWWb.....\n.....BbbbbB.....\n.....BWWWWb.....\n.....BbbbbB.....\n.....BWWWWb.....\n.....BbbbbB.....\n....BWWWWWWb....\n....BbbbbbbB....\n....BWWWWWWb....\n....BWWWWWWb....\n....BbbbbbbB....\n...BWWWWWWWWb...\n...BbbbbbbbbB...",
  house: "......BBBB......\n....BBRRRRBB....\n...BRRRRRRRRB...\n..BRRRRRRRRRRB..\n.BBBBBBBBBBBBBB.\n..BWWWWWWWWWWb..\n..BWWWWBBWWWWb..\n..BWWWWBBWWWWb..\n..BWWWWWWWWWWb..\n..BWWWWBBWWWWb..\n..BWWWWBBWWWWb..\n..BWWWWWWWWWWb..\n..BbbbbbbbbbB..\n.BBBBBBBBBBBBBB.",
  ship: ".......BB.......\n......BWWBB.....\n......BWWWWB....\n......BWWWWWB...\n......BWWWWWWB..\n......BBBBBBBBB.\n.B.......B....B.\n.BBTTTTTTTTTTBB.\n..BTTTTTTTTTTB..\n...BBTTTTTTBB...\n.....BBBBBB.....",
  forest: "......BBBB......\n....BBDDDDBB....\n...BDDDDDDDDB...\n..BDDDDDDDDDDB..\n..BDDDDDDDDDDB..\n.BDDDDDDDDDDDDB.\n.BDDDDDDDDDDDDB.\n.BDDDDDDDDDDDDB.\n..BDDDDDDDDDDB..\n...BDDDDDDDDB...\n....BBDDDDBB....\n......BTTB......\n......BTTB......\n.......BB.......",
  monster: "......BBBB......\n....BBRRRRBB....\n...BRRWWWWRRB...\n..BRRWBBWWBBRR..\n..BRRWBBWWBBRR..\n.BBRRWWWWWWRRBB.\n.BBRRYYYYYYRRBB.\n.BBRRYYYYYYRRBB.\n..BBRRYYYYRRBB..\n...BBRRRRRRBB...\n....BBGGBBBB....\n......B..B......",
};

function PixelArt({
  artName,
  paletteName,
  scale = 1,
  className = "",
}: {
  artName: string;
  paletteName: string;
  scale?: number;
  className?: string;
}) {
  const art = (ARTS[artName] ?? "").trim();
  const palette = PALETTES[paletteName] ?? {};
  const lines = art.split("\n");
  const height = lines.length;
  const width = lines[0]?.length ?? 0;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width: `${width * scale}px`, height: `${height * scale}px`, imageRendering: "pixelated" }}
    >
      {lines.map((line, y) =>
        line.split("").map((char, x) =>
          char !== "." ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={palette[char]} /> : null,
        ),
      )}
    </svg>
  );
}

// ==========================================
// 2. マップデータ構成 (15列 x 20行)
// ==========================================
// 0:海(進入不可), 1:草, 2:森, 3:山, 4:砂漠, 6:橋
const MAP = [
  [0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 0, 3, 3, 1, 1, 3, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 0, 3, 1, 1, 1, 3, 3, 0, 0, 0],
  [0, 1, 2, 2, 1, 0, 3, 1, 1, 2, 2, 3, 0, 0, 0],
  [0, 1, 1, 1, 1, 0, 3, 1, 1, 2, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 4, 4, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 4, 4, 4, 4, 1, 0, 0, 0],
  [0, 0, 1, 1, 6, 6, 1, 4, 4, 4, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 4, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];
const MAP_COLS = 15;
const MAP_ROWS = 20;

// ── 施設定義 ──────────────────────────────────────────────────
//   route   : /kids/{kidId}/{route} へ遷移（クエリ込み）。既存6ピンのコアループに一致。
//   nightOpen: 夜でも開いている（家・図鑑のみ true / DESIGN_PRINCIPLES 2）。
//   gate    : "hunt"=残り狩り回数で制限 / "trap"=コイン残高・1日上限で制限 / "none"。
type Facility = {
  id: string;
  route: string;
  name: string;
  short: string;
  x: number;
  y: number;
  art: string;
  pal: string;
  nightOpen: boolean;
  gate: "none" | "hunt" | "trap";
};

const FACILITIES: Facility[] = [
  { id: "quests", route: "quests", name: "クエストのおしろ", short: "クエスト", x: 3, y: 3, art: "castle", pal: "castle", nightOpen: false, gate: "none" },
  { id: "logistics", route: "logistics", name: "みなとまち", short: "うんぱん", x: 8, y: 7, art: "ship", pal: "ship", nightOpen: false, gate: "none" },
  { id: "trap", route: "safari?style=passive", name: "まよいの森", short: "わな", x: 8, y: 15, art: "forest", pal: "forest", nightOpen: false, gate: "trap" },
  { id: "hunt", route: "safari?style=active", name: "まものの洞窟", short: "かり", x: 10, y: 3, art: "cave", pal: "cave", nightOpen: false, gate: "hunt" },
  { id: "house", route: "house", name: "はじまりの村", short: "いえ", x: 3, y: 13, art: "house", pal: "house", nightOpen: true, gate: "none" },
  { id: "dictionary", route: "dictionary", name: "ちしきの塔", short: "ずかん", x: 10, y: 10, art: "tower", pal: "tower", nightOpen: true, gate: "none" },
];

// ==========================================
// 3. 昼夜（夜間おやすみモード / docs/DESIGN_PRINCIPLES.md 2）
// ==========================================
//   既存実装と判定軸を揃えるため JST ベースで day / twilight(夕方) / night を返す。
//   - day      06:00〜19:30  通常
//   - twilight 19:30〜20:00  夕暮れ（ロックなし・夕焼けフィルター）
//   - night    20:00〜翌06:00 夜（家/図鑑だけ開放、ほかは暗転ロック）
type DayPhase = "day" | "twilight" | "night";

const TWILIGHT_START_MIN = 19 * 60 + 30; // 19:30
const NIGHT_START_MIN = 20 * 60; // 20:00
const DAY_START_MIN = 6 * 60; // 06:00

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

// ── マップ画面用 BGM（このルートは BGMPlayer の対象外なので個別に再生）──
const BGM_DAY_SRC = "/sounds/Beyond_The_Tall_Grass.mp3";
const BGM_CALM_SRC = "/sounds/bgm/家.mp3";
function bgmSrcFor(phase: DayPhase): string {
  return phase === "day" ? BGM_DAY_SRC : BGM_CALM_SRC;
}
function bgmVolFor(phase: DayPhase): number {
  return phase === "day" ? 0.45 : phase === "twilight" ? 0.3 : 0.2;
}

// ── 子供ごとのアバター・テーマカラー・読み ────────────────────
const KID_AVATAR: Record<string, { emoji: string; color: string }> = {
  美琴: { emoji: "🦭", color: "#0ea5e9" },
  幸仁: { emoji: "🐹", color: "#f472b6" },
  叶泰: { emoji: "🦦", color: "#34d399" },
};
const NAME_READING: Record<string, string> = {
  美琴: "みこと",
  幸仁: "ゆきと",
  叶泰: "かなた",
};

// ── 型・プレイヤー組み立て ─────────────────────────────────────
type ChildLite = { id: string; name: string; coinBalance: number };
type Player = { id: string; name: string; yomi: string; coins: number; avatar: string; color: string };

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

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

// ── ドラクエ風メッセージウィンドウ ────────────────────────────
function RpgWindow({
  children,
  className = "",
  title,
  isRed = false,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  isRed?: boolean;
}) {
  return (
    <div
      className={`relative text-white p-3 rounded-md ${className}`}
      style={{
        background: isRed
          ? "linear-gradient(180deg, rgba(60,0,0,0.95) 0%, rgba(0,0,0,0.95) 100%)"
          : "linear-gradient(180deg, rgba(0,31,63,0.95) 0%, rgba(0,0,0,0.95) 100%)",
        border: `3px solid ${isRed ? "#fca5a5" : "#fff"}`,
        boxShadow: "inset 0 0 0 2px #000, 0 4px 0 #000, 0 4px 10px rgba(0,0,0,0.5)",
        fontFamily: '"DotGothic16", "Courier New", Courier, monospace',
        textShadow: "2px 2px 0 #000",
        lineHeight: "1.6",
      }}
    >
      {title && (
        <div
          className="absolute -top-4 left-4 px-3 py-0 rounded font-bold tracking-widest text-sm"
          style={{
            color: isRed ? "#fca5a5" : "#fde047",
            background: "#000",
            border: `2px solid ${isRed ? "#fca5a5" : "#fff"}`,
            boxShadow: "inset 0 0 0 1px #000",
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ==========================================
// 4. メインコンポーネント
// ==========================================
type Props = {
  children: ChildLite[];
  selectedId: string;
  onBack: () => void;
  houseAnimalCount?: number;
  // 選択中の子の「1日の上限」状態。未指定（ピッカー経由）のときは上限演出をスキップ。
  dailyLimit?: {
    trap: { used: number; remaining: number; limit: number };
    hunt: { used: number; remaining: number; limit: number };
  };
};

export function WorldMapPortal({
  children,
  selectedId,
  onBack: _onBack,
  houseAnimalCount = 0,
  dailyLimit,
}: Props) {
  const router = useRouter();

  // ── プレイヤー（コイン残高は children 由来）──────────────────
  const players = buildPlayers(children);
  const activeIndex = Math.max(0, players.findIndex((p) => p.id === selectedId));
  const player = players[activeIndex] ?? players[0];
  const kidId = player?.id ?? selectedId;
  const coins = player?.coins ?? 0;

  // ── 実データ接続：残り狩り回数 ──────────────────────────────
  //   dailyLimit 未指定（ピッカー経由）のときは判定材料が無いのでエンカウント可とする。
  const huntCount = dailyLimit?.hunt.remaining ?? 3;
  const trapDone = dailyLimit ? dailyLimit.trap.remaining <= 0 : false;
  const broke = coins < TRAP_COST;

  // ── 時間帯（マウント後に実時刻へ補正し、以後1分ごとに再判定）──
  const [phase, setPhase] = useState<DayPhase>("day");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase(dayPhaseNow());
    const id = setInterval(() => setPhase(dayPhaseNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── ゲーム状態 ────────────────────────────────────────────────
  const [started, setStarted] = useState(false);
  const [heroPos, setHeroPos] = useState({ x: 3.5, y: 13.5 });
  const [activeFacility, setActiveFacility] = useState<Facility | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [encounter, setEncounter] = useState(false);
  const [flash, setFlash] = useState(false);

  const tiltRef = useRef({ x: 0, y: 0 });
  const joyRef = useRef({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const walkDistanceRef = useRef(0);

  // ── BGM（マップ画面用・ミュートはローカル状態）─────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeTrackRef = useRef<string>(BGM_DAY_SRC);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = new Audio(BGM_DAY_SRC);
    audio.loop = true;
    audio.volume = bgmVolFor("day");
    audioRef.current = audio;
    activeTrackRef.current = BGM_DAY_SRC;
    audio.play().catch(() => {/* autoplay policy: 操作後に再生 */});
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = bgmSrcFor(phase);
    if (next !== activeTrackRef.current) {
      activeTrackRef.current = next;
      audio.src = next;
      audio.load();
      audio.play().catch(() => {});
    }
    audio.volume = bgmVolFor(phase);
  }, [phase]);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    audio.muted = next;
    setMuted(next);
    if (!next) audio.play().catch(() => {});
  };

  // ── センサー（傾き）入力 ──────────────────────────────────────
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const g = e.gamma || 0;
    const b = e.beta || 0;
    const adjB = b - 40;
    tiltRef.current = { x: clamp(g / 30, -1, 1), y: clamp(adjB / 30, -1, 1) };
  }, []);

  // アンマウント時に必ずリスナーを外す（handleOrientation は安定参照）。
  useEffect(() => {
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [handleOrientation]);

  const handleStart = async () => {
    // iOS Safari は明示的な許可が必要（型に無いのでキャストして判定）。
    const DOE =
      typeof DeviceOrientationEvent !== "undefined"
        ? (DeviceOrientationEvent as unknown as {
            requestPermission?: () => Promise<"granted" | "denied">;
          })
        : null;
    if (DOE && typeof DOE.requestPermission === "function") {
      try {
        const permission = await DOE.requestPermission();
        if (permission === "granted") window.addEventListener("deviceorientation", handleOrientation);
      } catch {
        /* 許可が得られなければジョイスティックのみで操作 */
      }
    } else if (typeof window !== "undefined") {
      window.addEventListener("deviceorientation", handleOrientation);
    }
    // ユーザー操作のタイミングで BGM を起動（autoplay 対策）。
    if (!muted) audioRef.current?.play().catch(() => {});
    setStarted(true);
  };

  // ── 仮想ジョイスティック（ドラッグ）入力 ──────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    touchStartRef.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!touchStartRef.current) return;
    joyRef.current = {
      x: clamp((e.clientX - touchStartRef.current.x) / 40, -1, 1),
      y: clamp((e.clientY - touchStartRef.current.y) / 40, -1, 1),
    };
  };
  const handlePointerUp = () => {
    touchStartRef.current = null;
    joyRef.current = { x: 0, y: 0 };
  };

  // ── メインループ（移動・地形判定・エンカウント）───────────────
  useEffect(() => {
    if (!started) return;
    const loop = (time: number) => {
      if (lastTimeRef.current != null) {
        const deltaTime = (time - lastTimeRef.current) / 1000;
        if (encounter) {
          setIsMoving(false);
          lastTimeRef.current = time;
          requestRef.current = requestAnimationFrame(loop);
          return;
        }
        const inputX = clamp(tiltRef.current.x + joyRef.current.x, -1, 1);
        const inputY = clamp(tiltRef.current.y + joyRef.current.y, -1, 1);
        const speed = 5.0;

        if (Math.abs(inputX) > 0.1 || Math.abs(inputY) > 0.1) {
          setIsMoving(true);
          const vx = inputX * speed * deltaTime;
          const vy = inputY * speed * deltaTime;
          walkDistanceRef.current += Math.sqrt(vx * vx + vy * vy);

          setHeroPos((prev) => {
            let newX = prev.x + vx;
            let newY = prev.y + vy;
            const checkGrid = (x: number, y: number) => {
              const rX = Math.round(x - 0.5);
              const rY = Math.round(y - 0.5);
              if (rY < 0 || rY >= MAP_ROWS || rX < 0 || rX >= MAP_COLS) return false;
              return MAP[rY][rX] !== 0; // 海(0)は進入不可
            };
            if (!checkGrid(newX, prev.y)) newX = prev.x;
            if (!checkGrid(newX, newY)) newY = prev.y;

            // 一定距離歩くごとにエンカウント判定（夜・残り0回はしない）。
            if (walkDistanceRef.current > 1.0) {
              walkDistanceRef.current = 0;
              const gx = Math.floor(newX);
              const gy = Math.floor(newY);
              if (gy >= 0 && gy < MAP_ROWS && gx >= 0 && gx < MAP_COLS) {
                const tile = MAP[gy][gx];
                if (phase !== "night" && huntCount > 0) {
                  let rate = 0;
                  if (tile === 2) rate = 0.25; // 森は出やすい
                  else if (tile === 1 || tile === 3 || tile === 4) rate = 0.1;
                  if (Math.random() < rate) {
                    setEncounter(true);
                    setFlash(true);
                    setTimeout(() => setFlash(false), 300);
                  }
                }
              }
            }
            return { x: newX, y: newY };
          });
        } else {
          setIsMoving(false);
        }
      }
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current != null) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = null;
    };
  }, [started, encounter, phase, huntCount]);

  // ── 近接施設の検出 ────────────────────────────────────────────
  useEffect(() => {
    if (encounter) {
      setActiveFacility(null);
      return;
    }
    let closest: Facility | null = null;
    let minDist = 1.2;
    FACILITIES.forEach((f) => {
      const dist = Math.sqrt((f.x + 0.5 - heroPos.x) ** 2 + (f.y + 0.5 - heroPos.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = f;
      }
    });
    setActiveFacility(closest);
  }, [heroPos, encounter]);

  // ── 施設のロック判定（夜・残り狩り回数・コイン/罠の1日上限）────
  const facilityLockMsg = (f: Facility): string | null => {
    if (phase === "night" && !f.nightOpen)
      return "🌙 よるは どうぶつも おやすみちゅう。また あした あそぼうね！";
    if (f.gate === "hunt" && huntCount <= 0)
      return "🌙 きょうの かりは もう おしまい！また あした";
    if (f.gate === "trap" && trapDone)
      return "🌙 きょうの わなは もう おしまい！また あした";
    if (f.gate === "trap" && broke)
      return "🪙 まだ コインが たりないよ。おてつだいで ためよう！";
    return null;
  };
  const isLocked = (f: Facility) => facilityLockMsg(f) !== null;

  // ── A ボタン：施設へ入る（ロック時はメッセージのみ）──────────
  const showMsg = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage((m) => (m === msg ? null : m)), 3000);
  };
  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeFacility) return;
    const lock = facilityLockMsg(activeFacility);
    if (lock) {
      showMsg(lock);
      return;
    }
    showMsg(`▶ ${activeFacility.name} に はいった！`);
    router.push(`/kids/${kidId}/${activeFacility.route}`);
  };

  // ── エンカウント：にげる / かりをする ─────────────────────────
  const handleFlee = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEncounter(false);
    walkDistanceRef.current = -3.0; // 直後の再エンカウントを抑制
  };
  const handleHunt = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEncounter(false);
    if (huntCount > 0) {
      // 実際のアクティブ狩り画面へ遷移（Notion: エンカウント → 狩り）。
      router.push(`/kids/${kidId}/safari?style=active`);
    }
  };

  // ── 描画ヘルパー ──────────────────────────────────────────────
  const getTileStyle = (type: number): React.CSSProperties => {
    switch (type) {
      case 0:
        return { backgroundImage: getSvgUrl(PATTERNS.sea) };
      case 1:
        return { backgroundImage: getSvgUrl(PATTERNS.grass) };
      case 2:
        return { backgroundImage: getSvgUrl(PATTERNS.forest) };
      case 3:
        return { backgroundImage: getSvgUrl(PATTERNS.mountain) };
      case 4:
        return { backgroundImage: getSvgUrl(PATTERNS.desert) };
      case 6:
        return { backgroundImage: getSvgUrl(PATTERNS.bridge) };
      default:
        return { backgroundColor: "#000" };
    }
  };

  const mapTransform = `perspective(800px) rotateX(${tiltRef.current.y * 10 + joyRef.current.y * 10}deg) rotateY(${tiltRef.current.x * -10 + joyRef.current.x * -10}deg)`;

  return (
    <div
      className="w-full flex justify-center bg-zinc-950 select-none overflow-hidden touch-none"
      style={{ height: "calc(100dvh - var(--header-h, 56px))" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DotGothic16&display=swap');
        .wm-sfc { font-family: 'DotGothic16', monospace; }
        @keyframes wm-wave { 0% { background-position: 0 0; } 100% { background-position: 16px 16px; } }
        .wm-animate-wave { animation: wm-wave 2.5s linear infinite; }
        @keyframes wm-cloud { 0% { background-position: 0 0; } 100% { background-position: 200px 200px; } }
        .wm-animate-cloud { animation: wm-cloud 60s linear infinite; }
        @keyframes wm-walk { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .wm-animate-walk { animation: wm-walk 0.3s steps(2, end) infinite; }
        @keyframes wm-flash { 0%, 100% { background-color: transparent; } 50% { background-color: white; } }
        .wm-animate-flash { animation: wm-flash 0.3s ease-out; }
      `}</style>

      <div
        className="wm-sfc relative w-full max-w-[480px] h-full flex flex-col bg-black overflow-hidden border-x-4 border-zinc-800"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {flash && <div className="absolute inset-0 bg-white z-[60] wm-animate-flash pointer-events-none" />}

        {/* スタートゲート（傾き許可＆BGM 起動のためのユーザー操作） */}
        {!started && (
          <div className="absolute inset-0 bg-black/80 z-[70] flex flex-col items-center justify-center backdrop-blur-sm p-4">
            <PixelArt artName="hero" paletteName="hero" scale={3} className="mb-4" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleStart();
              }}
              className="px-6 py-4 bg-yellow-500 text-black font-bold rounded-xl border-4 border-white hover:bg-yellow-400 transition cursor-pointer"
            >
              ▶ ぼうけんに でる
            </button>
          </div>
        )}

        {/* 上部 HUD（勇者＝選択中の子・残り狩り回数・コイン） */}
        <div className="p-2 z-20 flex justify-between items-start gap-2 pointer-events-none">
          <RpgWindow className="flex-1 text-sm pb-1 pt-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-yellow-400">▶ {player?.yomi ?? "ゆうしゃ"}</span>
              <span className="text-xs text-gray-400">かり: のこり{huntCount}かい</span>
            </div>
            <div className="text-right text-yellow-400">{coins} G</div>
          </RpgWindow>

          {/* BGM ミュート（ドラッグで誤操作しないよう pointerDown を止める） */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            title={muted ? "BGM をオンにする" : "BGM をオフにする"}
            className="pointer-events-auto shrink-0 w-10 h-10 rounded-md bg-black/70 border-2 border-white/80 text-white text-lg flex items-center justify-center"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>

        {/* マップ本体 */}
        <div className="relative flex-1 w-full bg-black overflow-hidden pointer-events-none">
          <div
            className="absolute inset-[-10%] w-[120%] h-[120%] transition-transform duration-75 ease-out"
            style={{ transform: encounter ? "none" : mapTransform }}
          >
            {/* 地形タイル */}
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${MAP_COLS}, 1fr)`, gridTemplateRows: `repeat(${MAP_ROWS}, 1fr)` }}
            >
              {MAP.map((row, y) =>
                row.map((tile, x) => (
                  <div
                    key={`${x}-${y}`}
                    style={getTileStyle(tile)}
                    className={`w-full h-full ${tile === 0 ? "wm-animate-wave" : ""}`}
                  />
                )),
              )}
            </div>

            {/* 道（点線） */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 150 200" preserveAspectRatio="none">
              <g fill="none" stroke="#b45309" strokeWidth="1.5" strokeDasharray="3 4" strokeLinecap="round" opacity="0.5">
                <path d="M 35 135 Q 35 105 85 75" />
                <path d="M 35 135 Q 70 135 105 105" />
                <path d="M 105 105 Q 115 145 125 145" />
                <path d="M 85 75 Q 85 35 35 35" />
                <path d="M 85 75 Q 105 55 105 35" />
                <path d="M 105 105 Q 105 70 105 35" />
              </g>
            </svg>

            {/* 施設 */}
            {FACILITIES.map((facility) => {
              const isActive = activeFacility?.id === facility.id && !encounter;
              const locked = isLocked(facility);
              const sleeping = phase === "night" && !facility.nightOpen;
              return (
                <div
                  key={facility.id}
                  className="absolute flex flex-col items-center justify-end z-20"
                  style={{
                    left: `${(facility.x / MAP_COLS) * 100}%`,
                    top: `${(facility.y / MAP_ROWS) * 100}%`,
                    width: `${100 / MAP_COLS}%`,
                    height: `${100 / MAP_ROWS}%`,
                  }}
                >
                  <div
                    className={`absolute bottom-0 drop-shadow-[0_2px_1px_rgba(0,0,0,0.8)] transition-transform origin-bottom ${
                      isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : ""
                    }`}
                    style={{ filter: locked ? "grayscale(0.85) brightness(0.7)" : undefined }}
                  >
                    <PixelArt artName={facility.art} paletteName={facility.pal} scale={2} />
                  </div>

                  {/* 夜/上限で閉じている施設は Zzz 表示（DESIGN_PRINCIPLES 2） */}
                  {locked && (
                    <div className="absolute -top-1 right-0 text-sm" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }}>
                      {sleeping ? "🌙" : "💤"}
                    </div>
                  )}

                  {/* 家：つかまえた どうぶつ数バッジ */}
                  {facility.id === "house" && houseAnimalCount > 0 && (
                    <div className="absolute -top-1 right-0 bg-red-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 border-2 border-white whitespace-nowrap">
                      🔴 {houseAnimalCount}
                    </div>
                  )}

                  {/* 接近時のラベル */}
                  <div
                    className={`absolute bottom-[120%] w-max bg-black/90 text-white text-[10px] px-2 py-1 border-2 border-white/80 rounded-md whitespace-nowrap transition-all duration-300 ${
                      isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                    }`}
                  >
                    ▼ {facility.name}
                  </div>
                </div>
              );
            })}

            {/* 勇者（選択中の子） */}
            <div
              className="absolute z-30 flex justify-center items-end"
              style={{ left: `${(heroPos.x / MAP_COLS) * 100}%`, top: `${(heroPos.y / MAP_ROWS) * 100}%`, width: "0px", height: "0px" }}
            >
              <div className={`absolute bottom-0 drop-shadow-[0_4px_2px_rgba(0,0,0,0.8)] ${isMoving && !encounter ? "wm-animate-walk" : ""}`}>
                <PixelArt artName="hero" paletteName="hero" scale={2} className="-translate-x-1/2" />
              </div>
              {encounter && (
                <div className="absolute bottom-8 -translate-x-1/2 text-2xl drop-shadow-lg text-red-500 font-black animate-bounce z-50">
                  ！
                </div>
              )}
            </div>

            {/* 雲ノイズ */}
            <div
              className="absolute inset-0 opacity-30 mix-blend-multiply z-40 wm-animate-cloud"
              style={{ backgroundImage: cloudNoiseUrl }}
            />

            {/* 昼夜フィルター */}
            {phase === "twilight" && (
              <div className="absolute inset-0 bg-orange-600/40 mix-blend-multiply pointer-events-none z-40 transition-colors duration-1000" />
            )}
            {phase === "night" && (
              <div className="absolute inset-0 bg-blue-900/60 mix-blend-multiply pointer-events-none z-40 transition-colors duration-1000" />
            )}

            {encounter && <div className="absolute inset-0 bg-black/50 z-40 transition-opacity duration-300" />}
          </div>
        </div>

        {/* 下部 UI（メッセージ / エンカウント） */}
        <div className="p-2 z-[60] flex flex-col gap-2 relative mt-auto mb-4 pointer-events-none">
          {encounter ? (
            <RpgWindow isRed className="flex flex-col text-sm pointer-events-auto">
              <div className="mb-4 text-red-300 font-bold flex items-center gap-2">
                <PixelArt artName="monster" paletteName="monster" scale={1.5} />
                やせいの まものが とびだしてきた！
              </div>
              <div className="flex gap-2 justify-center">
                <button onClick={handleHunt} className="flex-1 py-3 bg-red-900/80 border-2 border-red-400 rounded text-white font-bold">
                  ▶ かりをする
                </button>
                <button onClick={handleFlee} className="flex-1 py-3 bg-gray-800 border-2 border-gray-500 rounded text-white font-bold">
                  ▶ にげる
                </button>
              </div>
            </RpgWindow>
          ) : (
            <RpgWindow className="min-h-[4.5rem] flex items-center text-sm pointer-events-none">
              {actionMessage ? (
                <span className="text-yellow-400 font-bold w-full text-center">{actionMessage}</span>
              ) : activeFacility ? (
                <span>
                  『{activeFacility.name}』の まえだ。<br />Aボタン で はいりますか？
                </span>
              ) : (
                <span className="text-gray-400">もり や くさむら を あるくと まものに であうかも…？</span>
              )}
            </RpgWindow>
          )}

          {!encounter && (
            <div className="absolute -top-6 right-6 pointer-events-auto">
              <button
                className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-xl shadow-lg ${
                  activeFacility ? "bg-red-600 border-white text-white" : "bg-red-900 border-gray-400 text-gray-400 opacity-50"
                }`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleAction}
              >
                A
              </button>
            </div>
          )}
        </div>
      </div>

      {/* おたがいさまイベント（全画面共通） */}
      <KizunaManager />
    </div>
  );
}
