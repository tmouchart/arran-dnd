ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "hp_level_gains" jsonb NOT NULL DEFAULT '[]';
