-- AlterTable
ALTER TABLE "quests" ADD COLUMN     "target_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
