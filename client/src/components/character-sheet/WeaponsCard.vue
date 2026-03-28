<script setup lang="ts">
import { computed, ref } from "vue";
import AppCard from "../ui/AppCard.vue";
import AppInput from "../ui/AppInput.vue";
import AppButton from "../ui/AppButton.vue";
import { WEAPONS_CATALOG } from "../../data/weaponsCatalog";
import { MARTIAL_WEAPON_CATEGORIES } from "../../data/martialWeaponCategories";
import type { Character, WeaponRow } from "../../types/character";

const props = defineProps<{ character: Character }>();

const catalogPick = ref("");

const weaponsByCategory = computed(() =>
  MARTIAL_WEAPON_CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    weapons: WEAPONS_CATALOG.filter((w) => w.martialFamily === cat.id)
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
  })).filter((g) => g.weapons.length > 0),
);

function weaponRowFromCatalog(entry: (typeof WEAPONS_CATALOG)[number]): WeaponRow {
  return {
    id: crypto.randomUUID(),
    name: entry.name,
    attackType: entry.attackType,
    damageDice: entry.damageDice,
    damageAbility: entry.damageAbility,
    martialFamily: entry.martialFamily,
    rangeMeters: entry.rangeMeters,
    catalogId: entry.id,
    notes: entry.notes,
  };
}

function onCatalogWeaponChange() {
  const entry = WEAPONS_CATALOG.find((w) => w.id === catalogPick.value);
  if (!entry) return;
  props.character.weapons.push(weaponRowFromCatalog(entry));
  catalogPick.value = "";
}

function addCustomWeapon() {
  props.character.weapons.push({
    id: crypto.randomUUID(),
    name: "",
    attackType: "contact",
    damageDice: "1d6",
    damageAbility: "strength",
    martialFamily: "guerre",
    rangeMeters: null,
  });
}

function removeWeapon(i: number) { props.character.weapons.splice(i, 1); }

function damageAbilitySelectValue(w: WeaponRow): string { return w.damageAbility ?? ""; }

function setDamageAbilityFromSelect(w: WeaponRow, v: string) {
  if (v === "") w.damageAbility = null;
  else if (v === "strength" || v === "dexterity") w.damageAbility = v;
}
</script>

<template>
  <AppCard>
    <div class="card-head">
      <h2>Armes</h2>
      <div class="card-head-actions">
        <select
          v-model="catalogPick"
          class="input select weapon-catalog-select"
          @change="onCatalogWeaponChange"
        >
          <option value="">Ajouter depuis le livre</option>
          <optgroup v-for="g in weaponsByCategory" :key="g.id" :label="g.label">
            <option v-for="w in g.weapons" :key="w.id" :value="w.id">{{ w.name }}</option>
          </optgroup>
        </select>
        <AppButton size="small" @click="addCustomWeapon">+ Perso</AppButton>
      </div>
    </div>

    <ul v-if="character.weapons.length" class="weapon-sheet-list">
      <li v-for="(w, wi) in character.weapons" :key="w.id" class="weapon-sheet-card">
        <AppInput v-model="w.name" placeholder="Nom de l'arme" />
        <div class="grid-2 tight">
          <label class="field">
            <span>Type</span>
            <select v-model="w.attackType" class="input select">
              <option value="contact">Contact</option>
              <option value="distance">Distance</option>
            </select>
          </label>
          <label class="field">
            <span>Catégorie martiale</span>
            <select v-model="w.martialFamily" class="input select">
              <option v-for="c in MARTIAL_WEAPON_CATEGORIES" :key="c.id" :value="c.id">{{ c.label }}</option>
            </select>
          </label>
        </div>
        <div class="grid-2 tight">
          <label class="field">
            <span>Dés de dégâts</span>
            <AppInput v-model="w.damageDice" placeholder="1d8" />
          </label>
          <label class="field">
            <span>Mod. dégâts</span>
            <select
              class="input select"
              :value="damageAbilitySelectValue(w)"
              @change="setDamageAbilityFromSelect(w, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Aucun (—)</option>
              <option value="strength">FOR</option>
              <option value="dexterity">DEX</option>
            </select>
          </label>
        </div>
        <div class="grid-2 tight">
          <label class="field">
            <span>Portée (m)</span>
            <AppInput
              :model-value="w.rangeMeters ?? ''"
              type="number"
              :min="0"
              :step="1"
              placeholder="—"
              @update:model-value="(v: string | number) => w.rangeMeters = v === '' ? null : Number(v)"
            />
          </label>
          <label class="field">
            <span>Notes</span>
            <AppInput v-model="w.notes" placeholder="Optionnel" />
          </label>
        </div>
        <AppButton size="small" @click="removeWeapon(wi)">Retirer</AppButton>
      </li>
    </ul>
    <p v-else class="muted">Aucune arme listée.</p>
  </AppCard>
</template>

<style scoped>
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  gap: 0.6rem;
}

.card-head h2 { margin: 0; }

.card-head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  justify-content: flex-end;
}

.weapon-catalog-select { min-width: 11rem; max-width: 100%; }

.weapon-sheet-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.65rem; }

.weapon-sheet-card {
  padding: 0.68rem;
  border-radius: 10px;
  border: 1px dashed var(--border-strong);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  background: var(--surface-2);
}

.grid-2 { display: grid; grid-template-columns: 1fr; gap: 0.65rem; }

@media (min-width: 520px) {
  .grid-2 { grid-template-columns: 1fr 1fr; gap: 0.75rem 0.95rem; }
}

.grid-2.tight { margin-top: 0.7rem; }

.field { display: flex; flex-direction: column; gap: 0.32rem; font-size: 0.83rem; color: var(--muted); }
.field > span:first-child { font-weight: 600; }

.input.select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  padding-right: 2rem;
  cursor: pointer;
}

.muted { color: var(--muted); font-size: 0.9rem; margin: 0; }
</style>
