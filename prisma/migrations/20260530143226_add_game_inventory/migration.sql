-- CreateTable
CREATE TABLE "game_inventory_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_inventory_items_user_id_idx" ON "game_inventory_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_inventory_items_user_id_item_key_key" ON "game_inventory_items"("user_id", "item_key");

-- AddForeignKey
ALTER TABLE "game_inventory_items" ADD CONSTRAINT "game_inventory_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
