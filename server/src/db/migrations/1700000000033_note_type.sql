-- Une note privée peut être un dessin ('text' | 'drawing').
ALTER TABLE "note" ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'text';
