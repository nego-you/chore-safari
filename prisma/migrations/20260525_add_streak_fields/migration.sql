-- AddStreakFields: User モデルにストリーク（連続達成）管理フィールドを追加
ALTER TABLE "users" ADD COLUMN "current_streak"          INTEGER   NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "longest_streak"          INTEGER   NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "last_quest_completed_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "streak_status"           TEXT      NOT NULL DEFAULT 'ACTIVE';
