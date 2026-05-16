-- AlterTable: Animalテーブルに博物学フィールドを追加
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "generic_name"  TEXT NOT NULL DEFAULT '';
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "specific_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "is_extinct"    BOOLEAN NOT NULL DEFAULT false;

-- Index
CREATE INDEX IF NOT EXISTS "animals_generic_name_idx" ON "animals"("generic_name");
