"use client";

// app/kids/[kidId]/house/BaseCampClient.tsx
//
// ┌──────────────────────────────────────────────────────────────┐
// │  左 : フィールドビュー                                        │
// │    - 空の色・エフェクトは WeatherContext と同期              │
// │    - 動物が草原を動き回る                                    │
// │    - 動物タップで GuideChatModal を開く                      │
// │  右 : コマンドパネル                                         │
// │    - ガイドアイコン表示                                      │
// │    - ガイドを選ぶ / くんしょうを見る                         │
// └──────────────────────────────────────────────────────────────┘

import { useState, useRef, useTransition, useMemo } from "react";
import { setGuideAnimal } from "@/actions/guide";
import GuideChatModal from "@/components/GuideChatModal";
import { useGuide } from "@/app/kids/[kidId]/GuideContext";
import { useWeather } from "@/app/kids/[kidId]/WeatherContext";
import type { WeatherId } from "@/app/kids/[kidId]/WeatherContext";

// ─────────────────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────────────────

interface AnimalMaster {
  id: string;
  genericName: string;
  specificName: string;
  emoji: string;
  lifespanYears: number;
  rarity: string;
}

interface CaughtAnimalItem {
  id: string;
  intimacyScore: number;
  caughtAt: Date;
  expiresAt: Date | null;
  animal: AnimalMaster;
  personality: { firstPerson: string } | null;
}

interface GuideAnimalItem extends CaughtAnimalItem {
  personality: { firstPerson: string; toneRule: string } | null;
}

export interface BaseCampClientProps {
  kidId: string;
  userName: string;
  coinBalance: number;
  currentStreak: number;
  initialGuide: GuideAnimalItem | null;
  initialAnimals: CaughtAnimalItem[];
}

// ─────────────────────────────────────────────────────────────
// メダル定義
// ─────────────────────────────────────────────────────────────

const MEDALS_DEF = [
  { id: "first",     emoji: "🥉", name: "はじめての おてつだい", desc: "はじめて おてつだいを した！" },
  { id: "farm",      emoji: "🥈", name: "ファーム・マスター",    desc: "どうぶつを 10ぴき そだてた！" },
  { id: "hunter",    emoji: "🥇", name: "でんせつの ハンター",   desc: "でんせつの どうぶつを つかまえた！" },
  { id: "logistics", emoji: "🏆", name: "ぶつりゅうの ほし",    desc: "ぶつりゅうセンターへ 20ひき おくった！" },
];

// ─────────────────────────────────────────────────────────────
// レアリティ変換
// ─────────────────────────────────────────────────────────────

const RARITY_MAP: Record<string, string> = {
  LEGENDARY: "でんせつ",
  EPIC: "レア",
  RARE: "レア",
  COMMON: "ふつう",
};

const RARITY_STYLE = {
  "ふつう":   { bg: "#E8F5E9", border: "#81C784", text: "#2E7D32" },
  "レア":     { bg: "#E3F2FD", border: "#64B5F6", text: "#1565C0" },
  "でんせつ": { bg: "#FFFDE7", border: "#FFD54F", text: "#E65100" },
} as const;

type RarityKey = keyof typeof RARITY_STYLE;

function toJpRarity(r: string): RarityKey {
  return (RARITY_MAP[r] ?? "ふつう") as RarityKey;
}

// ─────────────────────────────────────────────────────────────
// 天気 → 空グラデーション
// ─────────────────────────────────────────────────────────────

const WEATHER_SKY: Record<WeatherId, string> = {
  sunny:   "linear-gradient(180deg,#4FC3F7 0%,#81D4FA 45%,#B3E5FC 100%)",
  cloudy:  "linear-gradient(180deg,#90A4AE 0%,#B0BEC5 45%,#CFD8DC 100%)",
  hot:     "linear-gradient(180deg,#FF8A65 0%,#FFB74D 40%,#FFE0B2 100%)",
  rainy:   "linear-gradient(180deg,#546E7A 0%,#78909C 45%,#90A4AE 100%)",
  typhoon: "linear-gradient(180deg,#263238 0%,#37474F 45%,#455A64 100%)",
};

