ALTER TABLE "character" ADD COLUMN IF NOT EXISTS attack_contact_bonus  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "character" ADD COLUMN IF NOT EXISTS attack_distance_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "character" ADD COLUMN IF NOT EXISTS attack_magique_bonus  INTEGER NOT NULL DEFAULT 0;
-- Reset initiative_bonus to 0 (was storing raw DEX, now used as custom bonus)
UPDATE "character" SET initiative_bonus = 0;
