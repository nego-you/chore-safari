-- Migration: 恩送りイベントシステム（kizuna_points / helped_grandma）を User テーブルに追加
-- 2026-05-25

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "kizuna_points" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "helped_grandma" BOOLEAN NOT NULL DEFAULT false;
