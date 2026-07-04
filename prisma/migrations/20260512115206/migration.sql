-- CreateEnum
CREATE TYPE "quest_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reward_coins" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '⭐',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_submissions" (
    "id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "quest_status" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "quest_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quest_submissions_status_idx" ON "quest_submissions"("status");

-- CreateIndex
CREATE INDEX "quest_submissions_user_id_status_idx" ON "quest_submissions"("user_id", "status");

-- CreateIndex
CREATE INDEX "quest_submissions_quest_id_idx" ON "quest_submissions"("quest_id");

-- CreateIndex
CREATE INDEX "quest_submissions_submitted_at_idx" ON "quest_submissions"("submitted_at");

-- AddForeignKey
ALTER TABLE "quest_submissions" ADD CONSTRAINT "quest_submissions_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_submissions" ADD CONSTRAINT "quest_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
