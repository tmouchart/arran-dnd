ALTER TABLE "user"
  ADD COLUMN "active_campaign_id" integer REFERENCES "campaign"("id") ON DELETE SET NULL;
