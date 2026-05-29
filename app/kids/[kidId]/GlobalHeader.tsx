"use client";

// GlobalHeader -- kids/[kidId]/* 共通スティッキヘッダー
//
//  左  : 戻るボタン (マップ画面は非表示)
//  中央: アバター + 名前 + コイン + ストリーク
//  右  : [体力ゲージ] [ガイドキャラ] [天気] [BGMミュート]
//
// iPad 対応: CSS カスタムプロパティ + @media (min-width: 768px) で
// ヘッダー高さ・ウィジェット・フォントをスケールアップ。
// --header-h は :root に公開し BaseCampClient などが参照する。

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeather } from "./WeatherContext";
import { useGuide } from "./GuideContext";
import { useSafariStore } from "@/store/useSafariStore";
import GuideChatModal from "@/components/GuideChatModal";

// ── レスポンシブ CSS トークン ─────────────────────────────────
// :root の --header-h は SafariLayoutShell 配下のページ全体が参照できる。
// .gh-inner に設定した vars は子コンポーネントに継承される。
const GH_CSS = `
:root {
  --header-h: 56px;
}
@media (min-width: 768px) {
  :root {
    --header-h: 80px;
  }
}
.gh-inner {
  min-height: var(--header-h);
  padding: 6px 10px;
  width: 100%;
  max-width: 1024px;
  margin: 0 auto;
  --av-sz:   34px;
  --av-r:    12px;
  --av-em:   18px;
  --nm-sz:   14px;
  --cn-sz:   12px;
  --sk-em:   12px;
  --sk-sz:   10px;
  --sk-r:    20px;
  --sk-py:   1px;
  --sk-px:   7px;
  --w-em:    14px;
  --wp-y:     4px;
  --wp-x:     8px;
  --wl-sz:    8px;
  --wv-sz:   10px;
  --wb-w:    36px;
  --wb-h:     5px;
  --wb-r:    16px;
  --bk-sz:   13px;
  --bk-py:   5px;
  --bk-px:   12px;
  --bk-r:    20px;
  --rg:       5px;
  --cg:       8px;
}
@media (min-width: 768px) {
  .gh-inner {
    padding: 10px 28px;
    max-width: 1280px;
    --av-sz:   54px;
    --av-r:    18px;
    --av-em:   28px;
    --nm-sz:   20px;
    --cn-sz:   16px;
    --sk-em:   16px;
    --sk-sz:   12px;
    --sk-r:    26px;
    --sk-py:   3px;
    --sk-px:   12px;
    --w-em:    22px;
    --wp-y:     8px;
    --wp-x:    16px;
    --wl-sz:   11px;
    --wv-sz:   14px;
    --wb-w:    58px;
    --wb-h:     8px;
    --wb-r:    20px;
    --bk-sz:   17px;
    --bk-py:   10px;
    --bk-px:   24px;
    --bk-r:    26px;
    --rg:      12px;
    --cg:      16px;
  }
}
`;

// inject once into <head>
let _ghCssInjected = false;
function injectGhCSS() {
  if (typeof document === "undefined" || _ghCssInjected) return;
  if (document.getElementById("cs-gh-css")) { _ghCssInjected = true; return; }
  const s = document.createElement("style");
  s.id = "cs-gh-css";
  s.textContent = GH_CSS;
  document.head.appendChild(s);
  _ghCssInjected = true;
}

// ── ストリークバッジ ───────────────────────────────────────────
function StreakBadge({ streak, status }: { streak: number; status: string }) {
  const isHold = status === "HOLD";
  return (
    <div
      title={isHold ? "ピンチ！今日クエストを2つクリアするとコンボが復活するよ" : `れんぞく${streak}日達成中！`}
      style={{
        marginTop: 2,
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        background: isHold ? "linear-gradient(135deg,#bfdbfe,#dbeafe)" : "linear-gradient(135deg,#fef08a,#fde68a)",
        border: isHold ? "1.5px solid #93c5fd" : "1.5px solid #fbbf24",
        borderRadius: "var(--sk-r)",
        padding: "var(--sk-py) var(--sk-px)",
        fontSize: "var(--sk-sz)",
        fontWeight: 800,
        color: isHold ? "#1d4ed8" : "#92400e",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: "var(--sk-em)" }}>{isHold ? "🧊" : "🔥"}</span>
      {isHold ? "ピンチ！" : `れんぞく${streak}日`}
    </div>
  );
}

