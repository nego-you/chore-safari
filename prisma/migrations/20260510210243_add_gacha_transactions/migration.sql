-- AlterEnum
ALTER TYPE "coin_tx_kind" ADD VALUE 'GACHA';

-- CreateTable
CREATE TABLE "gacha_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cost_amount" INTEGER NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_type" "item_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gacha_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gacha_transactions_user_id_idx" ON "gacha_transactions"("user_id");

-- CreateIndex
CREATE INDEX "gacha_transactions_created_at_idx" ON "gacha_transactions"("created_at");

-- AddForeignKey
ALTER TABLE "gacha_transactions" ADD CONSTRAINT "gacha_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
