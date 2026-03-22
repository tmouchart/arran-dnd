-- Current HP persisted on character (session UI uses PATCH /api/characters/:id)

ALTER TABLE "character" ADD COLUMN IF NOT EXISTS hp_current integer;

UPDATE "character" SET hp_current = hp_max WHERE hp_current IS NULL;

ALTER TABLE "character" ALTER COLUMN hp_current SET NOT NULL;
ALTER TABLE "character" ALTER COLUMN hp_current SET DEFAULT 10;
