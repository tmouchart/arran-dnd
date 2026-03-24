ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "competences" jsonb NOT NULL DEFAULT '[]'::jsonb;
