<script setup lang="ts">
import { ref, computed } from 'vue'
import { Skull, Heart, RefreshCw } from 'lucide-vue-next'
import AppModal from './ui/AppModal.vue'
import AppButton from './ui/AppButton.vue'
import { rollDie } from '../utils/dice'
import { attackDieSides } from '../composables/useCharacter'
import { dice, revealAfterDice } from '../composables/useDice3D'

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
  const sides = attackDieSides.value
  const die = rollDie(sides)
  let result: DeathRoll['result']
  if (die === sides) result = 'critical-save'
  else if (die === 1) result = 'critical-death'
  else if (die >= 11) result = 'success'
  else result = 'failure'
  revealAfterDice(dice(sides, [die]), () => rolls.value.push({ die, result }))
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
  <AppModal :model-value="true" @update:model-value="emit('close')">
    <div class="agonie-body">
      <div class="modal-icon">
        <Skull :size="36" />
      </div>

      <h2 class="modal-title">Agonie — {{ characterName }}</h2>
      <p class="modal-subtitle">0 PV — jets de mort (d{{ attackDieSides }} ≥ 11 = succès)</p>

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

    </div>

    <!-- Actions -->
    <template #footer>
      <AppButton @click="reset">
        <RefreshCw :size="14" /> Recommencer
      </AppButton>
      <AppButton v-if="verdict === 'none'" variant="primary" @click="roll">
        Lancer le d{{ attackDieSides }}
      </AppButton>
      <AppButton v-if="verdict !== 'none'" variant="primary" @click="confirm">
        Confirmer
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.agonie-body {
  text-align: center;
}

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

.tracker--success { color: var(--accent); }
.tracker--failure  { color: var(--danger); }

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
  border-radius: var(--radius-md);
}

.roll-entry--success        { background: color-mix(in srgb, var(--accent) 15%, transparent); }
.roll-entry--critical-save  { background: color-mix(in srgb, var(--accent) 25%, transparent); font-weight: 700; }
.roll-entry--failure         { background: color-mix(in srgb, var(--danger) 15%, transparent); }
.roll-entry--critical-death  { background: color-mix(in srgb, var(--danger) 25%, transparent); font-weight: 700; }

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
  border-radius: var(--radius-lg);
}
.verdict--stabilise { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
.verdict--death     { background: color-mix(in srgb, var(--danger) 18%, transparent); color: var(--danger); }
</style>
