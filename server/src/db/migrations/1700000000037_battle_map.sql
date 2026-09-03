-- Champ de bataille 3D.
--
-- La position d'un pion est libre : ce n'est pas un index de case mais des
-- coordonnées en cases (le centre de la grille est 0,0), avec des décimales.
-- NULL = jamais placé — le client pose alors le pion à sa place de départ.

ALTER TABLE "combat_participant"
  ADD COLUMN IF NOT EXISTS "pos_x" real,
  ADD COLUMN IF NOT EXISTS "pos_y" real;

-- Le décor de la carte, choisi par le MJ. Voir `client/src/components/battle/environments.ts`.
ALTER TABLE "combat"
  ADD COLUMN IF NOT EXISTS "environment" varchar(40) NOT NULL DEFAULT 'foret';