const WEATHER_GROUND: Record<WeatherId, string> = {
  sunny:   "linear-gradient(180deg,#66BB6A 0%,#388E3C 60%,#2E7D32 100%)",
  cloudy:  "linear-gradient(180deg,#57A05A 0%,#2E7D32 60%,#1B5E20 100%)",
  hot:     "linear-gradient(180deg,#8BC34A 0%,#558B2F 60%,#33691E 100%)",
  rainy:   "linear-gradient(180deg,#4CAF50 0%,#2E7D32 60%,#1B5E20 100%)",
  typhoon: "linear-gradient(180deg,#388E3C 0%,#1B5E20 60%,#0A3D0A 100%)",
};

// ─────────────────────────────────────────────────────────────
// フィールド動物型（種ごとにまとめる）
// ─────────────────────────────────────────────────────────────

interface FieldAnimal {
  id: string;              // animal.id（種 ID）
  emoji: string;
  name: string;
  rarity: RarityKey;
  count: number;
  instances: CaughtAnimalItem[];
}

function groupAnimals(items: CaughtAnimalItem[]): FieldAnimal[] {
  const map = new Map<string, FieldAnimal>();
  for (const item of items) {
    const key = item.animal.id;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        emoji: item.animal.emoji,
        name: item.animal.genericName,
        rarity: toJpRarity(item.animal.rarity),
        count: 0,
        instances: [],
      });
    }
    const g = map.get(key)!;
    g.count++;
    g.instances.push(item);
  }
  return Array.from(map.values());
}

// ─────────────────────────────────────────────────────────────
// ランダム位置（ref で安定化）
// ─────────────────────────────────────────────────────────────

function usePositions(animals: FieldAnimal[]) {
  const pos = useRef<Record<string, { x: number; y: number }>>({});
  const placed: { x: number; y: number }[] = [];
  const MIN_DIST = 16;

  animals.forEach((a) => {
    for (let i = 0; i < a.count; i++) {
      const k = `${a.id}-${i}`;
      if (!pos.current[k]) {
        let best: { x: number; y: number } | null = null;
        let tries = 0;
        while (tries < 80) {
          const cx = 4 + Math.random() * 88;
          const cy = 8 + Math.random() * 76;
          if (!placed.some((p) => Math.hypot(p.x - cx, p.y - cy) < MIN_DIST)) {
            best = { x: cx, y: cy };
            break;
          }
          tries++;
        }
        if (!best) best = { x: 4 + Math.random() * 88, y: 8 + Math.random() * 76 };
        pos.current[k] = best;
        placed.push(best);
      } else {
        placed.push(pos.current[k]);
      }
    }
  });

  return pos.current;
}

// ─────────────────────────────────────────────────────────────
// Cloud コンポーネント
// ─────────────────────────────────────────────────────────────

