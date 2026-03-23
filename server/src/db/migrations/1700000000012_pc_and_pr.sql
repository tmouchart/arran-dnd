-- Points de Chance (PC) et Points de Récupération (PR)
ALTER TABLE "character" ADD COLUMN "pc_current" integer NOT NULL DEFAULT 0;
ALTER TABLE "character" ADD COLUMN "pr_current" integer NOT NULL DEFAULT 5;
