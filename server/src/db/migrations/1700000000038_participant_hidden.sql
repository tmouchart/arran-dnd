-- PNJ cachés : renforts et embuscades préparés d'avance par le MJ.
-- Un caché est hors de l'ordre d'initiative et invisible pour les joueurs
-- tant que le MJ ne l'a pas fait entrer en scène.
-- Seul un monstre peut être caché ; un joueur ne l'est jamais.

ALTER TABLE "combat_participant"
  ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false;
