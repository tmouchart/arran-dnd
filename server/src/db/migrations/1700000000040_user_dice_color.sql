-- Couleur de dé du joueur : son dé 3D s'affiche dans cette couleur, chez lui
-- comme chez les autres membres de la campagne.
-- NULL = couleur par défaut, choisie d'après son rang d'entrée dans la campagne.

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "dice_color" varchar(7);
