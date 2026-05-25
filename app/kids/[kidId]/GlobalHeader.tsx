"use client";

// GlobalHeader -- kids/[kidId]/* 共通スティッキヘッダー
//
//  左  : 戻るボタン (マップ画面は非表示)
//  中央: アバター + 名前 + コイン + ストリーク
//  右  : [体力ゲージ] [ガイドキャラ] [天気]  <- 今回追加
//
// ガイドキャラをタップすると GuideChatModal が開く。
// 体力は Zustand ストア(stamina) から取得。

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeather } from "./WeatherContext";
import { useGuide } from "./GuideContext";
import { useSafariStore } from "@/store/useSafariStore";
import GuideChatModal from "@/components/GuideChatModal";

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
        gap: 2,
        background: isHold ? "linear-gradient(135deg,#bfdbfe,#dbeafe)" : "linear-gradient(135deg,#fef08a,#fde68a)",
        border: isHold ? "1.5px solid #93c5fd" : "1.5px solid #fbbf24",
        borderRadius: 20,
        padding: "1px 7px",
        fontSize: 10,
        fontWeight: 800,
        color: isHold ? "#1d4ed8" : "#92400e",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 12 }}>{isHold ? "\uD83E\uDDCA" : "\uD83D\uDD25"}</span>
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
        borderRadius: 16,
        padding: "4px 8px",
        minWidth: 58,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{"\u26A1"}</span>
      <div>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#166534", letterSpacing: "0.06em" }}>
          たいりょく
        </div>
        <div
          style={{
            width: 36,
            height: 5,
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
        borderRadius: 16,
        padding: "4px 8px",
        cursor: "pointer",
        minWidth: 58,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{guide.emoji}</span>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#9d174d", letterSpacing: "0.06em" }}>
          そうべつ
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#be185d",
            maxWidth: 36,
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
        borderRadius: 16,
        padding: "4px 10px 4px 8px",
        boxShadow: "1px 1px 0 #f59e0b44",
        minWidth: 58,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{weather.icon}</span>
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#92400e", letterSpacing: "0.08em" }}>
          おてんき
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#b45309" }}>
          {weather.label}
        </div>
      </div>
    </div>
  );
}

// ── アバター定義 ──────────────────────────────────────────────
const KID_AVATAR: Record<string, { emoji: string; color: string }> = {
  "\u7F8E\u7434": { emoji: "\uD83E\uDDB1", color: "#0ea5e9" },
  "\u5E78\u4EC1": { emoji: "\uD83D\uDC39", color: "#f472b6" },
  "\u53F6\u6CF0": { emoji: "\uD83E\uDDA6", color: "#34d399" },
};
const NAME_READING: Record<string, string> = {
  "\u7F8E\u7434": "\u307F\u3053\u3068",
  "\u5E78\u4EC1": "\u3086\u304D\u3068",
  "\u53F6\u6CF0": "\u304B\u306A\u305F",
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

  const isMapPage = pathname === `/kids/${kidId}`;
  const mapHref = `/kids/${kidId}`;
  const av = KID_AVATAR[kidName] ?? { emoji: "\uD83D\uDC64", color: "#9ca3af" };
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
        <div
          style={{
            maxWidth: 1024,
            margin: "0 auto",
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            minHeight: 56,
          }}
        >
          {/* 左: 戻るボタン */}
          <div style={{ flex: "0 0 52px", display: "flex", justifyContent: "flex-start" }}>
            {!isMapPage && (
              <Link
                href={mapHref}
                aria-label="ワールドマップへ戻る"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "rgba(0,0,0,0.06)",
                  border: "none",
                  borderRadius: 20,
                  padding: "5px 12px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#374151",
                  textDecoration: "none",
                }}
              >
                ←
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
              gap: 8,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: `linear-gradient(135deg,${av.color}33,${av.color}22)`,
                border: `2px solid ${av.color}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {av.emoji}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1f2937" }}>{yomi}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", gap: 3 }}>
                {"\uD83E\uDE99"}
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{coins.toLocaleString()}</span>
              </div>
              {currentStreak > 0 && <StreakBadge streak={currentStreak} status={streakStatus} />}
            </div>
          </div>

          {/* 右: 体力 + ガイドキャラ + 天気 */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <StaminaWidget stamina={stamina} />
            {guide && (
              <GuideWidget kidId={kidId} onOpenChat={() => setChatOpen(true)} />
            )}
            <WeatherWidget />
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
