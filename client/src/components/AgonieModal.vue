<script setup lang="ts">
import { ref, computed } from 'vue'
import { Skull, Heart, RefreshCw, X } from 'lucide-vue-next'
import { rollDie } from '../utils/dice'

defineProps<{ characterName: string }>()
const emit = defineEmits<{
  (e: 'stabilise'): void
  (e: 'death'): void
  (e: 'close'): void
}>()

interface DeathRoll {
  die: number
  result: 'success' | 'failure' | 'critical-save' | 'critical-death'
}

const rolls = ref<DeathRoll[]>([])

const successes = computed(() => rolls.value.filter((r) => r.result === 'success' || r.result === 'critical-save').length)
const failures  = computed(() => rolls.value.filter((r) => r.result === 'failure' || r.result === 'critical-death').length)

const verdict = computed<'none' | 'stabilise' | 'death'>(() => {
  if (rolls.value.some((r) => r.result === 'critical-save')) return 'stabilise'
  if (rolls.value.some((r) => r.result === 'critical-death')) return 'death'
  if (successes.value >= 3) return 'stabilise'
  if (failures.value  >= 3) return 'death'
  return 'none'
})

function roll() {
  if (verdict.value !== 'none') return
  const die = rollDie(20)
  let result: DeathRoll['result']
  if (die === 20) result = 'critical-save'
  else if (die === 1) result = 'critical-death'
  else if (die >= 10) result = 'success'
  else result = 'failure'
  rolls.value.push({ die, result })
}

function reset() {
  rolls.value = []
}

function confirm() {
  if (verdict.value === 'stabilise') emit('stabilise')
  else if (verdict.value === 'death') emit('death')
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal" :class="verdict !== 'none' ? `modal--${verdict}` : ''">
      <button type="button" class="modal-close" @click="emit('close')">
        <X :size="18" />
      </button>

      <div class="modal-icon">
        <Skull :size="36" />
      </div>

      <h2 class="modal-title">Agonie — {{ characterName }}</h2>
      <p class="modal-subtitle">0 PV — jets de mort (d20 ≥ 10 = succès)</p>

      <!-- Trackers -->
      <div class="trackers">
        <div class="tracker tracker--success">
          <Heart :size="14" />
          <span>Succès</span>
          <div class="pips">
            <span v-for="i in 3" :key="i" class="pip" :class="{ filled: successes >= i }" />
          </div>
        </div>
        <div class="tracker tracker--failure">
          <Skull :size="14" />
          <span>Échecs</span>
          <div class="pips">
            <span v-for="i in 3" :key="i" class="pip" :class="{ filled: failures >= i }" />
          </div>
        </div>
      </div>

      <!-- Roll log -->
      <ul v-if="rolls.length" class="roll-log">
        <li
          v-for="(r, i) in rolls"
          :key="i"
          class="roll-entry"
          :class="`roll-entry--${r.result}`"
        >
          <strong>{{ r.die }}</strong>
          <span class="roll-label">
            <template v-if="r.result === 'critical-save'">Réussite critique — Stabilisé !</template>
            <template v-else-if="r.result === 'critical-death'">Échec critique — Mort !</template>
            <template v-else-if="r.result === 'success'">Succès</template>
            <template v-else>Échec</template>
          </span>
        </li>
      </ul>

      <!-- Verdict -->
      <div v-if="verdict === 'stabilise'" class="verdict verdict--stabilise">
        <Heart :size="18" /> Stabilisé — le personnage survit !
      </div>
      <div v-else-if="verdict === 'death'" class="verdict verdict--death">
        <Skull :size="18" /> Mort — le personnage décède.
      </div>

      <!-- Actions -->
      <div class="modal-actions">
        <button
          v-if="verdict === 'none'"
          type="button"
          class="btn-roll"
          @click="roll"
        >
          Lancer le d20
        </button>
        <button
          v-if="verdict !== 'none'"
          type="button"
          class="btn-confirm"
          @click="confirm"
        >
          Confirmer
        </button>
        <button type="button" class="btn-reset" @click="reset">
          <RefreshCw :size="14" /> Recommencer
        </button>
      </div>
    </div>
  </div>
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
  max-width: 22rem;
  width: 100%;
  position: relative;
  text-align: center;
  transition: border-color 0.2s;
}

.modal--stabilise { border-color: #4caf82; }
.modal--death     { border-color: var(--danger, #e05252); }

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

.modal-icon {
  font-size: 2rem;
  margin-bottom: 0.4rem;
  opacity: 0.75;
}

.modal-title {
  margin: 0 0 0.2rem;
  font-size: 1.15rem;
  font-family: var(--title-font);
  color: var(--accent-strong);
}

.modal-subtitle {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  color: var(--muted);
}

.trackers {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.tracker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  font-weight: 600;
}

.tracker--success { color: #4caf82; }
.tracker--failure  { color: var(--danger, #e05252); }

.pips {
  display: flex;
  gap: 0.35rem;
}

.pip {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 50%;
  border: 2px solid currentColor;
  opacity: 0.4;
  transition: opacity 0.15s, background 0.15s;
}
.pip.filled {
  background: currentColor;
  opacity: 1;
}

.roll-log {
  list-style: none;
  margin: 0 0 0.8rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.roll-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  padding: 0.22rem 0.6rem;
  border-radius: 0.5rem;
}

.roll-entry--success        { background: color-mix(in srgb, #4caf82 15%, transparent); }
.roll-entry--critical-save  { background: color-mix(in srgb, #4caf82 25%, transparent); font-weight: 700; }
.roll-entry--failure         { background: color-mix(in srgb, var(--danger, #e05252) 15%, transparent); }
.roll-entry--critical-death  { background: color-mix(in srgb, var(--danger, #e05252) 25%, transparent); font-weight: 700; }

.roll-label { opacity: 0.85; }

.verdict {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 0.8rem;
  padding: 0.5rem 0.8rem;
  border-radius: 0.7rem;
}
.verdict--stabilise { background: color-mix(in srgb, #4caf82 18%, transparent); color: #4caf82; }
.verdict--death     { background: color-mix(in srgb, var(--danger, #e05252) 18%, transparent); color: var(--danger, #e05252); }

.modal-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-roll {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 2rem;
  padding: 0.55rem 1.4rem;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-roll:hover { opacity: 0.85; }

.btn-confirm {
  background: #4caf82;
  color: #fff;
  border: none;
  border-radius: 2rem;
  padding: 0.55rem 1.4rem;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-confirm:hover { opacity: 0.85; }

.btn-reset {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: 1.5px solid var(--border);
  border-radius: 2rem;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--text);
  transition: border-color 0.15s;
}
.btn-reset:hover { border-color: var(--accent); }
</style>
