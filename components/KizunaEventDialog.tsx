"use client";
// components/KizunaEventDialog.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 「おたがいさま（善意の手助け）」ストーリーイベント ダイアログ
//
// データ駆動。シナリオは lib/kizunaScenarios.ts から渡す。
//
// 使い方（お願い ＝ 善意で手助けする）:
//   <KizunaEventDialog
//     mode="ask"
//     ask={someAsk}
//     onHelp={handleHelp}     // 「助ける」を押した
//     onDecline={handleClose} // 「やめておく」/ お礼のあと閉じる
//   />
//
// 使い方（お返し ＝ だれかが さりげなく 手を貸してくれる）:
//   <KizunaEventDialog
//     mode="return"
//     ret={someReturn}
//     onComplete={handleComplete}
//   />
//
// 設計（Notion「助ける」より）:
//   - 見返りを ほのめかさない（お礼のあとに「何かあるかも」は出さない）。
//   - お返しは「恩着せがましくない」＝ おたがいさま の対等なトーン。
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import type { KizunaAsk, KizunaReturn } from "@/lib/kizunaScenarios";

// ─── 内部ステップ定義 ─────────────────────────────────────────────────────────
type InternalStep =
  | "ASK_APPEAR"     // こまっている人 登場
  | "ASK_THANKS"     // お礼（善意・見返りなし）
  | "RET_ARRIVE"     // 助けに来てくれた人 登場
  | "RET_DEED"       // 手伝いアニメーション
  | "RET_REWARD";    // 絆の証を受け取る

// ─── Props ────────────────────────────────────────────────────────────────────
interface KizunaEventDialogProps {
  mode: "ask" | "return";
  ask?: KizunaAsk;
  ret?: KizunaReturn;
  /** ask: 「助ける」を押した */
  onHelp?: () => void;
  /** ask: 「やめておく」/ お礼のあと閉じる */
  onDecline?: () => void;
  /** return: すべて完了したとき */
  onComplete?: () => void;
}

// ─── アニメーション CSS ───────────────────────────────────────────────────────
const DIALOG_CSS = `
@keyframes kz-fadeIn      { from{opacity:0} to{opacity:1} }
@keyframes kz-slideUp     { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes kz-portrait    { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-8px) rotate(2deg)} }
@keyframes kz-bounce      { 0%,100%{transform:translateY(0) scale(1)} 30%{transform:translateY(-24px) scale(1.15)} 60%{transform:translateY(8px) scale(0.92)} }
@keyframes kz-glow        { 0%,100%{box-shadow:0 0 16px 4px rgba(255,215,0,.6)} 50%{box-shadow:0 0 36px 12px rgba(255,215,0,.9)} }
@keyframes kz-sparkle     { 0%{opacity:0;transform:scale(0) rotate(0deg)} 50%{opacity:1;transform:scale(1.2) rotate(180deg)} 100%{opacity:0;transform:scale(0) rotate(360deg)} }
@keyframes kz-hands       { 0%,100%{transform:translateY(0) rotate(-8deg)} 50%{transform:translateY(-6px) rotate(8deg)} }
@keyframes kz-confetti    { 0%{opacity:1;transform:translateY(0) rotate(0deg)} 100%{opacity:0;transform:translateY(80px) rotate(720deg)} }
@keyframes kz-badge-in    { 0%{opacity:0;transform:scale(0) rotate(-30deg)} 60%{transform:scale(1.3) rotate(8deg)} 100%{opacity:1;transform:scale(1) rotate(0deg)} }
@keyframes kz-typist      { from{clip-path:inset(0 100% 0 0)} to{clip-path:inset(0 0% 0 0)} }
`;

function injectCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("kizuna-css")) return;
  const s = document.createElement("style");
  s.id = "kizuna-css";
  s.textContent = DIALOG_CSS;
  document.head.appendChild(s);
}

type CharLike = { emoji: string; name: string; color: string };

