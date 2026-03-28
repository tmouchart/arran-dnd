ALTER TABLE "journal_compagnie"
  ADD COLUMN IF NOT EXISTS "updated_by_user_id" integer REFERENCES "user"("id");
