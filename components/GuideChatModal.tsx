"use client";

// components/GuideChatModal.tsx
// VOICEVOX バックエンド TTS + Web Speech API STT による完全音声対話チャットモーダル
//   - SpeechRecognition (STT): マイクボタンタップでトグル録音
//   - VOICEVOX TTS: /api/synthesize に POST → WAV を AudioContext で再生
//   - Framer Motion: マイク波紋 / 動物アイコンジャンプ
//   - isSynthesizing: 音声生成中のローディング表示

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
  role: "user" | "animal" | "error";
  text: string;
  emotion?: AiResponse["emotion"];
  /** role === "error" のときに表示する開発者向け詳細 */
  errorDetail?: string;
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
// VOICEVOX TTS ヘルパー
// ─────────────────────────────────────────────────────────────

/**
 * /api/synthesize にテキストを送り WAV ArrayBuffer を返す。
 * 失敗時は null を返す（呼び出し元でサイレントフォールバック）。
 */
async function fetchSynthesizedAudio(text: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch("/api/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!res.ok) {
      console.error("[GuideChatModal] /api/synthesize error:", res.status, await res.text().catch(() => ""));
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.error("[GuideChatModal] /api/synthesize fetch failed:", err);
    return null;
  }
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
      text: animal.animalName + "だよ！ こえで はなしかけてみてね 🎤",
      emotion: "joy",
    },
  ]);
  const [isPending, startTransition] = useTransition();
  const [currentEmotion, setCurrentEmotion] =
    useState<AiResponse["emotion"]>("joy");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  /** VOICEVOX API 呼び出し中（WAV 生成待ち）のローディング状態 */
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [interimText, setInterimText] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  /** AudioContext は初回ユーザーインタラクション後に生成（autoplay policy 対応） */
  const audioContextRef = useRef<AudioContext | null>(null);
  /** 再生中の BufferSource。正解・スキップ時に即停止できるよう保持する */
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

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

  // ─── AudioContext の初期化（ユーザーインタラクション時） ──

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    // Safari などで suspended になっている場合は resume する
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  // ─── 再生停止 ─────────────────────────────────────────────

  const stopSpeech = useCallback(() => {
    try {
      audioSourceRef.current?.stop();
    } catch {
      // すでに停止済みの場合は無視
    }
    audioSourceRef.current = null;
    setIsSpeaking(false);
  }, []);

  // ─── VOICEVOX TTS 読み上げ ────────────────────────────────

  const speak = useCallback(
    async (text: string) => {
      // 前の音声を即停止
      stopSpeech();

      const ctx = ensureAudioContext();
      if (!ctx) return;

      setIsSynthesizing(true);
      try {
        const arrayBuffer = await fetchSynthesizedAudio(text);
        if (!arrayBuffer) {
          // 音声生成失敗はサイレントフォールバック（テキストは表示済み）
          return;
        }

        // WAV を AudioBuffer にデコードして再生
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        source.onended = () => {
          setIsSpeaking(false);
          if (audioSourceRef.current === source) {
            audioSourceRef.current = null;
          }
        };

        audioSourceRef.current = source;
        source.start();
        setIsSpeaking(true);
      } catch (err) {
        console.error("[GuideChatModal] AudioContext decode/play error:", err);
        setIsSpeaking(false);
      } finally {
        setIsSynthesizing(false);
      }
    },
    [ensureAudioContext, stopSpeech],
  );

  // ─── Gemini 送信 ──────────────────────────────────────────

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
            console.log("[GuideChatModal] reply_text:", JSON.stringify(reply), "emotion:", result.response.emotion);
            // reply_text が空の場合はエラーバブルにフォールバック
            if (!reply || reply.trim() === "") {
              console.error("[GuideChatModal] reply_text is empty — Gemini may not be following the JSON schema");
              setMessages((prev) => [
                ...prev,
                {
                  role: "error" as const,
                  text: "うまくおへんじできなかったよ。もういちどためしてみて！",
                  errorDetail: "[empty reply_text] Geminiは成功レスポンスを返したが reply_text が空文字でした。\nDocker logs で '[geminiGenerateObject] raw text:' を確認してください。",
                },
              ]);
              return;
            }
            setMessages((prev) => [
              ...prev,
              {
                role: "animal",
                text: reply,
                emotion: result.response.emotion,
              },
            ]);
            void speak(reply);
          } else {
            // Server Action が分類したエラーを表示
            console.error(
              "[GuideChatModal] chatWithAnimal failed",
              "\n  error:", result.error,
              "\n  errorDetail:", result.errorDetail,
            );
            setMessages((prev) => [
              ...prev,
              {
                role: "error",
                text: result.error,
                errorDetail: result.errorDetail,
              },
            ]);
            void speak("ごめんね、うまく きけなかった...");
          }
        } catch (err) {
          // ネットワーク層など予期しない例外
          const detail =
            err instanceof Error
              ? err.name + ": " + err.message + "\n" + (err.stack ?? "")
              : String(err);
          console.error("[GuideChatModal] chatWithAnimal threw:", err);
          setMessages((prev) => [
            ...prev,
            {
              role: "error",
              text: "よみこめないエラーが でたよ",
              errorDetail: "[クライアント例外]\n" + detail,
            },
          ]);
          void speak("ごめんね、よみこめないエラーが でたよ...");
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
      // モーダルが閉じられたら音声を即停止・AudioContext を解放
      try { audioSourceRef.current?.stop(); } catch { /* ignore */ }
      audioSourceRef.current = null;
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, []);

  // ─── マイクトグル ─────────────────────────────────────────

  const toggleMic = useCallback(() => {
    // マイク操作時に AudioContext を初期化（autoplay policy 解除）
    ensureAudioContext();

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
  }, [isListening, ensureAudioContext]);

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
            {/* アバター: 発話中はジャンプ、推論中・合成中はスケール */}
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
                  : isPending || isSynthesizing
                  ? { scale: [1, 1.12, 1] }
                  : { scale: 1, y: 0, rotate: 0 }
              }
              transition={
                isSpeaking
                  ? { repeat: Infinity, duration: 0.55, ease: "easeInOut" }
                  : isPending || isSynthesizing
                  ? { repeat: Infinity, duration: 0.8 }
                  : { duration: 0.2 }
              }
            >
              {isPending || isSynthesizing ? "💭" : animal.emoji}
              {!isPending && !isSynthesizing && (
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
              onClick={() => {
                stopSpeech();
                onClose();
              }}
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
              // ── エラーメッセージ ───────────────────────────
              if (msg.role === "error") {
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-1"
                  >
                    {/* 子ども向けフレンドリーメッセージ */}
                    <div
                      className="self-start px-4 py-2.5 rounded-2xl leading-relaxed"
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        background: "#FFF3E0",
                        color: "#E65100",
                        border: "2px solid #FFCC80",
                        borderBottomLeftRadius: 4,
                        maxWidth: "88%",
                      }}
                    >
                      {"⚠️ "}
                      {msg.text}
                    </div>

                    {/* 開発者向け errorDetail（コードボックス） */}
                    {msg.errorDetail && (
                      <div
                        className="self-start rounded-xl overflow-hidden"
                        style={{ maxWidth: "95%" }}
                      >
                        <div
                          style={{
                            background: "#B71C1C",
                            color: "#FFCDD2",
                            fontSize: "0.6rem",
                            fontWeight: 800,
                            padding: "3px 10px",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {"🛠 DEBUG INFO"}
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            padding: "8px 10px",
                            background: "#1C1C1E",
                            color: "#FF6B6B",
                            fontSize: "0.6rem",
                            fontFamily:
                              "'Fira Code','Courier New',monospace",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            lineHeight: 1.6,
                          }}
                        >
                          {msg.errorDetail}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                );
              }

              // ── 通常メッセージ（user / animal） ──────────
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
                  ensureAudioContext();
                  sendMessage(phrase);
                }}
                disabled={isPending || isListening || isSynthesizing}
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
                : isSynthesizing
                ? "🔄 こえを つくってるよ..."
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

              {/* 合成中スピナー */}
              {isSynthesizing && !isListening && (
                <motion.div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: 80,
                    height: 80,
                    border: "3px solid #FF9800",
                  }}
                  animate={{ scale: [1, 1.6], opacity: [0.8, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.0,
                    ease: "easeOut",
                  }}
                />
              )}

              {/* マイクボタン本体 */}
              <motion.button
                onClick={toggleMic}
                disabled={isPending || isSynthesizing}
                className="relative z-10 flex items-center justify-center rounded-full select-none"
                style={{
                  width: 80,
                  height: 80,
                  background: isListening
                    ? "linear-gradient(135deg, #F44336, #B71C1C)"
                    : isSynthesizing
                    ? "linear-gradient(135deg, #FF9800, #E65100)"
                    : "linear-gradient(135deg, #4CAF50, #1B5E20)",
                  border: isListening
                    ? "4px solid #B71C1C"
                    : isSynthesizing
                    ? "4px solid #E65100"
                    : "4px solid #1B5E20",
                  fontSize: "2rem",
                  boxShadow: isListening
                    ? "0 8px 0 #7F0000, 0 12px 28px rgba(244,67,54,0.4)"
                    : isSynthesizing
                    ? "0 8px 0 #BF360C, 0 12px 28px rgba(255,152,0,0.4)"
                    : "0 8px 0 #1B5E20, 0 12px 28px rgba(76,175,80,0.4)",
                  cursor: isPending || isSynthesizing ? "not-allowed" : "pointer",
                  opacity: isPending || isSynthesizing ? 0.7 : 1,
                }}
                animate={isListening ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                transition={
                  isListening
                    ? { repeat: Infinity, duration: 0.8 }
                    : { duration: 0.15 }
                }
                whileTap={{ scale: 0.88, y: 5 }}
              >
                {isListening ? "⏹" : isSynthesizing ? "🔄" : "🎤"}
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
