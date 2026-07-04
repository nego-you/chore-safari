-- AlterTable: User に activeGuideAnimalId カラムを追加
ALTER TABLE "users" ADD COLUMN "active_guide_animal_id" TEXT;

-- AddForeignKey: users.active_guide_animal_id → caught_animals.id
ALTER TABLE "users" ADD CONSTRAINT "users_active_guide_animal_id_fkey"
  FOREIGN KEY ("active_guide_animal_id")
  REFERENCES "caught_animals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
