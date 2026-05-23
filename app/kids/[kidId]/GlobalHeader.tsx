"use client";

// GlobalHeader — すべての kids/[kidId]/* 画面で共有するグローバルヘッダー。
// 左: 戻るボタン（マップ画面では非表示）
// 中: アバター + 子供の名前 + コイン残高
// 右: 天気ウィジェット（WeatherContext から取得）

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeather } from "./WeatherContext";

// ── 子供ごとのアバター定義 ────────────────────────────────────
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

type Props = {
  kidId: string;
  kidName: string;
  coinBalance: number;
};

export function GlobalHeader({ kidId, kidName, coinBalance }: Props) {
  const weather = useWeather();
  const pathname = usePathname();

  // マップ画面（/kids/[kidId] のみ）では戻るボタンを非表示
  const isMapPage = pathname === `/kids/${kidId}`;
  const mapHref = `/kids/${kidId}`;

  const av = KID_AVATAR[kidName] ?? { emoji: "👤", color: "#9ca3af" };
  const yomi = NAME_READING[kidName] ?? kidName;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(255,255,255,0.90)",
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
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 52,
        }}
      >
        {/* ── 左：戻るボタン ─────────────────────────────────── */}
        <div style={{ flex: "0 0 64px", display: "flex", justifyContent: "flex-start" }}>
          {!isMapPage && (
            <Link
              href={mapHref}
              aria-label="ワールドマップへ戻る"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(0,0,0,0.06)",
                border: "none",
                borderRadius: 20,
                padding: "5px 12px",
                fontSize: 13,
                fontWeight: 800,
                color: "#374151",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              ←
            </Link>
          )}
        </div>

        {/* ── 中央：アバター + 名前 + コイン ─────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {/* アバターバッジ */}
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

          {/* 名前 + コイン */}
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#1f2937" }}>
              {yomi}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#d97706",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              🪙
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {coinBalance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ── 右：天気ウィジェット ────────────────────────────── */}
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "1.5px solid #fcd34d",
            borderRadius: 16,
            padding: "4px 10px 4px 8px",
            boxShadow: "1px 1px 0 #f59e0b44",
            minWidth: 64,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{weather.icon}</span>
          <div style={{ lineHeight: 1.2 }}>
            <div
              style={{
                fontSize: 8,
                fontWeight: 800,
                color: "#92400e",
                letterSpacing: "0.08em",
              }}
            >
              おてんき
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#b45309" }}>
              {weather.label}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
