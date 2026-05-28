"use client";

// カオスレース - 5レーン / ベットシステム / チャット型実況UI
// Phase: idle → running → finished
// ベット前：5匹ランダム選出 + オッズ表示 + 賭け額入力
// レース後：勝敗でServer Actionを呼び報酬/消費を確定。再走なし・ポータルのみ。

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { betOnRace, claimRaceReward } from "../../actions";
import { useSafariStore } from "@/store/useSafariStore";

// ─── 型定義 ───────────────────────────────────────────────────

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
type CharKey = "lane1" | "lane2" | "lane3" | "lane4" | "lane5";
type EventType = "normal" | "stop" | "backward" | "boost" | "winner" | "start";
type EffectState = "normal" | "pause" | "speed_up" | "speed_down" | "finish";
type Phase = "idle" | "running" | "finished";

type AnimalOption = {
  animalId: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  description: string;
  count: number;
};

type RaceLane = {
  key: CharKey;
  animal: AnimalOption;
  odds: number;
  trackGrad: string;
  avatarGrad: string;
};

type CommentEntry = {
  id: number;
  text: string;
  type: EventType;
};

// ─── 定数 ─────────────────────────────────────────────────────

const ALL_KEYS: CharKey[] = ["lane1", "lane2", "lane3", "lane4", "lane5"];
const TICK_MS = 80;
const BASE_SPEED = 7;
const MAX_BET = 100;
const MIN_ANIMALS = 5;

const LANE_THEMES = [
  { trackGrad: "from-sky-200/60 to-cyan-100/60",     avatarGrad: "from-sky-400 to-cyan-500" },
  { trackGrad: "from-yellow-200/60 to-pink-100/60",   avatarGrad: "from-yellow-400 to-pink-400" },
  { trackGrad: "from-teal-200/60 to-emerald-100/60",  avatarGrad: "from-teal-400 to-emerald-500" },
  { trackGrad: "from-violet-200/60 to-purple-100/60", avatarGrad: "from-violet-400 to-purple-500" },
  { trackGrad: "from-rose-200/60 to-red-100/60",      avatarGrad: "from-rose-400 to-red-500" },
];

// オッズのタネ（毎回シャッフル）
const ODDS_POOL = [1.5, 2.0, 2.5, 3.5, 5.0];

// ─── イベントテキスト ─────────────────────────────────────────

type Text1 = (n: string) => string;
type Text2 = (n: string, n2: string) => string;

const STOP_TEXTS: Text1[] = [
  n => `${n}が きゅうに たちどまった！ おはなの においを かいでるみたい 🌸`,
  n => `${n}が みちに おちてた ごはんを たべはじめた… 🍖`,
  n => `${n}が いねむりを はじめてしまった！ 💤 だいじょうぶ！？`,
  n => `${n}が しっぽを ながめて ぼーっとしている…`,
  n => `${n}が むしを みつけて かたまってしまった！ 🐛`,
  n => `${n}が あなを みつけて のぞきこんでいる… 🕳️`,
];

const BACKWARD_TEXTS: Text1[] = [
  n => `${n}が なんと うしろに もどってしまった！！ 🔄`,
  n => `${n}が わすれものを とりに かえってる！？`,
  n => `${n}が まちがえて ぎゃくほうこうに はしりだした！！`,
  n => `${n}が ライバルを ふりかえって ガンを とばしたら そのまま うしろへ…`,
  n => `${n}が うしろから へんな おとがして ビビって さがってる！`,
];

const BOOST_TEXTS: Text1[] = [
  n => `${n}が きゅうに ダッシュ！！ なにかに おどろいた！？ 💨`,
  n => `${n}の めに ほのおが ともった！！ すごい スピード 🔥`,
  n => `${n}が ロケットに なった！！ 🚀 はやすぎる！！`,
  n => `${n}が ライバルを みて ふんおこった！ めちゃくちゃ はやい！！`,
  n => `${n}に かぜの せいれいが とりついた！！ とんでる とんでる！`,
  n => `${n}が ターボを きどうした！！ 💥 あっというまに まえへ！`,
  n => `${n}が むてきモードに はいった！！ だれも とめられない！！`,
];

