"use client";

// グローバル天候コンテキスト。
// 2時間スロット（現在時刻 ÷ 2h の整数）で天気を決定し、
// セッション中はページ遷移をまたいで一貫した天気を維持する。
// スロット境界を超えたら自動で次の天気に切り替わる。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ── 天気定義 ───────────────────────────────────────────────────
export type WeatherId = "sunny" | "hot" | "rainy" | "typhoon" | "cloudy";

export type WeatherInfo = {
  id: WeatherId;
  icon: string;
  label: string;
  // ワールドマップのグラデーション背景色
  bgGrad: string;
};

export const WEATHER_LIST: WeatherInfo[] = [
  {
    id: "sunny",
    icon: "☀️",
    label: "はれ",
    bgGrad:
      "linear-gradient(155deg,#86efac 0%,#fde68a 35%,#fed7aa 65%,#86efac 100%)",
  },
  {
    id: "cloudy",
    icon: "⛅",
    label: "くもり",
    bgGrad:
      "linear-gradient(155deg,#e2e8f0 0%,#bfdbfe 35%,#dbeafe 65%,#e2e8f0 100%)",
  },
  {
    id: "hot",
    icon: "🔥",
    label: "もうしょ",
    bgGrad:
      "linear-gradient(155deg,#fde68a 0%,#fb923c 40%,#fde68a 70%,#fed7aa 100%)",
  },
  {
    id: "rainy",
    icon: "☔",
    label: "あめ",
    bgGrad:
      "linear-gradient(155deg,#93c5fd 0%,#bfdbfe 35%,#a5b4fc 65%,#93c5fd 100%)",
  },
  {
    id: "typhoon",
    icon: "🌀",
    label: "たいふう",
    bgGrad:
      "linear-gradient(155deg,#475569 0%,#64748b 30%,#7dd3fc 65%,#475569 100%)",
  },
];

// 2時間ごとにスロットが変わる（1日 = 12スロット）
const MS_PER_SLOT = 2 * 60 * 60 * 1000;

function getWeatherForNow(): WeatherInfo {
  const slot = Math.floor(Date.now() / MS_PER_SLOT);
  return WEATHER_LIST[slot % WEATHER_LIST.length];
}

// ── Context ────────────────────────────────────────────────────
type WeatherContextType = {
  weather: WeatherInfo;
};

const WeatherContext = createContext<WeatherContextType>({
  weather: WEATHER_LIST[0],
});

// ── Provider ───────────────────────────────────────────────────
export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [weather, setWeather] = useState<WeatherInfo>(getWeatherForNow);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback(() => {
    const now = Date.now();
    const nextSlotMs = (Math.floor(now / MS_PER_SLOT) + 1) * MS_PER_SLOT;
    const delay = nextSlotMs - now;

    timerRef.current = setTimeout(() => {
      setWeather(getWeatherForNow());
      scheduleNext(); // 次のスロットも予約
    }, delay);
  }, []);

  useEffect(() => {
    scheduleNext();
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [scheduleNext]);

  return (
    <WeatherContext.Provider value={{ weather }}>
      {children}
    </WeatherContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────
export function useWeather(): WeatherInfo {
  return useContext(WeatherContext).weather;
}
