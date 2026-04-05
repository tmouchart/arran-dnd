CREATE TABLE IF NOT EXISTS "encounter_template" (
  "id" serial PRIMARY KEY,
  "campaign_id" integer NOT NULL REFERENCES "campaign"("id") ON DELETE CASCADE,
  "name" varchar(200) NOT NULL,
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "encounter_monster" (
  "id" serial PRIMARY KEY,
  "encounter_id" integer NOT NULL REFERENCES "encounter_template"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "nc" real NOT NULL DEFAULT 0,
  "size" text NOT NULL DEFAULT 'moyenne',
  "def" integer NOT NULL DEFAULT 10,
  "pv" integer NOT NULL DEFAULT 1,
  "init" integer NOT NULL DEFAULT 0,
  "rd" text,
  "stat_for" integer NOT NULL DEFAULT 0,
  "stat_dex" integer NOT NULL DEFAULT 0,
  "stat_con" integer NOT NULL DEFAULT 0,
  "stat_int" integer NOT NULL DEFAULT 0,
  "stat_sag" integer NOT NULL DEFAULT 0,
  "stat_cha" integer NOT NULL DEFAULT 0,
  "attacks" jsonb NOT NULL DEFAULT '[]',
  "abilities" jsonb NOT NULL DEFAULT '[]',
  "description" text
);
