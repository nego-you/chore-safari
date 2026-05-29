"use client";

// FlowClient — 「ぜんぶの ながれ」やさしい見える化。
// 小学校低学年〜幼児が見る前提：文章は最小限、ひらがな中心、
// 大きな絵文字＋矢印で「→」のつながりを直感的に見せる。
//
// 元ネタ: Notion「全体の流れ」(動物 / コイン / たいりょく / そざい / おんがえし)。
// ※ 動物園は「観覧料でお金もうけ」ではなく、お客さんが よろこんで
//   たまに「ありがとう」をくれる やさしい場所として表現する。

import React from "react";

// ── 1ステップ（絵文字＋ひとことラベル） ─────────────────────
type Step = { emoji: string; label: string };

function StepChip({ step, color, delay }: { step: Step; color: string; delay: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        minWidth: 78,
        padding: "10px 8px",
        borderRadius: 18,
        background: "#fff",
        border: `3px solid ${color}55`,
        boxShadow: `0 4px 14px ${color}22`,
      }}
    >
      <span
        style={{
          fontSize: 40,
          lineHeight: 1,
          animation: "flowBobble 2.6s ease-in-out infinite",
          animationDelay: `${delay * 0.18}s`,
        }}
        aria-hidden
      >
        {step.emoji}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#475569",
          textAlign: "center",
          lineHeight: 1.3,
          whiteSpace: "pre-line",
        }}
      >
        {step.label}
      </span>
    </div>
  );
}

function Arrow({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        fontSize: 26,
        fontWeight: 900,
        color: color,
        flexShrink: 0,
        alignSelf: "center",
        animation: "flowPulse 2s ease-in-out infinite",
      }}
    >
      ➡
    </span>
  );
}

// 横に流れる1本のながれ（折り返し対応）
function FlowChain({ steps, color }: { steps: Step[]; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "stretch",
        gap: 8,
        justifyContent: "center",
      }}
    >
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <StepChip step={s} color={color} delay={i} />
          {i < steps.length - 1 && <Arrow color={color} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// 「ふえる／へる」など小分けの帯
function SubRow({ tag, tagColor, steps, color }: { tag: string; tagColor: string; steps: Step[]; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: "#fff",
          background: tagColor,
          borderRadius: 999,
          padding: "5px 14px",
          whiteSpace: "nowrap",
          boxShadow: `0 2px 8px ${tagColor}55`,
        }}
      >
        {tag}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "stretch" }}>
        {steps.map((s, i) => (
          <StepChip key={i} step={s} color={color} delay={i} />
        ))}
      </div>
    </div>
  );
}

