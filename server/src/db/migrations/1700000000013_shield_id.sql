-- Séparation armure / bouclier : chaque personnage peut porter les deux indépendamment
ALTER TABLE "character" ADD COLUMN "shield_id" text;
