"use client";

// app/kids/[kidId]/house/BaseCampClient.tsx
//
// ┌──────────────────────────────────────────────────────────────┐
// │  上半分 : ガイドキャラ領域                                    │
// │    - activeGuideAnimal を大きく表示                          │
// │    - 自発提案の吹き出し（getGuideSuggestion）                 │
// │    - キャラ・吹き出しタップで GuideChatModal を開く           │
// │  下半分 : 動物一覧                                            │
// │    - CaughtAnimal をカード表示                               │
// │    - 「この子をガイドにする」ボタン → setGuideAnimal          │
// │    - カードタップで GuideChatModal を開く                     │
// └──────────────────────────────────────────────────────────────┘
//
// Zustand: UI ローカル状態（モーダル開閉）のみ。
// DB状態: Server Actions が Single Source of Truth。
//         setGuideAnimal 後は楽観的 UI 更新 + revalidatePath 。

import { useState, useEffect, useCallback, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setGuideAnimal, getGuideSuggestion } from "@/actions/guide";
import GuideChatModal from "@/components/GuideChatModal";

// ─────────────────────────────────────────────────────────────
// 型定義（page.tsx の select から推論）
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

interface BaseCampClientProps {
  kidId: string;
  userName: string;
  coinBalance: number;
  currentStreak: number;
  initialGuide: GuideAnimalItem | null;
  initialAnimals: CaughtAnimalItem[];
}

// ─────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────

