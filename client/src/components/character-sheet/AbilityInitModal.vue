<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, GripVertical, Dices, Shuffle } from 'lucide-vue-next'
import type { Character, CharacterAbilities } from '../../types/character'
import { getRacialMods, ABILITY_LABELS, type AbilityMods } from '../../data/racialAbilityMods'

const props = defineProps<{
  show: boolean
  character: Character
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'confirm': [abilities: CharacterAbilities]
}>()

type Method = 'aleatoire' | 'distribution'
const method = ref<Method>('aleatoire')

// ── Méthode aléatoire ────────────────────────────────────────────────────────

type AbilityKey = keyof CharacterAbilities

const ABILITY_KEYS: AbilityKey[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']

const randomValues = ref<Record<AbilityKey, number>>({
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
})

function rollRandom(key: AbilityKey) {
  // 4d6 drop lowest
  const dice = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6))
  dice.sort((a, b) => b - a)
  randomValues.value[key] = dice[0] + dice[1] + dice[2]
}

function rollAll() {
  for (const key of ABILITY_KEYS) rollRandom(key)
}

// ── Méthode distribution ─────────────────────────────────────────────────────

const DISTRIBUTION_VALUES = [16, 14, 13, 12, 11, 10]

// State: ordered list of ability keys — index i gets DISTRIBUTION_VALUES[i]
const distOrder = ref<AbilityKey[]>([...ABILITY_KEYS])

const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(idx: number) {
  dragIndex.value = idx
}

function onDragOver(idx: number) {
  dragOverIndex.value = idx
}

