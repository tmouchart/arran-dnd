ALTER TABLE "character" ADD COLUMN "mp_current" integer NOT NULL DEFAULT 0;

-- Initialise mp_current to mp_max for existing characters
UPDATE "character" SET "mp_current" = "mp_max";
