-- 2026-06-12 一本道化リフォーム：罠設置（パッシブ罠）にも1日上限を設けるためのスタミナ列を User に追加。
--   daily_trap_count : 今日すでに仕掛けた罠の回数（0〜上限）
--   last_trap_date   : 最後に仕掛けたタイムスタンプ。アプリ側で「今日(JST)」と比較してリセット判定。
-- （アクティブ狩り用の daily_hunt_count / last_hunt_date と同じパターン）

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "daily_trap_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "last_trap_date" TIMESTAMP(3);