/** 残り寿命を日数で返す */
function daysLeft(ca: CaughtAnimalItem): number {
  const targetDate = ca.expiresAt
    ?? new Date(ca.caughtAt.getTime() + ca.animal.lifespanYears * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

/** レアリティ → 色ペア */
function rarityStyle(rarity: string): { bg: string; text: string; badge: string } {
  switch (rarity) {
    case "LEGENDARY":
      return { bg: "#FFF9C4", text: "#795548", badge: "bg-yellow-400 text-yellow-900" };
    case "EPIC":
      return { bg: "#EDE7F6", text: "#4A148C", badge: "bg-purple-400 text-purple-900" };
    case "RARE":
      return { bg: "#E3F2FD", text: "#0D47A1", badge: "bg-blue-400 text-blue-900" };
    default:
      return { bg: "#F5F5F5", text: "#424242", badge: "bg-gray-300 text-gray-700" };
  }
}

/** 親密度フェーズ */
function intimacyPhase(score: number) {
  if (score <= 300) return { icon: "🤍", label: "しりあい" };
  if (score <= 800) return { icon: "💚", label: "ともだち" };
  return { icon: "💛", label: "しんゆう" };
}

// 自発提案のポーリング間隔（ms）
const SUGGESTION_POLL_MS = 5 * 60 * 1000; // 5 分

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

export default function BaseCampClient({
  kidId,
  userName,
  initialGuide,
  initialAnimals,
}: BaseCampClientProps) {
  // ── Zustand でなく useState で UI 状態を管理 ─────────────
  const [guide, setGuide] = useState<GuideAnimalItem | null>(initialGuide);
  const [animals] = useState<CaughtAnimalItem[]>(initialAnimals);

  // 自発提案の吹き出し
  const [suggestion, setSuggestion] = useState<{
    text: string;
    emotion: string;
  } | null>(null);

  // チャットモーダル
  const [chatTarget, setChatTarget] = useState<CaughtAnimalItem | null>(null);

  // ガイド任命中フラグ
  const [settingGuideId, setSettingGuideId] = useState<string | null>(null);
  const [_isPending, startTransition] = useTransition();

  // ── 自発提案ポーリング ────────────────────────────────────
  const fetchSuggestion = useCallback(async () => {
    if (!guide) return;
    const result = await getGuideSuggestion(kidId, guide.id);
    if (result.success && result.suggestion) {
      setSuggestion({
        text: result.suggestion.suggestion_text,
        emotion: result.suggestion.emotion,
      });
    }
  }, [kidId, guide]);

  useEffect(() => {
    fetchSuggestion();
    const timer = setInterval(fetchSuggestion, SUGGESTION_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchSuggestion]);

  // ── ガイド任命ハンドラ ────────────────────────────────────
  const handleSetGuide = (ca: CaughtAnimalItem) => {
    setSettingGuideId(ca.id);
    startTransition(async () => {
      const result = await setGuideAnimal(kidId, ca.id);
      if (result.success) {
        // 楽観的 UI 更新: GuideAnimalItem にキャスト
        setGuide({
          ...ca,
          personality: ca.personality
            ? { firstPerson: ca.personality.firstPerson, toneRule: "" }
            : null,
        });
        setSuggestion(null); // 新ガイドになったら吹き出しをリセット
      }
      setSettingGuideId(null);
    });
  };

  // ── チャットモーダルを開く ────────────────────────────────
  const openChat = (ca: CaughtAnimalItem) => {
    setChatTarget(ca);
    setSuggestion(null); // 吹き出しを消す
  };

  // ─────────────────────────────────────────────────────────
  // レンダリング
  // ─────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col w-full min-h-screen select-none"
      style={{
        fontFamily:
          "'M PLUS Rounded 1c', 'Rounded Mplus 1c', 'Noto Sans JP', sans-serif",
        background: "linear-gradient(180deg, #E8F5E9 0%, #F1F8E9 100%)",
      }}
    >
      <style>{`
        @keyframes float {
          0%,100%{transform:translateY(0) rotate(-2deg)}
          50%{transform:translateY(-8px) rotate(2deg)}
        }
        @keyframes pulse-ring {
          0%{transform:scale(1);opacity:0.7}
          100%{transform:scale(1.5);opacity:0}
        }
        @keyframes bubble-in {
          0%{transform:scale(0.7) translateY(8px);opacity:0}
          70%{transform:scale(1.05)}
          100%{transform:scale(1) translateY(0);opacity:1}
        }
        @keyframes shimmer {
          0%,100%{opacity:1}
          50%{opacity:0.65}
        }
        .float { animation: float 3s ease-in-out infinite; }
        .bubble-in { animation: bubble-in 0.45s ease-out forwards; }
        .shimmer { animation: shimmer 1.8s ease-in-out infinite; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ════════════════════════════════════════════════════
          上半分: ガイドキャラ領域
      ════════════════════════════════════════════════════ */}
      <div
        className="relative flex flex-col items-center justify-center pt-10 pb-8"
        style={{
          minHeight: "46vh",
          background: "linear-gradient(180deg, #C8E6C9 0%, #E8F5E9 100%)",
          borderBottom: "3px solid #A5D6A7",
        }}
      >
        {/* ユーザー名ラベル */}
        <div
          className="absolute top-3 left-4 text-sm font-black"
          style={{ color: "#2E7D32" }}
        >
          🏕️ {userName}のベースキャンプ
        </div>

        {guide ? (
          <GuideCharacterView
            guide={guide}
            suggestion={suggestion}
            onTap={() => openChat(guide)}
          />
        ) : (
          <NoGuidePrompt />
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          下半分: 動物一覧
      ════════════════════════════════════════════════════ */}
      <div className="flex-1 px-4 pt-4 pb-6">
        <div
          className="text-base font-black mb-3"
          style={{ color: "#2E7D32" }}
        >
          🐾 うちにいる なかまたち{" "}
          <span className="text-sm text-gray-500 font-bold">
            ({animals.length}ひき)
          </span>
        </div>

        {animals.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-center text-gray-500 text-sm">
            <div className="bg-white rounded-3xl p-6 shadow">
              🌿 まだ なかまが いないよ。<br />サファリへ でかけよう！
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {animals.map((ca) => (
              <AnimalCard
                key={ca.id}
                ca={ca}
                isCurrentGuide={guide?.id === ca.id}
                isSettingGuide={settingGuideId === ca.id}
                onSetGuide={() => handleSetGuide(ca)}
                onChat={() => openChat(ca)}
              />
            ))}
          </div>
        )}
      </div>

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

// ─────────────────────────────────────────────────────────────
// サブコンポーネント: ガイドキャラ表示
// ─────────────────────────────────────────────────────────────

function GuideCharacterView({
  guide,
  suggestion,
  onTap,
}: {
  guide: GuideAnimalItem;
  suggestion: { text: string; emotion: string } | null;
  onTap: () => void;
}) {
  const phase = intimacyPhase(guide.intimacyScore);
  const remaining = daysLeft(guide);
  const isWarning = remaining <= 3 && remaining > 0;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 吹き出し */}
      <AnimatePresence>
        {suggestion && (
          <motion.button
            key="bubble"
            initial={{ opacity: 0, scale: 0.7, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 4 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={onTap}
            className="relative max-w-[240px] px-4 py-2.5 rounded-2xl text-center text-sm font-black"
            style={{
              background: "#FFFFFF",
              border: "3px solid #4CAF50",
              color: "#2E7D32",
              boxShadow: "0 3px 10px rgba(76,175,80,0.3)",
            }}
          >
            {suggestion.text}
            {/* 吹き出しの三角 */}
            <span
              className="absolute -bottom-3 left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: "12px solid #4CAF50",
                display: "block",
              }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* キャラクター本体 */}
      <div className="relative">
        {/* パルスリング（クリック誘導） */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "rgba(76,175,80,0.25)",
            animation: "pulse-ring 2s ease-out infinite",
          }}
        />

        <button
          onClick={onTap}
          className="relative flex items-center justify-center rounded-full transition-transform active:scale-90"
          style={{
            width: 100,
            height: 100,
            background: "linear-gradient(135deg, #FFFFFF, #F1F8E9)",
            border: "4px solid #4CAF50",
            boxShadow: "0 6px 20px rgba(76,175,80,0.4)",
            fontSize: "3.5rem",
          }}
        >
          <span className="float">{guide.animal.emoji}</span>
        </button>

        {/* 残り寿命バッジ */}
        {isWarning && (
          <div
            className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-black shimmer"
            style={{
              background: "#FF5722",
              color: "white",
              fontSize: "0.6rem",
              border: "2px solid white",
            }}
          >
            ⚠️ あと{remaining}日
          </div>
        )}
      </div>

      {/* キャラ名 + 親密度 */}
      <div className="text-center">
        <div
          className="font-black text-lg"
          style={{ color: "#1B5E20" }}
        >
          {guide.animal.genericName}
        </div>
        <div className="flex items-center justify-center gap-2 mt-0.5">
          <span style={{ fontSize: "0.8rem", color: "#555" }}>
            {phase.icon} {phase.label}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: "#E8F5E9", color: "#2E7D32" }}
          >
            ❤️ {guide.intimacyScore}
          </span>
        </div>
        <div
          className="mt-1 text-xs font-bold"
          style={{ color: "#888" }}
        >
          💬 タップしてはなそう
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// サブコンポーネント: ガイド未設定メッセージ
// ─────────────────────────────────────────────────────────────

function NoGuidePrompt() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 text-center">
      <div style={{ fontSize: "4rem" }}>🐾</div>
      <div
        className="font-black text-lg"
        style={{ color: "#2E7D32" }}
      >
        そうべつを きめよう！
      </div>
      <div
        className="text-sm font-bold leading-relaxed"
        style={{ color: "#555" }}
      >
        したの どうぶつカードの<br />
        「この子をガイドにする」ボタンを<br />
        おしてね 👇
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// サブコンポーネント: 動物カード
// ─────────────────────────────────────────────────────────────

function AnimalCard({
  ca,
  isCurrentGuide,
  isSettingGuide,
  onSetGuide,
  onChat,
}: {
  ca: CaughtAnimalItem;
  isCurrentGuide: boolean;
  isSettingGuide: boolean;
  onSetGuide: () => void;
  onChat: () => void;
}) {
  const style = rarityStyle(ca.animal.rarity);
  const phase = intimacyPhase(ca.intimacyScore);
  const remaining = daysLeft(ca);
  const isWarning = remaining <= 3 && remaining > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-3xl overflow-hidden"
      style={{
        background: isCurrentGuide ? "#E8F5E9" : style.bg,
        border: isCurrentGuide
          ? "3px solid #4CAF50"
          : "2px solid rgba(0,0,0,0.08)",
        boxShadow: isCurrentGuide
          ? "0 4px 16px rgba(76,175,80,0.3)"
          : "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <button
        onClick={onChat}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all active:opacity-80"
      >
        {/* 絵文字 */}
        <div
          className="shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 52,
            height: 52,
            background: "rgba(255,255,255,0.8)",
            border: `2px solid ${isCurrentGuide ? "#4CAF50" : "rgba(0,0,0,0.1)"}`,
            fontSize: "2rem",
          }}
        >
          {ca.animal.emoji}
        </div>

        {/* テキスト */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-black text-sm"
              style={{ color: style.text }}
            >
              {ca.animal.genericName}
            </span>
            {isCurrentGuide && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-black"
                style={{ background: "#4CAF50", color: "white", fontSize: "0.6rem" }}
              >
                ★ ガイド中
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span style={{ fontSize: "0.7rem", color: "#777" }}>
              {phase.icon} {phase.label}
            </span>
            <span style={{ fontSize: "0.7rem", color: "#777" }}>
              ❤️ {ca.intimacyScore}
            </span>
            {isWarning ? (
              <span
                className="text-xs font-black shimmer"
                style={{ color: "#FF5722" }}
              >
                ⚠️ あと{remaining}日
              </span>
            ) : (
              <span style={{ fontSize: "0.7rem", color: "#aaa" }}>
                残り{remaining}日
              </span>
            )}
          </div>
        </div>

        {/* チャットアイコン */}
        <div
          className="shrink-0 text-xl"
          style={{ color: "#4CAF50" }}
        >
          💬
        </div>
      </button>

      {/* ガイドにするボタン */}
      {!isCurrentGuide && (
        <div
          className="px-4 pb-3"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <button
            onClick={onSetGuide}
            disabled={isSettingGuide}
            className="w-full py-2 rounded-2xl font-black text-sm text-white transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: isSettingGuide
                ? "#9E9E9E"
                : "linear-gradient(135deg, #4CAF50, #2E7D32)",
              border: "3px solid #1B5E20",
              boxShadow: "0 3px 0 #1B5E20",
              fontSize: "0.78rem",
            }}
          >
            {isSettingGuide ? "⏳ きりかえちゅう..." : "⭐ この子をガイドにする"}
          </button>
        </div>
      )}
    </motion.div>
  );
}
