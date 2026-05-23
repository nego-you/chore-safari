"use client";

// アクティブ狩り（投槍器・複合弓）のクライアント。
// フロー（state machine）:
//   idle        : ステージと道具を選ぶ。残り回数を大きく表示。
//   encounter   : 「〇〇が あらわれた！」道具に応じた行動選択 (2-3択)
//   captured    : 行動正解 → 「つかまえた！どんな どうぶつか よんでみよう」
//                 説明文を読ませながら裏で /api/quiz/generate を叩く
//   readingQuiz : 読解クイズ (Ollama 3択)
//   result      : 結果モーダル（だいせいかい / ざんねん）

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { startActiveHunt, resolveActiveHunt, getHuntStamina } from "../../../actions";

type ToolEntry = {
  id: string;
  toolId: string;
  name: string;
  emoji: string;
  description: string;
  historicalContext: string;
  type: "BOW" | "SPEAR" | "WEAPON";
  successRateBonus: number;
  inventoryItemId: string | null;
  consumable: boolean;
};

type StageEntry = {
  id: string;
  stageId: string;
  name: string;
  emoji: string;
  description: string;
  animalCount: number;
};

type AnimalLite = {
  id: string;
  animalId: string;
  name: string;
  genericName: string;
  specificName: string;
  emoji: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  description: string;
  imageUrl: string | null;
  isExtinct: boolean;
};

type StaminaInfo = {
  used: number;
  remaining: number;
  limit: number;
  lastHuntDate: string | null;
};

type ActiveHunt = {
  id: string;
  huntType: "BOW" | "SPEAR" | "WEAPON";
  toolName: string;
  toolEmoji: string;
  targetAnimal: AnimalLite;
};

type Props = {
  kidId: string;
  kidName: string;
  tools: ToolEntry[];
  stages: StageEntry[];
  noTools: boolean;
  initialStamina: StaminaInfo;
};

const NAME_READING: Record<string, string> = {
  "美琴": "みこと",
  "幸仁": "ゆきと",
  "叶泰": "かなた",
};

const RARITY_LABEL: Record<AnimalLite["rarity"], string> = {
  COMMON: "ふつう",
  RARE: "レア",
  EPIC: "すごレア",
  LEGENDARY: "でんせつ",
};

const RARITY_TONE: Record<AnimalLite["rarity"], string> = {
  COMMON: "from-slate-200 to-slate-300 text-slate-800",
  RARE: "from-sky-200 to-blue-300 text-sky-900",
  EPIC: "from-fuchsia-200 to-purple-300 text-fuchsia-900",
  LEGENDARY: "from-amber-200 via-yellow-300 to-orange-300 text-amber-900",
};

// ─────────────────────────────────────────────
// 道具ごとの「状況判断」クイズ（行動選択）
// 子供向けに簡潔・教育的な選択肢を用意。
// ─────────────────────────────────────────────
type ActionChoice = { label: string; correct: boolean; emoji: string };
type ActionQuiz = { question: string; choices: ActionChoice[] };

const TOOL_ACTION_QUIZ: Record<string, ActionQuiz> = {
  atlatl: {
    question: "アトラトル（投槍器）で どう ねらう？",
    choices: [
      { emoji: "🤫", label: "こっそり ちかづいて なげる", correct: true },
      { emoji: "📢", label: "おおごえを だして はしる", correct: false },
      { emoji: "🎯", label: "とおくから やみくもに なげまくる", correct: false },
    ],
  },
  harpoon: {
    question: "もり で どう ねらう？",
    choices: [
      { emoji: "🌊", label: "みずの ちかくで しずかに かまえる", correct: true },
      { emoji: "🏃", label: "おおあわてで はしりよる", correct: false },
    ],
  },
  compound_bow: {
    question: "複合弓 で どう ねらう？",
    choices: [
      { emoji: "🌬️", label: "かぜを よんで しずかに ねらう", correct: true },
      { emoji: "🎉", label: "おおさわぎして ちゅういを ひく", correct: false },
      { emoji: "🏹", label: "とりあえず ぜんぶ うちまくる", correct: false },
    ],
  },
  longbow: {
    question: "長弓 で どう ねらう？",
    choices: [
      { emoji: "🌳", label: "きのかげに かくれて ねらう", correct: true },
      { emoji: "🚪", label: "ひらけた ばしょで まっすぐ あるく", correct: false },
    ],
  },
};

