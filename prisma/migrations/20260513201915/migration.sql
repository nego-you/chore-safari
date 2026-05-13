-- CreateEnum
CREATE TYPE "trap_status" AS ENUM ('PLACED', 'APPEARED', 'CAUGHT', 'ESCAPED');

-- CreateTable
CREATE TABLE "active_traps" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trap_item_id" TEXT NOT NULL,
    "bait_item_id" TEXT NOT NULL,
    "status" "trap_status" NOT NULL DEFAULT 'PLACED',
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appears_at" TIMESTAMP(3) NOT NULL,
    "target_animal_id" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "active_traps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "active_traps_user_id_status_idx" ON "active_traps"("user_id", "status");

-- CreateIndex
CREATE INDEX "active_traps_appears_at_idx" ON "active_traps"("appears_at");

-- CreateIndex
CREATE INDEX "active_traps_target_animal_id_idx" ON "active_traps"("target_animal_id");

-- AddForeignKey
ALTER TABLE "active_traps" ADD CONSTRAINT "active_traps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_traps" ADD CONSTRAINT "active_traps_target_animal_id_fkey" FOREIGN KEY ("target_animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
