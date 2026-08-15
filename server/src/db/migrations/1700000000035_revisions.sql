-- Historique de versions pour tout contenu éditable de journal.
-- Sert deux buts : détecter les écrasements concurrents (409) et permettre
-- de revenir à une version antérieure.

ALTER TABLE journal_compagnie ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE journal_pages     ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE note              ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE codex_entry       ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS revision (
  id             serial PRIMARY KEY,
  -- journal_compagnie | journal_page | note | codex_entry
  entity_type    varchar(30) NOT NULL,
  entity_id      integer     NOT NULL,
  version        integer     NOT NULL,
  -- État complet des champs versionnés de l'entité à cette version.
  snapshot       jsonb       NOT NULL,
  author_user_id integer REFERENCES "user"(id) ON DELETE SET NULL,
  -- Dénormalisé : l'historique reste lisible même si le joueur change de perso.
  author_name    text        NOT NULL DEFAULT '',
  -- edit | restore
  kind           varchar(10) NOT NULL DEFAULT 'edit',
  -- Caractères gagnés/perdus vs la version précédente (repère visuel dans l'UI).
  size_delta     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS revision_entity_version
  ON revision (entity_type, entity_id, version);

CREATE INDEX IF NOT EXISTS revision_entity_recent
  ON revision (entity_type, entity_id, created_at DESC);
