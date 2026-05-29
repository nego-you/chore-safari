"use client";

// /kids/[kidId]/quiz — 早押しクイズ
// 正解すると +20 コイン（useSafariStore.addCoins + /api/coins POST）
// 読み上げは VOICEVOX「四国めたん」(speaker=2) を使用。
// VOICEVOX が利用できない場合は Web Speech API にフォールバック。

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Trophy, AlertCircle, Volume2, VolumeX,
  Zap, Eye, EyeOff, Mic,
} from "lucide-react";
import { useSafariStore } from "@/store/useSafariStore";

// ── 定数 ─────────────────────────────────────────────────────────────────
const QUIZ_REWARD    = 20;
const PHRASE_INTERVAL = 1600;
const HINT_TIMINGS   = [6, 12];

// VOICEVOX 四国めたん (2)
const VOICEVOX_URL     = "http://localhost:50021";
const VOICEVOX_SPEAKER = 2;

// ── 型 ───────────────────────────────────────────────────────────────────
type Kid = { id: string; name: string; coinBalance: number };
type Props = { initialKidId: string | null; kids: Kid[] };

const GENRES = [
  { id: "pokemon",   label: "ポケモン",     emoji: "⚡" },
  { id: "animals",   label: "どうぶつ",     emoji: "🐘" },
  { id: "food",      label: "たべもの",     emoji: "🍎" },
  { id: "vehicles",  label: "のりもの",     emoji: "🚂" },
  { id: "character", label: "キャラクター", emoji: "🦸" },
  { id: "kids",      label: "こどもクイズ", emoji: "🌟" },
];

const DIFFICULTIES = [
  { id: "easy",   label: "やさしい",   emoji: "🌱" },
  { id: "normal", label: "ふつう",     emoji: "⭐" },
  { id: "hard",   label: "むずかしい", emoji: "🔥" },
];

