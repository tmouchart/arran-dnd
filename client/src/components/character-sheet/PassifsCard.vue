<script setup lang="ts">
import { computed } from "vue";
import AppCard from "../ui/AppCard.vue";
import { VOIES_BY_ID, type Voie } from "../../data/voies";
import { PEUPLE_VOIES_BY_ID, type PeupleVoie } from "../../data/peuples";
import type { Character, PathRow } from "../../types/character";

const props = defineProps<{ character: Character }>();

const ALL_VOIES_BY_ID = { ...VOIES_BY_ID, ...PEUPLE_VOIES_BY_ID } as Record<string, Voie | PeupleVoie>;

function voieData(p: PathRow): Voie | PeupleVoie | null {
  return p.id ? (ALL_VOIES_BY_ID[p.id] ?? null) : null;
}

const passiveAbilities = computed(() => {
  const out: { key: string; pathName: string; name: string; description: string }[] = [];
  props.character.paths.forEach((p, pi) => {
    const vd = voieData(p);
    if (!vd || p.rank <= 0) return;
    vd.capacites.forEach((cap, ci) => {
      if (p.rank > ci && cap.active === false) {
        out.push({
          key: `${p.id ?? `p${pi}`}-${ci}`,
          pathName: p.name,
          name: cap.name,
          description: cap.description,
        });
      }
    });
  });
  return out;
});
</script>

<template>
  <AppCard v-if="passiveAbilities.length" title="Passifs" class="passifs-section">
    <ul class="passif-list">
      <li v-for="passif in passiveAbilities" :key="passif.key" class="passif-card">
        <div class="passif-top">
          <span class="passif-name">{{ passif.name }}</span>
          <span class="passif-path-tag">{{ passif.pathName }}</span>
        </div>
        <p class="passif-desc">{{ passif.description }}</p>
      </li>
    </ul>
  </AppCard>
</template>

<style scoped>
.passifs-section { margin-top: 0; }

.passif-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.55rem; }

.passif-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-2);
  padding: 0.62rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.passif-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }

.passif-name {
  font-family: var(--title-font);
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  flex: 1;
  min-width: 0;
}

.passif-path-tag {
  flex-shrink: 0;
  max-width: 48%;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: right;
  line-height: 1.25;
  padding: 0.2rem 0.45rem;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid var(--border);
}

.passif-desc { margin: 0; font-size: 0.8rem; color: var(--muted); line-height: 1.45; }
</style>
