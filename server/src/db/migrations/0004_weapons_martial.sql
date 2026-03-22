ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "weapons" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "martial_formations" jsonb DEFAULT '[]'::jsonb NOT NULL;
