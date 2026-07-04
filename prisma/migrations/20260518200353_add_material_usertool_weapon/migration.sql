-- AlterEnum
ALTER TYPE "hunt_type" ADD VALUE 'WEAPON';

-- AlterEnum
ALTER TYPE "item_type" ADD VALUE 'MATERIAL';

-- AlterEnum
ALTER TYPE "tool_type" ADD VALUE 'WEAPON';

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📦',
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_materials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tools" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tool_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materials_material_id_key" ON "materials"("material_id");

-- CreateIndex
CREATE INDEX "user_materials_user_id_idx" ON "user_materials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_materials_user_id_material_id_key" ON "user_materials"("user_id", "material_id");

-- CreateIndex
CREATE INDEX "user_tools_user_id_idx" ON "user_tools"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tools_user_id_tool_id_key" ON "user_tools"("user_id", "tool_id");

-- AddForeignKey
ALTER TABLE "user_materials" ADD CONSTRAINT "user_materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_materials" ADD CONSTRAINT "user_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tools" ADD CONSTRAINT "user_tools_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tools" ADD CONSTRAINT "user_tools_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
