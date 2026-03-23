<script setup lang="ts">
import AppCard from "../ui/AppCard.vue";
import {
  MARTIAL_WEAPON_CATEGORY_BY_ID,
  MARTIAL_FORMATION_SELECTABLE_IDS,
  type MartialWeaponCategoryId,
} from "../../data/martialWeaponCategories";
import type { Character } from "../../types/character";

const props = defineProps<{ character: Character }>();

function hasMartialFormation(id: MartialWeaponCategoryId): boolean {
  return props.character.martialFormations.includes(id);
}

function toggleMartialFormation(id: MartialWeaponCategoryId) {
  if (id === "paysan") return;
  const a = props.character.martialFormations;
  const i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1);
  else a.push(id);
}
</script>

<template>
  <AppCard title="Formations martiales">
    <ul class="formation-list">
      <li class="formation-row">
        <label class="formation-label">
          <input type="checkbox" checked disabled class="formation-cb" />
          <span>{{ MARTIAL_WEAPON_CATEGORY_BY_ID.paysan }}</span>
        </label>
        <span class="formation-note">Toujours actif</span>
      </li>
      <li v-for="fid in MARTIAL_FORMATION_SELECTABLE_IDS" :key="fid" class="formation-row">
        <label class="formation-label">
          <input
            type="checkbox"
            class="formation-cb"
            :checked="hasMartialFormation(fid)"
            @change="toggleMartialFormation(fid)"
          />
          <span>{{ MARTIAL_WEAPON_CATEGORY_BY_ID[fid] }}</span>
        </label>
      </li>
    </ul>
  </AppCard>
</template>

<style scoped>
.formation-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }

.formation-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.formation-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.92rem; }

.formation-cb { width: 1.05rem; height: 1.05rem; accent-color: var(--brand); }

.formation-note { font-size: 0.78rem; color: var(--muted); }
</style>
