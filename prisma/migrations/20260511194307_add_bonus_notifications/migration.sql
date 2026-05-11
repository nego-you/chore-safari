-- CreateTable
CREATE TABLE "special_bonus_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "coin_amount" INTEGER NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "special_bonus_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "special_bonus_notifications_user_id_is_read_idx" ON "special_bonus_notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "special_bonus_notifications_created_at_idx" ON "special_bonus_notifications"("created_at");

-- AddForeignKey
ALTER TABLE "special_bonus_notifications" ADD CONSTRAINT "special_bonus_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
