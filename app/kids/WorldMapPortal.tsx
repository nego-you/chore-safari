"use client";

// app/kids/WorldMapPortal.tsx
// ワールドマップ UI ポータル — KidsPortal のプレイヤー選択後に表示される画面。
// ベース: chore_safari_v2.tsx (WorldMap コンポーネント)
// 変更点:
//   - モックデータ → DB 由来の children prop を使用
//   - サファリを「罠スタイル」と「アクティブ狩り」の 2 ピンに分割
//   - NavigatePopup → Next.js router.push で実遷移
//   - 幸仁のアイコン 🐷 (ブタ) へ変更
//   - 未実装施設は comingSoon フラグでトースト表示

import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

// ── CSS アニメーション（一度だけ <head> に注入） ──────────────
const MAP_CSS = `
@keyframes rainDrop{0%{transform:translateY(-10px) translateX(0);opacity:0}10%{opacity:.7}90%{opacity:.7}100%{transform:translateY(420px) translateX(-80px);opacity:0}}
@keyframes leafSpin{0%{transform:translateX(-20px) translateY(0) rotate(0deg);opacity:0}15%{opacity:.85}85%{opacity:.85}100%{transform:translateX(340px) translateY(200px) rotate(540deg);opacity:0}}
@keyframes heatWave{0%,100%{transform:scaleY(1) translateY(0);opacity:.18}50%{transform:scaleY(1.04) translateY(-3px);opacity:.28}}
@keyframes bobble{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes walkTo{0%{transform:translate(var(--sx),var(--sy))}100%{transform:translate(var(--ex),var(--ey))}}
@keyframes slideUp{0%{transform:translateY(110%);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes popIn{0%{transform:translate(-50%,-50%) scale(0.5);opacity:0}70%{transform:translate(-50%,-50%) scale(1.1)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
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
  "幸仁": { emoji: "🐷", color: "#f472b6" }, // ブタ (🐹 から変更)
  "叶泰": { emoji: "🦦", color: "#34d399" }, // カワウソ
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

// ── 天気 ──────────────────────────────────────────────────────
const WEATHER_OPTIONS = [
  {
    id: "sunny",
    label: "☀️ はれ",
    bgGrad:
      "linear-gradient(155deg,#86efac 0%,#fde68a 35%,#fed7aa 65%,#86efac 100%)",
  },
  {
    id: "hot",
    label: "🔥 もうしょ",
    bgGrad:
      "linear-gradient(155deg,#fde68a 0%,#fb923c 40%,#fde68a 70%,#fed7aa 100%)",
  },
  {
    id: "typhoon",
    label: "🌀 たいふう",
    bgGrad:
      "linear-gradient(155deg,#bae6fd 0%,#93c5fd 30%,#a5f3fc 65%,#67e8f9 100%)",
  },
];
type Weather = (typeof WEATHER_OPTIONS)[number];

// ── マップピン型 ───────────────────────────────────────────────
type MapPin = {
  id: string;
  icon: string;
  label: string;
  sub: string;
  x: number; // % (left)
  y: number; // % (top)
  color: string;
  /** ルートセグメント (例: "guild") — null は comingSoon か arcade */
  route: string | null;
  /** query string (例: "style=passive") */
  query?: string;
  action: "route" | "arcade";
  ready: boolean;
  comingSoon?: boolean;
  isNew?: boolean;
};

// ── MAP_PINS ───────────────────────────────────────────────────
// サファリを「罠スタイル」と「アクティブ狩り」の 2 ピンに分割。
// ready:true のピンは実遷移。comingSoon のピンはトースト表示。
const MAP_PINS: MapPin[] = [
  {
    id: "guild",
    icon: "🏰",
    label: "クエストギルド",
    sub: "おてつだい・クエスト",
    x: 12,
    y: 18,
    color: "#c084fc",
    route: "guild",
    action: "route",
    ready: true,
  },
  {
    id: "farm",
    icon: "🌾",
    label: "農場",
    sub: "そざいをしゅうかく",
    x: 30,
    y: 40,
    color: "#86efac",
    route: null,
    action: "route",
    ready: false,
    comingSoon: true,
  },
  {
    id: "craft",
    icon: "🔨",
    label: "クラフト工房",
    sub: "わなや どうぐをつくる",
    x: 46,
    y: 26,
    color: "#4ade80",
    route: "craft",
    action: "route",
    ready: true,
  },
  // ── サファリ 2 分割 ──
  {
    id: "safari-passive",
    icon: "🦁",
    label: "罠スタイル",
    sub: "そざいと ワナを えらんで、どうぶつが くるのを まとう！",
    x: 60,
    y: 44,
    color: "#fbbf24",
    route: "safari",
    query: "style=passive",
    action: "route",
    ready: true,
  },
  {
    id: "safari-active",
    icon: "🏹",
    label: "アクティブ狩り",
    sub: "ぶきを もって、しゅんかんで どうぶつを つかまえよう！",
    x: 72,
    y: 22,
    color: "#fb7185",
    route: "safari",
    query: "style=active",
    action: "route",
    ready: true,
  },
  {
    id: "ranch",
    icon: "🐄",
    label: "牧場",
    sub: "どうぶつをそだてる",
    x: 80,
    y: 30,
    color: "#fde68a",
    route: null,
    action: "route",
    ready: false,
    comingSoon: true,
  },
  {
    id: "zoo",
    icon: "🐘",
    label: "動物園",
    sub: "みせて・まなぶ",
    x: 82,
    y: 54,
    color: "#f472b6",
    route: null,
    action: "route",
    ready: false,
    comingSoon: true,
  },
  {
    id: "warehouse",
    icon: "📦",
    label: "物流センター",
    sub: "えさをはこぶ・はいそう",
    x: 54,
    y: 62,
    color: "#60a5fa",
    route: "warehouse",
    action: "route",
    ready: true,
  },
  {
    id: "dictionary",
    icon: "📚",
    label: "博物図鑑",
    sub: "どうぶつのひみつ",
    x: 18,
    y: 68,
    color: "#f59e0b",
    route: "dictionary",
    action: "route",
    ready: true,
  },
  {
    id: "race",
    icon: "🏁",
    label: "カオスレース",
    sub: "どうぶつレースで さいそく",
    x: 36,
    y: 74,
    color: "#f97316",
    route: "race",
    action: "route",
    ready: true,
    isNew: true,
  },
  {
    id: "arcade",
    icon: "🕹️",
    label: "ゲームセンター",
    sub: "クレーンゲームなど",
    x: 86,
    y: 72,
    color: "#34d399",
    route: null,
    action: "arcade",
    ready: true,
    isNew: true,
  },
];

// ── PATHS (クラフト工房 → 2 つのサファリピンへ接続) ───────────
const PATHS = [
  { from: "guild", to: "farm" },
  { from: "farm", to: "craft" },
  { from: "craft", to: "safari-passive" },
  { from: "craft", to: "safari-active" },
  { from: "safari-passive", to: "ranch" },
  { from: "ranch", to: "zoo" },
  { from: "safari-passive", to: "warehouse" },
  { from: "warehouse", to: "zoo" },
  { from: "dictionary", to: "warehouse" },
  { from: "warehouse", to: "race" },
  { from: "zoo", to: "arcade" },
];

// ── ゲームセンター内ゲーム ─────────────────────────────────────
const ARCADE_GAMES = [
  {
    id: "crane",
    icon: "🎁",
    name: "クレーンゲーム",
    sub: "UFOキャッチャー",
    route: "crane",
    ready: true,
    color: "#34d399",
  },
  {
    id: "quiz",
    icon: "❓",
    name: "どうぶつクイズ",
    sub: "ちしきをためそう",
    route: "quiz",
    ready: false,
    color: "#a78bfa",
  },
  {
    id: "slot",
    icon: "🎰",
    name: "サファリスロット",
    sub: "レアなどうぶつをゲット",
    route: "slot",
    ready: false,
    color: "#f59e0b",
  },
];

// ── 内部型: プレイヤー ────────────────────────────────────────
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

// ── サブコンポーネント: 天気エフェクト ─────────────────────────
function WeatherEffect({ weather }: { weather: Weather }) {
  if (weather.id === "sunny") return null;
  if (weather.id === "hot")
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          zIndex: 10,
          background:
            "linear-gradient(180deg,rgba(251,146,60,.22),rgba(253,186,116,.12))",
          animation: "heatWave 3s ease-in-out infinite",
        }}
      />
    );
  // typhoon: 雨 + 葉
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        pointerEvents: "none",
        zIndex: 10,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: 16 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: (5 + (i * 6) % 92) + "%",
            top: (-10 - (i % 5) * 8) + "%",
            width: 2,
            height: 10 + (i % 8),
            background: "rgba(147,197,253,.7)",
            borderRadius: 4,
            animation: `rainDrop ${0.7 + (i % 5) * 0.18}s linear ${(i * 0.11) % 1}s infinite`,
          }}
        />
      ))}
      {["🍃", "🌿", "🍂", "🍀"].map((l, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            fontSize: 15,
            left: ((i * 27) % 78) + "%",
            top: (8 + (i * 14) % 38) + "%",
            animation: `leafSpin ${3 + i * 0.7}s linear ${i * 0.8}s infinite`,
          }}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

function WeatherBoard({ weather }: { weather: Weather }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 20,
        background: "linear-gradient(135deg,#fffbeb,#fef3c7)",
        border: "3px solid #f59e0b",
        borderRadius: 16,
        padding: "5px 10px",
        boxShadow: "3px 3px 0 #d97706",
        textAlign: "center",
        minWidth: 66,
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 800,
          color: "#92400e",
          letterSpacing: 1,
          marginBottom: 1,
        }}
      >
        おてんき
      </div>
      <div style={{ fontSize: 20 }}>{weather.label.split(" ")[0]}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#b45309" }}>
        {weather.label.split(" ").slice(1).join("")}
      </div>
    </div>
  );
}

// ── サブコンポーネント: もうすぐ開通トースト ──────────────────
function ComingSoonToast({
  pin,
  onClose,
}: {
  pin: MapPin;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      style={{
        position: "absolute",
        bottom: 54,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(30,30,30,.88)",
        color: "#fff",
        borderRadius: 16,
        padding: "9px 18px",
        fontSize: 12,
        fontWeight: 700,
        zIndex: 30,
        whiteSpace: "nowrap",
        backdropFilter: "blur(6px)",
      }}
    >
      🚧 {pin.label} は もうすぐ かいつう！
    </div>
  );
}

// ── サブコンポーネント: ゲームセンターモーダル ────────────────
function ArcadeModal({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg,#ecfdf5,#fff)",
          borderRadius: "24px 24px 0 0",
          animation: "slideUp .32s ease-out",
          paddingBottom: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 4px",
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: "#d1d5db",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 18px 12px",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <div style={{ fontSize: 30, marginRight: 12 }}>🕹️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#111827" }}>
              ゲームセンター
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              あそびたい ゲームを えらんでね！
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#f3f4f6",
              border: "none",
              borderRadius: 20,
              width: 32,
              height: 32,
              fontSize: 16,
              cursor: "pointer",
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {ARCADE_GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                if (g.ready) onNavigate(g.route);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 18,
                border: `2.5px solid ${g.ready ? g.color + "88" : "#e5e7eb"}`,
                background: g.ready
                  ? `linear-gradient(135deg,${g.color}18,${g.color}08)`
                  : "#f9fafb",
                cursor: g.ready ? "pointer" : "not-allowed",
                textAlign: "left",
                boxShadow: g.ready ? `0 3px 12px ${g.color}22` : "none",
                transition: "all .18s",
                opacity: g.ready ? 1 : 0.65,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: g.ready
                    ? `linear-gradient(135deg,${g.color},${g.color}bb)`
                    : "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  flexShrink: 0,
                  boxShadow: g.ready ? `0 3px 8px ${g.color}44` : "none",
                }}
              >
                {g.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: "#111827",
                    marginBottom: 2,
                  }}
                >
                  {g.name}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{g.sub}</div>
                <div style={{ marginTop: 4 }}>
                  {g.ready ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: g.color,
                        background: g.color + "18",
                        borderRadius: 8,
                        padding: "2px 7px",
                      }}
                    >
                      ▶ あそぶ
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#9ca3af",
                        background: "#f3f4f6",
                        borderRadius: 8,
                        padding: "2px 7px",
                      }}
                    >
                      🚧 準備中
                    </span>
                  )}
                </div>
              </div>
              {g.ready && (
                <div style={{ fontSize: 18, color: g.color }}>›</div>
              )}
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
}: {
  children: ChildLite[];
  selectedId: string;
  onBack: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    injectMapCSS();
  }, []);

  const players = buildPlayers(children);
  const initialIndex = Math.max(
    0,
    players.findIndex((p) => p.id === selectedId),
  );

  const [weather, setWeather] = useState<Weather | null>(null);
  const [activePlayer, setActivePlayer] = useState(initialIndex);
  const [avatarPos, setAvatarPos] = useState({ x: 12, y: 18 });
  const [walking, setWalking] = useState(false);
  const [walkTarget, setWalkTarget] = useState<{
    x: number;
    y: number;
    sx: number;
    sy: number;
  } | null>(null);
  const [pendingPin, setPendingPin] = useState<MapPin | null>(null);
  const [arcadeOpen, setArcadeOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<MapPin | null>(null);

  // 天気はマウント時にランダム決定
  useEffect(() => {
    setWeather(
      WEATHER_OPTIONS[Math.floor(Math.random() * WEATHER_OPTIONS.length)],
    );
  }, []);

  const player = players[activePlayer] ?? players[0];

  // 他の子供を NPC としてマップ上に表示
  const others = players
    .map((p, i) => ({ ...p, origIndex: i }))
    .filter((p) => p.origIndex !== activePlayer)
    .map((p, oi) => ({
      ...p,
      oi,
      pin: MAP_PINS[[5, 6, 9][oi % 3]], // ranch / zoo / race の近くに配置
    }));

  // ── ピンタップ処理 ─────────────────────────────────────────
  const handlePin = (pin: MapPin) => {
    if (walking) return;
    if (pin.comingSoon) {
      setComingSoon(pin);
      return;
    }
    setWalkTarget({ x: pin.x, y: pin.y, sx: avatarPos.x, sy: avatarPos.y });
    setPendingPin(pin);
    setWalking(true);
  };

  // 歩行アニメーション終了後に遷移 or モーダル表示
  useEffect(() => {
    if (!walking || !walkTarget) return;
    const capturedPin = pendingPin;
    const capturedPlayer = player;
    const t = setTimeout(() => {
      setAvatarPos({ x: walkTarget.x, y: walkTarget.y });
      setWalking(false);
      setPendingPin(null);
      setWalkTarget(null);
      if (!capturedPin) return;
      setTimeout(() => {
        if (capturedPin.action === "arcade") {
          setArcadeOpen(true);
        } else if (capturedPin.route) {
          const base = `/kids/${capturedPlayer.id}/${capturedPin.route}`;
          const url = capturedPin.query ? `${base}?${capturedPin.query}` : base;
          router.push(url);
        }
      }, 160);
    }, 1050);
    return () => clearTimeout(t);
  }, [walking, walkTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // ゲームセンター内ゲームに遷移
  const handleArcadeNavigate = (route: string) => {
    setArcadeOpen(false);
    setTimeout(() => router.push(`/kids/${player.id}/${route}`), 200);
  };

  if (!weather) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
        }}
      >
        🌍
      </div>
    );
  }

  // walking 中のアバター CSS カスタムプロパティ
  const walkCustomProps =
    walking && walkTarget
      ? ({
          "--sx": "0px",
          "--sy": "0px",
          "--ex": `calc(${(walkTarget.x - walkTarget.sx) * 3.2}px)`,
          "--ey": `calc(${(walkTarget.y - walkTarget.sy) * 3.4}px)`,
        } as React.CSSProperties)
      : {};

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#fef9c3,#dcfce7 40%,#dbeafe)",
        fontFamily: "'Segoe UI',sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 12px 32px" }}>
        {/* ── ヘッダー ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "rgba(255,255,255,.82)",
            backdropFilter: "blur(8px)",
            borderRadius: 20,
            marginBottom: 10,
            border: "1.5px solid rgba(255,255,255,.9)",
          }}
        >
          {/* 現在のプレイヤー表示 + もどるボタン */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={onBack}
              aria-label="プレイヤー選択にもどる"
              style={{
                background: "rgba(0,0,0,.06)",
                border: "none",
                borderRadius: 12,
                padding: "4px 10px",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 800,
                color: "#374151",
              }}
            >
              ←
            </button>
            <span style={{ fontSize: 22 }}>{player.avatar}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#374151" }}>
                {player.yomi}
              </div>
              <div style={{ fontSize: 11, color: "#d97706" }}>
                💰 {player.coins.toLocaleString()}
              </div>
            </div>
          </div>

          {/* プレイヤー切替ボタン */}
          <div style={{ display: "flex", gap: 4 }}>
            {players.map((p, i) => (
              <button
                key={p.id}
                onClick={() => {
                  if (!walking) {
                    setActivePlayer(i);
                    setAvatarPos({ x: 12, y: 18 });
                  }
                }}
                aria-label={`${p.yomi} に切替`}
                style={{
                  padding: "3px 7px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  border: `2px solid ${activePlayer === i ? p.color : "#e5e7eb"}`,
                  background: activePlayer === i ? p.color + "22" : "#fff",
                  color: activePlayer === i ? p.color : "#9ca3af",
                  cursor: "pointer",
                  transition: "all .2s",
                }}
              >
                {p.avatar}
              </button>
            ))}
          </div>
        </div>

        {/* ── ワールドマップ本体 ── */}
        <div
          style={{
            position: "relative",
            borderRadius: 28,
            overflow: "hidden",
            height: 370,
            background: weather.bgGrad,
            boxShadow: "0 8px 32px rgba(0,0,0,.16)",
          }}
        >
          <WeatherEffect weather={weather} />
          <WeatherBoard weather={weather} />

          {/* 地形デコレーション */}
          {[
            { t: "🌴", x: 5, y: 6, s: 1.1 },
            { t: "🌳", x: 88, y: 4, s: 1 },
            { t: "🌿", x: 2, y: 82, s: 0.9 },
            { t: "🌴", x: 91, y: 84, s: 1 },
            { t: "🏔️", x: 45, y: 3, s: 1.2 },
            { t: "🌊", x: 68, y: 84, s: 0.8 },
            { t: "🌾", x: 22, y: 52, s: 0.9 },
            { t: "🌿", x: 56, y: 82, s: 1 },
          ].map((d, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: d.x + "%",
                top: d.y + "%",
                fontSize: 22 * d.s,
                opacity: 0.35,
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {d.t}
            </div>
          ))}

          {/* パス（SVG 曲線） */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            {PATHS.map((path, i) => {
              const f = MAP_PINS.find((p) => p.id === path.from);
              const t = MAP_PINS.find((p) => p.id === path.to);
              if (!f || !t) return null;
              const mx = (f.x + t.x) / 2;
              const my = (f.y + t.y) / 2;
              const d = `M ${f.x}% ${f.y}% Q ${mx + 3}% ${my - 3}% ${t.x}% ${t.y}%`;
              return (
                <g key={i}>
                  <path
                    d={d}
                    stroke="rgba(180,130,60,.25)"
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d={d}
                    stroke="rgba(210,168,80,.65)"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="6 5"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </svg>

          {/* 兄弟 NPC */}
          {others.map((op) => (
            <div
              key={op.id}
              style={{
                position: "absolute",
                left: op.pin.x - 4 + "%",
                top: op.pin.y + 11 + "%",
                transform: "translate(-50%,-50%)",
                zIndex: 8,
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  animation: "bobble 3s ease-in-out infinite",
                  animationDelay: op.oi * 0.7 + "s",
                }}
              >
                {op.avatar}
              </div>
              <div
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  color: "#fff",
                  background: op.color,
                  borderRadius: 8,
                  padding: "1px 4px",
                  marginTop: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {op.yomi}
              </div>
            </div>
          ))}

          {/* マップピン */}
          {MAP_PINS.map((pin, idx) => {
            const grey = pin.comingSoon;
            return (
              <button
                key={pin.id}
                onClick={() => handlePin(pin)}
                aria-label={pin.label}
                style={{
                  position: "absolute",
                  left: pin.x + "%",
                  top: pin.y + "%",
                  transform: "translate(-50%,-50%)",
                  zIndex: 15,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  opacity: grey ? 0.8 : 1,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    background: grey
                      ? "linear-gradient(135deg,#9ca3af,#6b7280)"
                      : `linear-gradient(135deg,${pin.color},${pin.color}bb)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 19,
                    border: "3px solid white",
                    boxShadow: grey
                      ? "0 3px 8px rgba(0,0,0,.18)"
                      : `0 4px 12px ${pin.color}66`,
                    animation: "bobble 2.5s ease-in-out infinite",
                    animationDelay: idx * 0.25 + "s",
                    filter: grey ? "grayscale(.4)" : "none",
                  }}
                >
                  {pin.icon}
                  {pin.isNew && (
                    <div
                      style={{
                        position: "absolute",
                        top: -7,
                        right: -7,
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: 7,
                        fontWeight: 800,
                        borderRadius: 8,
                        padding: "2px 5px",
                      }}
                    >
                      NEW
                    </div>
                  )}
                  {grey && (
                    <div
                      style={{
                        position: "absolute",
                        top: -7,
                        right: -7,
                        background: "#9ca3af",
                        color: "#fff",
                        fontSize: 7,
                        fontWeight: 800,
                        borderRadius: 8,
                        padding: "2px 5px",
                      }}
                    >
                      準備中
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    color: "#fff",
                    background: grey
                      ? "rgba(100,100,100,.58)"
                      : "rgba(0,0,0,.40)",
                    borderRadius: 8,
                    padding: "2px 5px",
                    whiteSpace: "nowrap",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {pin.label}
                </div>
              </button>
            );
          })}

          {/* 歩行アバター */}
          <div
            style={{
              position: "absolute",
              left:
                (walkTarget ? walkTarget.sx : avatarPos.x) + "%",
              top:
                (walkTarget ? walkTarget.sy : avatarPos.y) + "%",
              zIndex: 20,
              pointerEvents: "none",
              transform: "translate(-50%,-50%)",
              animation: walking
                ? "walkTo 1s ease-in-out forwards"
                : undefined,
              ...walkCustomProps,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: player.color + "33",
                border: `3px solid ${player.color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                boxShadow: `0 0 0 4px ${player.color}33`,
                animation: walking
                  ? "bobble .3s ease-in-out infinite"
                  : "bobble 2s ease-in-out infinite",
              }}
            >
              {player.avatar}
            </div>
            <div
              style={{
                position: "absolute",
                top: -14,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 8,
                fontWeight: 800,
                color: "#fff",
                background: player.color,
                borderRadius: 8,
                padding: "1px 5px",
                whiteSpace: "nowrap",
              }}
            >
              {player.yomi}
            </div>
            {walking && (
              <div
                style={{
                  position: "absolute",
                  bottom: -4,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 11,
                }}
              >
                💨
              </div>
            )}
          </div>

          {/* ステータスバー */}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: "50%",
              transform: "translateX(-50%)",
              background: walking
                ? "rgba(132,94,247,.85)"
                : "rgba(0,0,0,.36)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 12,
              padding: "4px 12px",
              backdropFilter: "blur(4px)",
              zIndex: 25,
              whiteSpace: "nowrap",
            }}
          >
            {walking
              ? "🐾 いどうちゅう…"
              : "📍 しせつを タップして いどうしよう！"}
          </div>

          {/* もうすぐ開通トースト */}
          {comingSoon && (
            <ComingSoonToast
              pin={comingSoon}
              onClose={() => setComingSoon(null)}
            />
          )}
        </div>

        {/* ── 経済フロー表示 ── */}
        <div
          style={{
            marginTop: 8,
            background: "rgba(255,255,255,.72)",
            borderRadius: 18,
            padding: "10px 14px",
            border: "1px solid #ede9fe",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#7c3aed",
              marginBottom: 5,
            }}
          >
            📍 けいざいのながれ
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              flexWrap: "wrap",
            }}
          >
            {[
              "🏰 ギルド",
              "🔨 クラフト",
              "🦁 罠スタイル",
              "🏹 アクティブ",
              "📦 倉庫",
              "🐘 どうぶつえん",
              "🕹️ ゲームセンター",
            ].map((s, i, a) => (
              <span
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 3 }}
              >
                <span
                  style={{
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: 20,
                    padding: "3px 7px",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#5b21b6",
                  }}
                >
                  {s}
                </span>
                {i < a.length - 1 && (
                  <span style={{ color: "#a78bfa", fontSize: 10 }}>→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ゲームセンターモーダル */}
      {arcadeOpen && (
        <ArcadeModal
          onClose={() => setArcadeOpen(false)}
          onNavigate={handleArcadeNavigate}
        />
      )}
    </div>
  );
}
