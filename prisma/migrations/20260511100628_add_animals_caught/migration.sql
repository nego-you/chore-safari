-- CreateEnum
CREATE TYPE "rarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateTable
CREATE TABLE "animals" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" "rarity" NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🐾',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caught_animals" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "caught_by_user_id" TEXT NOT NULL,
    "trap_item_id" TEXT,
    "food_item_id" TEXT,
    "caught_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caught_animals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "animals_animal_id_key" ON "animals"("animal_id");

-- CreateIndex
CREATE INDEX "animals_rarity_idx" ON "animals"("rarity");

-- CreateIndex
CREATE INDEX "caught_animals_animal_id_idx" ON "caught_animals"("animal_id");

-- CreateIndex
CREATE INDEX "caught_animals_caught_by_user_id_idx" ON "caught_animals"("caught_by_user_id");

-- CreateIndex
CREATE INDEX "caught_animals_caught_at_idx" ON "caught_animals"("caught_at");

-- AddForeignKey
ALTER TABLE "caught_animals" ADD CONSTRAINT "caught_animals_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caught_animals" ADD CONSTRAINT "caught_animals_caught_by_user_id_fkey" FOREIGN KEY ("caught_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
