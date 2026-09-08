-- Style de dé du joueur : fond (uni ou dégradé) + couleur des chiffres.
-- Remplace `dice_color`, qui ne portait qu'un aplat.
-- NULL = style par défaut, choisi d'après son rang d'entrée dans la campagne.
--
-- `dice_color` est conservée volontairement : c'est la source des styles
-- convertis ci-dessous et le repli si on doit revenir en arrière. Elle sera
-- supprimée dans une migration ultérieure.

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "dice_style" jsonb;

UPDATE "user"
   SET "dice_style" = jsonb_build_object(
         'bg', jsonb_build_object('type', 'solid', 'from', "dice_color"),
         'ink', NULL)
 WHERE "dice_color" IS NOT NULL AND "dice_style" IS NULL;
