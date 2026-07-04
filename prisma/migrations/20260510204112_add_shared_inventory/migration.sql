-- CreateEnum
CREATE TYPE "item_type" AS ENUM ('FOOD', 'TRAP_PART');

-- CreateTable
CREATE TABLE "shared_inventory" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "item_type" "item_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_inventory_item_id_key" ON "shared_inventory"("item_id");

-- CreateIndex
CREATE INDEX "shared_inventory_item_type_idx" ON "shared_inventory"("item_type");
