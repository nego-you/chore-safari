/*
  Warnings:

  - You are about to drop the column `target_user_id` on the `quests` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "quests" DROP CONSTRAINT "quests_target_user_id_fkey";

-- AlterTable
ALTER TABLE "quests" DROP COLUMN "target_user_id";

-- CreateTable
CREATE TABLE "_QuestToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_QuestToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_QuestToUser_B_index" ON "_QuestToUser"("B");

-- AddForeignKey
ALTER TABLE "_QuestToUser" ADD CONSTRAINT "_QuestToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestToUser" ADD CONSTRAINT "_QuestToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