const NORMAL_TEXTS_1: Text1[] = [
  n => `${n}が いいかんじで すすんでいる！`,
  n => `${n}が ぐんぐん まえに すすむ！`,
  n => `${n}は まだまだ げんきそうだ！`,
  n => `${n}の フォームが きれい！`,
];

const NORMAL_TEXTS_2: Text2[] = [
  (n, n2) => `${n}が ${n2}を おいかけている！`,
  (n, n2) => `${n}と ${n2}が ならんできた！ はくちゅう！`,
  (n, n2) => `${n}が ${n2}に せまってきた！`,
];

const GOAL_TEXTS: Text1[] = [
  n => `🏆 ゴーーール！！ 1い は ${n} だー！！`,
  n => `🎉 やったー！ ${n} が ゴール！！ すごい！！`,
  n => `✨ ${n} が 1いに かけこんだ！！ かっこよすぎる！！`,
  n => `🏁 ${n} の かちーーー！！ ものすごい はしりっぷりだった！！`,
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Framer Motion バリアント ──────────────────────────────────

const pulseAnim = {
  scale: [1, 1.2, 0.95, 1.2, 1],
  transition: { duration: 0.5, repeat: Infinity, repeatType: "loop" as const },
};
const pauseAnim = {
  scale: 0.85,
  y: [0, -3, 0],
  transition: { duration: 1.2, repeat: Infinity, repeatType: "loop" as const },
};
const wobbleAnim = {
  x: [0, -4, 4, -4, 0],
  scale: 0.9,
  transition: { duration: 0.5, repeat: Infinity, repeatType: "loop" as const },
};

// ─── confetti ─────────────────────────────────────────────────

function fireConfetti() {
  const palette = ["#fda4af","#fcd34d","#a7f3d0","#bae6fd","#ddd6fe","#fbcfe8"];
  confetti({ particleCount: 200, spread: 120, startVelocity: 55, origin: { x: 0.5, y: 0.4 }, colors: palette, zIndex: 9999 });
  setTimeout(() => confetti({ particleCount: 100, angle: 60,  spread: 70, origin: { x: 0, y: 0.6 }, colors: palette, zIndex: 9999 }), 200);
  setTimeout(() => confetti({ particleCount: 100, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors: palette, zIndex: 9999 }), 400);
}

// ─── Props ────────────────────────────────────────────────────

type Props = {
  kidId: string;
  animals: AnimalOption[];
  coinBalance: number;
};

// ─── メインコンポーネント ─────────────────────────────────────

export function RacePlayer({ kidId, animals, coinBalance: initialCoinBalance }: Props) {
  const portalHref = `/kids/${kidId}`;
  const commentIdRef = useRef(0);
  const syncCoins = useSafariStore((s) => s.syncCoins);

  // ── ランダム5匹選出 ─────────────────────────────────────────
  const [lanes, setLanes] = useState<RaceLane[]>([]);
  useEffect(() => {
    const pool = animals.length >= MIN_ANIMALS
      ? shuffleArray(animals).slice(0, MIN_ANIMALS)
      : [...animals]; // 足りない場合はそのまま（エラー画面で処理）
    const oddsShuffled = shuffleArray(ODDS_POOL);
    setLanes(pool.map((a, i) => ({
      key: ALL_KEYS[i],
      animal: a,
      odds: oddsShuffled[i],
      ...LANE_THEMES[i],
    })));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ベット state ─────────────────────────────────────────────
  const [coinBalance, setCoinBalance] = useState(initialCoinBalance);
  const [betLaneKey, setBetLaneKey] = useState<CharKey | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [betError, setBetError] = useState<string | null>(null);
  const [isBetting, setIsBetting] = useState(false);

  const maxBet = Math.min(MAX_BET, Math.floor(coinBalance / 2));
  const betLane = lanes.find(l => l.key === betLaneKey) ?? null;
  const potentialReward = betLane ? Math.floor(betAmount * betLane.odds) : 0;

  // ── フェーズ＆表示 state ──────────────────────────────────
  const [phase, setPhase]           = useState<Phase>("idle");
  const [commentLog, setCommentLog] = useState<CommentEntry[]>([]);
  const [winnerKey, setWinnerKey]   = useState<CharKey | null>(null);
  const [wonBet, setWonBet]         = useState<boolean | null>(null);

  const [positions, setPositions] = useState<Record<CharKey, number>>({
    lane1: 0, lane2: 0, lane3: 0, lane4: 0, lane5: 0,
  });
  const [effects, setEffects] = useState<Record<CharKey, EffectState>>({
    lane1: "normal", lane2: "normal", lane3: "normal", lane4: "normal", lane5: "normal",
  });

  // ── ミュータブル ref ───────────────────────────────────────
  const posRef           = useRef<Record<CharKey, number>>({ lane1: 0, lane2: 0, lane3: 0, lane4: 0, lane5: 0 });
  const multRef          = useRef<Record<CharKey, number>>({ lane1: 1, lane2: 1, lane3: 1, lane4: 1, lane5: 1 });
  const elapsedRef       = useRef(0);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextEventRef     = useRef<Record<CharKey, number>>({ lane1: 0, lane2: 0, lane3: 0, lane4: 0, lane5: 0 });
  const finishedRef      = useRef(false);
  const commentScrollRef = useRef<HTMLDivElement | null>(null);
  const lanesRef         = useRef<RaceLane[]>([]);
  useEffect(() => { lanesRef.current = lanes; }, [lanes]);
  const betLaneKeyRef    = useRef<CharKey | null>(null);
  useEffect(() => { betLaneKeyRef.current = betLaneKey; }, [betLaneKey]);

  // ── コメント追加 ───────────────────────────────────────────
  const addComment = useCallback((text: string, type: EventType) => {
    const id = ++commentIdRef.current;
    setCommentLog(prev => {
      const next = [...prev, { id, text, type }];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
    requestAnimationFrame(() => {
      if (commentScrollRef.current) {
        commentScrollRef.current.scrollTop = commentScrollRef.current.scrollHeight;
      }
    });
  }, []);

  // ── イベントロール ─────────────────────────────────────────
  const rollEvent = useCallback((charKey: CharKey, elapsed: number) => {
    const currentLanes = lanesRef.current;
    const charName = currentLanes.find(l => l.key === charKey)?.animal.name ?? charKey;
    const otherLanes = currentLanes.filter(l => l.key !== charKey);
    const otherName = pickRandom(otherLanes)?.animal.name ?? "ライバル";

    const rand = Math.random();

    if (rand < 0.05) {
      multRef.current[charKey] = 0;
      setEffects(prev => ({ ...prev, [charKey]: "pause" }));
      nextEventRef.current[charKey] = elapsed + 1.2 + Math.random() * 1.8;
      addComment(pickRandom(STOP_TEXTS)(charName), "stop");

    } else if (rand < 0.10) {
      multRef.current[charKey] = -0.55;
      setEffects(prev => ({ ...prev, [charKey]: "speed_down" }));
      nextEventRef.current[charKey] = elapsed + 0.6 + Math.random() * 0.9;
      addComment(pickRandom(BACKWARD_TEXTS)(charName), "backward");

    } else if (rand < 0.25) {
      multRef.current[charKey] = 2.6 + Math.random() * 1.0;
      setEffects(prev => ({ ...prev, [charKey]: "speed_up" }));
      nextEventRef.current[charKey] = elapsed + 0.7 + Math.random() * 1.0;
      addComment(pickRandom(BOOST_TEXTS)(charName), "boost");

    } else {
      multRef.current[charKey] = 0.5 + Math.random() * 1.0;
      setEffects(prev => ({ ...prev, [charKey]: "normal" }));
      nextEventRef.current[charKey] = elapsed + 0.8 + Math.random() * 0.5;

      if (Math.random() < 0.25) {
        if (Math.random() < 0.5) {
          addComment(pickRandom(NORMAL_TEXTS_1)(charName), "normal");
        } else {
          addComment(pickRandom(NORMAL_TEXTS_2)(charName, otherName), "normal");
        }
      }
    }
  }, [addComment]);

  // ── レース終了 ────────────────────────────────────────────
  const finishRace = useCallback(async (wKey: CharKey) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);

    const currentLanes = lanesRef.current;
    const winnerAnimalName = currentLanes.find(l => l.key === wKey)?.animal.name ?? wKey;
    const winnerOdds = currentLanes.find(l => l.key === wKey)?.odds ?? 1;

    addComment(pickRandom(GOAL_TEXTS)(winnerAnimalName), "winner");
    fireConfetti();
    setTimeout(fireConfetti, 800);

    setWinnerKey(wKey);

    const bKey = betLaneKeyRef.current;
    const didWin = bKey !== null && bKey === wKey;
    setWonBet(didWin);

    if (didWin) {
      const reward = Math.floor(betAmount * winnerOdds);
      const res = await claimRaceReward(kidId, reward);
      if (res.success) {
        setCoinBalance(res.newCoinBalance);
        syncCoins(res.newCoinBalance);
      }
    }

    setPhase("finished");
  // betAmount / kidId are stable during a race — intentionally excluded to avoid re-creating
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addComment]);

  // ── インターバル開始 ──────────────────────────────────────
  const startInterval = useCallback(() => {
    elapsedRef.current = 0;
    posRef.current     = { lane1: 0, lane2: 0, lane3: 0, lane4: 0, lane5: 0 };
    multRef.current    = { lane1: 1, lane2: 1, lane3: 1, lane4: 1, lane5: 1 };
    nextEventRef.current = { lane1: 0.3, lane2: 0.5, lane3: 0.7, lane4: 0.9, lane5: 1.1 };
    finishedRef.current = false;

    intervalRef.current = setInterval(() => {
      const dt = TICK_MS / 1000;
      elapsedRef.current += dt;
      const elapsed = elapsedRef.current;
      const newPos = { ...posRef.current };

      for (const key of ALL_KEYS) {
        if (elapsed >= nextEventRef.current[key]) rollEvent(key, elapsed);
        const delta = BASE_SPEED * multRef.current[key] * dt;
        newPos[key] = Math.max(0, Math.min(100, newPos[key] + delta));
      }

      posRef.current = newPos;
      setPositions({ ...newPos });

      for (const key of ALL_KEYS) {
        if (newPos[key] >= 100 && !finishedRef.current) {
          void finishRace(key);
          return;
        }
      }
    }, TICK_MS);
  }, [rollEvent, finishRace]);

  // ── スタートハンドラ（ベット処理込み） ───────────────────
  const handleStart = useCallback(async () => {
    if (!betLaneKey) { setBetError("よそうする どうぶつを えらんでね！"); return; }
    if (betAmount < 10)  { setBetError("10コイン いじょう かけてね！"); return; }
    if (betAmount > maxBet) {
      setBetError(`さいだい ${maxBet}コイン まで だよ（もちコインの はんぶん or 100まい）`);
      return;
    }

    setBetError(null);
    setIsBetting(true);

    const res = await betOnRace(kidId, betAmount);
    if (!res.success) {
      setBetError(res.error);
      setIsBetting(false);
      return;
    }
    setCoinBalance(res.newCoinBalance);
    syncCoins(res.newCoinBalance);
    setIsBetting(false);

    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase("running");
    setCommentLog([]);
    setPositions({ lane1: 0, lane2: 0, lane3: 0, lane4: 0, lane5: 0 });
    setEffects({ lane1: "normal", lane2: "normal", lane3: "normal", lane4: "normal", lane5: "normal" });
    setWinnerKey(null);
    setWonBet(null);

    addComment("🏁 よーい… ドン！！", "start");
    startInterval();
  }, [betLaneKey, betAmount, maxBet, kidId, addComment, startInterval]);

  // クリーンアップ
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // ── 動物不足エラー画面 ────────────────────────────────────
  if (animals.length < MIN_ANIMALS) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-100 via-orange-100 to-amber-100 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-5xl">🔥🏟️🔥</p>
          <h1 className="text-2xl font-extrabold text-rose-700">レース きじょうへ ようこそ！</h1>
          <p className="rounded-3xl bg-white/80 p-6 text-sm text-rose-700 shadow ring-1 ring-rose-200">
            5レーンぶんの どうぶつが まだ たりません。<br />
            <Link className="font-bold underline" href={`/kids/${kidId}/safari`}>サファリ</Link> で あと <strong>{MIN_ANIMALS - animals.length}ひき</strong> つかまえてきてね！
          </p>
          <Link href={portalHref} className="inline-block rounded-full bg-white/90 px-5 py-2 text-sm font-bold text-rose-700 shadow ring-1 ring-rose-200">
            ← ポータルへ もどる
          </Link>
        </div>
      </main>
    );
  }

  // ─── 選択中のベットレーン情報（レース中表示用） ───────────
  const betLaneInfo = lanes.find(l => l.key === betLaneKey) ?? null;

  // ─────────────────────────────────────────────────────────
  return (
    <main className="h-screen overflow-hidden flex flex-col bg-gradient-to-b from-amber-900 via-orange-800 to-yellow-700 relative">

      {/* 背景装飾 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
        <span className="absolute top-2 left-4 text-5xl opacity-20">🌵</span>
        <span className="absolute top-4 right-8 text-6xl opacity-15">🦁</span>
        <span className="absolute top-8 left-1/4 text-4xl opacity-10">☀️</span>
        <span className="absolute top-12 right-1/3 text-5xl opacity-10">🌴</span>
        <span className="absolute bottom-24 left-6 text-4xl opacity-15">🌿</span>
        <span className="absolute bottom-20 right-4 text-5xl opacity-15">🦒</span>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-yellow-900/40" />
      </div>

      {/* ヘッダー */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2 z-10">
        <Link
          href={portalHref}
          className="rounded-full bg-white/20 backdrop-blur px-3 py-1.5 text-sm font-bold text-white shadow ring-1 ring-white/30 transition hover:bg-white/30 active:scale-95"
        >
          ← ポータルへ
        </Link>
        <p className="text-xs font-extrabold text-amber-200/80 tracking-widest">🏁 カオスレース 🏁</p>
        {/* コイン残高 */}
        <p className="rounded-full bg-white/20 px-3 py-1 text-xs font-black text-amber-200">
          🪙 {coinBalance.toLocaleString()}
        </p>
      </header>

      {/* レーストラック（5レーン） */}
      <section className="flex-1 flex flex-col justify-center px-3 gap-1 z-10 min-h-0" aria-label="レーストラック">
        {lanes.map((lane) => {
          const pos = positions[lane.key];
          const eff = effects[lane.key];

          return (
            <div
              key={lane.key}
              className={`relative rounded-2xl bg-gradient-to-r ${lane.trackGrad} backdrop-blur border border-white/30 overflow-hidden`}
              style={{ flex: "1 1 0", minHeight: 0, maxHeight: "5.5rem" }}
            >
              {/* ガイドライン */}
              <div className="absolute top-1/2 left-20 right-4 h-0.5 -translate-y-1/2 border-t-2 border-dashed border-white/30 pointer-events-none" />
              <div className="absolute left-14 top-0 bottom-0 w-0.5 bg-white/40" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xl pointer-events-none" aria-hidden>🏁</span>

              {/* 名前ラベル */}
              <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col items-center w-12 z-10">
                <span className="text-[9px] font-black text-white/90 drop-shadow leading-tight text-center truncate w-12">
                  {lane.animal.name}
                </span>
                {/* オッズバッジ（ベット前のみ） */}
                {phase === "idle" && (
                  <span className="mt-0.5 rounded-full bg-amber-400/90 px-1 py-0.5 text-[8px] font-black text-amber-900 leading-none">
                    {lane.odds.toFixed(1)}x
                  </span>
                )}
                {/* ベット中のハイライト */}
                {(phase === "running" || phase === "finished") && betLaneKey === lane.key && (
                  <span className="mt-0.5 rounded-full bg-rose-500 px-1 py-0.5 text-[8px] font-black text-white leading-none animate-pulse">
                    ★よそう
                  </span>
                )}
              </div>

              {/* アバター */}
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 z-20"
                style={{
                  left: `calc(3.5rem + (100% - 7rem) * (${pos} / 100))`,
                  transition: `left ${TICK_MS / 1000}s linear`,
                }}
              >
                <motion.div
                  animate={
                    eff === "speed_up"   ? pulseAnim :
                    eff === "pause"      ? pauseAnim :
                    eff === "speed_down" ? wobbleAnim :
                    eff === "finish"     ? { scale: [1, 1.4, 1], rotate: [0, 360], transition: { duration: 0.8 } } :
                    { x: 0, y: 0, rotate: 0, scale: 1, transition: { duration: 0.3 } }
                  }
                  className={`relative flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br ${lane.avatarGrad} shadow-lg ring-4 ring-white/60`}
                >
                  <span className="text-2xl leading-none" aria-hidden>{lane.animal.emoji}</span>
                  {eff === "speed_up"   && <span className="absolute -right-2 -top-2 text-lg animate-bounce" aria-hidden>🔥</span>}
                  {eff === "pause"      && <span className="absolute -right-2 -top-2 text-lg" aria-hidden>💤</span>}
                  {eff === "speed_down" && <span className="absolute -right-2 -top-2 text-base" aria-hidden>⬅️</span>}
                </motion.div>
              </motion.div>
            </div>
          );
        })}
      </section>

      {/* ベット情報バナー（レース中のみ） */}
      {phase === "running" && betLaneInfo && (
        <div className="shrink-0 mx-3 z-10">
          <div className="rounded-xl bg-rose-700/80 backdrop-blur border border-rose-400/40 px-3 py-1.5 flex items-center gap-2 flex-wrap shadow">
            <span className="text-lg">{betLaneInfo.animal.emoji}</span>
            <span className="text-xs font-black text-white">
              よそう：{betLaneInfo.animal.name} / {betAmount}コイン
            </span>
            <span className="text-amber-300 font-black text-xs">
              ➡️ あたれば {potentialReward}コイン！
            </span>
          </div>
        </div>
      )}

      {/* 実況ログ（3倍高・チャット型・イベント強調） */}
      <div className="shrink-0 mx-3 mb-2 mt-1 z-10">
        <div className="rounded-2xl bg-black/85 border border-amber-400/40 backdrop-blur px-4 py-3 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg" aria-hidden>🎙️</span>
            <span className="text-[10px] font-extrabold text-amber-300 tracking-widest uppercase">Live Commentary</span>
            {phase === "running" && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping inline-block" />
                LIVE
              </span>
            )}
          </div>

          {/* スクロールログ - 3倍高・フォント拡大 */}
          <div
            ref={commentScrollRef}
            className="h-36 overflow-y-auto space-y-1 pr-1"
            style={{ scrollBehavior: "smooth" }}
          >
            {commentLog.length === 0 && (
              <p className="text-white/40 text-sm font-bold">
                🎙️ したの かこみから よそうして スタートを おしてね！
              </p>
            )}
            {commentLog.map(entry => {
              const isStop     = entry.type === "stop";
              const isBackward = entry.type === "backward";
              const isBoost    = entry.type === "boost";
              const isWinner   = entry.type === "winner";
              const isStart    = entry.type === "start";

              return (
                <p
                  key={entry.id}
                  className={[
                    "leading-snug font-bold",
                    isWinner   ? "text-yellow-300 text-xl font-black" :
                    isBoost    ? "text-amber-300 text-base" :
                    isStop     ? "text-sky-300 text-base" :
                    isBackward ? "text-rose-400 text-base" :
                    isStart    ? "text-emerald-300 font-extrabold text-base" :
                    "text-white/80 text-sm",
                  ].join(" ")}
                  style={
                    isBoost    ? { textShadow: "0 0 8px #fbbf24, 0 1px 4px rgba(0,0,0,0.8)" } :
                    isStop     ? { textShadow: "0 0 8px #7dd3fc, 0 1px 4px rgba(0,0,0,0.8)" } :
                    isBackward ? { textShadow: "0 0 8px #f87171, 0 1px 4px rgba(0,0,0,0.8)" } :
                    isWinner   ? { textShadow: "0 0 12px #fde68a, 0 2px 6px rgba(0,0,0,0.9)" } :
                    undefined
                  }
                >
                  {entry.text}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ベット画面（スタート前） ── */}
      {phase === "idle" && (
        <div className="shrink-0 px-3 pb-3 z-10 space-y-2">
          {/* よそう選択 */}
          <div className="rounded-2xl bg-black/70 border border-amber-400/30 backdrop-blur px-3 py-2">
            <p className="text-[10px] font-extrabold text-amber-300 tracking-widest mb-2">🐾 どの どうぶつに かける？</p>
            <div className="grid grid-cols-5 gap-1">
              {lanes.map(lane => (
                <button
                  key={lane.key}
                  type="button"
                  onClick={() => { setBetLaneKey(lane.key); setBetError(null); }}
                  className={[
                    "rounded-xl p-1.5 flex flex-col items-center gap-0.5 transition active:scale-95 border-2",
                    betLaneKey === lane.key
                      ? "bg-amber-400/90 border-amber-200 shadow-lg scale-105"
                      : "bg-white/10 border-white/20 hover:bg-white/20",
                  ].join(" ")}
                >
                  <span className="text-2xl">{lane.animal.emoji}</span>
                  <span className="text-[8px] font-black text-white leading-tight text-center truncate w-full">
                    {lane.animal.name}
                  </span>
                  <span className={[
                    "text-[9px] font-black rounded-full px-1 leading-tight",
                    betLaneKey === lane.key ? "bg-amber-800 text-amber-100" : "bg-amber-400/80 text-amber-900",
                  ].join(" ")}>
                    {lane.odds.toFixed(1)}x
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* コイン入力（±10ステップボタン） */}
          <div className="flex gap-2 items-center">
            <div className="flex-1 rounded-xl bg-black/60 border border-amber-400/30 px-3 py-2 flex items-center gap-2">
              <span className="text-amber-300 font-black text-sm shrink-0">🪙 かける</span>

              {/* −10 */}
              <button
                type="button"
                onClick={() => setBetAmount(a => Math.max(10, a - 10))}
                disabled={betAmount <= 10}
                className="w-9 h-9 rounded-full bg-white/15 text-white font-black text-lg leading-none shadow transition active:scale-90 hover:bg-white/25 disabled:opacity-30"
              >
                −
              </button>

              {/* 現在値表示 */}
              <span className="w-14 text-center text-lg font-black text-white tabular-nums">
                {betAmount}
              </span>

              {/* +10 */}
              <button
                type="button"
                onClick={() => setBetAmount(a => Math.min(maxBet, a + 10))}
                disabled={betAmount >= maxBet}
                className="w-9 h-9 rounded-full bg-white/15 text-white font-black text-lg leading-none shadow transition active:scale-90 hover:bg-white/25 disabled:opacity-30"
              >
                ＋
              </button>

              <span className="text-amber-300 text-xs font-bold shrink-0">コイン</span>
              <span className="ml-auto text-[10px] text-amber-400/80 shrink-0">最大 {maxBet}</span>
            </div>
            {betLaneKey && (
              <div className="rounded-xl bg-emerald-800/70 border border-emerald-400/40 px-2 py-2 text-center shrink-0">
                <p className="text-[10px] text-emerald-300 font-bold">あたれば</p>
                <p className="text-sm font-black text-emerald-200">{potentialReward}<span className="text-[9px]">🪙</span></p>
              </div>
            )}
          </div>

          {/* エラー */}
          {betError && (
            <p className="rounded-xl bg-rose-700/80 px-3 py-1.5 text-xs font-bold text-white">
              ⚠️ {betError}
            </p>
          )}

          {/* スタートボタン */}
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={isBetting}
            className="w-full rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 py-3.5 text-xl font-black text-white shadow-2xl transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {isBetting ? "⏳ ベット中…" : "🔥 レーススタート！"}
          </button>
        </div>
      )}

      {/* ── 結果モーダル（再走ボタンなし・ポータルのみ） ── */}
      <AnimatePresence>
        {phase === "finished" && winnerKey !== null && wonBet !== null && (
          <motion.div
            key="result-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.5, y: 60 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 60 }}
              transition={{ type: "spring", damping: 14, stiffness: 200 }}
              className={`w-full max-w-sm rounded-[2.5rem] p-1 shadow-[0_30px_80px_rgba(0,0,0,0.5)] ${
                wonBet
                  ? "bg-gradient-to-br from-yellow-300 via-amber-300 to-orange-400"
                  : "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700"
              }`}
            >
              <div className={`rounded-[2.25rem] px-6 py-8 text-center ${wonBet ? "bg-white/95" : "bg-slate-800/95"}`}>

                {/* アイコン */}
                <div className="relative flex justify-center mb-3">
                  <motion.span
                    className="relative text-8xl drop-shadow-lg"
                    animate={wonBet
                      ? { rotate: [0, 10, -10, 10, 0] }
                      : { y: [0, -6, 0], opacity: [1, 0.6, 1] }
                    }
                    transition={{ duration: 2, repeat: Infinity, repeatType: "loop" }}
                    aria-hidden
                  >
                    {wonBet ? "🏆" : "😢"}
                  </motion.span>
                </div>

                {/* 勝利テキスト */}
                {wonBet ? (
                  <>
                    <p className="text-sm font-extrabold tracking-[0.3em] text-amber-600 animate-pulse">🎉 よそう てきちゅう！ 🎉</p>
                    <p className="mt-2 text-2xl font-black text-slate-800 leading-tight">
                      {lanes.find(l => l.key === winnerKey)?.animal.name} の かち！
                    </p>
                    <div className="mt-3 rounded-2xl bg-amber-100 py-3 px-4 ring-1 ring-amber-300">
                      <p className="text-xs font-bold text-amber-700">ゲット！</p>
                      <p className="text-4xl font-black text-amber-800">
                        {potentialReward} <span className="text-2xl">🪙</span>
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        ざんだか: {coinBalance.toLocaleString()} コイン
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-extrabold tracking-[0.2em] text-slate-400">😔 ざんねん…</p>
                    <p className="mt-2 text-xl font-black text-white leading-tight">
                      よそうが はずれて<br />
                      <span className="text-rose-400">コインが なくなっちゃった…</span>
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      かったのは <span className="font-black text-amber-300">
                        {lanes.find(l => l.key === winnerKey)?.animal.emoji}{" "}
                        {lanes.find(l => l.key === winnerKey)?.animal.name}
                      </span> だったよ！
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      ざんだか: {coinBalance.toLocaleString()} コイン
                    </p>
                  </>
                )}

                {/* ポータルへのみ */}
                <Link
                  href={portalHref}
                  className={`mt-6 block w-full rounded-2xl py-4 text-base font-extrabold text-center shadow transition hover:brightness-110 active:scale-[0.98] ${
                    wonBet
                      ? "bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white"
                      : "bg-slate-600 text-white hover:bg-slate-500"
                  }`}
                >
                  ← ポータルへ もどる
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
