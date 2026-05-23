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

// ── CSS アニメーション（一度だけ <head> に注入） ──────────────
const MAP_CSS = `
@keyframes rainDrop{0%{transform:translateY(-10px) translateX(0);opacity:0}10%{opacity:.7}90%{opacity:.7}100%{transform:translateY(620px) translateX(-80px);opacity:0}}
@keyframes leafSpin{0%{transform:translateX(-20px) translateY(0) rotate(0deg);opacity:0}15%{opacity:.85}85%{opacity:.85}100%{transform:translateX(500px) translateY(300px) rotate(540deg);opacity:0}}
@keyframes heatWave{0%,100%{transform:scaleY(1) translateY(0);opacity:.18}50%{transform:scaleY(1.04) translateY(-3px);opacity:.28}}
@keyframes bobble{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes walkTo{0%{transform:translate(var(--ex-start),var(--ey-start))}100%{transform:translate(var(--ex-end),var(--ey-end))}}
@keyframes slideUp{0%{transform:translateY(110%);opacity:0}100%{transform:translateY(0);opacity:1}}
`;

function injectMapCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("cs-world-css")) return;
  const s = document.createElement("style");
  s.id = "cs-world-css";
  s.textContent = MAP_CSS;
  document.head.appendChild(s);
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
  isNew?: boolean;
};

// ── MAP_PINS（iPad 対応・広域再配置） ─────────────────────────
//
// 地図の"ゾーン"イメージ：
//   左上  ──── ギルド（出発点）
//   中上  ──── クラフト工房（制作ゾーン）
//   右上  ──── アクティブ狩り（山岳・開けた野原 ゾーン）
//   左中  ──── 農場
//   中中  ──── 罠スタイル（密林ゾーン）・物流センター
//   右中  ──── 牧場
//   左下  ──── 博物図鑑
//   中下  ──── カオスレース
//   右下  ──── 動物園・ゲームセンター
//
const MAP_PINS: MapPin[] = [
  // ── 左上：ギルド（スタート地点）
  {
    id: "guild",
    icon: "🏰",
    label: "クエストギルド",
    sub: "おてつだい・クエスト",
    x: 9,
    y: 14,
    color: "#c084fc",
    route: "guild",
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
    ready: true,
    isNew: true,
  },
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
    ready: true,
    isNew: true,
  },
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
    ready: true,
    isNew: true,
  },
  // ── 中央下：物流センター（罠スタイルの南）
  {
    id: "logistics",
    icon: "📦",
    label: "物流センター",
    sub: "えさをはこぶ・はいそう",
    x: 52,
    y: 72,
    color: "#60a5fa",
    route: "logistics",
    action: "route",
    ready: true,
    isNew: true,
  },
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
    ready: true,
    isNew: true,
  },
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
    ready: true,
    isNew: true,
  },
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

// ── PATHS（新ピン配置に合わせた自然なルート） ─────────────────
const PATHS = [
  // ギルド → 農場 → クラフト（左辺の縦軸）
  { from: "guild",          to: "farm"           },
  { from: "farm",           to: "craft"          },
  // 農場 → 牧場（素材の流れ）
  { from: "farm",           to: "ranch"          },
  // クラフト → 2 つのサファリ（分岐）
  { from: "craft",          to: "safari-passive" },
  { from: "craft",          to: "safari-active"  },
  // 罠スタイル → 倉庫・牧場
  { from: "safari-passive", to: "logistics"      },
  { from: "safari-passive", to: "ranch"          },
  // アクティブ → 牧場（右辺）
  { from: "safari-active",  to: "ranch"          },
  // 牧場 → 動物園
  { from: "ranch",          to: "zoo"            },
  // 倉庫からの接続
  { from: "logistics",      to: "zoo"            },
  { from: "logistics",      to: "race"           },
  // 図鑑 → 倉庫
  { from: "dictionary",     to: "logistics"      },
  // 動物園 → ゲームセンター
  { from: "zoo",            to: "arcade"         },
  // サファリ → 自分の家 → 牧場・動物園
  { from: "safari-passive", to: "house"          },
  { from: "safari-active",  to: "house"          },
  { from: "house",          to: "ranch"          },
  { from: "house",          to: "zoo"            },
];

