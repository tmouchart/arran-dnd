CREATE TABLE IF NOT EXISTS "journal_pages" (
  "id"                 serial PRIMARY KEY,
  "title"              varchar(255) NOT NULL,
  "content"            text NOT NULL DEFAULT '',
  "created_by_user_id" integer NOT NULL REFERENCES "user"("id"),
  "updated_by_user_id" integer REFERENCES "user"("id"),
  "created_at"         timestamptz NOT NULL DEFAULT now(),
  "updated_at"         timestamptz NOT NULL DEFAULT now()
);
