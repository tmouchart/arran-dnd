-- Le log de jets passe du combat à la campagne : le combat devient un simple tag.
ALTER TABLE "combat_event" RENAME TO "roll_event";

ALTER TABLE "roll_event"
  ADD COLUMN "campaign_id" integer REFERENCES "campaign"("id") ON DELETE CASCADE;

UPDATE "roll_event" e
  SET "campaign_id" = c."campaign_id"
  FROM "combat" c
  WHERE c."id" = e."combat_id";

-- Sécurité : une entrée orpheline (combat supprimé) n'a plus de campagne connue.
DELETE FROM "roll_event" WHERE "campaign_id" IS NULL;

ALTER TABLE "roll_event" ALTER COLUMN "campaign_id" SET NOT NULL;
ALTER TABLE "roll_event" ALTER COLUMN "combat_id" DROP NOT NULL;

-- Filtre PJ / PNJ. Jusqu'ici la seule trace d'un jet de monstre était sa visibilité.
ALTER TABLE "roll_event"
  ADD COLUMN "actor_kind" varchar(10) NOT NULL DEFAULT 'player';
UPDATE "roll_event" SET "actor_kind" = 'monster' WHERE "visibility" = 'gm';

CREATE INDEX IF NOT EXISTS "roll_event_campaign_idx"
  ON "roll_event" ("campaign_id", "created_at" DESC);