// ── 体力ゲージウィジェット ────────────────────────────────────
function StaminaWidget({ stamina }: { stamina: number }) {
  const color =
    stamina > 60 ? "#4CAF50" : stamina > 30 ? "#FF9800" : "#f44336";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
        border: "1.5px solid #86efac",
        borderRadius: "var(--wb-r)",
        padding: "var(--wp-y) var(--wp-x)",
        minWidth: 58,
      }}
    >
      <span style={{ fontSize: "var(--w-em)", lineHeight: 1 }}>⚡</span>
      <div>
        <div style={{ fontSize: "var(--wl-sz)", fontWeight: 800, color: "#166534", letterSpacing: "0.06em" }}>
          たいりょく
        </div>
        <div
          style={{
            width: "var(--wb-w)",
            height: "var(--wb-h)",
            borderRadius: 4,
            background: "#d1fae5",
            overflow: "hidden",
            marginTop: 2,
          }}
        >
          <div
            style={{
              width: `${stamina}%`,
              height: "100%",
              borderRadius: 4,
              background: color,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── ガイドキャラウィジェット ──────────────────────────────────
function GuideWidget({
  kidId,
  onOpenChat,
}: {
  kidId: string;
  onOpenChat: () => void;
}) {
  const { guide } = useGuide();
  if (!guide) return null;

  return (
    <button
      onClick={onOpenChat}
      title={`${guide.animalName}とはなす`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "linear-gradient(135deg,#ffe4e6,#fce7f3)",
        border: "1.5px solid #f9a8d4",
        borderRadius: "var(--wb-r)",
        padding: "var(--wp-y) var(--wp-x)",
        cursor: "pointer",
        minWidth: 58,
      }}
    >
      <span style={{ fontSize: "var(--w-em)", lineHeight: 1 }}>{guide.emoji}</span>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: "var(--wl-sz)", fontWeight: 800, color: "#9d174d", letterSpacing: "0.06em" }}>
          ガイド
        </div>
        <div
          style={{
            fontSize: "var(--wv-sz)",
            fontWeight: 700,
            color: "#be185d",
            maxWidth: 46,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {guide.animalName}
        </div>
      </div>
    </button>
  );
}

// ── 天気ウィジェット ──────────────────────────────────────────
// ── BGM ミュートボタン ────────────────────────────────────────
function BGMMuteButton() {
  const muted = useSafariStore((s) => s.bgmMuted);
  const toggleBGMMute = useSafariStore((s) => s.toggleBGMMute);
  return (
    <button
      onClick={toggleBGMMute}
      title={muted ? "BGMをオンにする" : "BGMをオフにする"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: muted
          ? "linear-gradient(135deg,#f1f5f9,#e2e8f0)"
          : "linear-gradient(135deg,#ede9fe,#ddd6fe)",
        border: muted ? "1.5px solid #cbd5e1" : "1.5px solid #a78bfa",
        borderRadius: "var(--wb-r)",
        padding: "var(--wp-y) var(--wp-x)",
        cursor: "pointer",
        fontSize: "var(--w-em)",
        lineHeight: 1,
        minWidth: 36,
        minHeight: 36,
        flexShrink: 0,
      }}
      aria-label={muted ? "BGMをオンにする" : "BGMをオフにする"}
    >
      {muted ? "🔇" : "🎵"}
    </button>
  );
}

