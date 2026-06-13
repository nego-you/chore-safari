"use client";

// app/kids/[kidId]/QuizGate.tsx — クイズゲート（一本道化 2026-06-12）
//
// 「学びを冒険の鍵にする」（docs/DESIGN_PRINCIPLES.md 4）。
// 罠を仕掛ける直前／アクティブ狩りに出発する直前に全画面で1問出題し、
// 正解するまで先へ進めない。不正解なら別の問題で再挑戦できる
// （ペナルティは「進めない」だけ。3択の総当たり防止のため問題を引き直す）。
//
// 出題ソース：
//   1. getRandomQuizAnimal()（DB からランダムな動物）
//   2. /api/quiz/generate（Gemini。失敗時はルート側がフォールバッククイズを返す）
//   3. それも失敗したらローカルの決め打ちクイズ（子供を絶対に詰まらせない）

import { useCallback, useEffect, useState } from "react";
import { getRandomQuizAnimal } from "@/features/safari/actions";

type QuizData = {
  question: string;
  options: string[];
  answer: string;
  animalEmoji: string;
};

// ネットワーク・DB が全滅しても出せる最終フォールバック。
const LOCAL_FALLBACK_QUIZZES: QuizData[] = [
  {
    question: "どうぶつを つかまえる まえに することは どれ？",
    options: ["どうぶつのことを しらべる", "おおごえで さけぶ", "めを つぶる"],
    answer: "どうぶつのことを しらべる",
    animalEmoji: "🦁",
  },
  {
    question: "ワナを しかけるのに いちばん いい ばしょは？",
    options: ["どうぶつの とおりみち", "おうちの なか", "くるまの うえ"],
    answer: "どうぶつの とおりみち",
    animalEmoji: "🪤",
  },
  {
    question: "ぜつめつした どうぶつは どれ？",
    options: ["ティラノサウルス", "ライオン", "ウサギ"],
    answer: "ティラノサウルス",
    animalEmoji: "🦖",
  },
];

function pickLocalFallback(): QuizData {
  return LOCAL_FALLBACK_QUIZZES[
    Math.floor(Math.random() * LOCAL_FALLBACK_QUIZZES.length)
  ];
}

export function QuizGate({
  title,
  subtitle,
  onPass,
  onCancel,
}: {
  // 例: "しゅっぱつまえの ものしりクイズ！"
  title: string;
  // 例: "せいかいすると ワナを しかけられるよ"
  subtitle: string;
  onPass: () => void;
  onCancel: () => void;
}) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setPicked(null);
    setResult(null);
    try {
      const animal = await getRandomQuizAnimal();
      if (!animal) throw new Error("NO_ANIMAL");
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specificName: animal.specificName,
          description: animal.description,
        }),
      });
      if (!res.ok) throw new Error("QUIZ_API_FAILED");
      const data = (await res.json()) as {
        question: string;
        options: string[];
        answer: string;
      };
      if (!data?.question || !Array.isArray(data.options) || !data.answer) {
        throw new Error("QUIZ_MALFORMED");
      }
      setQuiz({
        question: data.question,
        options: data.options,
        answer: data.answer,
        animalEmoji: animal.emoji || "🐾",
      });
    } catch {
      // 最終フォールバック：ローカル決め打ちクイズ
      setQuiz(pickLocalFallback());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuiz();
  }, [loadQuiz]);

  const handlePick = (option: string) => {
    if (!quiz || picked !== null) return;
    setPicked(option);
    const correct = option === quiz.answer;
    setResult(correct ? "correct" : "wrong");
    if (correct) {
      setTimeout(() => onPass(), 1100);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md md:max-w-lg rounded-[2rem] bg-gradient-to-br from-violet-300 via-sky-200 to-emerald-200 p-1 shadow-2xl">
        <div className="rounded-[1.7rem] bg-white p-5 md:p-8">
          {/* ヘッダー */}
          <p className="text-center text-sm md:text-base font-extrabold tracking-widest text-violet-600">
            🧠 {title}
          </p>
          <p className="mt-1 text-center text-[11px] md:text-sm text-slate-500">
            {subtitle}
          </p>

          {loading || !quiz ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="text-5xl animate-bounce">📖</div>
              <p className="text-sm font-bold text-slate-500">
                もんだいを つくってるよ…
              </p>
            </div>
          ) : (
            <>
              {/* 問題文 */}
              <div className="mt-4 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4">
                <div className="mb-1 text-center text-3xl">{quiz.animalEmoji}</div>
                <p className="text-center text-sm md:text-base font-bold leading-relaxed text-slate-800">
                  {quiz.question}
                </p>
              </div>

              {/* 選択肢 */}
              <div className="mt-4 flex flex-col gap-2.5">
                {quiz.options.map((option) => {
                  const isPicked = picked === option;
                  const isAnswer = option === quiz.answer;
                  const showCorrect = result !== null && isAnswer;
                  const showWrong = result === "wrong" && isPicked;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={picked !== null}
                      onClick={() => handlePick(option)}
                      className={`rounded-xl border-2 px-4 py-3 text-left text-sm md:text-base font-bold transition active:scale-[0.98] ${
                        showCorrect
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : showWrong
                            ? "border-rose-400 bg-rose-50 text-rose-600"
                            : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                      } ${picked !== null ? "cursor-default" : "cursor-pointer"}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {/* 結果メッセージ */}
              {result === "correct" && (
                <p className="mt-4 animate-pulse text-center text-base font-black text-emerald-600">
                  🎉 せいかい！ すすめるよ！
                </p>
              )}
              {result === "wrong" && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <p className="text-center text-sm font-bold text-rose-500">
                    ざんねん…！ こたえは「{quiz.answer}」だったよ
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadQuiz()}
                    className="rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 px-5 py-2.5 text-sm font-black text-white shadow hover:brightness-110 active:scale-[0.97]"
                  >
                    🔁 べつの もんだいに チャレンジ！
                  </button>
                </div>
              )}
            </>
          )}

          {/* やめる */}
          {result !== "correct" && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-4 w-full rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200"
            >
              また あとで チャレンジする
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
