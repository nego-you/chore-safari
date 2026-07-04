"use client";

// components/BGMPlayer.tsx
// 各画面のルートに応じた BGM を再生するプレイヤー。
// SafariLayoutShell から一度だけレンダリングされ、UI は持たない。
//
// ファイル配置: /public/sounds/bgm/<ファイル名>.mp3
// ミュート状態: useSafariStore.bgmMuted（localStorage に永続保存）

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSafariStore } from "@/store/useSafariStore";

// ── ルート suffix → BGM ファイル名 ───────────────────────────────
// pathname は /kids/<kidId>/<suffix> の形式。
// "safari/hunt" が "safari" より先に評価されるよう、長いキーを先に置く。
const BGM_MAP: [string, string][] = [
  ["safari/hunt", "狩り.mp3"],
  ["house",       "家.mp3"],
  ["quests",      "クエスト.mp3"],
  ["dictionary",  "図鑑.mp3"],
  ["craft",       "発明.mp3"],
  ["race",        "レース.mp3"],
  ["farm",        "農場.mp3"],
  ["ranch",       "牧場.mp3"],
  ["zoo",         "動物園.mp3"],
  ["safari",      "わな.mp3"],
  ["logistics",   "物流.mp3"],
  ["crane",       "クレーン.mp3"],
];

const BGM_BASE = "/sounds/bgm/";
const TARGET_VOL = 0.35;
const FADE_STEPS = 20;
const FADE_MS = 1000;

/** /kids/<kidId>/<suffix> から suffix を取り出して対応する BGM パスを返す */
function resolveTrack(pathname: string): string | null {
  const m = pathname.match(/\/kids\/[^/]+\/(.+)/);
  if (!m) return null;
  const suffix = m[1].replace(/\/$/, "");
  const entry = BGM_MAP.find(([key]) => suffix === key || suffix.startsWith(key + "/"));
  return entry ? BGM_BASE + entry[1] : null;
}

export function BGMPlayer() {
  const pathname = usePathname();
  const muted = useSafariStore((s) => s.bgmMuted);

  // 安定した参照を useRef で管理（再レンダーで Audio を再生成しない）
  const audioRef        = useRef<HTMLAudioElement | null>(null);
  const activeTrackRef  = useRef<string | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const interactedRef   = useRef(false);
  // 最新の muted / pathname を closure-free に参照するため
  const mutedRef        = useRef(muted);
  const pathnameRef     = useRef(pathname);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // ── フェードヘルパー（useEffect 外で定義し ref に保持） ─────────
  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const fadeIn = (audio: HTMLAudioElement) => {
    clearTimer();
    audio.volume = 0;
    audio.play().catch(() => {/* autoplay blocked — 次のインタラクションで再試行 */});
    let step = 0;
    timerRef.current = setInterval(() => {
      step++;
      audio.volume = Math.min(TARGET_VOL, TARGET_VOL * step / FADE_STEPS);
      if (step >= FADE_STEPS) clearTimer();
    }, FADE_MS / FADE_STEPS);
  };

  const fadeOut = (audio: HTMLAudioElement, cb?: () => void) => {
    clearTimer();
    const start = audio.volume;
    if (start === 0) { audio.pause(); cb?.(); return; }
    let step = 0;
    timerRef.current = setInterval(() => {
      step++;
      audio.volume = Math.max(0, start * (1 - step / FADE_STEPS));
      if (step >= FADE_STEPS) {
        clearTimer();
        audio.pause();
        cb?.();
      }
    }, FADE_MS / FADE_STEPS);
  };

  const switchTrack = (newTrack: string | null) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (newTrack === activeTrackRef.current) return;

    if (!newTrack) {
      // この画面には BGM なし → フェードアウトして停止
      fadeOut(audio);
      activeTrackRef.current = null;
      return;
    }

    if (activeTrackRef.current) {
      // 別曲 → フェードアウト後にクロスフェード
      fadeOut(audio, () => {
        audio.src = newTrack;
        audio.load();
        activeTrackRef.current = newTrack;
        fadeIn(audio);
      });
    } else {
      // 無音状態から再生開始
      audio.src = newTrack;
      audio.load();
      activeTrackRef.current = newTrack;
      fadeIn(audio);
    }
  };

  // ── マウント時: Audio 要素を生成 & 初回インタラクション待ち ───────
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audioRef.current = audio;

    // ブラウザの自動再生ポリシー: ユーザーの最初の操作まで音声再生は禁止。
    // クリック/タッチ/キー操作を検知して BGM を起動する。
    const onFirstInteraction = () => {
      if (interactedRef.current) return;
      interactedRef.current = true;
      if (!mutedRef.current) {
        switchTrack(resolveTrack(pathnameRef.current));
      }
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("click",      onFirstInteraction);
      window.removeEventListener("touchstart", onFirstInteraction);
      window.removeEventListener("keydown",    onFirstInteraction);
    };
    window.addEventListener("click",      onFirstInteraction);
    window.addEventListener("touchstart", onFirstInteraction);
    window.addEventListener("keydown",    onFirstInteraction);

    return () => {
      clearTimer();
      audio.pause();
      audio.src = "";
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ルート変更 → BGM 切り替え ─────────────────────────────────
  useEffect(() => {
    if (!interactedRef.current) return; // まだ操作前
    if (muted) return;                  // ミュート中はここでは何もしない
    switchTrack(resolveTrack(pathname));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── ミュートトグル ─────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (muted) {
      fadeOut(audio, () => { activeTrackRef.current = null; });
    } else if (interactedRef.current) {
      switchTrack(resolveTrack(pathname));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  return null; // UI なし
}
