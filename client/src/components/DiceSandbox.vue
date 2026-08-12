<script setup lang="ts">
import { ref } from 'vue'
import { Dices, Minus, Plus } from 'lucide-vue-next'
import AppInput from './ui/AppInput.vue'
import { rollDie } from '../utils/dice'
import { useRollHistory } from '../composables/useRollHistory'
import { useCharacter } from '../composables/useCharacter'

const DICE = [4, 6, 8, 10, 12, 20, 100]

const { character } = useCharacter()
const { addRoll } = useRollHistory()

const count = ref(1)
const modifier = ref(0)

interface SandboxResult {
  sides: number
  rolls: number[]
  modifier: number
  total: number
  /** Incrémenté à chaque lancer pour rejouer l'animation. */
  key: number
}

const result = ref<SandboxResult | null>(null)

function signedMod(mod: number): string {
  if (mod === 0) return ''
  return mod > 0 ? `+${mod}` : String(mod)
}

function roll(sides: number) {
  const n = Math.min(10, Math.max(1, Math.round(count.value) || 1))
  const mod = Number.isFinite(modifier.value) ? Math.round(modifier.value) : 0
  const rolls = Array.from({ length: n }, () => rollDie(sides))
  const total = rolls.reduce((a, b) => a + b, 0) + mod

  result.value = { sides, rolls, modifier: mod, total, key: (result.value?.key ?? 0) + 1 }

  addRoll({
    characterName: character.value.name,
    kind: 'libre',
    label: `${n}d${sides}${signedMod(mod)}`,
    die: n === 1 ? rolls[0] : 0,
    sides,
    bonus: mod,
    total,
    rolls: n > 1 ? rolls : undefined,
  }, 'sandbox')
}

function stepCount(delta: number) {
  count.value = Math.min(10, Math.max(1, count.value + delta))
}
</script>

<template>
  <div class="sandbox-body">
    <div class="dice-row">
      <button
        v-for="sides in DICE"
        :key="sides"
        type="button"
        class="die-btn"
        @click="roll(sides)"
      >
        <Dices :size="14" class="die-btn-icon" />
        d{{ sides }}
      </button>
    </div>

    <div class="options-row">
      <div class="count-stepper">
        <button type="button" class="step-btn" :disabled="count <= 1" @click="stepCount(-1)">
          <Minus :size="16" />
        </button>
        <span class="count-value">{{ count }} {{ count > 1 ? "dés" : "dé" }}</span>
        <button type="button" class="step-btn" :disabled="count >= 10" @click="stepCount(1)">
          <Plus :size="16" />
        </button>
      </div>
      <label class="mod-field">
        <span class="mod-label">Modif.</span>
        <AppInput v-model="modifier" type="number" text-align="center" class="mod-input" />
      </label>
    </div>

    <div v-if="result" :key="result.key" class="result">
      <div class="result-total">{{ result.total }}</div>
      <div class="result-detail">
        {{ result.rolls.length }}d{{ result.sides }}{{ signedMod(result.modifier) }}
        <template v-if="result.rolls.length > 1 || result.modifier !== 0">
          = {{ result.rolls.join(" + ") }}{{ result.modifier !== 0 ? " " + (result.modifier > 0 ? "+ " + result.modifier : "- " + (-result.modifier)) : "" }}
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Une seule ligne : les 7 dés côte à côte, boutons compacts */
.dice-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.die-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.4rem 0.1rem;
  border-radius: 0.7rem;
  border: 1.5px solid var(--border-strong);
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--title-font);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}

.die-btn:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-2));
}

.die-btn:active {
  transform: scale(0.94);
}

.die-btn-icon {
  color: var(--accent-strong);
}

.options-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.count-stepper {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.step-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s, background 0.15s;
}

.step-btn:hover:not(:disabled) {
  border-color: var(--accent);
}

.step-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.count-value {
  min-width: 3.4rem;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.mod-field {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.mod-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
}

.mod-input {
  width: 4.2rem;
}

.result {
  margin-top: 0.9rem;
  padding: 0.9rem 0.7rem;
  border-radius: 1rem;
  border: 1.5px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  text-align: center;
  animation: result-pop 0.25s ease;
}

@keyframes result-pop {
  from {
    transform: scale(0.85);
    opacity: 0.4;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.result-total {
  font-size: 1.9rem;
  font-weight: 800;
  font-family: var(--title-font);
  line-height: 1.1;
  color: var(--accent-strong);
}

.result-detail {
  margin-top: 0.2rem;
  font-size: 0.88rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
