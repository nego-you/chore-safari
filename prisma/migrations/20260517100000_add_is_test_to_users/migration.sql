-- AlterTable: テスト用フラグを追加
ALTER TABLE "users" ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false;
