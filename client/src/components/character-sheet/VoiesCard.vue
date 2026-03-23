<script setup lang="ts">
import { computed, ref } from "vue";
import AppCard from "../ui/AppCard.vue";
import VoiePickerModal from "./VoiePickerModal.vue";
import { VOIES, VOIES_BY_ID, FAMILY_LABELS, FAMILY_ORDER, type Voie, type VoieFamily } from "../../data/voies";
import { PEUPLE_VOIES_BY_ID, type PeupleVoie } from "../../data/peuples";
import type { Character, PathRow } from "../../types/character";

const props = defineProps<{ character: Character }>();

// ── Points ────────────────────────────────────────────────────────────────
const totalPoints = computed(() => props.character.level * 2);

function rankCost(rank: number): number {
  return rank <= 2 ? rank : 2 + (rank - 2) * 2;
}

const spentPoints = computed(() =>
  props.character.paths.reduce((sum, p) => sum + rankCost(p.rank), 0),
);

const remainingPoints = computed(() => totalPoints.value - spentPoints.value);

function incrementCost(currentRank: number): number {
  return currentRank < 2 ? 1 : 2;
}

function canIncrease(p: PathRow): boolean {
  // Au niveau 1, impossible de dépasser le rang 1 (règle CO)
  if (props.character.level === 1 && p.rank >= 1) return false;
  return p.rank < 5 && remainingPoints.value >= incrementCost(p.rank);
}

function increaseTooltip(p: PathRow): string {
  if (props.character.level === 1 && p.rank >= 1)
    return "Rang 2 impossible au niveau 1 (2 capacités de rang 1 requis)";
  return "Augmenter le rang";
}

function increaseRank(p: PathRow) { if (canIncrease(p)) p.rank++; }
function decreaseRank(p: PathRow) { if (p.rank > 0) p.rank--; }
function removePath(i: number) { props.character.paths.splice(i, 1); }

// ── Expand/collapse ────────────────────────────────────────────────────────
const expandedSet = ref<Set<number>>(new Set());

function toggleExpand(i: number) {
  const next = new Set(expandedSet.value);
  if (next.has(i)) next.delete(i);
  else next.add(i);
  expandedSet.value = next;
}

// ── Voie data ──────────────────────────────────────────────────────────────
const ALL_VOIES_BY_ID = { ...VOIES_BY_ID, ...PEUPLE_VOIES_BY_ID } as Record<string, Voie | PeupleVoie>;

function voieData(p: PathRow): Voie | PeupleVoie | null {
  return p.id ? (ALL_VOIES_BY_ID[p.id] ?? null) : null;
}

const FAMILY_BADGE_LABELS: Record<VoieFamily, string> = {
  combattants: 'Combattant',
  aventuriers: 'Aventurier',
  mystiques: 'Mystique',
  prestige: 'Prestige',
}

function voieFamily(p: PathRow): VoieFamily | null {
  if (p.kind) return null;
  const vd = voieData(p);
  if (!vd || !('family' in vd)) return null;
  return (vd as Voie).family;
}

// ── Picker ─────────────────────────────────────────────────────────────────
const showPicker = ref(false);

const pickerByFamily = computed(() =>
  FAMILY_ORDER.map((family) => ({
    family,
    label: FAMILY_LABELS[family],
    locked: family === 'prestige' && props.character.level < 8,
    lockReason: 'Niveau 8 requis pour les voies de prestige',
    voies: VOIES.filter(
      (v) => v.family === family && !props.character.paths.find((p) => p.id === v.id),
    ),
  })).filter((g) => g.voies.length > 0),
);

function addPath(voie: Voie) {
  props.character.paths.push({ id: voie.id, name: voie.name, rank: 0 });
  showPicker.value = false;
}
</script>

<template>
  <AppCard class="voies-section">
    <div class="card-head">
      <div class="voies-title-block">
        <h2>Voies</h2>
        <span class="pts-badge" :class="{ depleted: remainingPoints <= 0 }">
          {{ spentPoints }} / {{ totalPoints }} pts
        </span>
      </div>
      <button type="button" class="btn ghost small" @click="showPicker = true">+ Ajouter</button>
    </div>

    <ul v-if="character.paths.length" class="voie-list">
      <li v-for="(p, i) in character.paths" :key="i" class="voie-card">
        <!-- Header -->
        <div class="voie-header" @click="toggleExpand(i)">
          <div class="voie-name-block">
            <span class="voie-name">{{ p.name }}</span>
            <span v-if="p.kind === 'peuple'" class="voie-kind-badge peuple">Peuple</span>
            <span v-else-if="p.kind === 'culturelle'" class="voie-kind-badge culturelle">Culture</span>
            <span v-else-if="voieFamily(p)" class="voie-kind-badge" :class="`family-${voieFamily(p)}`">{{ FAMILY_BADGE_LABELS[voieFamily(p)!] }}</span>
          </div>
          <div class="voie-rank-controls">
            <span class="voie-dots">
              <span v-for="dot in 5" :key="dot" class="dot" :class="{ filled: p.rank >= dot }" />
            </span>
            <div class="voie-controls" @click.stop>
              <button type="button" class="rank-btn" :disabled="p.rank <= 0" title="Réduire le rang" @click="decreaseRank(p)">−</button>
              <button type="button" class="rank-btn" :disabled="!canIncrease(p)" :title="increaseTooltip(p)" @click="increaseRank(p)">+</button>
              <button v-if="!p.kind" type="button" class="remove-btn" title="Retirer cette voie" @click="removePath(i)">×</button>
            </div>
          </div>
        </div>

        <!-- Capacités -->
        <ul v-if="expandedSet.has(i)" class="capacite-list">
          <template v-if="voieData(p)">
            <li
              v-for="(cap, ci) in voieData(p)!.capacites"
              :key="ci"
              class="capacite"
              :class="{ unlocked: p.rank > ci, locked: p.rank <= ci }"
            >
              <span class="cap-rank">{{ ci + 1 }}</span>
              <span class="cap-body">
                <span class="cap-name">{{ cap.name }}</span>
                <span class="cap-desc">{{ cap.description }}</span>
              </span>
            </li>
          </template>
          <template v-else>
            <li class="capacite muted-cap">Capacités non disponibles pour cette voie.</li>
          </template>
        </ul>
      </li>
    </ul>
    <p v-else class="muted">Choisis tes voies en cliquant sur "Ajouter".</p>
  </AppCard>

  <VoiePickerModal
    :show="showPicker"
    :groups="pickerByFamily"
    @close="showPicker = false"
    @pick="addPath"
  />
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