// ─── フキダシ ─────────────────────────────────────────────────────────────────
function Bubble({
  char,
  text,
  sub,
  animKey,
}: {
  char: CharLike;
  text: string;
  sub?: string;
  animKey: string;
}) {
  return (
    <div key={animKey} style={{ flex: 1, animation: "kz-slideUp 0.4s ease-out" }}>
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
          boxShadow: `0 2px 8px ${char.color}88`,
        }}
      >
        {char.name}
      </div>
      <div
        style={{
          background: "rgba(255,255,255,0.96)",
          borderRadius: "0 16px 16px 16px",
          padding: "14px 16px",
          fontSize: 14,
          fontWeight: 700,
          color: "#1a1a1a",
          lineHeight: 1.7,
          whiteSpace: "pre-line",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          border: `2px solid ${char.color}88`,
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
  char: CharLike;
  anim?: string;
  size?: number;
}) {
  return (
    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
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

// ─── 手伝いアニメーション（お返し） ───────────────────────────────────────────
function HelpAnimation() {
  const hands = ["🤝", "✨", "💪", "🌟"];
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 13, color: "#fde68a", fontWeight: 900, marginBottom: 12 }}>
        ✨ いっしょに てつだって くれているよ！
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 }}>
        {hands.map((t, i) => (
          <span
            key={i}
            style={{
              fontSize: 28,
              display: "inline-block",
              animation: "kz-hands 0.5s ease-in-out infinite",
              animationDelay: `${i * 0.13}s`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div style={{ height: 8, background: "rgba(0,0,0,0.3)", borderRadius: 99, overflow: "hidden", margin: "0 24px" }}>
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
        おたがいさま 💚
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
    <div style={{ position: "relative", textAlign: "center", padding: "16px 0 8px", overflow: "visible" }}>
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
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
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
          だれかと つながった しるし
        </div>
      </div>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────
export function KizunaEventDialog({
  mode,
  ask,
  ret,
  onHelp,
  onDecline,
  onComplete,
}: KizunaEventDialogProps) {
  useEffect(() => { injectCSS(); }, []);

  const initStep: InternalStep = mode === "ask" ? "ASK_APPEAR" : "RET_ARRIVE";
  const [step, setStep] = useState<InternalStep>(initStep);
  const [animKey, setAnimKey] = useState(0);

  const next = (s: InternalStep) => {
    setStep(s);
    setAnimKey((k) => k + 1);
  };

  // 手伝いアニメーション完了の自動進行
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (step === "RET_DEED") {
      timerRef.current = setTimeout(() => next("RET_REWARD"), 3000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [step]);

  // ── 背景スタイル ────────────────────────────────────────────────────────
  const overlayBg =
    step === "RET_DEED"
      ? "radial-gradient(ellipse at 50% 0%, rgba(10,50,30,0.97) 0%, rgba(5,25,15,0.98) 100%)"
      : step === "RET_REWARD"
      ? "radial-gradient(ellipse at 50% 0%, rgba(60,30,10,0.97) 0%, rgba(20,10,5,0.98) 100%)"
      : step === "ASK_THANKS"
      ? "radial-gradient(ellipse at 50% 0%, rgba(20,50,40,0.97) 0%, rgba(10,30,22,0.98) 100%)"
      : "radial-gradient(ellipse at 50% 0%, rgba(20,20,50,0.97) 0%, rgba(10,10,30,0.98) 100%)";

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

  const askChar: CharLike | null = ask ? { emoji: ask.emoji, name: ask.name, color: ask.color } : null;
  const retChar: CharLike | null = ret ? { emoji: ret.emoji, name: ret.name, color: ret.color } : null;

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
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 3, background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.8), transparent)", borderRadius: 99 }} />

        {/* イベントバッジ */}
        <div style={{
          position: "absolute",
          top: 12,
          right: 16,
          background: "linear-gradient(135deg,#16a34a,#22c55e)",
          color: "#fff",
          fontSize: 9,
          fontWeight: 900,
          borderRadius: 8,
          padding: "3px 8px",
          letterSpacing: 1,
          boxShadow: "0 2px 8px rgba(22,163,74,0.5)",
        }}>
          💚 おたがいさま
        </div>

        {/* ── Step: ASK_APPEAR ───────────────────────────────────────────── */}
        {step === "ASK_APPEAR" && askChar && ask && (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20, marginTop: 8 }}>
              <Portrait char={askChar} anim="kz-portrait 3s ease-in-out infinite" />
              <Bubble char={askChar} animKey={`${animKey}`} text={ask.plea} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  onHelp?.();
                  next("ASK_THANKS");
                }}
                style={{
                  ...btnBase,
                  flex: 2,
                  background: "linear-gradient(135deg,#16a34a,#15803d)",
                  color: "#fff",
                  boxShadow: "0 4px 0 #14532d",
                }}
              >
                {ask.action}
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

        {/* ── Step: ASK_THANKS（純粋な善意・見返りなし）─────────────────── */}
        {step === "ASK_THANKS" && askChar && ask && (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18, marginTop: 8 }}>
              <Portrait char={askChar} anim="kz-bounce 1s ease-out" size={72} />
              <Bubble char={askChar} animKey={`${animKey}`} text={ask.thanks} />
            </div>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              {["✨","🌟","💫","⭐","🌸"].map((s, i) => (
                <span key={i} style={{ fontSize: 20, display: "inline-block", margin: "0 4px", animation: `kz-sparkle 1.5s ease-in-out ${i * 0.2}s infinite` }}>{s}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#a7f3d0", textAlign: "center", marginBottom: 16, fontWeight: 700 }}>
              だれかを たすけると、こころが あったかく なるね 😊
            </div>
            <button
              onClick={onDecline}
              style={{ ...btnBase, width: "100%", background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", boxShadow: "0 4px 0 #14532d" }}
            >
              ✨ つづける
            </button>
          </>
        )}

        {/* ── Step: RET_ARRIVE ──────────────────────────────────────────── */}
        {step === "RET_ARRIVE" && retChar && ret && (
          <>
            <div style={{ textAlign: "center", marginBottom: 12, fontSize: 13, fontWeight: 900, color: "#fde68a" }}>
              🔔 だれか きたみたい！
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
              <Portrait char={retChar} anim="kz-bounce 0.7s ease-out" size={72} />
              <Bubble char={retChar} animKey={`${animKey}`} text={ret.arrive} />
            </div>
            <button
              onClick={() => next("RET_DEED")}
              style={{ ...btnBase, width: "100%", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", boxShadow: "0 4px 0 #1e3a8a" }}
            >
              😊 あっ、きみは…！
            </button>
          </>
        )}

        {/* ── Step: RET_DEED ────────────────────────────────────────────── */}
        {step === "RET_DEED" && <HelpAnimation />}

        {/* ── Step: RET_REWARD ──────────────────────────────────────────── */}
        {step === "RET_REWARD" && retChar && ret && (
          <>
            <BadgeReward />
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginTop: 16, marginBottom: 16 }}>
              <Portrait char={retChar} anim="kz-portrait 3s ease-in-out infinite" size={56} />
              <Bubble char={retChar} animKey={`${animKey}`} text={ret.deed} />
            </div>
            <button
              onClick={() => onComplete?.()}
              style={{ ...btnBase, width: "100%", background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff", boxShadow: "0 4px 0 #92400e", fontSize: 14 }}
            >
              🤝 ありがとう！ おたがいさま だね！
            </button>
          </>
        )}
      </div>
    </div>
  );
}
