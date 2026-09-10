-- Les murs tracés au doigt sur le champ de bataille (plan 23).
--
-- Un mur = { id, points: [{ x, z }] }, en cases, centre de la grille = 0,0.
-- Une table à part n'apporterait rien : on ne requête jamais un mur seul, on
-- lit et on écrit toujours la liste entière avec le combat.

ALTER TABLE "combat"
  ADD COLUMN IF NOT EXISTS "obstacles" jsonb NOT NULL DEFAULT '[]'::jsonb;
