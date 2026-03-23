<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronsDownUp } from "lucide-vue-next";
import AppCard from "../ui/AppCard.vue";
import { PEUPLES, PEUPLES_BY_ID, PEUPLE_VOIES_BY_ID } from "../../data/peuples";
import { FAMILY_LABELS } from "../../data/voies";
import { MYSTIC_TALENTS } from "../../data/mysticTalents";
import { inferProfileFamily } from "../../utils/inferProfileFamily";
import type { Character } from "../../types/character";

const props = defineProps<{ character: Character }>();

const histoireExpanded = ref(false);

const inferredProfileFamily = computed(() =>
  inferProfileFamily(props.character.paths),
);

watch(inferredProfileFamily, (fam) => {
  if (fam !== "mystiques") props.character.mysticTalent = "";
});

const availableCultures = computed(() => {
  const peuple = PEUPLES_BY_ID[props.character.people];
  return peuple ? peuple.voiesCulturelles : [];
});

const selectedCultureId = computed(() =>
  props.character.paths.find((p) => p.kind === "culturelle")?.id ?? "",
);

function applyPeupleUserChange(newPeople: string) {
  const c = props.character;
  if (newPeople === c.people) return;
  c.people = newPeople;
  c.paths = c.paths.filter((p) => p.kind !== "peuple" && p.kind !== "culturelle");
  const peuple = PEUPLES_BY_ID[newPeople];
  if (peuple) {
    c.paths.unshift(
      ...peuple.voiesDePeuple.map((v) => ({ id: v.id, name: v.name, rank: 0, kind: "peuple" as const })),
    );
  }
}

function selectCulture(id: string) {
  const c = props.character;
  c.paths = c.paths.filter((p) => p.kind !== "culturelle");
  if (!id) return;
  const voie = PEUPLE_VOIES_BY_ID[id];
  if (!voie) return;
  const lastPeupleIdx = c.paths.reduce((last, p, i) => (p.kind === "peuple" ? i : last), -1);
  c.paths.splice(lastPeupleIdx + 1, 0, {
    id: voie.id,
    name: voie.name,
    rank: 0,
    kind: "culturelle" as const,
  });
}
</script>

<template>
  <AppCard title="Identité" class="identity">
    <div class="grid-2">
      <label class="field">
        <span>Nom</span>
        <input v-model="character.name" type="text" class="input" />
      </label>
      <label class="field">
        <span>Niveau</span>
        <input v-model.number="character.level" type="number" min="1" class="input narrow" />
      </label>
      <label class="field">
        <span>Profil</span>
        <input v-model="character.profile" type="text" class="input" />
      </label>
      <div class="field">
        <span>Peuple</span>
        <select
          class="input select"
          :value="character.people"
          @change="applyPeupleUserChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">— Choisir —</option>
          <option v-for="p in PEUPLES" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="field">
        <span>Famille du profil</span>
        <div class="field-readonly input" :class="'family-' + inferredProfileFamily">
          {{ FAMILY_LABELS[inferredProfileFamily] }}
        </div>
      </div>
      <div v-if="inferredProfileFamily === 'mystiques'" class="field span-2">
        <span>Talent magique</span>
        <select v-model="character.mysticTalent" class="input select">
          <option value="">— Choisir —</option>
          <option v-for="t in MYSTIC_TALENTS" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </div>
      <div v-if="availableCultures.length" class="field span-2">
        <span>Voie culturelle</span>
        <select
          :value="selectedCultureId"
          class="input select"
          @change="selectCulture(($event.target as HTMLSelectElement).value)"
        >
          <option value="">— Choisir —</option>
          <option v-for="c in availableCultures" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="field span-2 histoire-block">
        <div class="histoire-field-head">
          <span>Histoire</span>
          <button
            type="button"
            class="histoire-expand-btn"
            :aria-expanded="histoireExpanded"
            :aria-label="histoireExpanded ? 'Réduire le champ histoire' : 'Agrandir le champ histoire'"
            @click="histoireExpanded = !histoireExpanded"
          >
            <ChevronsDownUp :size="18" :stroke-width="2" />
          </button>
        </div>
        <textarea
          v-model="character.histoire"
          class="input input-textarea"
          :rows="histoireExpanded ? 12 : 3"
        />
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.65rem;
}

@media (min-width: 520px) {
  .grid-2 {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 0.95rem;
  }
  .grid-2 .span-2 {
    grid-column: 1 / -1;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
  font-size: 0.83rem;
  color: var(--muted);
}

.field > span:first-child {
  font-weight: 600;
}

.field-readonly.input {
  display: flex;
  align-items: center;
  font-weight: 600;
  cursor: default;
}

.input.narrow {
  max-width: 6rem;
}

.input.select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  padding-right: 2rem;
  cursor: pointer;
}

.field.histoire-block {
  gap: 0.4rem;
}

.histoire-field-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.histoire-field-head > span {
  font-size: 0.83rem;
  color: var(--muted);
}

.histoire-expand-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
}

.histoire-expand-btn:hover {
  background: var(--surface-1);
}

.input-textarea {
  width: 100%;
  min-height: 5.5rem;
  line-height: 1.45;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
  font-size: inherit;
}

.family-combattants { background: color-mix(in srgb, var(--brand) 16%, transparent); color: var(--brand-strong); }
.family-aventuriers { background: color-mix(in srgb, #3a8a4a 14%, transparent); color: #2a6a38; }
.family-mystiques { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent-strong); }
.family-prestige { background: color-mix(in srgb, #8a6a20 14%, transparent); color: #5c4510; }

:root[data-theme="dark"] .family-aventuriers { color: #7bcf8a; }
:root[data-theme="dark"] .family-prestige { color: #d4a843; }
</style>
