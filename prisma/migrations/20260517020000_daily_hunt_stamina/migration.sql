-- 2026-05-17 アクティブ狩り（BOW/SPEAR）1日3回制限のためのスタミナ列を User に追加。
--   daily_hunt_count : 今日すでに消費した狩り回数（0〜上限）
--   last_hunt_date   : 最後に消費したタイムスタンプ。アプリ側で「今日」と比較してリセット判定。

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "daily_hunt_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "last_hunt_date" TIMESTAMP(3);
