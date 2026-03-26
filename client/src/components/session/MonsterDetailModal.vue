<script setup lang="ts">
import { computed } from 'vue'
import { X, Shield, Swords, Heart, Zap } from 'lucide-vue-next'
import type { Monster } from '../../data/monstersCatalog'
import type { SessionMonster } from '../../api/sessions'
import {
  formatMod,
  hpPercent as calcHpPercent,
  hpColor as calcHpColor,
} from '../../utils/monsterSession'

const props = defineProps<{
  /** Catalog data (may be undefined if custom monster) */
  catalog?: Monster
  /** Live session monster data */
  sessionMonster: SessionMonster
  /** Whether the viewer is the GM */
  isGm: boolean
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const hpPercent = computed(() =>
  calcHpPercent(props.sessionMonster.hpCurrent, props.sessionMonster.hpMax),
)

const hpColor = computed(() => calcHpColor(hpPercent.value))
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal">
        <button type="button" class="modal-close" @click="emit('close')">
          <X :size="18" />
        </button>

        <!-- Name -->
        <h2 class="modal-name">{{ sessionMonster.name }}</h2>

        <!-- Size (visible to all) -->
        <p v-if="catalog?.size" class="modal-size">
          Taille {{ catalog.size }}
        </p>

        <!-- Description (visible to all) -->
        <p v-if="catalog?.description" class="modal-description">
          {{ catalog.description }}
        </p>

        <!-- Ability names only (player view) -->
        <div v-if="!isGm && catalog?.abilities?.length" class="section">
          <h3 class="section-label"><Zap :size="14" /> Capacités connues</h3>
          <ul class="ability-names">
            <li v-for="ab in catalog.abilities" :key="ab.name">{{ ab.name }}</li>
          </ul>
        </div>

        <!-- ── GM-only details ────────────────────────────── -->
        <template v-if="isGm">

          <!-- HP bar -->
          <div v-if="sessionMonster.hpCurrent != null" class="hp-bar-section">
            <div class="hp-bar-track">
              <div
                class="hp-bar-fill"
                :class="hpColor"
                :style="{ width: `${hpPercent}%` }"
              />
            </div>
            <span class="hp-bar-label">
              <Heart :size="13" />
              {{ sessionMonster.hpCurrent }} / {{ sessionMonster.hpMax }}
            </span>
          </div>

          <!-- Stats block -->
          <div v-if="catalog" class="stats-block">
            <div class="stat-row">
              <span class="stat-label">NC</span>
              <span class="stat-value">{{ catalog.nc }}</span>
            </div>
            <div v-if="catalog.rd" class="stat-row">
              <span class="stat-label">RD</span>
              <span class="stat-value">{{ catalog.rd }}</span>
            </div>
          </div>

          <div v-if="catalog" class="ability-scores">
            <div class="ability-score" v-for="ab in (['for', 'dex', 'con', 'int', 'sag', 'cha'] as const)" :key="ab">
              <span class="ab-label">{{ ab.toUpperCase() }}</span>
              <span class="ab-value">{{ formatMod(catalog.stats[ab]) }}</span>
            </div>
          </div>

          <div v-if="catalog" class="stat-row">
            <span class="stat-label"><Shield :size="13" /> DEF</span>
            <span class="stat-value">{{ catalog.def }}</span>
            <span class="stat-label" style="margin-left: 0.8rem;">Init.</span>
            <span class="stat-value">{{ catalog.init }}</span>
          </div>

          <!-- Attacks -->
          <div v-if="catalog?.attacks?.length" class="section">
            <h3 class="section-label"><Swords :size="14" /> Attaques</h3>
            <div v-for="atk in catalog.attacks" :key="atk.name" class="attack-row">
              <span class="attack-name">{{ atk.name }}</span>
              <span class="attack-bonus">+{{ atk.bonus }}</span>
              <span class="attack-damage">DM {{ atk.damage }}</span>
              <span v-if="atk.range" class="attack-range">({{ atk.range }} m)</span>
            </div>
          </div>

          <!-- Abilities (full) -->
          <div v-if="catalog?.abilities?.length" class="section">
            <h3 class="section-label"><Zap :size="14" /> Capacités</h3>
            <div v-for="ab in catalog.abilities" :key="ab.name" class="ability-item">
              <strong>{{ ab.name }}</strong>
              <p>{{ ab.description }}</p>
            </div>
          </div>
        </template>

        <!-- No catalog data -->
        <p v-if="!catalog" class="modal-note">
          {{ isGm ? "Monstre personnalisé — pas de fiche catalogue." : "" }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border: 2px solid var(--border-strong);
  border-radius: 1.4rem;
  padding: 1.5rem 1.2rem;
  max-width: 26rem;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-close {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  padding: 0.2rem;
}
.modal-close:hover { opacity: 1; }

.modal-name {
  margin: 0;
  font-size: 1.2rem;
  font-family: var(--title-font);
  color: var(--accent-strong);
  padding-right: 1.5rem;
}

.modal-size {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
  font-style: italic;
}

.modal-description {
  margin: 0;
  font-size: 0.88rem;
  color: var(--text);
  line-height: 1.45;
  white-space: pre-line;
}

.modal-note {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
  font-style: italic;
}

/* ── HP bar ── */
.hp-bar-section {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.hp-bar-track {
  flex: 1;
  height: 0.6rem;
  background: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.hp-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.hp-ok { background: #4caf82; }
.hp-warn { background: #e8a838; }
.hp-danger { background: var(--danger, #e05252); }

.hp-bar-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

/* ── Stats ── */
.stats-block {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.stat-label {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
}

.stat-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text);
}

.ability-scores {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.3rem;
  text-align: center;
}

.ability-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.35rem 0.2rem;
  background: var(--surface-2);
  border-radius: 0.6rem;
  border: 1px solid var(--border);
}

.ab-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
}

.ab-value {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--accent-strong);
}

/* ── Sections ── */
.section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
  padding-top: 0.3rem;
  border-top: 1px solid var(--border);
}

/* ── Attacks ── */
.attack-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  padding: 0.25rem 0;
}

.attack-name {
  font-weight: 600;
  color: var(--text);
}

.attack-bonus {
  font-weight: 700;
  color: var(--accent-strong);
}

.attack-damage {
  color: var(--muted);
}

.attack-range {
  font-size: 0.78rem;
  color: var(--muted);
}

/* ── Abilities ── */
.ability-names {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.88rem;
  color: var(--text);
}

.ability-names li {
  padding: 0.1rem 0;
}

.ability-item {
  font-size: 0.85rem;
}

.ability-item strong {
  color: var(--accent-strong);
}

.ability-item p {
  margin: 0.15rem 0 0;
  color: var(--text);
  line-height: 1.4;
}
</style>
