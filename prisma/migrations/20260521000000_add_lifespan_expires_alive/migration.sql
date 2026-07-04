-- AlterTable: Animal に lifespan_years を追加
ALTER TABLE "animals" ADD COLUMN "lifespan_years" INTEGER NOT NULL DEFAULT 10;

-- AlterTable: CaughtAnimal に expires_at と is_alive を追加
ALTER TABLE "caught_animals" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "caught_animals" ADD COLUMN "is_alive" BOOLEAN NOT NULL DEFAULT true;