// WEAPON（刃物・銃）用クイズ
const WEAPON_ACTION_QUIZ_MAP: Record<string, ActionQuiz> = {
  flint_knife: {
    question: "せっきの ナイフで どう ちかづく？",
    choices: [
      { emoji: "🤫", label: "しずかに はらって えものに ちかづく", correct: true },
      { emoji: "🏃", label: "ダッシュして ながら きる", correct: false },
      { emoji: "📢", label: "おおごえで おどかしてから きる", correct: false },
    ],
  },
  survival_knife: {
    question: "サバイバルナイフで どう ねらう？",
    choices: [
      { emoji: "🌿", label: "くさに かくれて えものを まつ", correct: true },
      { emoji: "🔊", label: "さけびながら とびかかる", correct: false },
    ],
  },
  arquebus: {
    question: "ひなわじゅうで うつ まえに なにを する？",
    choices: [
      { emoji: "🎯", label: "しっかり たいせいを ととのえて ねらいを さだめる", correct: true },
      { emoji: "💨", label: "いそいで てきとうに うつ", correct: false },
      { emoji: "🏃", label: "はしりながら うつ", correct: false },
    ],
  },
  hunting_rifle: {
    question: "りょうじゅうで とおくの えものを ねらう とき、どうする？",
    choices: [
      { emoji: "🌬️", label: "かぜの むきを よんで、しずかに こきゅうを ととのえる", correct: true },
      { emoji: "🎉", label: "おおさわぎして ちゅういを ひく", correct: false },
      { emoji: "⏩", label: "はやく うてば あたる", correct: false },
    ],
  },
};

// デフォルト（未知の道具用）
const DEFAULT_ACTION_QUIZ: ActionQuiz = {
  question: "どう ねらう？",
  choices: [
    { emoji: "🤫", label: "そっと ちかづいて ねらう", correct: true },
    { emoji: "📢", label: "おおごえで おどかす", correct: false },
  ],
};

type Phase =
  | { kind: "idle" }
  | { kind: "encounter"; hunt: ActiveHunt; tool: ToolEntry }
  | { kind: "captured"; hunt: ActiveHunt; tool: ToolEntry }
  | { kind: "readingQuiz"; hunt: ActiveHunt; tool: ToolEntry; quiz: GeneratedQuiz }
  | { kind: "result"; outcome: "caught" | "escaped"; animal: AnimalLite; tool: ToolEntry; reason: string };

type GeneratedQuiz = {
  question: string;
  options: string[];
  answer: string;
  source: "ollama" | "fallback";
};

