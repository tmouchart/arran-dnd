CREATE TABLE IF NOT EXISTS "combat" (
  "id" serial PRIMARY KEY,
  "campaign_id" integer NOT NULL REFERENCES "campaign"("id") ON DELETE CASCADE,
  "encounter_id" integer REFERENCES "encounter_template"("id"),
  "name" varchar(200) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "current_turn_index" integer NOT NULL DEFAULT 0,
  "round_number" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "combat_participant" (
  "id" serial PRIMARY KEY,
  "combat_id" integer NOT NULL REFERENCES "combat"("id") ON DELETE CASCADE,
  "kind" varchar(10) NOT NULL,
  "user_id" integer REFERENCES "user"("id"),
  "name" text NOT NULL,
  "initiative" integer NOT NULL,
  "hp_max" integer NOT NULL,
  "hp_current" integer NOT NULL,
  "def" integer NOT NULL DEFAULT 10,
  "nc" real,
  "stat_for" integer,
  "stat_dex" integer,
  "stat_con" integer,
  "stat_int" integer,
  "stat_sag" integer,
  "stat_cha" integer,
  "attacks" jsonb,
  "abilities" jsonb,
  "monster_description" text
);