// ── ながれセクション ─────────────────────────────────────────
function FlowSection({
  no,
  icon,
  title,
  caption,
  color,
  children,
}: {
  no: number;
  icon: string;
  title: string;
  caption: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        margin: "0 auto",
        borderRadius: 26,
        overflow: "hidden",
        background: "#fff",
        border: `3px solid ${color}33`,
        boxShadow: `0 6px 22px ${color}1f`,
      }}
    >
      {/* 見出し帯 */}
      <div
        style={{
          background: `linear-gradient(90deg,${color},${color}cc)`,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            background: "rgba(255,255,255,.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            flexShrink: 0,
          }}
          aria-hidden
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: "#fff",
                background: "rgba(0,0,0,.18)",
                borderRadius: 999,
                padding: "1px 9px",
              }}
            >
              {no}
            </span>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.18)" }}>
              {title}
            </h2>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: "#ffffffdd" }}>{caption}</p>
        </div>
      </div>

      {/* 中身 */}
      <div style={{ padding: "16px 14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

export default function FlowClient() {
  return (
    <div
      style={{
        fontFamily: "'Nunito','Kosugi Maru',sans-serif",
        minHeight: "calc(100vh - var(--header-h, 56px))",
        background: "linear-gradient(170deg,#fef9c3 0%,#dcfce7 45%,#dbeafe 100%)",
        paddingBottom: 60,
      }}
    >
      <style>{`
        @keyframes flowBobble { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes flowPulse  { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes flowIn     { 0%{opacity:0;transform:translateY(16px)} 100%{opacity:1;transform:translateY(0)} }
      `}</style>

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "18px 14px 0",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          animation: "flowIn .5s ease both",
        }}
      >
        {/* ── ページタイトル ── */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden>🗺️</div>
          <h1 style={{ margin: "6px 0 2px", fontSize: 26, fontWeight: 900, color: "#0f766e" }}>
            ぜんぶの ながれ
          </h1>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f766eaa" }}>
            どうぶつ・コイン・げんき・どうぐ・やさしさ が どう めぐるのか みてみよう！
          </p>
        </div>

        {/* ── 1. どうぶつの ながれ ── */}
        <FlowSection
          no={1}
          icon="🦁"
          title="どうぶつの ながれ"
          caption="であって なかよし → さいごは ずかんに のこるよ"
          color="#f59e0b"
        >
          <FlowChain
            color="#f59e0b"
            steps={[
              { emoji: "🪤", label: "つかまえる" },
              { emoji: "🏠", label: "おうちで\nまつ" },
              { emoji: "🚚", label: "トラックで\nはこぶ" },
              { emoji: "🐄", label: "ぼくじょうで\nそだてる" },
              { emoji: "📚", label: "ずかんに\nのこる" },
            ]}
          />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#92400e", textAlign: "center" }}>
            ✨ どうぶつえん 🐘 でも くらせるよ。ずっと いっしょの ともだち！
          </p>
        </FlowSection>

        {/* ── 2. コインの ながれ ── */}
        <FlowSection
          no={2}
          icon="🪙"
          title="コインの ながれ"
          caption="やさしい ことを すると ふえる・あそぶと へる"
          color="#eab308"
        >
          <SubRow
            tag="ふえる"
            tagColor="#22c55e"
            color="#22c55e"
            steps={[
              { emoji: "🧹", label: "おてつだい" },
              { emoji: "💗", label: "どうぶつえんの\nありがとう" },
              { emoji: "🎁", label: "おうちの\nひとから" },
            ]}
          />
          <SubRow
            tag="へる"
            tagColor="#f97316"
            color="#f97316"
            steps={[
              { emoji: "🎮", label: "ゲーム\nセンター" },
              { emoji: "🌱", label: "ひりょう" },
              { emoji: "🍎", label: "エサ" },
            ]}
          />
          <SubRow
            tag="ふえたり へったり"
            tagColor="#a855f7"
            color="#a855f7"
            steps={[{ emoji: "🏁", label: "カオス\nレース" }]}
          />
        </FlowSection>

        {/* ── 3. たいりょくの ながれ ── */}
        <FlowSection
          no={3}
          icon="💪"
          title="たいりょくの ながれ"
          caption="うごくと へる・おやすみすると げんきに もどる"
          color="#06b6d4"
        >
          <SubRow
            tag="へる"
            tagColor="#f97316"
            color="#f97316"
            steps={[
              { emoji: "🏹", label: "かり" },
              { emoji: "🔨", label: "クラフト" },
              { emoji: "🌾", label: "のうじょう" },
            ]}
          />
          <SubRow
            tag="げんきに なる"
            tagColor="#22c55e"
            color="#22c55e"
            steps={[{ emoji: "⏰", label: "じかんが\nたつと" }]}
          />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0e7490", textAlign: "center" }}>
            🌙 たいりょくが ０でも、ずかんを よんだり どうぶつと おはなし できるよ
          </p>
        </FlowSection>

        {/* ── 4. そざいの ながれ ── */}
        <FlowSection
          no={4}
          icon="📦"
          title="そざいの ながれ"
          caption="あつめて → はこんで → どうぐを つくる"
          color="#3b82f6"
        >
          <FlowChain
            color="#3b82f6"
            steps={[
              { emoji: "🌾", label: "あつめる" },
              { emoji: "🏠", label: "おうち" },
              { emoji: "📦", label: "ぶつりゅう\nセンター" },
              { emoji: "🔨", label: "クラフト\nこうぼう" },
              { emoji: "🪤", label: "わな・エサ・\nどうぐ" },
            ]}
          />
        </FlowSection>

        {/* ── 5. おんがえしの ながれ ── */}
        <FlowSection
          no={5}
          icon="💝"
          title="おんがえしの ながれ"
          caption="やさしくすると、あとで だれかが たすけにきてくれる"
          color="#ec4899"
        >
          <FlowChain
            color="#ec4899"
            steps={[
              { emoji: "🤲", label: "こまってる人を\nたすける" },
              { emoji: "⛈️", label: "すうじつご\nピンチ！" },
              { emoji: "🤝", label: "むかし たすけた人が\nきてくれる" },
              { emoji: "✨", label: "ありがとう！" },
            ]}
          />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#be185d", textAlign: "center" }}>
            すぐ ごほうびが なくても、やさしさは ちゃんと もどってくるよ 😊
          </p>
        </FlowSection>

        <p style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#64748b", marginTop: 4 }}>
          ← ひだりうえの「もどる」で マップに もどれるよ
        </p>
      </div>
    </div>
  );
}
