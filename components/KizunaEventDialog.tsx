"use client";
// components/KizunaEventDialog.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 「恩送り（ペイ・フォワード）」ストーリーイベント ダイアログ
//
// 使い方（Phase1 — 種まき）:
//   <KizunaEventDialog
//     phase="GRANDMA_SEED"
//     hasItem={inventory["grass"] >= 1}
//     onGiveItem={handleGiveGrass}
//     onDecline={handleDecline}
//   />
//
// 使い方（Phase2/3 — ピンチ＆回収）:
//   <KizunaEventDialog
//     phase="TYPHOON_RESCUE"
//     onComplete={handleKizunaComplete}
//   />
//
// 通常のクエスト・買い物とは明確に異なる「ストーリーイベント」の見た目：
//   - 暗い半透明オーバーレイ + ゴールドの枠
//   - 左に大きな立ち絵風絵文字（80px）
//   - 右にキャラ名プレート + フキダシ
//   - ボタンは通常とは異なる色調
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";

// ─── Phase 定義 ──────────────────────────────────────────────────────────────
export type KizunaPhase = "GRANDMA_SEED" | "TYPHOON_RESCUE";

// ─── 内部ステップ定義 ─────────────────────────────────────────────────────────
type InternalStep =
  | "GRANDMA_APPEAR"     // おばあちゃん登場
  | "GRANDMA_THANKS"     // お礼メッセージ
  | "TYPHOON_DANGER"     // 台風ピンチ
  | "CARPENTER_ARRIVE"   // 大工さん到着
  | "CARPENTER_SPEECH"   // 大工さんのセリフ
  | "REPAIR_ANIM"        // 修理アニメーション
  | "REWARD"             // 絆の証を受け取る
  | "DONE";              // 完了（クローズ直前）

// ─── Props ────────────────────────────────────────────────────────────────────
interface KizunaEventDialogProps {
  phase: KizunaPhase;
  /** Phase1 のみ: アイテム（草）を持っているか */
  hasItem?: boolean;
  /** Phase1: アイテムを渡す */
  onGiveItem?: () => void;
  /** Phase1: 断る */
  onDecline?: () => void;
  /** Phase2/3: すべて完了したとき */
  onComplete?: () => void;
}

// ─── キャラクター定義 ─────────────────────────────────────────────────────────
const CHARS = {
  grandma:   { emoji: "👵", name: "おばあちゃん", color: "#e8c87a" },
  grandson:  { emoji: "👨‍🔧", name: "たいくや・さぶろう", color: "#7ab8e8" },
  player:    { emoji: "😊", name: "きみ",           color: "#98e87a" },
  narrator:  { emoji: "📖", name: "ナレーター",      color: "#b07ae8" },
};

// ─── アニメーション CSS ───────────────────────────────────────────────────────
const DIALOG_CSS = `
@keyframes kz-fadeIn      { from{opacity:0} to{opacity:1} }
@keyframes kz-slideUp     { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes kz-portrait    { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-8px) rotate(2deg)} }
@keyframes kz-shake       { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-6deg)} 40%{transform:rotate(6deg)} 60%{transform:rotate(-4deg)} 80%{transform:rotate(4deg)} }
@keyframes kz-bounce      { 0%,100%{transform:translateY(0) scale(1)} 30%{transform:translateY(-24px) scale(1.15)} 60%{transform:translateY(8px) scale(0.92)} }
@keyframes kz-glow        { 0%,100%{box-shadow:0 0 16px 4px rgba(255,215,0,.6)} 50%{box-shadow:0 0 36px 12px rgba(255,215,0,.9)} }
@keyframes kz-sparkle     { 0%{opacity:0;transform:scale(0) rotate(0deg)} 50%{opacity:1;transform:scale(1.2) rotate(180deg)} 100%{opacity:0;transform:scale(0) rotate(360deg)} }
@keyframes kz-hammer      { 0%,100%{transform:rotate(-20deg) translateY(0)} 50%{transform:rotate(20deg) translateY(6px)} }
@keyframes kz-confetti    { 0%{opacity:1;transform:translateY(0) rotate(0deg)} 100%{opacity:0;transform:translateY(80px) rotate(720deg)} }
@keyframes kz-badge-in    { 0%{opacity:0;transform:scale(0) rotate(-30deg)} 60%{transform:scale(1.3) rotate(8deg)} 100%{opacity:1;transform:scale(1) rotate(0deg)} }
@keyframes kz-typist      { from{clip-path:inset(0 100% 0 0)} to{clip-path:inset(0 0% 0 0)} }
@keyframes kz-typhoon-bg  { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
`;

function injectCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("kizuna-css")) return;
  const s = document.createElement("style");
  s.id = "kizuna-css";
  s.textContent = DIALOG_CSS;
  document.head.appendChild(s);
}

// ─── フキダシ ─────────────────────────────────────────────────────────────────
function Bubble({
  char,
  text,
  sub,
  animKey,
}: {
  char: typeof CHARS[keyof typeof CHARS];
  text: string;
  sub?: string;
  animKey: string;
}) {
  return (
    <div
      key={animKey}
      style={{
        flex: 1,
        animation: "kz-slideUp 0.4s ease-out",
      }}
    >
      {/* 名前プレート */}
      <div
        style={{
          display: "inline-block",
          background: char.color,
          borderRadius: "8px 8px 0 0",
          padding: "3px 12px",
          fontSize: 11,
          fontWeight: 900,
          color: "#1a1a1a",
          letterSpacing: 1,
          marginBottom: 0,
          boxShadow: `0 2px 8px ${char.color}88`,
        }}
      >
        {char.name}
      </div>

      {/* フキダシ本体 */}
      <div
        style={{
          background: "rgba(255,255,255,0.96)",
          borderRadius: "0 16px 16px 16px",
          padding: "14px 16px",
          fontSize: 14,
          fontWeight: 700,
          color: "#1a1a1a",
          lineHeight: 1.7,
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          border: `2px solid ${char.color}88`,
          position: "relative",
        }}
      >
        {text}
        {sub && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#666",
              fontWeight: 500,
              borderTop: "1px solid #eee",
              paddingTop: 6,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 立ち絵ポートレート ───────────────────────────────────────────────────────
function Portrait({
  char,
  anim = "kz-portrait 3s ease-in-out infinite",
  size = 72,
}: {
  char: typeof CHARS[keyof typeof CHARS];
  anim?: string;
  size?: number;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        style={{
          width: size + 16,
          height: size + 16,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${char.color}44, ${char.color}11)`,
          border: `3px solid ${char.color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size,
          animation: anim,
          boxShadow: `0 4px 16px ${char.color}44`,
        }}
      >
        {char.emoji}
      </div>
    </div>
  );
}

// ─── 修理アニメーション ───────────────────────────────────────────────────────
function RepairAnimation() {
  const tools = ["🔨", "🪚", "🔧", "🪛"];
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 13, color: "#fde68a", fontWeight: 900, marginBottom: 12 }}>
        🔨 さぶろうさんが しゅうりしてくれているよ！
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 }}>
        {tools.map((t, i) => (
          <span
            key={i}
            style={{
              fontSize: 28,
              display: "inline-block",
              animation: "kz-hammer 0.5s ease-in-out infinite",
              animationDelay: `${i * 0.13}s`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div
        style={{
          height: 8,
          background: "rgba(0,0,0,0.3)",
          borderRadius: 99,
          overflow: "hidden",
          margin: "0 24px",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg,#4ade80,#16a34a)",
            borderRadius: 99,
            animation: "kz-typist 2.5s ease-out forwards",
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: "#a7f3d0", marginTop: 8, fontWeight: 700 }}>
        しゅうり 100%
      </div>
    </div>
  );
}

// ─── 絆の証 報酬アニメーション ────────────────────────────────────────────────
function BadgeReward() {
  const confettiColors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6bcd"];
  const confetti = Array.from({ length: 12 }, (_, i) => ({
    left: 10 + (i * 7) % 80,
    delay: (i * 0.15) % 1.5,
    color: confettiColors[i % confettiColors.length],
    size: 8 + (i % 4) * 3,
  }));
  return (
    <div
      style={{
        position: "relative",
        textAlign: "center",
        padding: "16px 0 8px",
        overflow: "visible",
      }}
    >
      {/* コンフェッティ */}
      {confetti.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${c.left}%`,
            top: "20%",
            width: c.size,
            height: c.size,
            borderRadius: 2,
            background: c.color,
            animation: `kz-confetti 1.8s ease-out ${c.delay}s infinite`,
            opacity: 0,
          }}
        />
      ))}

      {/* 絆バッジ */}
      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 64,
            animation: "kz-badge-in 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards, kz-glow 2s ease-in-out 0.7s infinite",
            display: "inline-block",
            filter: "drop-shadow(0 0 20px gold)",
          }}
        >
          🏅
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: "#fde68a",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            letterSpacing: 2,
          }}
        >
          ✨ きずなの しょう ✨
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#a7f3d0",
            fontWeight: 700,
            background: "rgba(0,0,0,0.3)",
            borderRadius: 8,
            padding: "4px 12px",
          }}
        >
          とくべつな トロフィーを ゲット！
        </div>
      </div>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────
export function KizunaEventDialog({
  phase,
  hasItem = false,
  onGiveItem,
  onDecline,
  onComplete,
}: KizunaEventDialogProps) {
  useEffect(() => { injectCSS(); }, []);

  // 初期ステップ
  const initStep: InternalStep =
    phase === "GRANDMA_SEED" ? "GRANDMA_APPEAR" : "TYPHOON_DANGER";

  const [step, setStep] = useState<InternalStep>(initStep);
  const [animKey, setAnimKey] = useState(0);

  const next = (s: InternalStep) => {
    setStep(s);
    setAnimKey((k) => k + 1);
  };

  // 修理アニメーション完了の自動進行
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (step === "REPAIR_ANIM") {
      timerRef.current = setTimeout(() => next("REWARD"), 3000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [step]);

  // ── 背景スタイル ────────────────────────────────────────────────────────
  const isTyphoon = step === "TYPHOON_DANGER" || step === "CARPENTER_ARRIVE" || step === "CARPENTER_SPEECH";
  const overlayBg = isTyphoon
    ? "radial-gradient(ellipse at 50% 0%, rgba(100,20,140,0.97) 0%, rgba(30,10,60,0.98) 100%)"
    : step === "REPAIR_ANIM"
    ? "radial-gradient(ellipse at 50% 0%, rgba(10,50,30,0.97) 0%, rgba(5,25,15,0.98) 100%)"
    : step === "REWARD" || step === "DONE"
    ? "radial-gradient(ellipse at 50% 0%, rgba(60,30,10,0.97) 0%, rgba(20,10,5,0.98) 100%)"
    : "radial-gradient(ellipse at 50% 0%, rgba(20,20,50,0.97) 0%, rgba(10,10,30,0.98) 100%)";

  // ── 共通ボタンスタイル ──────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    border: "none",
    borderRadius: 16,
    padding: "12px 0",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: 1,
    transition: "all 0.18s",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        animation: "kz-fadeIn 0.3s ease-out",
        fontFamily: "'Hiragino Maru Gothic ProN','rounded mplus 1c',sans-serif",
      }}
    >
      {/* ── ダイアログパネル ─────────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: overlayBg,
          borderRadius: "28px 28px 0 0",
          border: "3px solid rgba(255,215,0,0.5)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(255,215,0,0.2), 0 -2px 0 rgba(255,215,0,0.3)",
          padding: "20px 18px 36px",
          animation: "kz-slideUp 0.42s cubic-bezier(0.22,1,0.36,1)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ゴールドの装飾ライン */}
        <div style={{
          position: "absolute",
          top: 0,
          left: "20%",
          right: "20%",
          height: 3,
          background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.8), transparent)",
          borderRadius: 99,
        }} />

        {/* ストーリーイベントバッジ */}
        <div style={{
          position: "absolute",
          top: 12,
          right: 16,
          background: "linear-gradient(135deg,#7c3aed,#a855f7)",
          color: "#fff",
          fontSize: 9,
          fontWeight: 900,
          borderRadius: 8,
          padding: "3px 8px",
          letterSpacing: 1,
          boxShadow: "0 2px 8px rgba(124,58,237,0.5)",
        }}>
          ✨ ストーリーイベント
        </div>

        {/* ── Step: GRANDMA_APPEAR ───────────────────────────────────────── */}
        {step === "GRANDMA_APPEAR" && (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20, marginTop: 8 }}>
              <Portrait char={CHARS.grandma} anim="kz-portrait 3s ease-in-out infinite" />
              <Bubble
                char={CHARS.grandma}
                animKey={`${animKey}`}
                text={"👵 あしが いたくて\nあるけないんだよ…\nだれか たすけて くれないかい？"}
                sub="（おくすり か つえ に つかう くさ を もっていれば わたせる）"
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  if (!hasItem) return;
                  onGiveItem?.();
                  next("GRANDMA_THANKS");
                }}
                style={{
                  ...btnBase,
                  flex: 2,
                  background: hasItem
                    ? "linear-gradient(135deg,#16a34a,#15803d)"
                    : "rgba(80,80,80,0.5)",
                  color: hasItem ? "#fff" : "#888",
                  boxShadow: hasItem ? "0 4px 0 #14532d" : "none",
                  opacity: hasItem ? 1 : 0.6,
                  cursor: hasItem ? "pointer" : "not-allowed",
                }}
              >
                🌿 もっている おクスリ（くさ）を あげる
                {!hasItem && <span style={{ display: "block", fontSize: 10, fontWeight: 500, opacity: 0.8 }}>（くさが たりない…）</span>}
              </button>
              <button
                onClick={onDecline}
                style={{
                  ...btnBase,
                  flex: 1,
                  background: "rgba(60,60,80,0.8)",
                  color: "rgba(200,200,220,0.8)",
                  boxShadow: "0 2px 0 rgba(0,0,0,0.4)",
                }}
              >
                やめておく
              </button>
            </div>
          </>
        )}

        {/* ── Step: GRANDMA_THANKS ──────────────────────────────────────── */}
        {step === "GRANDMA_THANKS" && (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20, marginTop: 8 }}>
              <Portrait
                char={CHARS.grandma}
                anim="kz-bounce 1s ease-out"
                size={72}
              />
              <Bubble
                char={CHARS.grandma}
                animKey={`${animKey}`}
                text={"ありがとう！！\nほんとうに たすかったよ。\n\nこの おんがえしは\nかならず するからね…✨"}
                sub="（ほっこりした き もちに なった）"
              />
            </div>
            {/* スパークル装飾 */}
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              {["✨","🌟","💫","⭐","🌸"].map((s, i) => (
                <span key={i} style={{
                  fontSize: 20,
                  display: "inline-block",
                  margin: "0 4px",
                  animation: `kz-sparkle 1.5s ease-in-out ${i * 0.2}s infinite`,
                }}>{s}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#fde68a", textAlign: "center", marginBottom: 16, fontWeight: 700, opacity: 0.85 }}>
              ＊ コインや アイテムは もらえなかった ＊
            </div>
            <div style={{ fontSize: 11, color: "#a7f3d0", textAlign: "center", marginBottom: 14, fontWeight: 700 }}>
              ＊ でも、なにか いいことが おきそうな よかん… ＊
            </div>
            <button
              onClick={onDecline}
              style={{
                ...btnBase,
                width: "100%",
                background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                color: "#fff",
                boxShadow: "0 4px 0 #4c1d95",
              }}
            >
              ✨ つづける
            </button>
          </>
        )}

        {/* ── Step: TYPHOON_DANGER ──────────────────────────────────────── */}
        {step === "TYPHOON_DANGER" && (
          <>
            {/* 台風エフェクト */}
            <div style={{ textAlign: "center", marginBottom: 16, marginTop: 4 }}>
              <div style={{ fontSize: 52, animation: "kz-shake 0.6s ease-in-out infinite", display: "inline-block" }}>🌪️</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f87171", marginTop: 6, textShadow: "0 0 16px #ef4444", animation: "kz-shake 0.4s ease-in-out infinite" }}>
                たいふう で はたけが こわれそうだ！！
              </div>
            </div>
            <Bubble
              char={CHARS.narrator}
              animKey={`${animKey}`}
              text={"💨 つよい かぜが ふいてきた！\nはたけの さくが こわれそう…\nしゅうりするには コインが\nたくさん ひつようだ！！"}
              sub="（たいふう Level MAX ／ ひがい：はたけ ぜんたい）"
            />
            <div style={{ marginTop: 18 }}>
              <button
                onClick={() => next("CARPENTER_ARRIVE")}
                style={{
                  ...btnBase,
                  width: "100%",
                  background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                  color: "#fff",
                  boxShadow: "0 4px 0 #4c1d95",
                }}
              >
                😰 どうすれば…！
              </button>
            </div>
          </>
        )}

        {/* ── Step: CARPENTER_ARRIVE ────────────────────────────────────── */}
        {step === "CARPENTER_ARRIVE" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 12, fontSize: 13, fontWeight: 900, color: "#fde68a" }}>
              🔔 ちょっとまった！！
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
              <Portrait
                char={CHARS.grandson}
                anim="kz-bounce 0.7s ease-out"
                size={72}
              />
              <Bubble
                char={CHARS.grandson}
                animKey={`${animKey}`}
                text={"オレは さぶろう！\nおばあちゃんの まごだよ！\n\nきみが うちの おばあちゃんを\nたすけてくれたんだってね！！"}
              />
            </div>
            <button
              onClick={() => next("CARPENTER_SPEECH")}
              style={{
                ...btnBase,
                width: "100%",
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                color: "#fff",
                boxShadow: "0 4px 0 #1e3a8a",
              }}
            >
              😲 だれだろう…？
            </button>
          </>
        )}

        {/* ── Step: CARPENTER_SPEECH ────────────────────────────────────── */}
        {step === "CARPENTER_SPEECH" && (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20, marginTop: 4 }}>
              <Portrait
                char={CHARS.grandson}
                anim="kz-portrait 2.5s ease-in-out infinite"
                size={72}
              />
              <Bubble
                char={CHARS.grandson}
                animKey={`${animKey}`}
                text={"オレは だいく なんだ！\nその おんがえしに\nはたけを しゅうりしに きたよ！\n\nタダで なおしてやるぜ！！ 🔨✨"}
                sub="（プレイヤーのリソースは ゼロ消費）"
              />
            </div>
            <button
              onClick={() => next("REPAIR_ANIM")}
              style={{
                ...btnBase,
                width: "100%",
                background: "linear-gradient(135deg,#059669,#047857)",
                color: "#fff",
                boxShadow: "0 4px 0 #065f46",
              }}
            >
              🙏 ありがとう！！ たのむよ！
            </button>
          </>
        )}

        {/* ── Step: REPAIR_ANIM ─────────────────────────────────────────── */}
        {step === "REPAIR_ANIM" && (
          <RepairAnimation />
        )}

        {/* ── Step: REWARD ──────────────────────────────────────────────── */}
        {step === "REWARD" && (
          <>
            <BadgeReward />
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginTop: 16, marginBottom: 16 }}>
              <Portrait
                char={CHARS.grandson}
                anim="kz-portrait 3s ease-in-out infinite"
                size={56}
              />
              <Bubble
                char={CHARS.grandson}
                animKey={`${animKey}`}
                text={"はたけ なおったよ！\nこれ、おれたちの きずなの しるし。\nうけとってくれ！🏅"}
              />
            </div>
            <button
              onClick={() => {
                onComplete?.();
              }}
              style={{
                ...btnBase,
                width: "100%",
                background: "linear-gradient(135deg,#d97706,#b45309)",
                color: "#fff",
                boxShadow: "0 4px 0 #92400e",
                fontSize: 14,
              }}
            >
              🏅 ありがとう！ きずなの しょうを うけとった！
            </button>
          </>
        )}
      </div>
    </div>
  );
}
