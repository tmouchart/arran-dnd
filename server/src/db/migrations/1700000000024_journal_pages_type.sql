ALTER TABLE "journal_pages" ADD COLUMN IF NOT EXISTS "type" varchar(20) NOT NULL DEFAULT 'text';
