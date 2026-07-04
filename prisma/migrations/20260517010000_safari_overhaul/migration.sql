-- 2026-05-17 大規模改修マイグレーション
--   1) Stage / Tool テーブル新設
--   2) Animal に habitat / stage_id 追加
--   3) ActiveTrap → Hunt にリネーム + hunt_type 列 + tool_id 列
--   4) enum trap_status → hunt_status にリネーム + 新 enum hunt_type / tool_type

-- ─────────────────────────────────────────────
-- 1) enum
-- ─────────────────────────────────────────────

-- trap_status を hunt_status にリネーム（存在しない環境のために安全に）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trap_status')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hunt_status') THEN
    EXECUTE 'ALTER TYPE "trap_status" RENAME TO "hunt_status"';
  END IF;
END$$;

-- hunt_type / tool_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hunt_type') THEN
    CREATE TYPE "hunt_type" AS ENUM ('TRAP', 'BOW', 'SPEAR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tool_type') THEN
    CREATE TYPE "tool_type" AS ENUM ('TRAP', 'BOW', 'SPEAR');
  END IF;
END$$;

-- ─────────────────────────────────────────────
-- 2) Stage
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "stages" (
  "id"               TEXT        PRIMARY KEY,
  "stage_id"         TEXT        NOT NULL UNIQUE,
  "name"             TEXT        NOT NULL,
  "emoji"            TEXT        NOT NULL DEFAULT '🌍',
  "description"      TEXT        NOT NULL DEFAULT '',
  "unlock_condition" TEXT,
  "sort_order"       INTEGER     NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 3) Tool
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "tools" (
  "id"                  TEXT         PRIMARY KEY,
  "tool_id"             TEXT         NOT NULL UNIQUE,
  "name"                TEXT         NOT NULL,
  "emoji"               TEXT         NOT NULL DEFAULT '🛠️',
  "description"         TEXT         NOT NULL DEFAULT '',
  "historical_context"  TEXT         NOT NULL DEFAULT '',
  "type"                "tool_type"  NOT NULL,
  "success_rate_bonus"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "inventory_item_id"   TEXT,
  "consumable"          BOOLEAN      NOT NULL DEFAULT true,
  "sort_order"          INTEGER      NOT NULL DEFAULT 0,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tools_type_idx" ON "tools"("type");

-- ─────────────────────────────────────────────
-- 4) Animal: habitat / stage_id 追加
-- ─────────────────────────────────────────────
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "habitat"   TEXT NOT NULL DEFAULT '';
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "stage_id"  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'animals_stage_id_fkey'
  ) THEN
    ALTER TABLE "animals"
      ADD CONSTRAINT "animals_stage_id_fkey"
      FOREIGN KEY ("stage_id") REFERENCES "stages"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "animals_stage_id_idx" ON "animals"("stage_id");

-- ─────────────────────────────────────────────
-- 5) CaughtAnimal: tool_id 追加
-- ─────────────────────────────────────────────
ALTER TABLE "caught_animals" ADD COLUMN IF NOT EXISTS "tool_id" TEXT;

-- ─────────────────────────────────────────────
-- 6) ActiveTrap → Hunt にリネーム
--    手順: テーブルを rename → 旧名で残ったインデックス/FK を rename → 新規列とインデックスを追加。
--    順序がポイント: 「新インデックスを CREATE IF NOT EXISTS」する前に古いものを rename し終えること。
-- ─────────────────────────────────────────────

-- 6-a) テーブル本体のリネーム
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'active_traps')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'hunts') THEN
    EXECUTE 'ALTER TABLE "active_traps" RENAME TO "hunts"';
  END IF;
END$$;

-- 6-b) hunts テーブルが存在しない場合（新規環境）は作成
CREATE TABLE IF NOT EXISTS "hunts" (
  "id"               TEXT         PRIMARY KEY,
  "user_id"          TEXT         NOT NULL,
  "trap_item_id"     TEXT         NOT NULL,
  "bait_item_id"     TEXT         NOT NULL,
  "status"           "hunt_status" NOT NULL DEFAULT 'PLACED',
  "placed_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appears_at"       TIMESTAMP(3) NOT NULL,
  "target_animal_id" TEXT         NOT NULL,
  "resolved_at"      TIMESTAMP(3),
  "pos_x"            DOUBLE PRECISION NOT NULL DEFAULT 50,
  "pos_y"            DOUBLE PRECISION NOT NULL DEFAULT 50
);

-- 6-c) 旧 active_traps_* というインデックス名が残っていれば hunts_* にリネーム。
--      （CREATE INDEX IF NOT EXISTS より前に必ず実行する）
DO $$
DECLARE
  r RECORD;
  new_name TEXT;
BEGIN
  FOR r IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'hunts'
      AND indexname LIKE 'active_traps_%'
  LOOP
    new_name := replace(r.indexname, 'active_traps_', 'hunts_');
    -- ぶつかる場合は古い方を捨てて新しい方を残す
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = new_name) THEN
      EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    ELSE
      EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname, new_name);
    END IF;
  END LOOP;
END$$;

-- 6-d) 旧 active_traps_* FK 名を hunts_* にリネーム
DO $$
DECLARE
  r RECORD;
  new_name TEXT;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conname LIKE 'active_traps_%'
  LOOP
    new_name := replace(r.conname, 'active_traps_', 'hunts_');
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = new_name) THEN
      EXECUTE format('ALTER TABLE "hunts" DROP CONSTRAINT %I', r.conname);
    ELSE
      EXECUTE format('ALTER TABLE "hunts" RENAME CONSTRAINT %I TO %I', r.conname, new_name);
    END IF;
  END LOOP;
END$$;

-- 6-e) 新規列を追加
ALTER TABLE "hunts" ADD COLUMN IF NOT EXISTS "hunt_type" "hunt_type" NOT NULL DEFAULT 'TRAP';
ALTER TABLE "hunts" ADD COLUMN IF NOT EXISTS "tool_id"   TEXT;

-- 6-f) インデックス（既に rename 済みであれば NO-OP）
CREATE INDEX IF NOT EXISTS "hunts_user_id_status_idx"   ON "hunts"("user_id", "status");
CREATE INDEX IF NOT EXISTS "hunts_appears_at_idx"       ON "hunts"("appears_at");
CREATE INDEX IF NOT EXISTS "hunts_target_animal_id_idx" ON "hunts"("target_animal_id");
CREATE INDEX IF NOT EXISTS "hunts_hunt_type_idx"        ON "hunts"("hunt_type");

-- 6-g) 外部キー（既にあればスキップ）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hunts_user_id_fkey') THEN
    ALTER TABLE "hunts" ADD CONSTRAINT "hunts_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hunts_target_animal_id_fkey') THEN
    ALTER TABLE "hunts" ADD CONSTRAINT "hunts_target_animal_id_fkey"
      FOREIGN KEY ("target_animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hunts_tool_id_fkey') THEN
    ALTER TABLE "hunts" ADD CONSTRAINT "hunts_tool_id_fkey"
      FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
