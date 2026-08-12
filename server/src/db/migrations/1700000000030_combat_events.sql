CREATE TABLE IF NOT EXISTS "combat_event" (
  "id" serial PRIMARY KEY,
  "combat_id" integer NOT NULL REFERENCES "combat"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "actor_name" text NOT NULL,
  "visibility" varchar(10) NOT NULL DEFAULT 'public',
  "kind" varchar(20) NOT NULL,
  "label" text NOT NULL,
  "context" varchar(30) NOT NULL DEFAULT 'combat',
  "die" integer NOT NULL,
  "sides" integer NOT NULL,
  "bonus" integer NOT NULL DEFAULT 0,
  "total" integer NOT NULL,
  "rolls" jsonb,
  "damage" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "combat_event_combat_id_idx" ON "combat_event" ("combat_id");
