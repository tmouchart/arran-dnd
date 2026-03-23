-- Inventory items (JSONB array) + money fields on character
ALTER TABLE "character"
  ADD COLUMN IF NOT EXISTS "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "gold_coins" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "silver_coins" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "copper_coins" integer NOT NULL DEFAULT 0;
