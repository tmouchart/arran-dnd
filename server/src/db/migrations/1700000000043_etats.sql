ALTER TABLE "character" ADD COLUMN "states" jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE "character" SET "states" = '["affaibli"]'::jsonb WHERE "affaibli" = true;
ALTER TABLE "character" DROP COLUMN "affaibli";
ALTER TABLE "combat_participant" ADD COLUMN "states" jsonb NOT NULL DEFAULT '[]'::jsonb;
