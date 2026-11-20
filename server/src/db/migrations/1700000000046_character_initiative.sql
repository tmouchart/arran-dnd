-- Initiative finale calculée par la fiche (DEX, armure, passifs des voies, bonus).
-- Le combat la lit pour l'ordre de jeu. NULL = fiche pas encore ré-enregistrée :
-- le serveur retombe sur son ancien calcul (DEX - armure - bouclier + bonus).
ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "initiative" integer;
