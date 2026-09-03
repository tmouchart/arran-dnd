-- Réserve préparée d'avance : un monstre marqué caché dans une rencontre
-- démarre le combat en réserve, hors initiative et invisible pour les joueurs.

ALTER TABLE "encounter_monster"
  ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false;
