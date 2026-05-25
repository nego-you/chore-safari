"use client";

// components/GuideChatModal.tsx
// LINEノベルゲーム風 動物チャットモーダル
//   - chatWithAnimal Server Action を呼び出す
//   - Ollama推論中は「かんがえちゅう...」アニメーション
//   - Framer Motion でふわっとした開閉アニメーション

import { useState, useRef, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { chatWithAnimal } from "@/actions/guide";
import type { AiResponse } from "@/lib/ai-guide";

// ─────────────────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────────────────

interface AnimalInfo {
  caughtAnimalId: string;
  animalName: string;
  emoji: string;
  intimacyScore: number;
}

interface Message {
  role: "user" | "animal";
  text: string;
  emotion?: AiResponse["emotion"];
}

interface GuideChatModalProps {
  userId: string;
  animal: AnimalInfo;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────
// 感情 → 表情絵文字マップ
// ─────────────────────────────────────────────────────────────
const EMOTION_FACE: Record<AiResponse["emotion"], string> = {
  neutral: "😊",
  joy: "😄",
  blush: "😳",
  think: "🤔",
};

// ─────────────────────────────────────────────────────────────
// 親密度フェーズラベル
// ─────────────────────────────────────────────────────────────
function getIntimacyLabel(score: number) {
  if (score <= 300) return { label: "しりあい", color: "#9E9E9E" };
  if (score <= 800) return { label: "ともだち", color: "#4CAF50" };
  return { label: "しんゆう", color: "#FF9800" };
}

// ─────────────────────────────────────────────────────────────
// 入力を読みやすい短文に変換するヒント
// ─────────────────────────────────────────────────────────────
const QUICK_PHRASES = [
  "げんき？",
  "なにたべたい？",
  "いっしょにあそぼ！",
  "すきなものなーに？",
];

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────
export default function GuideChatModal({
  userId,
  animal,
  onClose,
}: GuideChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "animal",
      text: `${animal.animalName}だよ！ なにか はなしかけてみてね 🐾`,
      emotion: "joy",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [currentEmotion, setCurrentEmotion] =
    useState<AiResponse["emotion"]>("joy");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが来たら最下部へスクロール
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    setInputText("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);

    startTransition(async () => {
      const result = await chatWithAnimal(
        animal.caughtAnimalId,
        trimmed,
        userId,
      );
      if (result.success) {
        setCurrentEmotion(result.response.emotion);
        setMessages((prev) => [
          ...prev,
          {
            role: "animal",
            text: result.response.reply_text,
            emotion: result.response.emotion,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "animal",
            text: "ごめんね、うまく きけなかった... もう一度 はなしかけてね 🐾",
            emotion: "think",
          },
        ]);
      }
    });
  };

  const intimacy = getIntimacyLabel(animal.intimacyScore);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "rgba(0,0,0,0.7)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative flex flex-col w-full max-w-sm mx-auto mt-auto rounded-t-3xl overflow-hidden"
          style={{
            height: "88vh",
            background: "linear-gradient(180deg, #FFF8E7 0%, #FFFDE4 100%)",
            border: "3px solid #8B4513",
          }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
        >
          {/* ─── ヘッダー ─── */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
              borderBottom: "3px solid #1B5E20",
            }}
          >
            {/* アバター（感情アニメーション付き） */}
            <motion.div
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: 56,
                height: 56,
                background: "rgba(255,255,255,0.25)",
                border: "3px solid rgba(255,255,255,0.5)",
                fontSize: "2rem",
              }}
              animate={isPending ? { scale: [1, 1.1, 1] } : { scale: 1 }}
              transition={
                isPending
                  ? { repeat: Infinity, duration: 0.8 }
                  : { duration: 0.2 }
              }
            >
              {isPending ? "💭" : animal.emoji}
              {/* 感情バッジ */}
              {!isPending && (
                <span
                  className="absolute -bottom-1 -right-1 text-lg"
                  style={{ fontSize: "1.1rem" }}
                >
                  {EMOTION_FACE[currentEmotion]}
                </span>
              )}
            </motion.div>

            {/* 名前 + 親密度 */}
            <div className="flex-1 min-w-0">
              <div
                className="font-black text-white truncate"
                style={{ fontSize: "1.05rem" }}
              >
                {animal.animalName}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: intimacy.color,
                    color: "white",
                    fontSize: "0.65rem",
                  }}
                >
                  {intimacy.label}
                </span>
                <span className="text-white text-xs opacity-80">
                  ❤️ {animal.intimacyScore}
                </span>
              </div>
            </div>

            {/* 閉じるボタン */}
            <button
              className="flex items-center justify-center rounded-full text-white transition-transform active:scale-90"
              style={{
                width: 36,
                height: 36,
                background: "rgba(0,0,0,0.25)",
                fontSize: "1.3rem",
              }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          {/* ─── チャット本文 ─── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex items-end gap-2 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* 動物アバター（動物側のみ） */}
                {msg.role === "animal" && (
                  <div
                    className="shrink-0 flex items-center justify-center rounded-full"
                    style={{
                      width: 36,
                      height: 36,
                      background: "#E8F5E9",
                      border: "2px solid #4CAF50",
                      fontSize: "1.3rem",
                    }}
                  >
                    {animal.emoji}
                  </div>
                )}

                {/* メッセージバブル */}
                <div
                  className="max-w-[72%] px-4 py-2.5 rounded-2xl leading-relaxed"
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    ...(msg.role === "animal"
                      ? {
                          background: "#FFFFFF",
                          color: "#3E2723",
                          border: "2px solid #E8D5B0",
                          borderBottomLeftRadius: 4,
                        }
                      : {
                          background:
                            "linear-gradient(135deg, #4CAF50, #2E7D32)",
                          color: "#FFFFFF",
                          borderBottomRightRadius: 4,
                        }),
                  }}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {/* ローディング（かんがえちゅう） */}
            {isPending && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end gap-2"
              >
                <div
                  className="shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 36,
                    height: 36,
                    background: "#E8F5E9",
                    border: "2px solid #4CAF50",
                    fontSize: "1.3rem",
                  }}
                >
                  {animal.emoji}
                </div>
                <div
                  className="px-4 py-2.5 rounded-2xl"
                  style={{
                    background: "#FFFFFF",
                    border: "2px solid #E8D5B0",
                    borderBottomLeftRadius: 4,
                  }}
                >
                  <ThinkingDots />
                </div>
              </motion.div>
            )}
          </div>

          {/* ─── クイックフレーズ ─── */}
          <div className="px-4 pb-1 flex gap-2 overflow-x-auto shrink-0 hide-scrollbar">
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                onClick={() => sendMessage(phrase)}
                disabled={isPending}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-transform active:scale-95 disabled:opacity-50"
                style={{
                  background: "#E8F5E9",
                  border: "2px solid #4CAF50",
                  color: "#2E7D32",
                  whiteSpace: "nowrap",
                }}
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* ─── 入力エリア ─── */}
          <div
            className="flex items-center gap-2 px-4 py-3 shrink-0"
            style={{
              background: "#FFF8E7",
              borderTop: "2px solid #E8D5B0",
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(inputText);
                }
              }}
              placeholder="なにか はなしかけてみよう..."
              disabled={isPending}
              className="flex-1 rounded-2xl px-4 py-2 text-sm font-bold outline-none disabled:opacity-60"
              style={{
                background: "#FFF",
                border: "2px solid #C8A46E",
                color: "#3E2723",
                fontSize: "0.85rem",
              }}
            />
            <button
              onClick={() => sendMessage(inputText)}
              disabled={isPending || !inputText.trim()}
              className="flex items-center justify-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-40"
              style={{
                width: 44,
                height: 44,
                background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                border: "3px solid #1B5E20",
                fontSize: "1.3rem",
                flexShrink: 0,
              }}
            >
              {isPending ? "⏳" : "💬"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// かんがえちゅう... ドットアニメーション
// ─────────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      <span
        className="text-xs font-bold"
        style={{ color: "#8B6914" }}
      >
        かんがえちゅう
      </span>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{
            repeat: Infinity,
            duration: 0.7,
            delay: i * 0.15,
          }}
          style={{ color: "#4CAF50", fontSize: "1.1rem", lineHeight: 1 }}
        >
          •
        </motion.span>
      ))}
    </div>
  );
}
