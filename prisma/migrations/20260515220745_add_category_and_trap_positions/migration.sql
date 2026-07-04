-- AlterTable
ALTER TABLE "active_traps" ADD COLUMN     "pos_x" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "pos_y" DOUBLE PRECISION NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "quests" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'CHORE';

-- CreateTable
CREATE TABLE "penalties" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coin_amount" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🚨',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PenaltyToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PenaltyToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PenaltyToUser_B_index" ON "_PenaltyToUser"("B");

-- AddForeignKey
ALTER TABLE "_PenaltyToUser" ADD CONSTRAINT "_PenaltyToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "penalties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PenaltyToUser" ADD CONSTRAINT "_PenaltyToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
