-- CreateTable
CREATE TABLE "penalty_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "coin_amount" INTEGER NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "penalty_notifications_user_id_is_read_idx" ON "penalty_notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "penalty_notifications_created_at_idx" ON "penalty_notifications"("created_at");

-- AddForeignKey
ALTER TABLE "penalty_notifications" ADD CONSTRAINT "penalty_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
