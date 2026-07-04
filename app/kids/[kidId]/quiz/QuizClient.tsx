"use client";

// /kids/[kidId]/quiz — 早押しクイズ（ゲームセンター方式）
// 1プレイ 20 コイン消費。正解で難易度別に 20/30/40 コイン獲得、不正解は没収。
//   （useSafariStore.addCoins + /api/coins POST。負の amount で消費）
// 読み上げは VOICEVOX「四国めたん」(speaker=2) を使用。
// VOICEVOX が利用できない場合は Web Speech API にフォールバック。

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Volume2, VolumeX,
  Zap, Eye, EyeOff, Mic,
} from "lucide-react";
import { useSafariStore } from "@/store/useSafariStore";

// ── 定数 ─────────────────────────────────────────────────────────────────
// ゲームセンター方式：1プレイ PLAY_COST コインを払って挑戦。
// 正解すると難易度に応じて REWARD_BY_DIFFICULTY コインが返ってくる。
// 不正解だと払ったコインは没収（返ってこない）。
const PLAY_COST      = 20;
const REWARD_BY_DIFFICULTY: Record<string, number> = { easy: 20, normal: 30, hard: 40 };
const PHRASE_GAP     = 250; // フレーズ読み上げ間の小さな間
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
// 現在再生中の VOICEVOX 音声（キャンセル用に保持）
let currentAudio: HTMLAudioElement | null = null;