export function HuntClient({
  kidId,
  kidName,
  tools,
  stages,
  noTools,
  initialStamina,
}: Props) {
  const reading = NAME_READING[kidName] ?? kidName;

  const [selectedStage, setSelectedStage] = useState<StageEntry | null>(
    stages[0] ?? null,
  );
  const [stamina, setStamina] = useState<StaminaInfo>(initialStamina);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);

  // 起動から少し経過していたら最新のスタミナを取り直す（日付変わりに対応）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fresh = await getHuntStamina(kidId);
      if (!cancelled) setStamina(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, [kidId]);

  const handleStartHunt = (tool: ToolEntry) => {
    if (!selectedStage) {
      setErrorMsg("ステージを えらんでね");
      return;
    }
    if (stamina.remaining <= 0) {
      setErrorMsg("きょうの かりは おわり！あしたまた チャレンジしよう");
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      const r = await startActiveHunt(kidId, tool.id, selectedStage.id);
      if (!r.success) {
        setErrorMsg(r.error);
        if (r.stamina) setStamina(r.stamina);
        return;
      }
      setStamina(r.stamina);
      setPhase({
        kind: "encounter",
        tool,
        hunt: {
          id: r.hunt.id,
          huntType: r.hunt.huntType,
          toolName: r.hunt.toolName,
          toolEmoji: r.hunt.toolEmoji,
          targetAnimal: r.hunt.targetAnimal,
        },
      });
    });
  };

  // 行動選択で「不正解」を選んだ時：その場で逃げられた扱い
  const handleActionFail = (hunt: ActiveHunt, tool: ToolEntry, reason: string) => {
    setPhase({
      kind: "result",
      outcome: "escaped",
      animal: hunt.targetAnimal,
      tool,
      reason,
    });
    // サーバ側にも結果を伝える（precision=0 → ESCAPED）
    void resolveActiveHunt(hunt.id, 0);
  };

  // 行動選択で「正解」を選んだ時：一時捕獲 → 読解フェーズへ
  const handleActionPass = (hunt: ActiveHunt, tool: ToolEntry) => {
    setPhase({ kind: "captured", hunt, tool });
    // 裏で Ollama にクイズを生成させる
    setIsLoadingQuiz(true);
    void (async () => {
      try {
        const res = await fetch("/api/quiz/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            specificName: hunt.targetAnimal.specificName,
            description: hunt.targetAnimal.description,
          }),
        });
        const json = (await res.json()) as GeneratedQuiz;
        setIsLoadingQuiz(false);
        setPhase((cur) => {
          if (cur.kind !== "captured") return cur;
          return { kind: "readingQuiz", hunt, tool, quiz: json };
        });
      } catch {
        setIsLoadingQuiz(false);
        // ネットワーク失敗時のフォールバック: 説明文の冒頭を使った簡易クイズ
        const fb: GeneratedQuiz = {
          question: `${hunt.targetAnimal.specificName} は どんな どうぶつ？`,
          options: [
            hunt.targetAnimal.description.split(/[。．]/)[0]?.slice(0, 40) ||
              "せつめいに かいてある とおり",
            "そらを とぶ きかい",
            "あまい たべもの",
          ],
          answer:
            hunt.targetAnimal.description.split(/[。．]/)[0]?.slice(0, 40) ||
            "せつめいに かいてある とおり",
          source: "fallback",
        };
        setPhase((cur) => {
          if (cur.kind !== "captured") return cur;
          return { kind: "readingQuiz", hunt, tool, quiz: fb };
        });
      }
    })();
  };

  // 読解クイズの結果
  const handleReadingAnswer = (
    hunt: ActiveHunt,
    tool: ToolEntry,
    selectedOption: string,
    quiz: GeneratedQuiz,
  ) => {
    const isCorrect = selectedOption.trim() === quiz.answer.trim();
    if (isCorrect) {
      // サーバに「捕獲成功」を確定
      void resolveActiveHunt(hunt.id, 1.0);
      setPhase({
        kind: "result",
        outcome: "caught",
        animal: hunt.targetAnimal,
        tool,
        reason: "せつめいを よく よめたね！",
      });
    } else {
      void resolveActiveHunt(hunt.id, 0);
      setPhase({
        kind: "result",
        outcome: "escaped",
        animal: hunt.targetAnimal,
        tool,
        reason: "ちしきが たりなくて にげられちゃった…",
      });
    }
  };

  const closeResult = () => {
    setPhase({ kind: "idle" });
  };

  const remaining = stamina.remaining;
  const dailyDisabled = remaining <= 0;

  return (
    <main className="min-h-[calc(100vh-52px)] bg-gradient-to-b from-emerald-100 via-teal-100 to-sky-100 px-4 py-4">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* ページタイトル */}
        <p className="text-center text-sm font-extrabold text-emerald-700/80 tracking-widest">
          🏹 アクティブ 狩り
        </p>

        {/* スタミナヒーロー（あと ◯ かい） */}
        <section
          className={`rounded-[2rem] p-1 shadow-xl ring-4 ring-white ${
            dailyDisabled
              ? "bg-gradient-to-br from-slate-300 to-slate-400"
              : "bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400"
          }`}
        >
          <div className="rounded-[1.7rem] bg-white/95 px-6 py-5 text-center backdrop-blur">
            <p className="text-[10px] font-bold tracking-[0.4em] text-emerald-600">
              きょうの かり
            </p>
            <p className="mt-1 font-mono text-6xl font-black tracking-tight text-emerald-800 leading-none sm:text-7xl">
              あと <span className={dailyDisabled ? "text-rose-500" : ""}>{remaining}</span> <span className="text-3xl">かい</span>
            </p>
            {/* スタミナ・トークン */}
            <div className="mt-3 flex justify-center gap-1.5">
              {Array.from({ length: stamina.limit }).map((_, i) => {
                const used = i < stamina.used;
                return (
                  <span
                    key={i}
                    aria-hidden
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ring-2 ${
                      used
                        ? "bg-slate-200 text-slate-400 ring-slate-300"
                        : "bg-gradient-to-br from-amber-300 to-orange-400 text-white ring-amber-500 shadow"
                    }`}
                  >
                    {used ? "✗" : "🏹"}
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] font-bold text-emerald-700/80">
              {reading}、しんちょうに ねらおう！
              {dailyDisabled && (
                <span className="block text-rose-500 mt-1">
                  きょうは おしまい。あした 0:00 に リセット
                </span>
              )}
            </p>
          </div>
        </section>

        {noTools && (
          <div className="rounded-2xl bg-yellow-100 px-4 py-3 text-sm font-bold text-yellow-900 ring-1 ring-yellow-300">
            ⚠️ つかえる どうぐが ありません。
            クラフト工場で BOW・とうしゃぶき・ぶき を つくってね！
          </div>
        )}

        {/* ステージ選択 */}
        <section className="rounded-3xl bg-white/85 p-5 shadow ring-1 ring-emerald-200">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-emerald-800">
            <span aria-hidden>🌍</span> ステージを えらぶ
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {stages.map((s) => {
              const isSelected = selectedStage?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStage(s)}
                  className={`rounded-2xl p-2 ring-2 transition active:scale-95 ${
                    isSelected
                      ? "bg-gradient-to-br from-emerald-300 to-teal-300 ring-emerald-500 shadow"
                      : "bg-slate-50 ring-transparent hover:bg-slate-100"
                  }`}
                >
                  <p className="text-2xl" aria-hidden>{s.emoji}</p>
                  <p className="text-[10px] font-extrabold leading-tight text-slate-700">
                    {s.name}
                  </p>
                  <p className="text-[9px] text-slate-500">{s.animalCount}種</p>
                </button>
              );
            })}
          </div>
          {selectedStage && (
            <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-[11px] text-emerald-900 leading-relaxed">
              {selectedStage.description}
            </p>
          )}
        </section>

        {/* 道具選択 */}
        <section className="rounded-3xl bg-white/85 p-5 shadow ring-1 ring-emerald-200">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-emerald-800">
            <span aria-hidden>🛠️</span> 道具を かまえる
          </h2>
          {tools.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              使える 道具が ありません。クラフトで つくろう。
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tools.map((t) => {
                const disabled = dailyDisabled || isPending;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleStartHunt(t)}
                    disabled={disabled}
                    className={`text-left rounded-2xl p-3 ring-2 transition active:scale-95 ${
                      disabled
                        ? "bg-slate-100 ring-slate-200 opacity-50 cursor-not-allowed"
                        : t.type === "BOW"
                          ? "bg-gradient-to-br from-emerald-100 to-teal-100 ring-emerald-300 hover:scale-[1.02]"
                          : t.type === "SPEAR"
                            ? "bg-gradient-to-br from-sky-100 to-indigo-100 ring-sky-300 hover:scale-[1.02]"
                            : "bg-gradient-to-br from-rose-100 to-orange-100 ring-rose-300 hover:scale-[1.02]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-4xl shrink-0" aria-hidden>{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black leading-tight text-slate-800">
                          {t.name}
                        </p>
                        <p className="text-[10px] font-bold text-slate-600 mt-0.5">
                          {t.type === "BOW" ? "🏹 弓" : t.type === "SPEAR" ? "🗡️ 投擲" : "🔪 ぶき"} ／ 命中 +{Math.round(t.successRateBonus * 100)}%
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                          {t.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {errorMsg && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
              {errorMsg}
            </p>
          )}
        </section>

        <p className="text-center text-[11px] font-bold text-emerald-600/70 tracking-widest">
          🏹 よく かんがえ、よく よむ。それが ハンター！ 🏹
        </p>
      </div>

      {/* 行動選択モーダル */}
      {phase.kind === "encounter" && (
        <EncounterModal
          hunt={phase.hunt}
          tool={phase.tool}
          onPass={handleActionPass}
          onFail={(reason) => handleActionFail(phase.hunt, phase.tool, reason)}
        />
      )}

      {/* 一時捕獲＋読解中（クイズ生成待ち） */}
      {phase.kind === "captured" && (
        <CapturedReadingModal
          hunt={phase.hunt}
          isLoadingQuiz={isLoadingQuiz}
        />
      )}

      {/* 読解クイズ */}
      {phase.kind === "readingQuiz" && (
        <ReadingQuizModal
          hunt={phase.hunt}
          tool={phase.tool}
          quiz={phase.quiz}
          onAnswer={(opt) =>
            handleReadingAnswer(phase.hunt, phase.tool, opt, phase.quiz)
          }
        />
      )}

      {/* 結果 */}
      {phase.kind === "result" && (
        <ResultModal
          outcome={phase.outcome}
          animal={phase.animal}
          tool={phase.tool}
          reason={phase.reason}
          onClose={closeResult}
        />
      )}

      <style jsx>{`
        @keyframes box-shake {
          0%, 100% { transform: rotate(0deg) translateX(0); }
          15% { transform: rotate(-6deg) translateX(-3px); }
          30% { transform: rotate(7deg) translateX(4px); }
          45% { transform: rotate(-5deg) translateX(-3px); }
          60% { transform: rotate(6deg) translateX(3px); }
          75% { transform: rotate(-3deg) translateX(-2px); }
        }
        :global(.box-gatagata) {
          animation: box-shake 0.45s ease-in-out infinite;
          display: inline-block;
        }
        @keyframes burst-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        :global(.burst-spin) {
          animation: burst-spin 8s linear infinite;
        }
      `}</style>
    </main>
  );
}

// ─────────────────────────────────────────
// 行動選択モーダル（状況判断クイズ）
// ─────────────────────────────────────────
function EncounterModal({
  hunt,
  tool,
  onPass,
  onFail,
}: {
  hunt: ActiveHunt;
  tool: ToolEntry;
  onPass: (hunt: ActiveHunt, tool: ToolEntry) => void;
  onFail: (reason: string) => void;
}) {
  const quiz =
    TOOL_ACTION_QUIZ[tool.toolId] ??
    WEAPON_ACTION_QUIZ_MAP[tool.toolId] ??
    DEFAULT_ACTION_QUIZ;
  const [picked, setPicked] = useState<number | null>(null);

  const handlePick = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    const c = quiz.choices[idx];
    setTimeout(() => {
      if (c.correct) {
        onPass(hunt, tool);
      } else {
        onFail("おどろかせて にげられちゃった…");
      }
    }, 900);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-[2rem] bg-gradient-to-br from-emerald-300 via-teal-300 to-sky-300 p-1 shadow-2xl">
        <div className="rounded-[1.75rem] bg-slate-900 px-6 py-7 text-center text-white">
          <p className="text-[10px] font-bold tracking-[0.4em] text-amber-300 animate-pulse">
            ✨ そうぐう ✨
          </p>

          {/* 動物のシルエット */}
          <div className="mt-3 relative mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-emerald-900/60 ring-2 ring-emerald-400/40">
            <span
              aria-hidden
              className="text-7xl"
              style={{ filter: "brightness(0)", opacity: 0.9 }}
            >
              {hunt.targetAnimal.emoji}
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-300">
            <span className="font-bold text-white">
              {hunt.targetAnimal.genericName || "なにか"}
            </span>
            が あらわれた！
          </p>
          <span className="mt-1 inline-block rounded-full bg-emerald-700/40 px-2 py-0.5 text-[10px] font-bold text-emerald-100">
            {RARITY_LABEL[hunt.targetAnimal.rarity]}
          </span>

          <div className="mt-5 rounded-2xl bg-emerald-950/60 p-4 ring-1 ring-emerald-600/30">
            <p className="text-[11px] font-bold text-emerald-300">
              {tool.emoji} {tool.name}
            </p>
            <p className="mt-1 text-sm font-extrabold text-white">{quiz.question}</p>
          </div>

          {/* 行動の選択肢 */}
          <div className="mt-4 flex flex-col gap-2">
            {quiz.choices.map((c, i) => {
              const isPicked = picked === i;
              const showResult = picked !== null;
              const isCorrect = c.correct;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={picked !== null}
                  onClick={() => handlePick(i)}
                  className={`w-full rounded-2xl px-4 py-3 text-left font-bold transition active:scale-95 ${
                    showResult
                      ? isPicked
                        ? isCorrect
                          ? "bg-emerald-500 text-white ring-4 ring-emerald-300"
                          : "bg-rose-500 text-white ring-4 ring-rose-300"
                        : "bg-slate-800 text-slate-400 opacity-50"
                      : "bg-white text-slate-800 hover:bg-emerald-100 ring-2 ring-emerald-300"
                  }`}
                >
                  <span className="text-2xl mr-2">{c.emoji}</span>
                  <span className="text-sm">{c.label}</span>
                  {showResult && isPicked && (
                    <span className="ml-2 text-xs font-extrabold">
                      {isCorrect ? "○ せいかい！" : "✗ ふせいかい"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 一時捕獲＋読解（クイズ生成中）
// ─────────────────────────────────────────
function CapturedReadingModal({
  hunt,
  isLoadingQuiz,
}: {
  hunt: ActiveHunt;
  isLoadingQuiz: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-[2rem] bg-gradient-to-br from-amber-300 via-orange-300 to-rose-300 p-1 shadow-2xl">
        <div className="rounded-[1.75rem] bg-white px-6 py-6 text-center">
          <p className="text-[10px] font-bold tracking-[0.4em] text-amber-600">
            ✨ いちじ ほかく ✨
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-800 leading-tight">
            つかまえた！
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            どんな どうぶつか よんでみよう
          </p>

          {/* 動物の正体 */}
          <div className="mt-4 flex items-center justify-center">
            {hunt.targetAnimal.imageUrl ? (
              <img
                src={hunt.targetAnimal.imageUrl}
                alt={hunt.targetAnimal.specificName}
                className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-2 ring-white"
              />
            ) : (
              <span className="text-7xl drop-shadow-lg">
                {hunt.targetAnimal.emoji}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] font-bold text-slate-500">
            {hunt.targetAnimal.genericName}
          </p>
          <p className="text-lg font-black text-slate-800">
            {hunt.targetAnimal.specificName}
          </p>
          {hunt.targetAnimal.isExtinct && (
            <span className="mt-1 inline-block rounded-full bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-200">
              💀 絶滅種
            </span>
          )}

          {/* 説明文：100文字 */}
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 text-left">
            <p className="text-[10px] font-extrabold tracking-widest text-amber-700">
              📖 ずかんの せつめい
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-800">
              {hunt.targetAnimal.description}
            </p>
          </div>

          {/* ローディング演出：箱がガタガタ */}
          <div className="mt-5 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 p-4 ring-1 ring-violet-200">
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl box-gatagata" aria-hidden>📦</span>
              <div className="text-left">
                <p className="text-xs font-extrabold text-violet-700">
                  AI が クイズを つくっているよ…
                </p>
                <p className="text-[10px] text-violet-600 mt-0.5">
                  はこが ガタガタ ゆれている！
                </p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "120ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "240ms" }} />
                </div>
              </div>
            </div>
            {!isLoadingQuiz && (
              <p className="mt-2 text-[10px] text-violet-500">
                よみおわった？クイズ いくよ！
              </p>
            )}
          </div>

          <p className="mt-4 text-[10px] text-slate-400">
            ※ 説明文を よく よんで！クイズに ですよ！
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 読解クイズ（Ollama 生成 3択）
// ─────────────────────────────────────────
function ReadingQuizModal({
  hunt,
  tool: _tool,
  quiz,
  onAnswer,
}: {
  hunt: ActiveHunt;
  tool: ToolEntry;
  quiz: GeneratedQuiz;
  onAnswer: (opt: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  const handlePick = (opt: string) => {
    if (picked !== null) return;
    setPicked(opt);
    setTimeout(() => onAnswer(opt), 700);
  };

  const isCorrect = (opt: string) => opt.trim() === quiz.answer.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-[2rem] bg-gradient-to-br from-violet-400 via-fuchsia-400 to-rose-400 p-1 shadow-2xl">
        <div className="rounded-[1.75rem] bg-white px-6 py-6">
          <p className="text-[10px] font-bold tracking-[0.4em] text-violet-600 text-center">
            🧠 どっかい クイズ 🧠
          </p>

          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-3xl">{hunt.targetAnimal.emoji}</span>
            <span className="text-sm font-extrabold text-slate-700">
              {hunt.targetAnimal.specificName} クイズ
            </span>
          </div>

          {quiz.source === "fallback" && (
            <p className="mt-1 text-center text-[9px] text-amber-600">
              ⚠️ AI が おやすみちゅう。かんたんクイズで チャレンジ
            </p>
          )}

          <div className="mt-4 rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-200">
            <p className="text-sm font-extrabold text-slate-800 leading-relaxed">
              {quiz.question}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {quiz.options.map((opt, i) => {
              const isPicked = picked === opt;
              const showResult = picked !== null;
              const ok = isCorrect(opt);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={picked !== null}
                  onClick={() => handlePick(opt)}
                  className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-bold transition active:scale-95 ${
                    showResult
                      ? isPicked
                        ? ok
                          ? "bg-emerald-500 text-white ring-4 ring-emerald-300"
                          : "bg-rose-500 text-white ring-4 ring-rose-300"
                        : ok
                          ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300"
                          : "bg-slate-100 text-slate-500 opacity-60"
                      : "bg-white text-slate-800 ring-2 ring-violet-300 hover:bg-violet-50"
                  }`}
                >
                  <span className="font-mono mr-2 text-violet-500">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 結果モーダル
// ─────────────────────────────────────────
function ResultModal({
  outcome,
  animal,
  tool,
  reason,
  onClose,
}: {
  outcome: "caught" | "escaped";
  animal: AnimalLite;
  tool: ToolEntry;
  reason: string;
  onClose: () => void;
}) {
  const isCaught = outcome === "caught";

  // 捕獲成功時は派手な confetti
  useEffect(() => {
    if (!isCaught) return;
    let cancelled = false;
    (async () => {
      const mod = await import("canvas-confetti");
      const confetti = mod.default;
      if (cancelled) return;
      const palette = ["#fbbf24", "#f59e0b", "#a78bfa", "#34d399", "#f472b6"];
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { x: 0.5, y: 0.4 },
        colors: palette,
        zIndex: 9999,
      });
      setTimeout(() => {
        confetti({
          particleCount: 120,
          angle: 60,
          spread: 70,
          origin: { x: 0, y: 0.6 },
          colors: palette,
          zIndex: 9999,
        });
      }, 250);
      setTimeout(() => {
        confetti({
          particleCount: 120,
          angle: 120,
          spread: 70,
          origin: { x: 1, y: 0.6 },
          colors: palette,
          zIndex: 9999,
        });
      }, 420);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCaught]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md ${
        isCaught
          ? "bg-gradient-to-br from-amber-300/50 via-rose-300/40 to-fuchsia-300/50"
          : "bg-black/70"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-[2rem] bg-gradient-to-br ${RARITY_TONE[animal.rarity]} p-1 shadow-2xl`}
      >
        <div className="rounded-[1.75rem] bg-white px-6 py-7 text-center">
          <p
            className={`text-[10px] font-bold tracking-[0.4em] ${
              isCaught ? "text-amber-600 animate-pulse" : "text-slate-500"
            }`}
          >
            {isCaught ? "🎉 だいせいかい 🎉" : "💨 ざんねん 💨"}
          </p>

          <h2
            className={`mt-2 text-2xl font-black leading-tight ${
              isCaught
                ? "bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500 bg-clip-text text-transparent"
                : "text-slate-700"
            }`}
          >
            {isCaught ? "ずかんに とうろく！" : "にげられた…"}
          </h2>

          <div className="mt-4 flex items-center justify-center">
            {isCaught ? (
              <span className="text-8xl drop-shadow-lg animate-bounce">
                {animal.emoji}
              </span>
            ) : (
              <span
                className="text-8xl"
                style={{ filter: "brightness(0)", opacity: 0.6 }}
              >
                {animal.emoji}
              </span>
            )}
          </div>

          <p className="mt-2 text-[11px] font-bold text-slate-500">
            {animal.genericName}
          </p>
          <p className="text-lg font-black text-slate-800">
            {isCaught ? animal.specificName : "？？？"}
          </p>

          <div className="mt-2 flex justify-center gap-1 flex-wrap">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {RARITY_LABEL[animal.rarity]}
            </span>
            {isCaught && animal.isExtinct && (
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-gray-200">
                💀 絶滅種
              </span>
            )}
          </div>

          <p className={`mt-4 text-sm leading-relaxed ${isCaught ? "text-emerald-700" : "text-rose-600"} font-bold`}>
            {reason}
          </p>

          {isCaught && (
            <div className="mt-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200 text-left">
              <p className="text-[10px] font-extrabold text-amber-700 tracking-widest">
                📜 {tool.name} の 歴史
              </p>
              <p className="mt-1 text-[11px] text-amber-900 leading-relaxed">
                {tool.historicalContext}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`mt-6 w-full rounded-full px-6 py-3 text-sm font-extrabold text-white transition active:scale-95 ${
              isCaught
                ? "bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500 hover:brightness-110"
                : "bg-slate-700 hover:bg-slate-600"
            }`}
          >
            {isCaught ? "やったー！" : "つぎは ぜったい よむ"}
          </button>
        </div>
      </div>
    </div>
  );
}
