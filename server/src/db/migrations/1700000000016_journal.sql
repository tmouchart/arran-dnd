-- Notes personnelles par utilisateur
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "notes_perso" text NOT NULL DEFAULT '';

-- Journal de la compagnie (singleton : une seule ligne, id=1)
CREATE TABLE IF NOT EXISTS "journal_compagnie" (
  "id"         integer PRIMARY KEY DEFAULT 1,
  "content"    text NOT NULL DEFAULT '',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Insérer la ligne singleton si elle n'existe pas
INSERT INTO "journal_compagnie" ("id", "content") VALUES (1, '')
  ON CONFLICT ("id") DO NOTHING;