// ── ゲームセンター内ゲーム ─────────────────────────────────────
const ARCADE_GAMES = [
  { id: "crane", icon: "🎁", name: "クレーンゲーム", sub: "UFOキャッチャー", route: "crane", ready: true,  color: "#34d399" },
  { id: "quiz",  icon: "❓", name: "どうぶつクイズ", sub: "ちしきをためそう",  route: "quiz",  ready: false, color: "#a78bfa" },
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

// ── ゲームセンターモーダル ─────────────────────────────────────
function ArcadeModal({ onClose, onNavigate }: {
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.55)",
      display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end",
    }}>
      <div style={{
        background: "linear-gradient(180deg,#ecfdf5,#fff)",
        borderRadius: "28px 28px 0 0", animation: "slideUp .32s ease-out", paddingBottom: 36,
        maxHeight: "80vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 44, height: 5, borderRadius: 3, background: "#d1d5db" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "0 20px 14px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 32, marginRight: 14 }}>🕹️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#111827" }}>ゲームセンター</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>あそびたい ゲームを えらんでね！</div>
          </div>
          <button onClick={onClose} style={{
            background: "#f3f4f6", border: "none", borderRadius: 20,
            width: 36, height: 36, fontSize: 18, cursor: "pointer", color: "#6b7280",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {ARCADE_GAMES.map((g) => (
            <button key={g.id} onClick={() => { if (g.ready) onNavigate(g.route); }}
              style={{
                display: "flex", alignItems: "center", gap: 16, padding: "16px 18px",
                borderRadius: 20, border: `2.5px solid ${g.ready ? g.color + "88" : "#e5e7eb"}`,
                background: g.ready ? `linear-gradient(135deg,${g.color}18,${g.color}08)` : "#f9fafb",
                cursor: g.ready ? "pointer" : "not-allowed", textAlign: "left",
                boxShadow: g.ready ? `0 3px 14px ${g.color}22` : "none",
                transition: "all .18s", opacity: g.ready ? 1 : 0.65,
              }}>
              <div style={{
                width: 58, height: 58, borderRadius: 18,
                background: g.ready ? `linear-gradient(135deg,${g.color},${g.color}bb)` : "#e5e7eb",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, flexShrink: 0,
                boxShadow: g.ready ? `0 3px 10px ${g.color}44` : "none",
              }}>{g.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#111827", marginBottom: 3 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{g.sub}</div>
                <div style={{ marginTop: 5 }}>
                  {g.ready
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: g.color, background: g.color + "18", borderRadius: 8, padding: "2px 8px" }}>▶ あそぶ</span>
                    : <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", borderRadius: 8, padding: "2px 8px" }}>🚧 準備中</span>}
                </div>
              </div>
              {g.ready && <div style={{ fontSize: 20, color: g.color }}>›</div>}
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
}: {
  children: ChildLite[];
  selectedId: string;
  onBack: () => void;
  houseAnimalCount?: number;
}) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);

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

  const player = players[activePlayer] ?? players[0];

  const others = players
    .map((p, i) => ({ ...p, origIndex: i }))
    .filter((p) => p.origIndex !== activePlayer)
    .map((p, oi) => ({
      ...p, oi,
      // 兄弟は牧場/動物園/レース周辺に配置
      pin: MAP_PINS[[5, 6, 9][oi % 3]],
    }));

  // ── ピンタップ ────────────────────────────────────────────────
  const handlePin = (pin: MapPin) => {
    if (walking) return;
    if (pin.comingSoon) { setComingSoon(pin); return; }
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
    <div style={{
      background: "linear-gradient(135deg,#fef9c3,#dcfce7 40%,#dbeafe)",
      fontFamily: "'Segoe UI',sans-serif",
      minHeight: "calc(100vh - 52px)",
    }}>
      {/* ── maxWidth 1024px でタブレット全幅を活用 ── */}
      <div style={{ maxWidth: 1024, margin: "0 auto", padding: "14px 16px 36px" }}>

        {/* ── マップ本体（GlobalHeader 分を引いた高さ） ── */}
        <div ref={mapRef} style={{
          position: "relative", borderRadius: 32, overflow: "hidden",
          height: "min(calc(76vh - 52px), 680px)",
          background: weather.bgGrad,
          boxShadow: "0 10px 40px rgba(0,0,0,.18)",
        }}>
          <WeatherEffect weather={weather} />

          {/* 地形デコレーション（広域に散らす） */}
          {[
            { t: "🌴", x: 3,  y: 5,  s: 1.2 },
            { t: "🌳", x: 90, y: 3,  s: 1.1 },
            { t: "🌿", x: 1,  y: 78, s: 1.0 },
            { t: "🌴", x: 93, y: 82, s: 1.1 },
            { t: "🏔️", x: 60, y: 2,  s: 1.4 }, // 山岳（アクティブ狩りエリアの北）
            { t: "🌊", x: 72, y: 88, s: 0.9 },
            { t: "🌾", x: 20, y: 60, s: 1.0 },
            { t: "🌿", x: 55, y: 87, s: 1.1 },
            { t: "🌲", x: 38, y: 40, s: 1.0 }, // 罠スタイル周辺の密林
            { t: "🌲", x: 48, y: 43, s: 0.9 },
            { t: "🌿", x: 42, y: 65, s: 0.8 },
          ].map((d, i) => (
            <div key={i} style={{
              position: "absolute", left: d.x + "%", top: d.y + "%",
              fontSize: 24 * d.s, opacity: 0.32, pointerEvents: "none", userSelect: "none",
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
              <div style={{ fontSize: 18, animation: "bobble 3s ease-in-out infinite", animationDelay: op.oi * 0.7 + "s" }}>{op.avatar}</div>
              <div style={{
                fontSize: 8, fontWeight: 700, color: "#fff",
                background: op.color, borderRadius: 8,
                padding: "1px 5px", marginTop: 2, whiteSpace: "nowrap",
              }}>{op.yomi}</div>
            </div>
          ))}

          {/* マップピン */}
          {MAP_PINS.map((pin, idx) => {
            const grey = !!pin.comingSoon;
            return (
              <button key={pin.id} onClick={() => handlePin(pin)} aria-label={pin.label}
                style={{
                  position: "absolute", left: pin.x + "%", top: pin.y + "%",
                  transform: "translate(-50%,-50%)", zIndex: 15,
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  opacity: grey ? 0.75 : 1,
                }}>
                {/* ピンのアイコン */}
                <div style={{
                  position: "relative", width: 52, height: 52, borderRadius: 18,
                  background: grey
                    ? "linear-gradient(135deg,#9ca3af,#6b7280)"
                    : `linear-gradient(135deg,${pin.color},${pin.color}bb)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, border: "3.5px solid white",
                  boxShadow: grey ? "0 3px 10px rgba(0,0,0,.18)" : `0 5px 16px ${pin.color}66`,
                  animation: "bobble 2.5s ease-in-out infinite",
                  animationDelay: idx * 0.22 + "s",
                  filter: grey ? "grayscale(.5)" : "none",
                }}>
                  {pin.icon}
                  {pin.isNew && (
                    <div style={{
                      position: "absolute", top: -8, right: -8,
                      background: "#ef4444", color: "#fff",
                      fontSize: 8, fontWeight: 800, borderRadius: 8, padding: "2px 5px",
                    }}>NEW</div>
                  )}
                  {grey && (
                    <div style={{
                      position: "absolute", top: -8, right: -8,
                      background: "#9ca3af", color: "#fff",
                      fontSize: 8, fontWeight: 800, borderRadius: 8, padding: "2px 5px",
                    }}>準備中</div>
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
                  fontSize: 9, fontWeight: 800, color: "#fff",
                  background: grey ? "rgba(80,80,80,.60)" : "rgba(0,0,0,.42)",
                  borderRadius: 8, padding: "2px 7px",
                  whiteSpace: "nowrap", backdropFilter: "blur(4px)",
                  maxWidth: 90, textAlign: "center", lineHeight: 1.3,
                }}>{pin.label}</div>
              </button>
            );
          })}

          {/* 歩行アバター */}
          <div style={walkAnimStyle}>
            <div style={{
              width: 44, height: 44, borderRadius: 22,
              background: player.color + "33",
              border: `3.5px solid ${player.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, boxShadow: `0 0 0 5px ${player.color}22`,
              animation: walking ? "bobble .3s ease-in-out infinite" : "bobble 2s ease-in-out infinite",
            }}>{player.avatar}</div>
            {/* 名前バッジ */}
            <div style={{
              position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
              fontSize: 9, fontWeight: 800, color: "#fff",
              background: player.color, borderRadius: 8, padding: "2px 6px", whiteSpace: "nowrap",
            }}>{player.yomi}</div>
            {walking && (
              <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", fontSize: 13 }}>💨</div>
            )}
          </div>

          {/* ステータスバー */}
          <div style={{
            position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
            background: walking ? "rgba(132,94,247,.88)" : "rgba(0,0,0,.38)",
            color: "#fff", fontSize: 11, fontWeight: 700,
            borderRadius: 14, padding: "5px 16px",
            backdropFilter: "blur(6px)", zIndex: 25, whiteSpace: "nowrap",
            boxShadow: "0 2px 10px rgba(0,0,0,.2)",
          }}>
            {walking ? "🐾 いどうちゅう…" : "📍 しせつを タップして いどうしよう！"}
          </div>

          {/* トースト・モーダル */}
          {comingSoon && <ComingSoonToast pin={comingSoon} onClose={() => setComingSoon(null)} />}
        </div>

        {/* ── 経済フロー（タブレットでは横並び展開） ── */}
        <div style={{
          marginTop: 12, background: "rgba(255,255,255,.72)",
          borderRadius: 20, padding: "12px 18px",
          border: "1px solid #ede9fe",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", marginBottom: 6 }}>📍 けいざいのながれ</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {[
              "🏰 ギルド", "🔨 クラフト",
              "🦁 罠スタイル", "🏹 アクティブ狩り",
              "📦 倉庫", "🐘 どうぶつえん", "🕹️ ゲームセンター",
            ].map((s, i, a) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  background: "#f5f3ff", border: "1px solid #ddd6fe",
                  borderRadius: 22, padding: "3px 9px",
                  fontSize: 10, fontWeight: 700, color: "#5b21b6",
                }}>{s}</span>
                {i < a.length - 1 && <span style={{ color: "#a78bfa", fontSize: 11 }}>→</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {arcadeOpen && (
        <ArcadeModal onClose={() => setArcadeOpen(false)} onNavigate={handleArcadeNavigate} />
      )}
    </div>
  );
}