function onDropAt(idx: number) {
  if (dragIndex.value === null || dragIndex.value === idx) {
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }
  const arr = [...distOrder.value]
  const [item] = arr.splice(dragIndex.value, 1)
  arr.splice(idx, 0, item)
  distOrder.value = arr
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

// ── Racial mods ──────────────────────────────────────────────────────────────

const racialMods = computed<AbilityMods>(() => {
  const cultureId = props.character.paths.find(p => p.kind === 'culturelle')?.id ?? ''
  return getRacialMods(props.character.people, cultureId)
})

const hasRacialMods = computed(() =>
  Object.values(racialMods.value).some(v => v !== 0)
)

const peupleName = computed(() => props.character.people)

function racialModSign(v: number) {
  return v > 0 ? `+${v}` : String(v)
}

// ── Preview (valeurs finales avec mods raciaux) ──────────────────────────────

const previewValues = computed<Record<AbilityKey, { base: number; mod: number; total: number }>>(() => {
  const out = {} as Record<AbilityKey, { base: number; mod: number; total: number }>
  for (let i = 0; i < ABILITY_KEYS.length; i++) {
    const key = ABILITY_KEYS[i]
    const base = method.value === 'distribution'
      ? DISTRIBUTION_VALUES[distOrder.value.indexOf(key)]
      : randomValues.value[key]
    const mod = racialMods.value[key] ?? 0
    out[key] = { base, mod, total: base + mod }
  }
  return out
})

// ── Actions ───────────────────────────────────────────────────────────────────

function close() {
  emit('update:show', false)
}

function confirm() {
  const abilities: CharacterAbilities = {
    strength: previewValues.value.strength.total,
    dexterity: previewValues.value.dexterity.total,
    constitution: previewValues.value.constitution.total,
    intelligence: previewValues.value.intelligence.total,
    wisdom: previewValues.value.wisdom.total,
    charisma: previewValues.value.charisma.total,
  }
  emit('confirm', abilities)
  close()
}

// Reset on open
watch(() => props.show, (shown) => {
  if (shown) {
    method.value = 'aleatoire'
    distOrder.value = [...ABILITY_KEYS]
    for (const key of ABILITY_KEYS) {
      randomValues.value[key] = 10
    }
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop" @click.self="close">
      <div class="modal" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="modal-header">
          <span class="modal-title">Initialiser les caractéristiques</span>
          <button class="close-btn" @click="close" title="Fermer">
            <X :size="18" />
          </button>
        </div>

        <!-- Method tabs -->
        <div class="method-tabs">
          <button
            class="tab-btn"
            :class="{ active: method === 'aleatoire' }"
            @click="method = 'aleatoire'"
          >
            Aléatoire
          </button>
          <button
            class="tab-btn"
            :class="{ active: method === 'distribution' }"
            @click="method = 'distribution'"
          >
            Distribution
          </button>
        </div>

        <div class="modal-body">
          <!-- ── Méthode aléatoire ── -->
          <template v-if="method === 'aleatoire'">
            <p class="method-desc">
              Lancez <strong>4d6</strong>, gardez les 3 meilleurs dés — répétez 6 fois.
              Saisissez vos résultats ci-dessous ou utilisez le bouton dé.
            </p>
            <button class="roll-all-btn" @click="rollAll">
              <Shuffle :size="15" />
              Tout relancer
            </button>
            <div class="random-grid">
              <div v-for="key in ABILITY_KEYS" :key="key" class="random-row">
                <span class="stat-label">{{ ABILITY_LABELS[key] }}</span>
                <input
                  v-model.number="randomValues[key]"
                  type="number"
                  min="3"
                  max="18"
                  class="score-input"
                />
                <button class="dice-btn" @click="rollRandom(key)" :title="`Jet aléatoire pour ${ABILITY_LABELS[key]}`">
                  <Dices :size="15" />
                </button>
              </div>
            </div>
          </template>

          <!-- ── Méthode distribution ── -->
          <template v-else>
            <p class="method-desc">
              Répartissez les valeurs <strong>16, 14, 13, 12, 11, 10</strong> dans vos 6 caractéristiques.
              Glissez les lignes pour changer l'ordre.
            </p>
            <div class="dist-list">
              <div
                v-for="(key, idx) in distOrder"
                :key="key"
                class="dist-row"
                :class="{ 'drag-over': dragOverIndex === idx, 'is-dragging': dragIndex === idx }"
                draggable="true"
                @dragstart="onDragStart(idx)"
                @dragover.prevent="onDragOver(idx)"
                @drop.prevent="onDropAt(idx)"
                @dragend="onDragEnd"
              >
                <span class="drag-handle">
                  <GripVertical :size="16" />
                </span>
                <span class="stat-label">{{ ABILITY_LABELS[key] }}</span>
                <span class="dist-arrow">→</span>
                <span class="dist-value">{{ DISTRIBUTION_VALUES[idx] }}</span>
              </div>
            </div>
          </template>

          <!-- ── Modificateurs raciaux ── -->
          <div v-if="hasRacialMods" class="racial-note">
            <span class="racial-title">Modificateurs raciaux ({{ peupleName }}) :</span>
            <span
              v-for="(val, key) in racialMods"
              :key="key"
              class="racial-chip"
              :class="(val ?? 0) > 0 ? 'positive' : 'negative'"
            >
              {{ ABILITY_LABELS[key as AbilityKey] }} {{ racialModSign(val ?? 0) }}
            </span>
            <span class="racial-info">Ces modificateurs s'appliqueront au résultat final.</span>
          </div>

          <!-- ── Aperçu des valeurs finales ── -->
          <div class="preview-section">
            <span class="preview-title">Résultat final</span>
            <div class="preview-grid">
              <div v-for="key in ABILITY_KEYS" :key="key" class="preview-cell">
                <span class="stat-label">{{ ABILITY_LABELS[key] }}</span>
                <span class="preview-total" :class="{ modified: (racialMods[key] ?? 0) !== 0 }">
                  {{ previewValues[key].total }}
                </span>
                <span v-if="(racialMods[key] ?? 0) !== 0" class="preview-breakdown">
                  {{ previewValues[key].base }}{{ racialModSign(racialMods[key]!) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn ghost" @click="close">Annuler</button>
          <button class="btn primary" @click="confirm">Confirmer</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}
.close-btn:hover { color: var(--text); background: var(--surface-2); }

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

.method-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.tab-btn {
  flex: 1;
  padding: 0.6rem 1rem;
  border: none;
  background: none;
  color: var(--muted);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  color: var(--accent-strong);
  background: var(--surface);
  border-bottom-color: var(--accent-strong);
}

/* ── Body ─────────────────────────────────────────────────────────────────── */

.modal-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.method-desc {
  margin: 0;
  font-size: 0.83rem;
  color: var(--muted);
  line-height: 1.4;
}

/* ── Aléatoire ───────────────────────────────────────────────────────────── */

.roll-all-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  align-self: flex-start;
}
.roll-all-btn:hover { background: var(--surface-1); }

.random-grid {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.random-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

/* ── Distribution ────────────────────────────────────────────────────────── */

.dist-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  cursor: default;
  user-select: none;
  transition: border-color 0.1s, background 0.1s, opacity 0.1s;
}

.dist-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.drag-handle {
  display: flex;
  color: var(--muted);
  cursor: grab;
  flex-shrink: 0;
}
.drag-handle:active { cursor: grabbing; }

.dist-row.is-dragging {
  opacity: 0.4;
}

.dist-row.drag-over {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-2));
}

.dist-arrow {
  color: var(--muted);
  font-size: 0.85rem;
  flex-shrink: 0;
}

.dist-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  margin-left: auto;
  min-width: 1.8rem;
  text-align: right;
}

/* ── Shared ─────────────────────────────────────────────────────────────── */

.stat-label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--muted);
  min-width: 2.4rem;
  flex-shrink: 0;
}

.score-input {
  width: 3rem;
  font-size: 0.95rem;
  font-weight: 700;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 0.2rem 0.3rem;
}
.score-input:focus { outline: 2px solid var(--accent); border-color: var(--accent); }

.dice-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0.15rem;
  transition: color 0.15s;
  flex-shrink: 0;
}
.dice-btn:hover { color: var(--accent-strong); }

/* ── Racial mods ─────────────────────────────────────────────────────────── */

.racial-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-2));
  border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
}

.racial-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  width: 100%;
}

.racial-chip {
  border-radius: 6px;
  padding: 0.15rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 700;
}
.racial-chip.positive { background: color-mix(in srgb, #4caf50 18%, var(--surface-2)); color: #2e7d32; }
.racial-chip.negative { background: color-mix(in srgb, #f44336 15%, var(--surface-2)); color: #c62828; }
:root[data-theme="dark"] .racial-chip.positive { color: #81c784; }
:root[data-theme="dark"] .racial-chip.negative { color: #e57373; }

.racial-info {
  font-size: 0.72rem;
  color: var(--muted);
  font-style: italic;
  width: 100%;
}

/* ── Preview ─────────────────────────────────────────────────────────────── */

.preview-section {
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.4rem;
}

.preview-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.4rem 0.2rem 0.3rem;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.preview-total {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}
.preview-total.modified { color: var(--accent-strong); }

.preview-breakdown {
  font-size: 0.65rem;
  color: var(--muted);
  white-space: nowrap;
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border);
}
</style>