function Cloud({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", ...style }}>
      <div style={{ position: "relative", width: 100, height: 38 }}>
        <div style={{ position: "absolute", background: "rgba(255,255,255,0.88)", borderRadius: "50%", width: 62, height: 38, top: 0, left: 18 }} />
        <div style={{ position: "absolute", background: "rgba(255,255,255,0.88)", borderRadius: "50%", width: 44, height: 28, top: 8, left: 0 }} />
        <div style={{ position: "absolute", background: "rgba(255,255,255,0.88)", borderRadius: "50%", width: 50, height: 32, top: 6, left: 48 }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Confetti
// ─────────────────────────────────────────────────────────────

function Confetti({ active }: { active: boolean }) {
  const drops = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        key: i,
        left: Math.random() * 100,
        top: 8 + Math.random() * 16,
        size: 1.1 + Math.random() * 1,
        delay: Math.random() * 1.6,
        duration: 1.8 + Math.random() * 2,
        icon: ["🎊","🎉","⭐","✨","🌟","💫","🍀","🌈"][Math.floor(Math.random() * 8)],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active]
  );
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }}>
      {drops.map((d) => (
        <div
          key={d.key}
          className="anim-confetti"
          style={{
            position: "absolute",
            left: `${d.left}%`,
            top: `-${d.top}px`,
            fontSize: `${d.size}rem`,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        >
          {d.icon}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ガイド選択モーダル
// ─────────────────────────────────────────────────────────────

function GuideSelectModal({
  animals,
  currentGuideSpeciesId,
  onSelect,
  onClose,
}: {
  animals: FieldAnimal[];
  currentGuideSpeciesId: string | null;
  onSelect: (speciesId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 40, display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: 32, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="anim-popup"
        style={{
          width: "min(90vw, 560px)", borderRadius: 32, overflow: "hidden",
          background: "linear-gradient(180deg,#FFFDF5,#FFF8E1)",
          border: "4px solid #4CAF50",
          boxShadow: "0 16px 60px rgba(0,0,0,.3)",
        }}
      >
        <div style={{ padding: "16px 22px", background: "linear-gradient(90deg,#1B5E20,#4CAF50)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1.8rem" }}>⭐</span>
          <span style={{ color: "#fff", fontWeight: 900, fontSize: "1.3rem" }}>ガイドを えらぼう</span>
          <button onClick={onClose} style={{ marginLeft: "auto", fontSize: "1.6rem", background: "none", border: "none", cursor: "pointer", color: "#fff", opacity: .8 }}>✕</button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: ".9rem", color: "#777", marginBottom: 12, textAlign: "center" }}>
            ガイドにする どうぶつを タップしてね
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
            {animals.length === 0 ? (
              <div style={{ textAlign: "center", color: "#aaa", padding: "24px 0" }}>
                🌿 なかまが いないよ！
              </div>
            ) : (
              animals.map((a) => {
                const rs = RARITY_STYLE[a.rarity];
                const isCurrent = a.id === currentGuideSpeciesId;
                return (
                  <div
                    key={a.id}
                    onClick={() => onSelect(a.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 16,
                      background: isCurrent ? "#E8F5E9" : rs.bg,
                      border: `3px solid ${isCurrent ? "#4CAF50" : rs.border}`,
                      borderRadius: 20, padding: "14px 18px", cursor: "pointer",
                      boxShadow: isCurrent ? "0 0 0 3px rgba(76,175,80,.3)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "2.6rem", filter: a.rarity === "でんせつ" ? "drop-shadow(0 0 6px gold)" : "none" }}>
                      {a.emoji}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: rs.text, fontWeight: 900, fontSize: "1.1rem" }}>{a.name}</div>
                      <div style={{ fontSize: ".75rem", color: "#aaa", marginTop: 3 }}>{a.rarity}</div>
                    </div>
                    {isCurrent && <span style={{ fontSize: "1.6rem" }}>⭐</span>}
                  </div>
                );
              })
            )}
          </div>
          <button
            onClick={onClose}
            style={{ marginTop: 16, width: "100%", borderRadius: 18, padding: "13px 0", background: "#E0E0E0", border: "none", color: "#555", fontWeight: 900, fontSize: "1rem", cursor: "pointer" }}
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

export default function BaseCampClient({
  kidId,
  userName,
  initialGuide,
  initialAnimals,
}: BaseCampClientProps) {
  // ── 天気（共通コンテキスト） ─────────────────────────────
  const weather = useWeather();

  // ── ガイドコンテキスト（GlobalHeader と同期） ────────────
  const { setGuide: setGlobalGuide } = useGuide();

  // ── ローカルガイド状態 ───────────────────────────────────
  const [guide, setGuide] = useState<GuideAnimalItem | null>(initialGuide);
  const [settingGuideId, setSettingGuideId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ── 動物（種ごとにまとめたフィールド動物） ───────────────
  const [animals] = useState<FieldAnimal[]>(() => groupAnimals(initialAnimals));
  const positions = usePositions(animals);

  // ── UI 状態 ──────────────────────────────────────────────
  const [modal, setModal] = useState<"guide" | "medals" | "medalDetail" | null>(null);
  const [chatTarget, setChatTarget] = useState<CaughtAnimalItem | null>(null);
  const [medals] = useState<{ id: string; unlockedAt: string }[]>([]);
  const [selectedMedal, setSelectedMedal] = useState<(typeof MEDALS_DEF)[0] | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [newMedalDef, setNewMedalDef] = useState<(typeof MEDALS_DEF)[0] | null>(null);

  // ── 現在のガイドの種 ID ──────────────────────────────────
  const guideSpeciesId = guide ? guide.animal.id : null;
  const guideFieldAnimal = animals.find((a) => a.id === guideSpeciesId) ?? null;

  // ── ガイド任命ハンドラ ───────────────────────────────────
  const handleSelectGuide = (speciesId: string) => {
    const fa = animals.find((a) => a.id === speciesId);
    if (!fa || fa.instances.length === 0) return;
    const firstInstance = fa.instances[0];
    setSettingGuideId(firstInstance.id);
    setModal(null);

    startTransition(async () => {
      const result = await setGuideAnimal(kidId, firstInstance.id);
      if (result.success) {
        const newGuide: GuideAnimalItem = {
          ...firstInstance,
          personality: firstInstance.personality
            ? { firstPerson: firstInstance.personality.firstPerson, toneRule: "" }
            : null,
        };
        setGuide(newGuide);
        setGlobalGuide({
          id: firstInstance.id,
          animalName: firstInstance.animal.genericName,
          emoji: firstInstance.animal.emoji,
          intimacyScore: firstInstance.intimacyScore,
        });
      }
      setSettingGuideId(null);
    });
  };

  // ── 天気由来の描画設定 ────────────────────────────────────
  const skyGrad  = WEATHER_SKY[weather.id];
  const groundGrad = WEATHER_GROUND[weather.id];
  const showSun  = weather.id === "sunny" || weather.id === "hot";
  const showRain = weather.id === "rainy" || weather.id === "typhoon";
  const cloudOpacity = weather.id === "typhoon" ? 0.35 : weather.id === "cloudy" || weather.id === "rainy" ? 0.9 : 0.75;

  // 雨滴の位置・速度（マウント時に1回生成）
  const rainDrops = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        key: i,
        left: Math.random() * 100,
        speed: 0.5 + Math.random() * 0.7,
        delay: Math.random() * 2,
        opacity: weather.id === "typhoon" ? 0.7 : 0.45,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weather.id]
  );

  // コマンドパネルの星（マウント時に1回生成）
  const stars = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        key: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 0.4 + Math.random() * 0.6,
        opacity: 0.2 + Math.random() * 0.3,
      })),
    []
  );

  // ─────────────────────────────────────────────────────────
  // レンダリング
  // ─────────────────────────────────────────────────────────

  const guideEmoji = guideFieldAnimal?.emoji ?? guide?.animal.emoji ?? "🐾";
  const guideName  = guideFieldAnimal?.name  ?? guide?.animal.genericName ?? "ガイドなし";

  return (
    <div
      style={{
        width: "100%",
        height: "calc(100dvh - 56px)",
        overflow: "hidden",
        fontFamily: "'M PLUS Rounded 1c','Rounded Mplus 1c','Noto Sans JP',sans-serif",
        fontWeight: 700,
        userSelect: "none",
        display: "flex",
        flexDirection: "row",
      }}
    >
      <style>{`
        @keyframes bc-float    { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-10px) rotate(3deg)} }
        @keyframes bc-wander   { 0%{transform:translate(0,0) scaleX(1)} 25%{transform:translate(10px,-5px) scaleX(1)} 50%{transform:translate(0,8px) scaleX(-1)} 75%{transform:translate(-10px,-2px) scaleX(-1)} 100%{transform:translate(0,0) scaleX(1)} }
        @keyframes bc-legendary{ 0%{transform:translate(0,0) scale(1)} 20%{transform:translate(12px,-8px) scale(1.07)} 40%{transform:translate(-9px,5px) scale(0.93)} 60%{transform:translate(8px,-3px) scale(1.1)} 80%{transform:translate(-6px,6px) scale(1)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes bc-confetti { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(110vh) rotate(720deg);opacity:0} }
        @keyframes bc-shimmer  { 0%,100%{opacity:1;filter:brightness(1)} 50%{opacity:.7;filter:brightness(1.5)} }
        @keyframes bc-popup    { 0%{transform:scale(.4);opacity:0} 70%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
        @keyframes bc-rain     { 0%{transform:translateY(-5%) rotate(12deg)} 100%{transform:translateY(110vh) rotate(12deg)} }
        .bc-float     { animation: bc-float 3.2s ease-in-out infinite; }
        .bc-wander    { animation: bc-wander 5s ease-in-out infinite; }
        .bc-legendary { animation: bc-legendary 4s ease-in-out infinite; }
        .anim-confetti{ animation: bc-confetti linear forwards; position:absolute; }
        .bc-shimmer   { animation: bc-shimmer 2s ease-in-out infinite; }
        .anim-popup   { animation: bc-popup .45s cubic-bezier(.22,1,.36,1) forwards; }
        .bc-btn:active{ transform:translateY(4px) scale(.96); }
      `}</style>

      <Confetti active={confetti} />

      {/* ── メダル獲得ポップアップ ── */}
      {confetti && newMedalDef && (
        <div style={{ position: "fixed", inset: 0, zIndex: 65, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div
            className="anim-popup"
            style={{ background: "linear-gradient(135deg,#FFD700,#FFA500)", border: "5px solid #FF8C00", borderRadius: 32, padding: "36px 48px", textAlign: "center", boxShadow: "0 10px 50px rgba(255,160,0,.5)" }}
          >
            <div style={{ fontSize: "5rem", marginBottom: 10 }}>{newMedalDef.emoji}</div>
            <div style={{ color: "#fff", fontSize: "1.4rem" }}>🎉 あたらしい くんしょう！</div>
            <div style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 900, marginTop: 6 }}>{newMedalDef.name}</div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          左：フィールドビュー
      ════════════════════════════════════════════════════ */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          background: skyGrad,
          transition: "background 2s ease",
        }}
      >
        {/* 太陽（晴れ・もうしょ） */}
        {showSun && (
          <div
            className="bc-shimmer"
            style={{
              position: "absolute", top: 18, left: 24, width: 64, height: 64,
              borderRadius: "50%",
              background: weather.id === "hot"
                ? "radial-gradient(circle,#FF8C00 60%,#FF4500 100%)"
                : "radial-gradient(circle,#FFE066 60%,#FFB300 100%)",
              boxShadow: weather.id === "hot"
                ? "0 0 0 10px rgba(255,100,0,.22),0 0 0 22px rgba(255,80,0,.1)"
                : "0 0 0 10px rgba(255,220,50,.22),0 0 0 22px rgba(255,200,30,.1)",
              zIndex: 2,
            }}
          />
        )}

        {/* 台風アイコン */}
        {weather.id === "typhoon" && (
          <div style={{ position: "absolute", top: 16, left: 20, fontSize: "2.8rem", zIndex: 2 }}>🌀</div>
        )}

        {/* 雲 */}
        <Cloud style={{ top: 20, left: "18%", opacity: cloudOpacity, zIndex: 2 }} />
        <Cloud style={{ top: 44, left: "50%", opacity: cloudOpacity * 0.8, transform: "scale(.85)", zIndex: 2 }} />
        <Cloud style={{ top: 12, right: "12%", opacity: cloudOpacity * 0.7, transform: "scale(.7)", zIndex: 2 }} />

        {/* 雨エフェクト */}
        {showRain && (
          <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", overflow: "hidden" }}>
            {rainDrops.map((d) => (
              <div
                key={d.key}
                style={{
                  position: "absolute",
                  left: `${d.left}%`,
                  top: "-5%",
                  width: 2,
                  height: 20,
                  background: `rgba(120,180,255,${d.opacity})`,
                  borderRadius: 2,
                  animation: `bc-rain ${d.speed}s linear ${d.delay}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* 地面 */}
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "44%",
            background: groundGrad,
            overflow: "hidden", zIndex: 1,
            transition: "background 2s ease",
          }}
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", bottom: 0, left: `${i * 5.7}%`, fontSize: "1.3rem", lineHeight: 1 }}>🌿</div>
          ))}
          {[8, 24, 42, 61, 80].map((x, i) => (
            <div key={i} style={{ position: "absolute", bottom: 18, left: `${x}%`, fontSize: "1.1rem" }}>
              {["🌸","🌼","🌺","🌻","🌷"][i]}
            </div>
          ))}
        </div>

        {/* フェンス */}
        <div style={{ position: "absolute", bottom: "42%", left: 0, right: 0, display: "flex", gap: 8, padding: "0 10px", zIndex: 3 }}>
          {Array.from({ length: 26 }).map((_, i) => (
            <div key={i} style={{ width: 16, height: 32, background: "linear-gradient(180deg,#FFCCBC,#BCAAA4)", border: "2px solid #8D6E63", borderRadius: "4px 4px 0 0", flexShrink: 0, boxShadow: "1px 2px 0 rgba(0,0,0,.15)" }} />
          ))}
        </div>
        <div style={{ position: "absolute", bottom: "42%", left: 0, right: 0, height: 10, background: "#BCAAA4", borderTop: "3px solid #8D6E63", zIndex: 4 }} />

        {/* 動物たち */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "42%", overflow: "hidden", zIndex: 2 }}>
          {animals.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{ background: "rgba(255,255,255,.85)", borderRadius: 20, padding: "16px 24px", textAlign: "center", fontSize: "1rem", color: "#555" }}>
                🌿 どうぶつが いないよ！<br />サファリへ でかけよう！
              </div>
            </div>
          ) : (
            animals.flatMap((a) =>
              Array.from({ length: a.count }, (_, i) => {
                const k = `${a.id}-${i}`;
                const p = positions[k] ?? { x: 10, y: 10 };
                const anim =
                  a.rarity === "でんせつ" ? "bc-legendary" :
                  a.rarity === "レア"     ? "bc-wander"    : "bc-float";
                const isGuideAnimal = a.id === guideSpeciesId && i === 0;

                return (
                  <div
                    key={k}
                    style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, cursor: "pointer" }}
                    onClick={() => setChatTarget(a.instances[i] ?? a.instances[0])}
                    title={`${a.name}にはなしかける`}
                  >
                    <div
                      className={anim}
                      style={{
                        fontSize: a.rarity === "でんせつ" ? "3.2rem" : "2.4rem",
                        filter: a.rarity === "でんせつ" ? "drop-shadow(0 0 8px gold)" : "none",
                        userSelect: "none",
                      }}
                    >
                      {a.emoji}
                    </div>
                    {isGuideAnimal && (
                      <div
                        style={{
                          position: "absolute", top: -20, left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: ".7rem", background: "#4CAF50", color: "#fff",
                          borderRadius: 8, padding: "2px 7px",
                          whiteSpace: "nowrap", fontWeight: 900,
                        }}
                      >
                        ⭐ガイド
                      </div>
                    )}
                    {settingGuideId && a.instances.some((x) => x.id === settingGuideId) && i === 0 && (
                      <div
                        style={{
                          position: "absolute", top: -20, left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: ".7rem", background: "#FF9800", color: "#fff",
                          borderRadius: 8, padding: "2px 7px",
                          whiteSpace: "nowrap", fontWeight: 900,
                        }}
                      >
                        ⏳きりかえちゅう
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>

        {/* 天気バッジ */}
        <div
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 5,
            background: "rgba(255,255,255,0.82)", borderRadius: 14,
            padding: "4px 12px", fontSize: ".85rem", fontWeight: 800, color: "#555",
            backdropFilter: "blur(4px)",
          }}
        >
          {weather.icon} {weather.label}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          右：コマンドパネル
      ════════════════════════════════════════════════════ */}
      <div
        style={{
          width: 220,
          background: "linear-gradient(180deg,#1B1B2F 0%,#2D2D44 100%)",
          borderLeft: "3px solid #3A3A5C",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 18,
          padding: "24px 16px",
          position: "relative", overflow: "hidden", flexShrink: 0,
        }}
      >
        {/* 星 */}
        {stars.map((s) => (
          <div
            key={s.key}
            style={{
              position: "absolute",
              left: `${s.left}%`, top: `${s.top}%`,
              color: "#fff", fontSize: `${s.size}rem`,
              opacity: s.opacity, pointerEvents: "none",
            }}
          >
            ✦
          </div>
        ))}

        {/* ガイドアイコン */}
        <div style={{ textAlign: "center", zIndex: 1 }}>
          <div
            style={{
              fontSize: "3.2rem",
              filter: guideFieldAnimal?.rarity === "でんせつ" ? "drop-shadow(0 0 8px gold)" : "none",
            }}
          >
            {guideEmoji}
          </div>
          <div style={{ color: "#A5D6A7", fontSize: ".75rem", marginTop: 4 }}>
            ⭐ {guideName}
          </div>
        </div>

        <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,.1)", zIndex: 1 }} />

        {/* コマンドボタン */}
        {[
          {
            label: "ガイドを えらぶ",
            emoji: "⭐",
            bg: "linear-gradient(135deg,#1B5E20,#4CAF50)",
            border: "#1B5E20",
            shadow: "#1B5E20",
            action: () => setModal("guide"),
          },
          {
            label: "くんしょうを みる",
            emoji: "🏅",
            bg: "linear-gradient(135deg,#4A148C,#9C27B0)",
            border: "#4A148C",
            shadow: "#4A148C",
            action: () => setModal("medals"),
          },
        ].map((btn) => (
          <button
            key={btn.label}
            className="bc-btn"
            onClick={btn.action}
            style={{
              zIndex: 1, width: "100%",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: "16px 8px", borderRadius: 22,
              border: `3px solid ${btn.border}`,
              background: btn.bg, color: "#fff",
              cursor: "pointer",
              boxShadow: `0 6px 0 ${btn.shadow},0 10px 20px rgba(0,0,0,.3)`,
            }}
          >
            <span style={{ fontSize: "2.2rem" }}>{btn.emoji}</span>
            <span style={{ fontSize: ".78rem", lineHeight: 1.4, textAlign: "center" }}>{btn.label}</span>
          </button>
        ))}

        {/* ユーザー名 */}
        <div style={{ zIndex: 1, textAlign: "center", color: "#7CB9A0", fontSize: ".7rem", marginTop: 4 }}>
          🏕️ {userName}のベースキャンプ
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          モーダル：メダル
      ════════════════════════════════════════════════════ */}
      {(modal === "medals" || modal === "medalDetail") && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div
            className="anim-popup"
            style={{ width: "min(90vw, 600px)", borderRadius: 32, overflow: "hidden", background: "linear-gradient(180deg,#FFFDF5,#FFF8E1)", border: "4px solid #BCAAA4", boxShadow: "0 16px 60px rgba(0,0,0,.3)" }}
          >
            <div style={{ padding: "16px 22px", background: "linear-gradient(90deg,#4A148C,#9C27B0)", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "1.8rem" }}>{modal === "medals" ? "🏅" : selectedMedal?.emoji}</span>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: "1.3rem" }}>
                {modal === "medals" ? "くんしょうリスト" : selectedMedal?.name}
              </span>
              <button onClick={() => setModal(null)} style={{ marginLeft: "auto", fontSize: "1.6rem", background: "none", border: "none", cursor: "pointer", color: "#fff", opacity: .8 }}>✕</button>
            </div>
            <div style={{ padding: "18px 22px" }}>
              {modal === "medals" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 320, overflowY: "auto" }}>
                    {MEDALS_DEF.map((m) => {
                      const sm = medals.find((x) => x.id === m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => { setSelectedMedal(m); setModal("medalDetail"); }}
                          style={{ display: "flex", alignItems: "center", gap: 14, background: sm ? "linear-gradient(90deg,#FFFDE7,#FFF9C4)" : "#F5F5F5", border: `2px solid ${sm ? "#FFD54F" : "#E0E0E0"}`, borderRadius: 20, padding: "14px 16px", cursor: "pointer", opacity: sm ? 1 : 0.6 }}
                        >
                          <span style={{ fontSize: "2.8rem", filter: sm ? "drop-shadow(0 0 6px gold)" : "grayscale(1) opacity(.4)" }} className={sm ? "bc-shimmer" : ""}>{m.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 900, fontSize: ".9rem", color: sm ? "#E65100" : "#999" }}>{m.name}</div>
                            <div style={{ fontSize: ".7rem", color: "#aaa", marginTop: 3 }}>{sm ? `🗓 ${sm.unlockedAt}` : "まだ ゲットしていないよ"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => setModal(null)} style={{ marginTop: 16, width: "100%", borderRadius: 18, padding: "13px 0", background: "linear-gradient(90deg,#4A148C,#9C27B0)", border: "none", color: "#fff", fontWeight: 900, fontSize: "1rem", cursor: "pointer" }}>とじる</button>
                </>
              )}
              {modal === "medalDetail" && selectedMedal && (() => {
                const sm = medals.find((x) => x.id === selectedMedal.id);
                return (
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: "5rem", display: "block", marginBottom: 14, filter: sm ? "drop-shadow(0 0 12px gold)" : "grayscale(1) opacity(.4)" }} className={sm ? "bc-shimmer" : ""}>{selectedMedal.emoji}</span>
                    <div style={{ fontWeight: 900, fontSize: "1.3rem", color: "#5D4037", marginBottom: 10 }}>{selectedMedal.name}</div>
                    <div style={{ fontSize: "1rem", color: "#777", lineHeight: 1.7, marginBottom: 16 }}>{selectedMedal.desc}</div>
                    <div style={{ borderRadius: 18, padding: "12px 16px", background: sm ? "#FFFDE7" : "#F5F5F5", border: `2px solid ${sm ? "#FFD54F" : "#E0E0E0"}`, marginBottom: 16 }}>
                      {sm
                        ? <span style={{ color: "#E65100", fontSize: "1rem" }}>🗓 {sm.unlockedAt} に ゲット！</span>
                        : <span style={{ color: "#aaa", fontSize: "1rem" }}>🔒 まだ ゲットしていないよ</span>
                      }
                    </div>
                    <button onClick={() => setModal("medals")} style={{ width: "100%", borderRadius: 18, padding: "13px 0", background: "linear-gradient(90deg,#5D4037,#8D6E63)", border: "none", color: "#fff", fontWeight: 900, fontSize: "1rem", cursor: "pointer" }}>もどる</button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          モーダル：ガイド選択
      ════════════════════════════════════════════════════ */}
      {modal === "guide" && (
        <GuideSelectModal
          animals={animals}
          currentGuideSpeciesId={guideSpeciesId}
          onSelect={handleSelectGuide}
          onClose={() => setModal(null)}
        />
      )}

      {/* ════════════════════════════════════════════════════
          チャットモーダル
      ════════════════════════════════════════════════════ */}
      {chatTarget && (
        <GuideChatModal
          userId={kidId}
          animal={{
            caughtAnimalId: chatTarget.id,
            animalName: chatTarget.animal.genericName,
            emoji: chatTarget.animal.emoji,
            intimacyScore: chatTarget.intimacyScore,
          }}
          onClose={() => setChatTarget(null)}
        />
      )}
    </div>
  );
}
