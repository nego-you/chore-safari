-- AlterTable
ALTER TABLE "caught_animals" ADD COLUMN     "intimacy_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "personality_id" INTEGER;

-- CreateTable
CREATE TABLE "personalities" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "first_person" TEXT NOT NULL,
    "tone_rule" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personalities_name_key" ON "personalities"("name");

-- CreateIndex
CREATE INDEX "user_activities_user_id_idx" ON "user_activities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_activities_user_id_feature_id_key" ON "user_activities"("user_id", "feature_id");

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caught_animals" ADD CONSTRAINT "caught_animals_personality_id_fkey" FOREIGN KEY ("personality_id") REFERENCES "personalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
