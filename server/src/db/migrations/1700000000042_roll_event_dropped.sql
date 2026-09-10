-- Un jet peut lancer plusieurs dés et n'en garder qu'un (avantage, relance).
-- `rolls` = les dés qui comptent et s'additionnent ; `dropped` = ceux qui ont
-- été lancés puis écartés. Nullable : les jets déjà en base restent lisibles.
ALTER TABLE "roll_event" ADD COLUMN "dropped" jsonb;
