"use client";

// components/GuideChatModal.tsx
// Web Speech API を使った完全音声対話チャットモーダル
//   - SpeechRecognition (STT): マイクボタンタップでトグル録音
//   - speechSynthesis (TTS): 動物の返答を自動読み上げ (ja-JP, pitch 高め)
//   - Framer Motion: マイク波紋 / 動物アイコンジャンプ
//   - AudioContext unlock: 初回タップ時に speechSynthesis を解除

import { useState, useRef, useEffect, useTransition, useCallback } from "react";
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
// クイックフレーズ
// ─────────────────────────────────────────────────────────────

const QUICK_PHRASES = [
  "げんき？",
  "なにたべたい？",
  "いっしょにあそぼ！",
  "すきなものなーに？",
];

// ─────────────────────────────────────────────────────────────
// webkit プレフィックス付き SpeechRecognition の型補完
// ─────────────────────────────────────────────────────────────

type AnyWindow = Window & {
  webkitSpeechRecognition?: new () => SpeechRecognition;
};

function getSpeechRecognitionClass(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as AnyWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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
      text: `${animal.animalName}だよ！ こえで はなしかけてみてね 🎤`,
      emotion: "joy",
    },
  ]);
  const [isPending, startTransition] = useTransition();
  const [currentEmotion, setCurrentEmotion] =
    useState<AiResponse["emotion"]>("joy");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioUnlockedRef = useRef(false);

  // sendMessage を ref で保持して SpeechRecognition コールバック内の
  // stale closure 問題を回避する
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  // ─── スクロール ───────────────────────────────────────────

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // ─── AudioContext / speechSynthesis unlock ───────────────

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      // 無音の Utterance を発話してブラウザの自動再生制限を解除する
      const silent = new SpeechSynthesisUtterance(" ");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
      audioUnlockedRef.current = true;
    } catch (e) {
      console.error("[GuideChatModal] AudioContext unlock failed:", e);
    }
  }, []);

  // ─── TTS 読み上げ ─────────────────────────────────────────

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.pitch = 1.8;
    u.rate = 1.1;

    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = (e) => {
      console.error("[GuideChatModal] SpeechSynthesis error:", e.error);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(u);
  }, []);

  // ─── Ollama 送信 ──────────────────────────────────────────

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isPending) return;

      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);

      startTransition(async () => {
        try {
          const result = await chatWithAnimal(
            animal.caughtAnimalId,
            trimmed,
            userId,
          );
          if (result.success) {
            setCurrentEmotion(result.response.emotion);
            const reply = result.response.reply_text;
            setMessages((prev) => [
              ...prev,
              {
                role: "animal",
                text: reply,
                emotion: result.response.emotion,
              },
            ]);
            speak(reply);
          } else {
            const errText =
              "ごめんね、うまく きけなかった... もう いちど はなしかけてね 🐾";
            console.error(
              "[GuideChatModal] chatWithAnimal failed:",
              result.error,
            );
            setMessages((prev) => [
              ...prev,
              { role: "animal", text: errText, emotion: "think" },
            ]);
            speak(errText);
          }
        } catch (err) {
          const errText =
            "ごめんね、うまく きけなかった... もう いちど はなしかけてね 🐾";
          console.error("[GuideChatModal] chatWithAnimal threw:", err);
          setMessages((prev) => [
            ...prev,
            { role: "animal", text: errText, emotion: "think" },
          ]);
          speak(errText);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [animal.caughtAnimalId, userId, isPending, speak],
  );

  // sendMessage が更新されたら ref も更新
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // ─── SpeechRecognition 初期化（一度だけ） ─────────────────

  useEffect(() => {
    const SR = getSpeechRecognitionClass();
    if (!SR) {
      console.error(
        "[GuideChatModal] SpeechRecognition はこのブラウザでは未対応です。",
      );
      return;
    }

    const rec = new SR();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      setInterimText(interim);
      if (final) {
        setInterimText("");
        setIsListening(false);
        sendMessageRef.current(final);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error(
        "[GuideChatModal] SpeechRecognition error:",
        event.error,
        event.message ?? "",
      );
      setIsListening(false);
      setInterimText("");
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;

    return () => {
      rec.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ─── マイクトグル ─────────────────────────────────────────

  const toggleMic = useCallback(() => {
    unlockAudio();
    const rec = recognitionRef.current;
    if (!rec) {
      console.error(
        "[GuideChatModal] SpeechRecognition インスタンスが存在しません。",
      );
      return;
    }

    if (isListening) {
      rec.stop();
      setIsListening(false);
    } else {
      setInterimText("");
      try {
        rec.start();
        setIsListening(true);
      } catch (e) {
        console.error("[GuideChatModal] SpeechRecognition start failed:", e);
      }
    }
  }, [isListening, unlockAudio]);

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
          {/* ヘッダー */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
              borderBottom: "3px solid #1B5E20",
            }}
          >
            {/* アバター: 発話中はジャンプ、推論中はスケール */}
            <motion.div
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: 56,
                height: 56,
                background: "rgba(255,255,255,0.25)",
                border: "3px solid rgba(255,255,255,0.5)",
                fontSize: "2rem",
              }}
              animate={
                isSpeaking
                  ? { y: [0, -10, 0, -7, 0], rotate: [0, -6, 6, -3, 0] }
                  : isPending
                  ? { scale: [1, 1.12, 1] }
                  : { scale: 1, y: 0, rotate: 0 }
              }
              transition={
                isSpeaking
                  ? { repeat: Infinity, duration: 0.55, ease: "easeInOut" }
                  : isPending
                  ? { repeat: Infinity, duration: 0.8 }
                  : { duration: 0.2 }
              }
            >
              {isPending ? "💭" : animal.emoji}
              {!isPending && (
                <span
                  className="absolute -bottom-1 -right-1"
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
                  {"❤️ "}
                  {animal.intimacyScore}
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
              {"✕"}
            </button>
          </div>

          {/* チャット本文 */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={
                    "flex items-end gap-2 " +
                    (isUser ? "flex-row-reverse" : "flex-row")
                  }
                >
                  {!isUser && (
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

                  <div
                    className="max-w-[72%] px-4 py-2.5 rounded-2xl leading-relaxed"
                    style={
                      isUser
                        ? {
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            background:
                              "linear-gradient(135deg, #4CAF50, #2E7D32)",
                            color: "#FFFFFF",
                            borderBottomRightRadius: 4,
                          }
                        : {
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            background: "#FFFFFF",
                            color: "#3E2723",
                            border: "2px solid #E8D5B0",
                            borderBottomLeftRadius: 4,
                          }
                    }
                  >
                    {msg.text}
                  </div>
                </motion.div>
              );
            })}

            {/* かんがえちゅう... */}
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

            {/* 音声認識中の暫定テキスト */}
            {interimText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-row-reverse items-end"
              >
                <div
                  className="max-w-[72%] px-4 py-2.5 rounded-2xl leading-relaxed"
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    background: "rgba(76,175,80,0.12)",
                    color: "#2E7D32",
                    border: "2px dashed #4CAF50",
                    borderBottomRightRadius: 4,
                  }}
                >
                  {"🎤 "}
                  {interimText}
                </div>
              </motion.div>
            )}
          </div>

          {/* クイックフレーズ */}
          <div className="px-4 pb-1 flex gap-2 overflow-x-auto shrink-0 hide-scrollbar">
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                onClick={() => {
                  unlockAudio();
                  sendMessage(phrase);
                }}
                disabled={isPending || isListening}
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

          {/* マイクエリア */}
          <div
            className="flex flex-col items-center gap-3 px-4 py-5 shrink-0"
            style={{
              background: "#FFF8E7",
              borderTop: "2px solid #E8D5B0",
            }}
          >
            {/* 状態テキスト */}
            <p
              className="text-xs font-bold"
              style={{ color: "#8B6914", minHeight: "1.2em" }}
            >
              {isListening
                ? "🎤 きいてるよ... はなしかけてね！"
                : isSpeaking
                ? "🔊 はなしてるよ..."
                : isPending
                ? "💭 かんがえちゅう..."
                : "マイクを おして はなしかけてね"}
            </p>

            {/* マイクボタン + 波紋 */}
            <div className="relative flex items-center justify-center">
              {/* 波紋（リスニング中のみ） */}
              {isListening &&
                [0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: 80,
                      height: 80,
                      border: "3px solid #4CAF50",
                    }}
                    animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.6,
                      delay: i * 0.52,
                      ease: "easeOut",
                    }}
                  />
                ))}

              {/* マイクボタン本体 */}
              <motion.button
                onClick={toggleMic}
                disabled={isPending}
                className="relative z-10 flex items-center justify-center rounded-full select-none"
                style={{
                  width: 80,
                  height: 80,
                  background: isListening
                    ? "linear-gradient(135deg, #F44336, #B71C1C)"
                    : "linear-gradient(135deg, #4CAF50, #1B5E20)",
                  border: isListening
                    ? "4px solid #B71C1C"
                    : "4px solid #1B5E20",
                  fontSize: "2rem",
                  boxShadow: isListening
                    ? "0 8px 0 #7F0000, 0 12px 28px rgba(244,67,54,0.4)"
                    : "0 8px 0 #1B5E20, 0 12px 28px rgba(76,175,80,0.4)",
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.55 : 1,
                }}
                animate={isListening ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                transition={
                  isListening
                    ? { repeat: Infinity, duration: 0.8 }
                    : { duration: 0.15 }
                }
                whileTap={{ scale: 0.88, y: 5 }}
              >
                {isListening ? "⏹" : "🎤"}
              </motion.button>
            </div>
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
      <span className="text-xs font-bold" style={{ color: "#8B6914" }}>
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
          {"•"}
        </motion.span>
      ))}
    </div>
  );
}
