ALTER TABLE character
  ADD COLUMN IF NOT EXISTS armor_id text,
  ADD COLUMN IF NOT EXISTS defense_bonus integer NOT NULL DEFAULT 0;
