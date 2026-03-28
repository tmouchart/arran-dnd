<script setup lang="ts">
import { computed } from "vue";
import { X, Dices } from "lucide-vue-next";
import type { VoieFamily } from "../../data/voies";
import { FAMILY_DIE_MAX } from "../../composables/useCharacter";

const props = defineProps<{
  show: boolean;
  level: number;
  family: VoieFamily;
  conMod: number;
  hpLevelGains: number[];
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  "update:hpLevelGains": [value: number[]];
}>();

const dieMax = computed(() => FAMILY_DIE_MAX[props.family]);

const familyLabel = computed(() => {
  const labels: Record<VoieFamily, string> = {
    combattants: "Combattants (d10)",
    aventuriers: "Aventuriers (d8)",
    mystiques: "Mystiques (d6)",
    prestige: "Prestige (d8)",
  };
  return labels[props.family];
});

const conSign = computed(() => (props.conMod >= 0 ? "+" : ""));

function baseHp() {
  return dieMax.value + props.conMod;
}

function rollAt(levelIndex: number): number {
  return props.hpLevelGains[levelIndex] ?? dieMax.value;
}

function gainAt(levelIndex: number): number {
  return rollAt(levelIndex) + props.conMod;
}

function setRoll(levelIndex: number, value: number) {
  const clamped = Math.max(1, Math.min(dieMax.value, value));
  const copy = [...props.hpLevelGains];
  copy[levelIndex] = clamped;
  emit("update:hpLevelGains", copy);
}

function rollDie(levelIndex: number) {
  setRoll(levelIndex, Math.ceil(Math.random() * dieMax.value));
}

function close() {
  emit("update:show", false);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop" @click.self="close">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <span class="modal-title">Progression des PV</span>
          <button class="close-btn" @click="close" title="Fermer">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="family-note">{{ familyLabel }} — Mod. CON : {{ conSign }}{{ conMod }}</div>

          <div class="level-list">
            <!-- Niveau 1 : base fixe -->
            <div class="level-row level-row--base">
              <span class="lvl-badge">Niv. 1</span>
              <span class="lvl-desc">Dé max</span>
              <span class="lvl-roll fixed">{{ dieMax }}</span>
              <span class="lvl-sep">+</span>
              <span class="lvl-con">CON {{ conSign }}{{ conMod }}</span>
              <span class="lvl-sep">=</span>
              <span class="lvl-total">{{ baseHp() }}</span>
            </div>

            <!-- Niveaux 2..N -->
            <div
              v-for="i in level - 1"
              :key="i"
              class="level-row"
            >
              <span class="lvl-badge">Niv. {{ i + 1 }}</span>
              <span class="lvl-desc">Jet</span>
              <input
                type="number"
                class="lvl-roll-input"
                :min="1"
                :max="dieMax"
                :value="rollAt(i - 1)"
                @input="setRoll(i - 1, parseInt(($event.target as HTMLInputElement).value) || 1)"
              />
              <button class="dice-btn" @click="rollDie(i - 1)" :title="`Lancer 1d${dieMax}`">
                <Dices :size="14" />
              </button>
              <span class="lvl-sep">+</span>
              <span class="lvl-con">CON {{ conSign }}{{ conMod }}</span>
              <span class="lvl-sep">=</span>
              <span class="lvl-total">{{ gainAt(i - 1) }}</span>
            </div>
          </div>
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
  max-height: 80vh;
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

.close-btn:hover {
  color: var(--text);
  background: var(--surface-2);
}

.modal-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.family-note {
  font-size: 0.78rem;
  color: var(--muted);
  background: var(--surface-2);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
}

.level-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.level-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  flex-wrap: nowrap;
}

.level-row--base {
  border-color: #c95f56;
  background: color-mix(in srgb, #c95f56 10%, var(--surface-2));
}

.lvl-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  min-width: 3.2rem;
  flex-shrink: 0;
}

.lvl-desc {
  font-size: 0.72rem;
  color: var(--muted);
  min-width: 2rem;
  flex-shrink: 0;
}

.fixed {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  min-width: 1.8rem;
  text-align: center;
}

.lvl-roll-input {
  width: 3rem;
  font-size: 0.95rem;
  font-weight: 700;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 0.2rem 0.3rem;
  flex-shrink: 0;
}

.lvl-roll-input:focus {
  outline: 2px solid var(--accent);
  border-color: var(--accent);
}

/* Hide number spinners */
.lvl-roll-input::-webkit-inner-spin-button,
.lvl-roll-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.lvl-roll-input { -moz-appearance: textfield; }

.dice-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent-strong);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 5px;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.dice-btn:hover {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
}

.lvl-sep {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  flex-shrink: 0;
}

.lvl-con {
  font-size: 0.78rem;
  color: var(--muted);
  flex-shrink: 0;
  white-space: nowrap;
}

.lvl-total {
  font-size: 1rem;
  font-weight: 700;
  color: #c95f56;
  margin-left: auto;
  min-width: 1.5rem;
  text-align: right;
  flex-shrink: 0;
}
</style>
