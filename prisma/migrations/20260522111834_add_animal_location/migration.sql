-- AlterTable
ALTER TABLE "caught_animals" ADD COLUMN     "is_graduated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reward_claimed" BOOLEAN NOT NULL DEFAULT false;
