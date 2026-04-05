CREATE TABLE IF NOT EXISTS "campaign" (
  "id" serial PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "gm_user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "campaign_member" (
  "id" serial PRIMARY KEY,
  "campaign_id" integer NOT NULL REFERENCES "campaign"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "character_id" integer REFERENCES "character"("id") ON DELETE SET NULL,
  "joined_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_campaign_member" ON "campaign_member" ("campaign_id", "user_id");