.voies-title-block { display: flex; align-items: center; gap: 0.6rem; }

.pts-badge {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}

.pts-badge.depleted {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
}

.voie-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.55rem; }

.voie-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-2);
  overflow: hidden;
}

.voie-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem 0.75rem;
  padding: 0.62rem 0.75rem;
  cursor: pointer;
  user-select: none;
  transition: background 120ms ease;
}

.voie-header:hover { background: color-mix(in srgb, var(--accent-soft) 60%, transparent); }

.voie-name-block {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  flex: 1 1 auto;
  min-width: 0;
}

.voie-rank-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem 0.55rem;
  flex: 0 1 auto;
  min-width: 0;
}

.voie-name {
  font-family: var(--title-font);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--brand-strong);
  min-width: 0;
  overflow-wrap: anywhere;
}

.voie-dots { display: flex; gap: 4px; flex-shrink: 0; }

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--border-strong);
  background: transparent;
  transition: background 150ms ease, border-color 150ms ease;
}

.dot.filled { background: var(--brand); border-color: var(--brand-strong); }

.voie-controls { display: flex; align-items: center; gap: 0.3rem; flex: 0 0 auto; }

@media (max-width: 699px) {
  .voie-name-block { flex: 1 1 100%; }
  .voie-rank-controls { flex: 1 1 100%; justify-content: flex-end; }
}

@media (min-width: 700px) {
  .voie-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}

.rank-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms ease, border-color 120ms ease;
  padding: 0;
  line-height: 1;
}

.rank-btn:hover:not(:disabled) { background: var(--accent-soft); border-color: var(--accent); }
.rank-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.remove-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms ease, color 120ms ease;
  padding: 0;
  line-height: 1;
}

.remove-btn:hover { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }

.capacite-list {
  list-style: none;
  margin: 0;
  padding: 0.35rem 0.75rem 0.62rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  border-top: 1px solid var(--border);
}

.capacite {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.28rem 0;
  transition: opacity 150ms ease;
}

.capacite.locked { opacity: 0.52; }

.cap-rank {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  min-width: 1rem;
  text-align: center;
  flex-shrink: 0;
  padding-top: 0.12rem;
}

.cap-body { display: flex; flex-direction: column; gap: 0.1rem; }
.cap-name { font-size: 0.9rem; color: var(--text); line-height: 1.3; }
.cap-desc { font-size: 0.78rem; color: var(--muted); line-height: 1.45; }

.capacite.unlocked .cap-rank { color: var(--brand); }
.capacite.unlocked .cap-name { font-weight: 600; }
.capacite.unlocked .cap-desc { color: var(--text); }

.muted-cap { font-size: 0.85rem; color: var(--muted); font-style: italic; }

.voie-kind-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.voie-kind-badge.peuple {
  background: color-mix(in srgb, var(--brand) 18%, transparent);
  color: var(--brand-strong);
  border: 1px solid color-mix(in srgb, var(--brand) 35%, transparent);
}

.voie-kind-badge.culturelle {
  background: color-mix(in srgb, #3a8a4a 14%, transparent);
  color: #2a6a38;
  border: 1px solid color-mix(in srgb, #3a8a4a 30%, transparent);
}

:root[data-theme="dark"] .voie-kind-badge.culturelle { color: #7bcf8a; }

.voie-kind-badge.family-combattants {
  background: color-mix(in srgb, #c0392b 13%, transparent);
  color: #a02820;
  border: 1px solid color-mix(in srgb, #c0392b 28%, transparent);
}
.voie-kind-badge.family-aventuriers {
  background: color-mix(in srgb, #27ae60 13%, transparent);
  color: #1e8048;
  border: 1px solid color-mix(in srgb, #27ae60 28%, transparent);
}
.voie-kind-badge.family-mystiques {
  background: color-mix(in srgb, #8e44ad 13%, transparent);
  color: #6c3490;
  border: 1px solid color-mix(in srgb, #8e44ad 28%, transparent);
}
.voie-kind-badge.family-prestige {
  background: color-mix(in srgb, #d4ac0d 13%, transparent);
  color: #8a6a10;
  border: 1px solid color-mix(in srgb, #d4ac0d 32%, transparent);
}
:root[data-theme="dark"] .voie-kind-badge.family-combattants { color: #e07060; }
:root[data-theme="dark"] .voie-kind-badge.family-aventuriers { color: #7bcf8a; }
:root[data-theme="dark"] .voie-kind-badge.family-mystiques { color: #b07ce8; }
:root[data-theme="dark"] .voie-kind-badge.family-prestige { color: #d4a843; }

.muted { color: var(--muted); font-size: 0.9rem; margin: 0; }
.btn.small { min-height: 38px; padding: 0.3rem 0.58rem; font-size: 0.82rem; }
</style>