function WeatherWidget() {
  const weather = useWeather();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: "linear-gradient(135deg,#fffbeb,#fef3c7)",
        border: "1.5px solid #fcd34d",
        borderRadius: "var(--wb-r)",
        padding: "var(--wp-y) var(--wp-x)",
        boxShadow: "1px 1px 0 #f59e0b44",
        minWidth: 58,
      }}
    >
      <span style={{ fontSize: "var(--w-em)", lineHeight: 1 }}>{weather.icon}</span>
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontSize: "var(--wl-sz)", fontWeight: 800, color: "#92400e", letterSpacing: "0.08em" }}>
          おてんき
        </div>
        <div style={{ fontSize: "var(--wv-sz)", fontWeight: 700, color: "#b45309" }}>
          {weather.label}
        </div>
      </div>
    </div>
  );
}

// ── アバター定義 ──────────────────────────────────────────────
const KID_AVATAR: Record<string, { emoji: string; color: string }> = {
  "美琴": { emoji: "🦭", color: "#0ea5e9" },
  "幸仁": { emoji: "🐹", color: "#f472b6" },
  "叶泰": { emoji: "🦦", color: "#34d399" },
};
const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

// ── メインコンポーネント ──────────────────────────────────────
type Props = {
  kidId: string;
  kidName: string;
  currentStreak: number;
  longestStreak: number;
  streakStatus: string;
};

export function GlobalHeader({ kidId, kidName, currentStreak, streakStatus }: Props) {
  const pathname = usePathname();
  const coins = useSafariStore((s) => s.coins);
  const stamina = useSafariStore((s) => s.stamina);
  const { guide } = useGuide();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => { injectGhCSS(); }, []);

  const isMapPage = pathname === `/kids/${kidId}`;
  const mapHref = `/kids/${kidId}`;
  const av = KID_AVATAR[kidName] ?? { emoji: "👤", color: "#9ca3af" };
  const yomi = NAME_READING[kidName] ?? kidName;

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        {/* gh-inner: CSS vars が定義されるルート。子コンポーネントが継承する */}
        <div
          className="gh-inner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--cg)",
          }}
        >
          {/* 左: 戻るボタン */}
          <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-start" }}>
            {!isMapPage && (
              <Link
                href={mapHref}
                aria-label="ワールドマップへ戻る"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "rgba(0,0,0,0.06)",
                  border: "none",
                  borderRadius: "var(--bk-r)",
                  padding: "var(--bk-py) var(--bk-px)",
                  fontSize: "var(--bk-sz)",
                  fontWeight: 800,
                  color: "#374151",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                ← もどる
              </Link>
            )}
          </div>

          {/* 中央: アバター + 名前 + コイン + ストリーク */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--cg)",
            }}
          >
            <div
              style={{
                width: "var(--av-sz)",
                height: "var(--av-sz)",
                borderRadius: "var(--av-r)",
                background: `linear-gradient(135deg,${av.color}33,${av.color}22)`,
                border: `2px solid ${av.color}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "var(--av-em)",
                flexShrink: 0,
              }}
            >
              {av.emoji}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: "var(--nm-sz)", fontWeight: 800, color: "#1f2937" }}>{yomi}</div>
              <div style={{ fontSize: "var(--cn-sz)", fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", gap: 3 }}>
                🪙
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{coins.toLocaleString()}</span>
              </div>
              {currentStreak > 0 && <StreakBadge streak={currentStreak} status={streakStatus} />}
            </div>
          </div>

          {/* 右: 体力 + ガイドキャラ + 天気 */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--rg)", flexShrink: 0 }}>
            <StaminaWidget stamina={stamina} />
            {guide && (
              <GuideWidget kidId={kidId} onOpenChat={() => setChatOpen(true)} />
            )}
            <WeatherWidget />
            <BGMMuteButton />
          </div>
        </div>
      </header>

      {/* ガイドチャットモーダル */}
      {chatOpen && guide && (
        <GuideChatModal
          userId={kidId}
          animal={{
            caughtAnimalId: guide.id,
            animalName: guide.animalName,
            emoji: guide.emoji,
            intimacyScore: guide.intimacyScore,
          }}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}
