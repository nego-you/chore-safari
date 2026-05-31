-- AlterTable
ALTER TABLE "users" ADD COLUMN     "kindness_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kizuna_badge_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kizuna_fired_date" TEXT,
ADD COLUMN     "kizuna_plan_date" TEXT,
ADD COLUMN     "kizuna_plan_kind" TEXT,
ADD COLUMN     "pending_returns" INTEGER NOT NULL DEFAULT 0;
