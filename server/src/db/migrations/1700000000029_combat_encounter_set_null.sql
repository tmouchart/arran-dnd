ALTER TABLE "combat" DROP CONSTRAINT "combat_encounter_id_fkey";
ALTER TABLE "combat" ADD CONSTRAINT "combat_encounter_id_fkey"
  FOREIGN KEY ("encounter_id") REFERENCES "encounter_template"("id") ON DELETE SET NULL;
