// lib/streak.ts
// ─────────────────────────────────────────────────────────────────────────────
// ストリーク（連続お手伝い達成ボーナス）の判定ロジック。
// サーバー側（approveQuest トランザクション内）から呼ばれる純粋関数群。
// ─────────────────────────────────────────────────────────────────────────────

// ストリークの状態
export type StreakStatus = "ACTIVE" | "HOLD";

// 現在のストリーク情報（DB の User フィールドに対応）
export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastQuestCompletedAt: Date | null;
  streakStatus: string; // "ACTIVE" | "HOLD"
};

// 判定結果：DB に書き込むフィールドの差分
export type StreakUpdateResult = {
  currentStreak: number;
  longestStreak: number;
  lastQuestCompletedAt: Date;
  streakStatus: StreakStatus;
  /** ストリークが増えた（+1）場合 true */
  didIncrement: boolean;
  /** 達成したマイルストーン（なければ null） */
  milestone: StreakMilestone | null;
};

// マイルストーン定義
export type StreakMilestone = {
  days: number;
  label: string;
  bonusCoins: number;
  // SharedInventoryItem に追加するアイテム（null なら素材なし）
  bonusItem: { itemId: string; itemName: string; itemType: "FARM_SUPPLY" | "CRAFT_PART"; quantity: number } | null;
};

// 達成するマイルストーン一覧（日数の昇順）
export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    days: 3,
    label: "3日れんぞく！",
    bonusCoins: 150,
    bonusItem: {
      itemId: "animal_feces",
      itemName: "💩 どうぶつのフン",
      itemType: "FARM_SUPPLY",
      quantity: 1,
    },
  },
  {
    days: 7,
    label: "7日れんぞく！",
    bonusCoins: 500,
    bonusItem: {
      itemId: "iron_fragment",
      itemName: "⚙️ てつのかけら",
      itemType: "CRAFT_PART",
      quantity: 1,
    },
  },
];

/**
 * 日本時間でのJST「日付文字列 YYYY-MM-DD」を返す。
 * サーバー環境のタイムゾーンに依存しないように UTC+9 で計算する。
 */
function toJSTDateString(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * 2つの Date の JST 日付差（日数）を返す。
 * daysDiff(A, B) > 0 なら B は A より後。
 */
function daysDiff(earlier: Date, later: Date): number {
  const a = toJSTDateString(earlier);
  const b = toJSTDateString(later);
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}

/**
 * クエスト承認時にストリーク状態を計算する。
 *
 * @param current  - 現在の DB 上のストリーク状態
 * @param now      - 承認時刻（通常は `new Date()`）
 * @param todayApprovedCount - 今日（JST）にすでに APPROVED になったクエスト数（この承認を含まない）
 * @returns 更新後のストリーク情報
 */
export function computeStreakUpdate(
  current: StreakState,
  now: Date,
  todayApprovedCount: number,
): StreakUpdateResult {
  const { currentStreak, longestStreak, lastQuestCompletedAt, streakStatus } = current;

  let nextStreak = currentStreak;
  let nextStatus: StreakStatus = streakStatus === "HOLD" ? "HOLD" : "ACTIVE";
  let didIncrement = false;

  if (lastQuestCompletedAt === null) {
    // 初回
    nextStreak = 1;
    nextStatus = "ACTIVE";
    didIncrement = true;
  } else {
    const diff = daysDiff(lastQuestCompletedAt, now);

    if (diff === 0) {
      // 今日すでに達成済み → ストリーク数は変えない（ただし HOLD 復帰チェックは行う）
      if (streakStatus === "HOLD") {
        // HOLD 中に当日2クエスト目をクリア → 復活
        // todayApprovedCount は「この承認より前に今日承認されたもの」なので
        // 1 以上 = 今日2個目以降 ということになる
        if (todayApprovedCount >= 1) {
          nextStatus = "ACTIVE";
          didIncrement = false; // 日数は変えずに復帰のみ
        }
      }
    } else if (diff === 1) {
      // 前日に達成 → 連続継続
      nextStreak = currentStreak + 1;
      nextStatus = "ACTIVE";
      didIncrement = true;
    } else if (diff === 2) {
      // 1日空いた（HOLD 移行 or 復活）
      if (streakStatus === "HOLD") {
        // すでに HOLD だったのにまた1日空いた = 2日連続空き → リセット
        nextStreak = 1;
        nextStatus = "ACTIVE";
        didIncrement = true;
      } else {
        // 初めて1日空いた → HOLD に移行（カウントは維持）
        nextStatus = "HOLD";
        didIncrement = false;
      }
    } else {
      // 2日以上空いた → リセット
      nextStreak = 1;
      nextStatus = "ACTIVE";
      didIncrement = true;
    }
  }

  const nextLongest = Math.max(longestStreak, nextStreak);

  // マイルストーン判定（増加したときだけチェック）
  let milestone: StreakMilestone | null = null;
  if (didIncrement) {
    milestone =
      STREAK_MILESTONES.find((m) => m.days === nextStreak) ?? null;
  }

  return {
    currentStreak: nextStreak,
    longestStreak: nextLongest,
    lastQuestCompletedAt: now,
    streakStatus: nextStatus,
    didIncrement,
    milestone,
  };
}
