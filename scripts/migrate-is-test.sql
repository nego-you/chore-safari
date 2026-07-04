-- テストユーザー用フラグの追加
-- 実行方法: npm run db:migrate
-- または、既存のDBに直接当てる場合:
--   psql $DATABASE_URL -f scripts/migrate-is-test.sql

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_test" BOOLEAN NOT NULL DEFAULT false;
