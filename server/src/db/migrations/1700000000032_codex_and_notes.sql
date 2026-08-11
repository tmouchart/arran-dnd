-- Phase 3 (notes & mentions) : fiches codex par campagne + notes privées par joueur.
-- journal_pages reste inchangé ; user.notes_perso est conservé (retiré plus tard).

CREATE TABLE IF NOT EXISTS "codex_entry" (
  "id"                 serial PRIMARY KEY,
  "campaign_id"        integer NOT NULL REFERENCES "campaign"("id") ON DELETE CASCADE,
  "type"               text NOT NULL,
  "name"               text NOT NULL,
  "description"        text NOT NULL DEFAULT '',
  "created_by_user_id" integer NOT NULL REFERENCES "user"("id"),
  "created_at"         timestamptz NOT NULL DEFAULT now(),
  "updated_at"         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "note" (
  "id"            serial PRIMARY KEY,
  "owner_user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title"         text NOT NULL DEFAULT '',
  "content"       text NOT NULL DEFAULT '',
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now()
);

-- Migre le blob notes_perso de chaque joueur vers une note privée.
INSERT INTO "note" ("owner_user_id", "title", "content")
SELECT "id", 'Anciennes notes', "notes_perso"
FROM "user"
WHERE "notes_perso" <> '';