// 読み上げて「最後まで終わる（またはキャンセルされる）」まで待つ。
// 文字の表示と音声を揃えるために使う。
function speakAndWait(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };

    (async () => {
      try {
        const qRes = await fetch(
          `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${VOICEVOX_SPEAKER}`,
          { method: "POST" },
        );
        if (!qRes.ok) throw new Error("query failed");
        const query = await qRes.json();
        query.speedScale  = 1.05;
        query.pitchScale  = 0.04;
        query.volumeScale = 1.0;

        const sRes = await fetch(
          `${VOICEVOX_URL}/synthesis?speaker=${VOICEVOX_SPEAKER}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) },
        );
        if (!sRes.ok) throw new Error("synthesis failed");

        const blob = await sRes.blob();
        const url  = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        const cleanup = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; };
        audio.onended = () => { cleanup(); finish(); };
        audio.onpause = () => { cleanup(); finish(); }; // キャンセル(pause)でも解決
        audio.onerror = () => { cleanup(); finish(); };
        await audio.play();
      } catch {
        // VOICEVOX が無ければ Web Speech にフォールバック
        if (!window.speechSynthesis) { finish(); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ja-JP"; u.pitch = 1.2; u.rate = 0.95; u.volume = 1;
        u.onend = () => finish();
        u.onerror = () => finish();
        window.speechSynthesis.speak(u);
      }
    })();
  });
}

// 待たずに読み上げる（短い掛け声などに使用）
function speakVoicevox(text: string): void {
  void speakAndWait(text);
}

function cancelSpeech() {
  window.speechSynthesis?.cancel();
  if (currentAudio) { try { currentAudio.pause(); } catch { /* noop */ } currentAudio = null; }
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
function useSpeechRecognition(
  { onResult, onInterim }: { onResult: (t: string[]) => void; onInterim?: (t: string) => void },
) {
  const recRef  = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  // コールバックは currentQ に依存して毎回作り直されるため、ref で常に最新を呼ぶ
  const onResultRef  = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  useEffect(() => { onResultRef.current  = onResult;  }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  const [listening,  setListening]  = useState(false);
  const [supported,  setSupported]  = useState(true);
  useEffect(() => {
    const SR = (window as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
            || (window as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    // interimResults=true で「聞き取り中の文字」をリアルタイム表示（マイクが動いている安心感）
    rec.lang = "ja-JP"; rec.interimResults = true; rec.maxAlternatives = 3;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const last = e.results[e.results.length - 1];
      if (last.isFinal) {
        onResultRef.current(Array.from(last).map((r: SpeechRecognitionAlternative) => r.transcript));
      } else {
        onInterimRef.current?.(last[0]?.transcript ?? "");
      }
    };
    rec.onend   = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const start = useCallback(() => {
    if (!recRef.current) return;
    try { recRef.current.start(); setListening(true); }
    catch { /* already started → 再開のため一度止めて再start */
      try { recRef.current.stop(); } catch { /* noop */ }
    }
  }, []);
  const stop = useCallback(() => {
    if (!recRef.current) return;
    try { recRef.current.stop(); } catch { /* already stopped */ }
  }, []);
  return { listening, supported, start, stop };
}

// ── PhraseDisplay ─────────────────────────────────────────────────────────
// shown は親（読み上げループ）から渡される。音声と文字を揃えて出すための制御。
function PhraseDisplay({ phrases, shown }: { phrases: string[]; shown: number }) {
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
  const [shownPhrases, setShownPhrases] = useState(0); // 読み上げに合わせて表示するフレーズ数
  const [answered, setAnswered]       = useState(false);
  const [correct, setCorrect]         = useState<boolean | null>(null);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [used, setUsed]               = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [voiceResult, setVoiceResult] = useState("");
  const [interimText, setInterimText] = useState("");      // 聞き取り中の途中テキスト
  const [voiceCorrect, setVoiceCorrect] = useState<boolean | null>(null);
  const [buzzing, setBuzzing]         = useState(false);
  const [showBuzzPopup, setShowBuzzPopup] = useState(false);
  const [coinAwarded, setCoinAwarded] = useState(false);
  const [hostRevealed, setHostRevealed] = useState(false); // 司会者ボタンで判定欄を展開したか
  const [earnedCoins, setEarnedCoins] = useState(0);        // 正解で実際に付与したコイン
  const [coinError, setCoinError]     = useState("");       // コイン不足など

  // 次の問題を事前に取得しておくキャッシュ（待ち時間を減らす）
  const prefetchRef = useRef<{ key: string; promise: Promise<Record<string, unknown> | null> } | null>(null);
  // 読み上げループの中断フラグ（早押し時に止める）
  const revealAbortRef = useRef(false);

  // ── 音声認識 ───────────────────────────────────────────────────────────
  const { listening, supported: micSupported, start: startMic, stop: stopMic } =
    useSpeechRecognition({
      onResult: useCallback((transcripts: string[]) => {
        const best = transcripts[0] || "";
        setVoiceResult(best);
        setInterimText("");
        if (currentQ && !answered) {
          const ok = transcripts.some(t => checkAnswer(t, currentQ as { answer: string; answerReading?: string }));
          setVoiceCorrect(ok);
          if (ok) {
            // 正解：自動で確定
            setTimeout(() => doCorrect(), 700);
          } else {
            // 間違い：終わらせず、もう一度きく（当たるまで挑戦できる）
            speakVoicevox("ちがうよ。もういちど！");
            setTimeout(() => {
              setVoiceResult(""); setVoiceCorrect(null);
              startMic();
            }, 1500);
          }
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [currentQ, answered]),
      onInterim: useCallback((t: string) => { setInterimText(t); }, []),
    });

  // ── コイン付与（正解時：難易度に応じて 20/30/40） ──────────────────────
  const awardCoins = useCallback(async () => {
    if (!selectedKid || coinAwarded) return;
    setCoinAwarded(true);
    const reward = REWARD_BY_DIFFICULTY[difficulty.id] ?? PLAY_COST;
    setEarnedCoins(reward);
    addCoins(reward);
    try {
      const res = await fetch("/api/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedKid.id,
          amount: reward,
          reason: `早押しクイズ正解（${difficulty.label}）`,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { newCoinBalance?: number };
        if (data.newCoinBalance != null) syncCoins(data.newCoinBalance);
      }
    } catch {
      // ローカルストアへの加算は済んでいるので無視
    }
  }, [selectedKid, coinAwarded, addCoins, syncCoins, difficulty]);

  // ── プレイ料金の徴収（問題開始時：20コイン消費） ───────────────────────
  // 残高不足なら false を返して開始を中止する。
  const chargePlayCost = useCallback(async (): Promise<boolean> => {
    if (!selectedKid) return false;
    if (storeCoins < PLAY_COST) {
      setCoinError(`コインがたりないよ！（のこり ${storeCoins} / ひつよう ${PLAY_COST}）`);
      return false;
    }
    setCoinError("");
    addCoins(-PLAY_COST); // ローカル即時反映
    try {
      const res = await fetch("/api/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedKid.id,
          amount: -PLAY_COST,
          reason: "早押しクイズ プレイ料金",
        }),
      });
      if (res.ok) {
        const data = await res.json() as { newCoinBalance?: number };
        if (data.newCoinBalance != null) syncCoins(data.newCoinBalance);
        return true;
      }
      // サーバー側で失敗（残高不足など）→ ローカル反映を巻き戻す
      const err = await res.json().catch(() => ({})) as { error?: string; coinBalance?: number };
      addCoins(PLAY_COST);
      if (err.coinBalance != null) syncCoins(err.coinBalance);
      setCoinError(err.error || "コインのしはらいにしっぱいしたよ");
      return false;
    } catch {
      // 通信失敗：ローカルは加算で戻し、楽観的にプレイ続行は避ける
      addCoins(PLAY_COST);
      setCoinError("つうしんエラーでプレイできなかったよ");
      return false;
    }
  }, [selectedKid, storeCoins, addCoins, syncCoins]);

  // ── 正解処理 ───────────────────────────────────────────────────────────
  const doCorrect = useCallback(() => {
    revealAbortRef.current = true;
    setCorrect(true);
    setAnswered(true);
    setIsSpeaking(false);
    setBuzzing(false);
    setShowBuzzPopup(false);
    setRevealAnswer(false);
    setHostRevealed(false);
    setInterimText("");
    cancelSpeech();
    stopMic();
    awardCoins();
    speakVoicevox("せいかい！すごいね！");
  }, [stopMic, awardCoins]);

  // 司会者が「ちがう」を押した時だけの「あきらめ＝終了」処理（コイン没収）
  const doWrong = useCallback(() => {
    revealAbortRef.current = true;
    setCorrect(false);
    setAnswered(true);
    setIsSpeaking(false);
    setBuzzing(false);
    setShowBuzzPopup(false);
    setRevealAnswer(false);
    setHostRevealed(false);
    setInterimText("");
    cancelSpeech();
    stopMic();
    speakVoicevox("ざんねん！コインはぼっしゅう！またちょうせんしてね！");
  }, [stopMic]);

  // ── 早押し ─────────────────────────────────────────────────────────────
  const handleBuzz = () => {
    if (buzzing || !currentQ || answered) return;
    // 読み上げを止めて、問題文は全部見せる
    revealAbortRef.current = true;
    cancelSpeech();
    setIsSpeaking(false);
    setShownPhrases((currentQ.phrases as string[]).length);
    setBuzzing(true);
    setHostRevealed(false);
    setShowBuzzPopup(true);
    setVoiceResult(""); setVoiceCorrect(null); setInterimText("");
    // 「はやおし！」は一瞬だけ。すぐに大きなマイク表示へ切り替える
    setTimeout(() => setShowBuzzPopup(false), 650);
    // マイク起動（少し待ってから＝掛け声と被らないように）
    setTimeout(() => startMic(), 700);
  };

  // ── 問題の読み上げ：1フレーズずつ「声」と「文字」を揃えて出す ───────────
  const playQuestion = useCallback(async (phrases: string[]) => {
    revealAbortRef.current = false;
    setIsSpeaking(true);
    setShownPhrases(0);
    for (let i = 0; i < phrases.length; i++) {
      if (revealAbortRef.current) break;
      setShownPhrases(i + 1);          // 文字を出す
      await speakAndWait(phrases[i]);  // 同時に読み上げ、終わるまで待つ
      if (revealAbortRef.current) break;
      if (i < phrases.length - 1) await new Promise(r => setTimeout(r, PHRASE_GAP));
    }
    if (!revealAbortRef.current) setShownPhrases(phrases.length);
    setIsSpeaking(false);
  }, []);

  // ── 次の問題を先読み（コインは消費しない。表示時に使い回す） ────────────
  const prefetchNext = useCallback((curUsed: string[]) => {
    const key = `${genre.id}|${difficulty.id}`;
    prefetchRef.current = {
      key,
      promise: fetchQuestion(genre.label, curUsed, difficulty.id)
        .then((q) => {
          if (!q.phrases || !(q.phrases as string[]).length) q.phrases = [(q.question as string) || "問題"];
          return q as Record<string, unknown>;
        })
        .catch(() => null),
    };
  }, [genre, difficulty]);

  // ジャンル・難易度が決まったら先に1問用意しておく（最初の表示も速くする）
  useEffect(() => {
    const key = `${genre.id}|${difficulty.id}`;
    if (!prefetchRef.current || prefetchRef.current.key !== key) prefetchNext([]);
  }, [genre, difficulty, prefetchNext]);

  // ── 問題生成 ───────────────────────────────────────────────────────────
  const generateQ = async () => {
    if (loading) return;
    // ゲームセンター方式：まず 20 コインを払う。足りなければ開始しない。
    const paid = await chargePlayCost();
    if (!paid) return;

    setLoading(true); setError("");
    revealAbortRef.current = true; // 前の読み上げが残っていたら止める
    setBuzzing(false); setShowBuzzPopup(false); setAnswered(false); setCorrect(null);
    setRevealAnswer(false); setShownPhrases(0); setHostRevealed(false);
    setVoiceResult(""); setInterimText(""); setVoiceCorrect(null); setCoinAwarded(false); setEarnedCoins(0);
    cancelSpeech(); stopMic();
    try {
      // 先読み済みがあれば即使う（待ち時間ゼロ）。なければその場で取得。
      const key = `${genre.id}|${difficulty.id}`;
      let q: Record<string, unknown> | null = null;
      if (prefetchRef.current && prefetchRef.current.key === key) {
        q = await prefetchRef.current.promise;
        prefetchRef.current = null;
      }
      if (!q) q = await fetchQuestion(genre.label, used, difficulty.id);
      if (!q) { setError("問題の取得に しっぱいしたよ。もういちど ためしてね"); setLoading(false); return; }
      if (!q.phrases || !(q.phrases as string[]).length) q.phrases = [(q.question as string) || "問題"];
      const phrases = q.phrases as string[];
      const newUsed = [...used, phrases.join("")];
      setUsed(newUsed);
      setCurrentQ(q);
      setLoading(false);
      // 声と文字を1フレーズずつ揃えて出す
      playQuestion(phrases);
      // 次の問題をバックグラウンドで先読みしておく
      prefetchNext(newUsed);
      return;
    } catch (e) {
      // 問題生成に失敗したらプレイ料金を返金する
      setError(e instanceof Error ? e.message : String(e));
      if (selectedKid) {
        addCoins(PLAY_COST);
        try {
          const res = await fetch("/api/coins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: selectedKid.id,
              amount: PLAY_COST,
              reason: "早押しクイズ プレイ料金 返金（問題生成失敗）",
            }),
          });
          if (res.ok) {
            const data = await res.json() as { newCoinBalance?: number };
            if (data.newCoinBalance != null) syncCoins(data.newCoinBalance);
          }
        } catch { /* ローカルは返金済み */ }
      }
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

      {/* 難易度選択（難易度ごとに もらえるコインが変わる） */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs font-bold flex-shrink-0">むずかしさ</span>
          <div className="flex gap-2 flex-1">
            {DIFFICULTIES.map(d => (
              <button key={d.id}
                onClick={() => { setDifficulty(d); setCurrentQ(null); setAnswered(false); setCorrect(null); setUsed([]); }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl text-sm font-bold transition-all ${
                  difficulty.id === d.id
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/40"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}>
                <span className="flex items-center gap-1"><span>{d.emoji}</span><span>{d.label}</span></span>
                <span className={`text-[10px] font-black tabular-nums ${difficulty.id === d.id ? "text-yellow-100" : "text-yellow-300/70"}`}>
                  🪙{REWARD_BY_DIFFICULTY[d.id]}
                </span>
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
              <p className="text-yellow-300/70 text-sm font-bold mt-3">
                🪙 1かい {PLAY_COST}コインつかうよ
              </p>
              <p className="text-yellow-300/60 text-xs font-bold mt-1">
                せいかいで {REWARD_BY_DIFFICULTY[difficulty.id]}コイン／ふせいかいはぼっしゅう！
              </p>
              {coinError && (
                <p className="text-red-300 text-sm font-bold mt-3 bg-red-500/15 rounded-xl px-3 py-2 inline-block">
                  {coinError}
                </p>
              )}
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
                      ? <button onClick={() => { revealAbortRef.current = true; cancelSpeech(); setIsSpeaking(false); setShownPhrases((currentQ.phrases as string[]).length); }}
                          className="bg-white/10 rounded-xl p-1.5 text-white/50 hover:text-white" aria-label="読み上げを止める"><VolumeX size={16} /></button>
                      : <button onClick={() => { if (!buzzing && !answered) playQuestion(currentQ.phrases as string[]); }}
                          className="bg-white/10 rounded-xl p-1.5 text-white/50 hover:text-white" aria-label="もう一度読む"><Volume2 size={16} /></button>
                    }
                  </div>
                </div>

                {currentQ.type === "kanji_cross" && (
                  <KanjiCross q={currentQ as { top: string; bottom: string; left: string; right: string }} />
                )}
                {currentQ.type === "logic_sequence" && (
                  <LogicSequence items={currentQ.items as string[]} />
                )}

                <PhraseDisplay phrases={currentQ.phrases as string[]} shown={shownPhrases} />

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
                      {correct ? (
                        <motion.p
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="text-yellow-300 font-black text-lg mt-2">
                          🪙 +{earnedCoins} コイン！
                        </motion.p>
                      ) : (
                        <motion.p
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="text-red-300/90 font-black text-sm mt-2">
                          🪙 {PLAY_COST}コインぼっしゅう…
                        </motion.p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 音声認識：大きく分かりやすいマイク表示 */}
              <AnimatePresence>
                {buzzing && !answered && micSupported && !showBuzzPopup && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-3 rounded-3xl px-4 py-5 border flex flex-col items-center gap-3"
                    style={{
                      background: voiceCorrect === true ? "rgba(34,197,94,0.16)" : voiceCorrect === false ? "rgba(239,68,68,0.12)" : "rgba(99,102,241,0.12)",
                      borderColor: voiceCorrect === true ? "rgba(34,197,94,0.45)" : voiceCorrect === false ? "rgba(239,68,68,0.4)" : "rgba(99,102,241,0.4)",
                    }}>
                    {/* 大きなマイクアイコン＋波紋 */}
                    <div className="relative flex items-center justify-center w-24 h-24">
                      {listening && [0, 1, 2].map(i => (
                        <motion.span key={i}
                          className="absolute rounded-full"
                          style={{ width: 64, height: 64, border: "3px solid rgba(99,102,241,0.55)" }}
                          initial={{ scale: 1, opacity: 0.7 }}
                          animate={{ scale: 2.1, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.5, ease: "easeOut" }} />
                      ))}
                      <motion.div
                        className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                        style={{ background: listening ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.18)" }}
                        animate={listening ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                        transition={{ repeat: Infinity, duration: 0.9 }}>
                        <Mic size={32} className="text-white" />
                      </motion.div>
                    </div>

                    <p className="text-white font-black text-xl text-center">
                      {voiceCorrect === true ? "せいかい！🎉"
                        : listening ? "きいてるよ！こえでこたえてね"
                        : "🎤 マイクの じゅんびちゅう…"}
                    </p>

                    {/* 聞き取り中／確定テキスト */}
                    {(interimText || voiceResult) && (
                      <p className="text-white/95 font-bold text-lg bg-black/25 rounded-xl px-4 py-1.5">
                        「{voiceResult || interimText}」
                        {voiceCorrect === true  && <span className="text-green-300 ml-2">✅</span>}
                        {voiceCorrect === false && <span className="text-red-300 ml-2">❌ もういちど！</span>}
                      </p>
                    )}

                    {!listening && voiceCorrect !== true && (
                      <button onClick={startMic}
                        className="px-5 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-white text-sm font-black transition-all">
                        <Mic size={14} className="inline mr-1" />もういちど はなす
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* マイクが使えない時の案内 */}
              {buzzing && !answered && !micSupported && (
                <p className="mt-3 text-center text-white/60 text-sm font-bold">
                  このブラウザは こえにんしき が つかえないみたい。したのボタンで はんていしてね
                </p>
              )}

              {/* 司会者用：手動で判定する（あきらめる時にも使える） */}
              {buzzing && !answered && !hostRevealed && (
                <button
                  onClick={() => setHostRevealed(true)}
                  className="w-full mt-3 py-2.5 rounded-xl text-white/70 hover:text-white text-sm font-bold flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                  しかいしゃが てどうで はんていする
                </button>
              )}

              {/* 正解/ギブアップ（司会者ボタンを押してから表示） */}
              {buzzing && !answered && hostRevealed && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 mt-3">
                  <motion.button initial={{ scale: 0.85 }} animate={{ scale: 1 }} whileTap={{ scale: 0.95 }} onClick={doCorrect}
                    className="flex-1 py-3 bg-green-500 rounded-xl text-white font-black text-lg shadow-lg shadow-green-500/40">✅ せいかい！</motion.button>
                  <motion.button initial={{ scale: 0.85 }} animate={{ scale: 1 }} whileTap={{ scale: 0.95 }} onClick={doWrong}
                    className="flex-1 py-3 bg-red-500/90 rounded-xl text-white font-black text-lg shadow-lg shadow-red-500/40">🏳️ ギブアップ</motion.button>
                </motion.div>
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
