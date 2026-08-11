-- Player participants no longer carry an HP snapshot: the character sheet is the
-- single source of truth (enrichParticipantHp). Make the columns nullable and
-- clear existing player snapshots.
ALTER TABLE combat_participant ALTER COLUMN hp_max DROP NOT NULL;
ALTER TABLE combat_participant ALTER COLUMN hp_current DROP NOT NULL;

UPDATE combat_participant SET hp_max = NULL, hp_current = NULL WHERE kind = 'player';
