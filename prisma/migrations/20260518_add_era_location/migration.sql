-- Migration: add era and location to animals and tools
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "era"      TEXT NOT NULL DEFAULT '';
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "location" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tools"   ADD COLUMN IF NOT EXISTS "era"      TEXT NOT NULL DEFAULT '';
ALTER TABLE "tools"   ADD COLUMN IF NOT EXISTS "location" TEXT NOT NULL DEFAULT '';