// ── VOICEVOX TTS ──────────────────────────────────────────────────────────
async function speakVoicevox(text: string): Promise<void> {
  try {
    // 音声合成クエリを作成
    const qRes = await fetch(
      `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${VOICEVOX_SPEAKER}`,
      { method: "POST" },
    );
    if (!qRes.ok) throw new Error("query failed");
    const query = await qRes.json();

    // スピードを少し上げて子ども向けに調整
    query.speedScale   = 1.1;
    query.pitchScale   = 0.04;
    query.volumeScale  = 1.0;

    // 音声合成
    const sRes = await fetch(
      `${VOICEVOX_URL}/synthesis?speaker=${VOICEVOX_SPEAKER}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      },
    );
    if (!sRes.ok) throw new Error("synthesis failed");

    const blob = await sRes.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch {
    // VOICEVOX が起動していない場合は Web Speech API にフォールバック
    speakFallback(text);
  }
}

function speakFallback(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP"; u.pitch = 1.2; u.rate = 0.88; u.volume = 1;
  window.speechSynthesis.speak(u);
}

function cancelSpeech() {
  window.speechSynthesis?.cancel();
  // Audio 要素は onended で自動解放されるため特別な処理不要
}

// ── Gemini API（サーバールート経由） ─────────────────────────────────────
async function fetchQuestion(genreLabel: string, usedQuestions: string[], difficulty: string) {
  const res = await fetch("/api/quiz/hayaoshi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ genre: genreLabel, usedQuestions, difficulty }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err?.error || `APIエラー: ${res.status}`);
  }
  return res.json();
}

// ── あいまい答え合わせ ────────────────────────────────────────────────────
function checkAnswer(spoken: string, question: { answer: string; answerReading?: string }) {
  const n = (s: string) => s.toLowerCase().replace(/\s/g, "")
    .replace(/[ァ-ン]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const s = n(spoken), ans = n(question.answer), rd = n(question.answerReading || "");
  return s.includes(ans) || ans.includes(s) || (rd && (s.includes(rd) || rd.includes(s)));
}

// ── useSpeechRecognition ──────────────────────────────────────────────────
function useSpeechRecognition({ onResult }: { onResult: (t: string[]) => void }) {
  const recRef  = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const [listening,  setListening]  = useState(false);
  const [supported,  setSupported]  = useState(true);
  useEffect(() => {
    const SR = (window as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
            || (window as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.lang = "ja-JP"; rec.interimResults = false; rec.maxAlternatives = 3;
    rec.onresult = (e: SpeechRecognitionEvent) =>
      onResult(Array.from(e.results[0]).map((r: SpeechRecognitionAlternative) => r.transcript));
    rec.onend   = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const start = useCallback(() => {
    if (!recRef.current || listening) return;
    try { recRef.current.start(); setListening(true); } catch { /* already started */ }
  }, [listening]);
  const stop = useCallback(() => {
    if (!recRef.current || !listening) return;
    try { recRef.current.stop(); } catch { /* already stopped */ }
  }, [listening]);
  return { listening, supported, start, stop };
}

// ── PhraseDisplay ─────────────────────────────────────────────────────────
function PhraseDisplay({ phrases, active }: { phrases: string[]; active: boolean }) {
  const [shown, setShown] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setShown(1); }, [phrases]);
  useEffect(() => {
    if (!active || shown >= phrases.length) return;
    timerRef.current = setTimeout(() => setShown(s => s + 1), PHRASE_INTERVAL);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active, shown, phrases.length]);
  useEffect(() => { if (!active && timerRef.current) clearTimeout(timerRef.current); }, [active]);

  return (
    <div className="text-center min-h-20 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 px-2 py-2">
      {phrases.map((phrase: string, i: number) => (
        i < shown ? (
          <motion.span key={i}
            initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`font-bold text-xl leading-relaxed ${i === shown - 1 ? "text-white" : "text-white/55"}`}>
            {phrase}
          </motion.span>
        ) : (
          <span key={i} className="text-white/15 font-black text-2xl">・・・</span>
        )
      ))}
    </div>
  );
}

// ── HintTimer ─────────────────────────────────────────────────────────────
function HintTimer({ active, hints, stopped }: { active: boolean; hints: string[]; stopped: boolean }) {
  const [elapsed,    setElapsed]    = useState(0);
  const [shownHints, setShownHints] = useState<number[]>([]);
  const startRef = useRef(Date.now());
  useEffect(() => { setElapsed(0); setShownHints([]); startRef.current = Date.now(); }, [hints]);
  useEffect(() => {
    if (!active || stopped) return;
    const iv = setInterval(() => {
      const e = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(e);
      HINT_TIMINGS.forEach((t, idx) => {
        if (e >= t && hints[idx]) setShownHints(p => p.includes(idx) ? p : [...p, idx]);
      });
    }, 500);
    return () => clearInterval(iv);
  }, [active, stopped, hints]);

  return (
    <div className="space-y-2 mt-2">
      {active && !stopped && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full"
              style={{
                background: elapsed < 6 ? "#10b981" : elapsed < 12 ? "#f59e0b" : "#ef4444",
                width: `${Math.min((elapsed / 20) * 100, 100)}%`,
              }}
              transition={{ duration: 0.5 }} />
          </div>
          <span className="text-white/40 text-xs font-bold tabular-nums w-6 text-right">{elapsed}s</span>
        </div>
      )}
      <AnimatePresence>
        {shownHints.map(idx => (
          <motion.div key={idx}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            className={`rounded-xl px-4 py-2 text-sm font-bold border flex items-start gap-2 ${
              idx === 0
                ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-200"
                : "bg-orange-500/15 border-orange-500/30 text-orange-200"
            }`}>
            <span className="flex-shrink-0">{idx === 0 ? "💡" : "🔥"}</span>
            <span><span className="opacity-50 text-xs mr-1">Lv{idx + 1}</span>{hints[idx]}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── KanjiCross ────────────────────────────────────────────────────────────
function KanjiCross({ q }: { q: { top: string; bottom: string; left: string; right: string } }) {
  const C = "w-14 h-14 flex items-center justify-center rounded-xl text-3xl font-black text-white shadow-lg";
  return (
    <div className="flex flex-col items-center gap-2 my-3">
      <div className={C} style={{ background: "#6366f1" }}>{q.top}</div>
      <div className="flex gap-2 items-center">
        <div className={C} style={{ background: "#ec4899" }}>{q.left}</div>
        <motion.div className={C + " text-4xl"} style={{ background: "#1e293b", border: "3px solid #f59e0b" }}
          animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>？</motion.div>
        <div className={C} style={{ background: "#10b981" }}>{q.right}</div>
      </div>
      <div className={C} style={{ background: "#f59e0b" }}>{q.bottom}</div>
    </div>
  );
}

// ── LogicSequence ─────────────────────────────────────────────────────────
function LogicSequence({ items }: { items: string[] }) {
  return (
    <div className="flex items-center gap-2 my-3 flex-wrap justify-center">
      {items.map((item: string, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <motion.div
            className="w-14 h-14 flex items-center justify-center rounded-xl text-2xl font-black shadow-lg"
            style={{
              background: item === "?" ? "#1e293b" : "#334155",
              border: item === "?" ? "3px solid #f59e0b" : "none",
              color: "#fff",
            }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12 }}>
            {item === "?" ? (
              <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>？</motion.span>
            ) : item}
          </motion.div>
          {i < items.length - 1 && <span className="text-slate-400 text-xl">→</span>}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export function QuizClient({ initialKidId, kids }: Props) {
  // ── Store ──────────────────────────────────────────────────────────────
  const addCoins   = useSafariStore((s) => s.addCoins);
  const syncCoins  = useSafariStore((s) => s.syncCoins);
  const storeCoins = useSafariStore((s) => s.coins);

  // ── 子供特定（URL の kidId 固定。選択UIは不要） ────────────────────────
  const selectedKid = kids.find(k => k.id === initialKidId) ?? kids[0] ?? null;
  const portalHref = `/kids/${selectedKid?.id ?? ""}`;

  // ── ストア初期化 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedKid) syncCoins(selectedKid.coinBalance);
  }, [selectedKid, syncCoins]);

  // ── クイズ状態 ─────────────────────────────────────────────────────────
  const [genre, setGenre]             = useState(GENRES[0]);
  const [difficulty, setDifficulty]   = useState(DIFFICULTIES[0]);
  const [currentQ, setCurrentQ]       = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [phraseActive, setPhraseActive] = useState(false);
  const [answered, setAnswered]       = useState(false);
  const [correct, setCorrect]         = useState<boolean | null>(null);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [used, setUsed]               = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [voiceResult, setVoiceResult] = useState("");
  const [voiceCorrect, setVoiceCorrect] = useState<boolean | null>(null);
  const [buzzing, setBuzzing]         = useState(false);
  const [showBuzzPopup, setShowBuzzPopup] = useState(false);
  const [coinAwarded, setCoinAwarded] = useState(false);

  // ── 音声認識 ───────────────────────────────────────────────────────────
  const { listening, supported: micSupported, start: startMic, stop: stopMic } =
    useSpeechRecognition({
      onResult: useCallback((transcripts: string[]) => {
        const best = transcripts[0] || "";
        setVoiceResult(best);
        if (currentQ) {
          const ok = transcripts.some(t => checkAnswer(t, currentQ as { answer: string; answerReading?: string }));
          setVoiceCorrect(ok);
          if (ok) setTimeout(() => doCorrect(), 700);
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [currentQ]),
    });

  // ── コイン付与 ─────────────────────────────────────────────────────────
  const awardCoins = useCallback(async () => {
    if (!selectedKid || coinAwarded) return;
    setCoinAwarded(true);
    addCoins(QUIZ_REWARD);
    try {
      const res = await fetch("/api/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedKid.id,
          amount: QUIZ_REWARD,
          reason: "早押しクイズ正解",
        }),
      });
      if (res.ok) {
        const data = await res.json() as { newCoinBalance?: number };
        if (data.newCoinBalance != null) syncCoins(data.newCoinBalance);
      }
    } catch {
      // ローカルストアへの加算は済んでいるので無視
    }
  }, [selectedKid, coinAwarded, addCoins, syncCoins]);

  // ── 正解処理 ───────────────────────────────────────────────────────────
  const doCorrect = useCallback(() => {
    setCorrect(true);
    setAnswered(true);
    setPhraseActive(false);
    setBuzzing(false);
    setShowBuzzPopup(false);
    setRevealAnswer(false);
    stopMic();
    awardCoins();
    speakVoicevox("せいかい！すごいね！");
  }, [stopMic, awardCoins]);

  const doWrong = () => {
    setCorrect(false);
    setAnswered(true);
    setPhraseActive(false);
    setBuzzing(false);
    setShowBuzzPopup(false);
    setRevealAnswer(false);
    stopMic();
    setVoiceResult(""); setVoiceCorrect(null);
    speakVoicevox("ざんねん！またちょうせんしてね！");
  };

  // ── 早押し ─────────────────────────────────────────────────────────────
  const handleBuzz = () => {
    if (buzzing || !currentQ || answered) return;
    cancelSpeech();
    setIsSpeaking(false);
    setPhraseActive(false);
    setBuzzing(true);
    setShowBuzzPopup(true);
    setVoiceResult(""); setVoiceCorrect(null);
    // 「はやおし！」の演出は一瞬だけ表示し、すぐに司会者ボタン＆マイク欄を出す
    setTimeout(() => setShowBuzzPopup(false), 1100);
    // マイクは使える環境でだけバックグラウンドで起動（失敗しても司会者ボタンで進める）
    setTimeout(() => startMic(), 400);
    speakVoicevox("はやおし！");
  };

  // ── 問題生成 ───────────────────────────────────────────────────────────
  const generateQ = async () => {
    if (loading) return;
    setLoading(true); setError("");
    setBuzzing(false); setShowBuzzPopup(false); setAnswered(false); setCorrect(null);
    setRevealAnswer(false); setPhraseActive(false);
    setVoiceResult(""); setVoiceCorrect(null); setCoinAwarded(false);
    cancelSpeech(); stopMic();
    try {
      const q = await fetchQuestion(genre.label, used, difficulty.id);
      if (!q.phrases || !q.phrases.length) q.phrases = [q.question || "問題"];
      setCurrentQ(q);
      setUsed(u => [...u, (q.phrases as string[]).join("")]);
      await speakVoicevox((q.phrases as string[]).join(""));
      setIsSpeaking(true);
      setPhraseActive(true);
      const chk = setInterval(() => {
        if (!window.speechSynthesis?.speaking) { setIsSpeaking(false); clearInterval(chk); }
      }, 300);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── レンダリング ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">

      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <Link href={portalHref}
          className="text-white/60 hover:text-white text-sm font-bold px-3 py-1.5 bg-white/10 rounded-xl">
          ← もどる
        </Link>
        <h1 className="text-white font-black text-xl tracking-tight">🎯 はやおしクイズ</h1>
        {/* コイン残高 */}
        <div className="flex items-center gap-1 bg-yellow-400/20 rounded-xl px-3 py-1.5">
          <span className="text-lg">🪙</span>
          <span className="text-yellow-300 font-black text-sm tabular-nums">{storeCoins}</span>
        </div>
      </div>


      {/* ジャンル選択 */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {GENRES.map(g => (
            <button key={g.id}
              onClick={() => { setGenre(g); setCurrentQ(null); setAnswered(false); setCorrect(null); setUsed([]); }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                genre.id === g.id
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/40"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              }`}>
              <span>{g.emoji}</span><span>{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 難易度選択 */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs font-bold flex-shrink-0">むずかしさ</span>
          <div className="flex gap-2 flex-1">
            {DIFFICULTIES.map(d => (
              <button key={d.id}
                onClick={() => { setDifficulty(d); setCurrentQ(null); setAnswered(false); setCorrect(null); setUsed([]); }}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-sm font-bold transition-all ${
                  difficulty.id === d.id
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/40"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}>
                <span>{d.emoji}</span><span>{d.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2">
        <AnimatePresence mode="wait">

          {/* 待機 */}
          {!currentQ && !loading && (
            <motion.div key="idle" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center">
              <motion.div className="text-8xl mb-5"
                animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}>
                {genre.emoji}
              </motion.div>
              <p className="text-white/50 font-bold text-lg">「つぎのもんだい」を<br />おしてスタート！</p>
              <p className="text-yellow-300/60 text-sm font-bold mt-3">
                🪙 せいかいすると {QUIZ_REWARD}コインもらえるよ！
              </p>
            </motion.div>
          )}

          {/* 生成中 */}
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="text-6xl mb-4">⚡</motion.div>
              <p className="text-indigo-300 font-bold text-lg">もんだいをつくってるよ…</p>
            </motion.div>
          )}

          {/* 問題 */}
          {currentQ && !loading && (
            <motion.div key={JSON.stringify(currentQ)} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} className="w-full max-w-lg">

              {/* 問題カード */}
              <div className="bg-white/10 rounded-3xl p-5 border border-white/20 shadow-2xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-300">
                    {currentQ.type === "kanji_cross" ? "🈶 かんじ" : currentQ.type === "logic_sequence" ? "🔢 ならび" : `${genre.emoji} ${genre.label}`}
                  </span>
                  <div className="flex gap-1">
                    {isSpeaking
                      ? <button onClick={() => { cancelSpeech(); setIsSpeaking(false); }}
                          className="bg-white/10 rounded-xl p-1.5 text-white/50 hover:text-white"><VolumeX size={16} /></button>
                      : <button onClick={() => { speakVoicevox((currentQ.phrases as string[]).join("")); setIsSpeaking(true); }}
                          className="bg-white/10 rounded-xl p-1.5 text-white/50 hover:text-white"><Volume2 size={16} /></button>
                    }
                  </div>
                </div>

                {currentQ.type === "kanji_cross" && (
                  <KanjiCross q={currentQ as { top: string; bottom: string; left: string; right: string }} />
                )}
                {currentQ.type === "logic_sequence" && (
                  <LogicSequence items={currentQ.items as string[]} />
                )}

                <PhraseDisplay phrases={currentQ.phrases as string[]} active={phraseActive && !buzzing} />

                <HintTimer
                  active={!!currentQ && !answered}
                  hints={[currentQ.hint1 as string, currentQ.hint2 as string]}
                  stopped={buzzing}
                />

                {/* 司会者：答え確認 */}
                {!answered && (
                  <div className="mt-3 flex justify-center">
                    <button onClick={() => setRevealAnswer(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/8 hover:bg-white/15 rounded-xl text-white/40 hover:text-white/70 text-xs font-bold transition-all border border-white/10">
                      {revealAnswer ? <><EyeOff size={12} />かくす</> : <><Eye size={12} />こたえをみる（しかいしゃ）</>}
                    </button>
                  </div>
                )}
                <AnimatePresence>
                  {revealAnswer && !answered && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-2 bg-slate-800/80 border border-white/10 rounded-xl px-4 py-3 text-center">
                      <p className="text-white/30 text-xs mb-0.5">しかいしゃのみ</p>
                      <p className="text-white font-black text-2xl">{currentQ.answer as string}</p>
                      {/* 答えを見た状態からも正解・不正解にできる */}
                      <div className="flex gap-2 mt-3">
                        <motion.button whileTap={{ scale: 0.95 }} onClick={doCorrect}
                          className="flex-1 py-2.5 bg-green-500 rounded-xl text-white font-black text-base shadow-lg shadow-green-500/40">
                          ✅ せいかいにする
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={doWrong}
                          className="flex-1 py-2.5 bg-red-500/80 rounded-xl text-white font-black text-base shadow-lg shadow-red-500/30">
                          ❌ ちがう
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 結果表示 */}
                <AnimatePresence>
                  {answered && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      className={`mt-4 rounded-2xl px-4 py-4 text-center border ${
                        correct
                          ? "bg-green-500/20 border-green-500/40"
                          : "bg-red-500/15 border-red-500/30"
                      }`}>
                      <p className="text-4xl mb-1">{correct ? "🎉" : "😢"}</p>
                      <p className={`text-sm font-bold mb-1 ${correct ? "text-green-300" : "text-red-300"}`}>
                        {correct ? "せいかい！！" : "ざんねん…"}
                      </p>
                      <p className="text-white font-black text-2xl">{currentQ.answer as string}</p>
                      {correct && (
                        <motion.p
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="text-yellow-300 font-black text-lg mt-2">
                          🪙 +{QUIZ_REWARD} コイン！
                        </motion.p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 音声認識フィードバック */}
              <AnimatePresence>
                {buzzing && micSupported && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-3 rounded-2xl px-4 py-3 border flex flex-col items-center gap-1.5"
                    style={{
                      background: voiceCorrect === true ? "rgba(34,197,94,0.15)" : voiceCorrect === false ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.08)",
                      borderColor: voiceCorrect === true ? "rgba(34,197,94,0.4)" : voiceCorrect === false ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.15)",
                    }}>
                    <div className="flex items-center gap-2">
                      {listening
                        ? <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.65 }} className="w-3 h-3 rounded-full bg-red-500" />
                        : <div className="w-3 h-3 rounded-full bg-white/20" />
                      }
                      <span className="text-white/70 text-sm font-bold">
                        {listening ? "🎤 こたえて！" : voiceResult ? "きこえたよ" : "🎤 こえか、したのボタンでこたえてね"}
                      </span>
                      {!listening && (
                        <button onClick={startMic} className="ml-1 px-3 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-white/60 text-xs font-bold transition-all">
                          <Mic size={12} className="inline mr-1" />もう一度
                        </button>
                      )}
                    </div>
                    {voiceResult && (
                      <p className="text-white font-bold">
                        「{voiceResult}」
                        {voiceCorrect === true  && <span className="text-green-400 ml-2">✅</span>}
                        {voiceCorrect === false && <span className="text-red-400 ml-2">❌</span>}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 正解/不正解ボタン（司会者用） */}
              {buzzing && !answered && (
                <div className="flex gap-2 mt-3">
                  <motion.button initial={{ scale: 0.85 }} animate={{ scale: 1 }} whileTap={{ scale: 0.95 }} onClick={doCorrect}
                    className="flex-1 py-3 bg-green-500 rounded-xl text-white font-black text-lg shadow-lg shadow-green-500/40">✅ せいかい！</motion.button>
                  <motion.button initial={{ scale: 0.85 }} animate={{ scale: 1 }} whileTap={{ scale: 0.95 }} onClick={doWrong}
                    className="flex-1 py-3 bg-red-500 rounded-xl text-white font-black text-lg shadow-lg shadow-red-500/40">❌ ちがう</motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl p-3 mt-3 max-w-lg w-full border border-red-500/20">
            <AlertCircle size={16} className="flex-shrink-0" />{error}
          </motion.div>
        )}
      </div>

      {/* 早押しボタン */}
      {currentQ && !answered && !buzzing && (
        <div className="px-4 pb-3">
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleBuzz}
            className="w-full py-6 rounded-3xl text-white font-black text-3xl shadow-2xl relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: "0 12px 40px rgba(99,102,241,0.5)" }}>
            <motion.div className="absolute inset-0 rounded-3xl"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2), transparent)" }} />
            <span className="relative z-10">⚡ おしてこたえる！</span>
          </motion.button>
        </div>
      )}

      {/* 次の問題ボタン */}
      <div className="px-4 pb-6">
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={generateQ} disabled={loading || (!!currentQ && !answered && !buzzing)}
          className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl disabled:opacity-30 transition-opacity">
          <Zap size={22} /> {loading ? "つくってるよ…" : "つぎのもんだい"}
        </motion.button>
      </div>

      {/* 早押しポップアップ（一瞬だけ表示してすぐ消える） */}
      <AnimatePresence>
        {showBuzzPopup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 pointer-events-none">
            <motion.div initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="rounded-3xl px-12 py-8 text-center"
              style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", boxShadow: "0 0 80px rgba(99,102,241,0.7)" }}>
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.55 }} className="text-6xl mb-3">⚡</motion.div>
              <p className="text-white font-black text-3xl drop-shadow-lg">はやおし！</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
