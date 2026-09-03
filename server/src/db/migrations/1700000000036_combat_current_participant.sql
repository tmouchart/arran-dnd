-- Le tour courant était stocké comme un INDEX de position dans la liste triée
-- par initiative. Cette liste n'existe pas en base : elle est recalculée à
-- chaque requête. Ajouter ou retirer un participant décalait donc l'index et
-- changeait le tour courant tout seul.
-- On stocke maintenant QUI joue, pas OÙ. L'index redevient une simple vue.

ALTER TABLE "combat"
  ADD COLUMN IF NOT EXISTS "current_participant_id" integer
  REFERENCES "combat_participant"("id") ON DELETE SET NULL;

-- Reprise des combats en cours : on résout l'index actuel vers l'id
-- correspondant, avec le même tri que le serveur (initiative DESC, id ASC).
UPDATE "combat" c
SET "current_participant_id" = ranked."id"
FROM (
  SELECT
    p."id",
    p."combat_id",
    row_number() OVER (
      PARTITION BY p."combat_id"
      ORDER BY p."initiative" DESC, p."id" ASC
    ) - 1 AS idx
  FROM "combat_participant" p
) ranked
WHERE ranked."combat_id" = c."id"
  AND ranked.idx = c."current_turn_index"
  AND c."current_participant_id" IS NULL;

ALTER TABLE "combat" DROP COLUMN IF EXISTS "current_turn_index";
