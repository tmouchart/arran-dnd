<script setup lang="ts">
import { computed, ref } from "vue";
import AppCard from "../ui/AppCard.vue";
import HpGrowthModal from "./HpGrowthModal.vue";
import type { Character } from "../../types/character";
import type { VoieFamily } from "../../data/voies";
import { hpGradientColor } from "../../utils/hpGradientColor";

const props = defineProps<{
  character: Character;
  computedMp: number;
  computedHp: number;
  computedHpBase: number;
  computedHpDv: number;
  computedHpConMod: number;
  computedHpGrowth: number;
  family: VoieFamily;
  abilityModifier: (score: number) => number;
  computedDv: string;
  computedPcMax: number;
  prMax: number;
}>();

const showHpModal = ref(false);

const pcChaMod = computed(() => props.abilityModifier(props.character.abilities.charisma));
const pcChaSign = computed(() => (pcChaMod.value >= 0 ? "+" : ""));
const pcFamilyBonus = computed(() => props.family === "aventuriers" ? 2 : 0);

const mpWisMod = computed(() => props.abilityModifier(props.character.abilities.wisdom));
const mpWisSign = computed(() => (mpWisMod.value >= 0 ? "+" : ""));
const mpWisTooltip = computed(() => {
  const mod = mpWisMod.value;
  const sign = mod >= 0 ? "+" : "";
  return `Mod. SAG (${props.character.abilities.wisdom} → ${sign}${mod})`;
});
const mpIsMystique = computed(() => props.family === "mystiques");
</script>

<template>
  <AppCard title="PV &amp; ressources" class="resources">
    <div class="bars">
      <!-- Points de vie -->
      <div class="bar-block">
        <div class="bar-label"><span>Points de vie</span></div>
        <div class="hp-current-row">
          <button type="button" class="hp-btn hp-btn--minus" :disabled="character.hpCurrent <= 0" @click="character.hpCurrent = Math.max(0, character.hpCurrent - 1)">-</button>
          <div class="hp-current-display hp-current-display--hp">
            <span class="hp-current-value" :style="{ color: hpGradientColor(character.hpCurrent, computedHp) }">{{ character.hpCurrent }}</span>
            <span class="hp-current-sep">/</span>
            <span class="hp-current-max">{{ computedHp }}</span>
          </div>
          <button type="button" class="hp-btn hp-btn--plus" :disabled="character.hpCurrent >= computedHp" @click="character.hpCurrent = Math.min(computedHp, character.hpCurrent + 1)">+</button>
        </div>
        <div class="def-formula hp-formula">
          <div class="def-chip def-chip--total def-chip--hp" title="PV max calculés">
            <span class="def-chip-label">PV</span>
            <span class="def-chip-value">{{ computedHp }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" :title="`Dé de vie famille (${computedDv})`">
            <span class="def-chip-label">{{ computedDv }}</span>
            <span class="def-chip-value">{{ computedHpDv }}</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="`Mod. CON (${character.abilities.constitution})`">
            <span class="def-chip-label">CON</span>
            <span class="def-chip-value">{{ computedHpConMod >= 0 ? '+' : '' }}{{ computedHpConMod }}</span>
          </div>
          <template v-if="character.level > 1">
            <span class="def-op">+</span>
            <button
              class="def-chip def-chip--growth"
              title="Cliquer pour voir la progression par niveau"
              @click="showHpModal = true"
            >
              <span class="def-chip-label">Croissance</span>
              <span class="def-chip-value">{{ computedHpGrowth >= 0 ? '+' : '' }}{{ computedHpGrowth }}</span>
            </button>
          </template>
        </div>
      </div>

      <!-- Points de mana -->
      <div class="bar-block">
        <div class="bar-label"><span>Points de mana</span></div>
        <div class="hp-current-row">
          <button type="button" class="hp-btn hp-btn--minus mp" :disabled="character.mpCurrent <= 0" @click="character.mpCurrent = Math.max(0, character.mpCurrent - 1)">-</button>
          <div class="hp-current-display hp-current-display--mp">
            <span class="hp-current-value">{{ character.mpCurrent }}</span>
            <span class="hp-current-sep">/</span>
            <span class="hp-current-max">{{ computedMp }}</span>
          </div>
          <button type="button" class="hp-btn hp-btn--plus mp" :disabled="character.mpCurrent >= computedMp" @click="character.mpCurrent = Math.min(computedMp, character.mpCurrent + 1)">+</button>
        </div>
        <div class="def-formula mp-formula">
          <div class="def-chip def-chip--total def-chip--mp" title="PM max calculés">
            <span class="def-chip-label">PM</span>
            <span class="def-chip-value">{{ computedMp }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" title="Niveau du personnage">
            <span class="def-chip-label">Niv.</span>
            <span class="def-chip-value">{{ character.level }}</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="mpWisTooltip">
            <span class="def-chip-label">SAG</span>
            <span class="def-chip-value">{{ mpWisSign }}{{ mpWisMod }}</span>
          </div>
          <template v-if="mpIsMystique">
            <span class="def-op">×</span>
            <div class="def-chip def-chip--mystique" title="Famille mystique : PM doublés">
              <span class="def-chip-label">Famille</span>
              <span class="def-chip-value">×2</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <HpGrowthModal
      v-model:show="showHpModal"
      :level="character.level"
      :family="family"
      :con-mod="abilityModifier(character.abilities.constitution)"
      v-model:hp-level-gains="character.hpLevelGains"
    />

    <!-- PC + DV -->
    <div class="extra-row">
      <!-- Points de Chance -->
      <div class="field">
        <span>Points de chance (PC)</span>
        <div class="def-formula">
          <div class="def-chip def-chip--total def-chip--pc" title="PC max">
            <span class="def-chip-label">Max</span>
            <span class="def-chip-value">{{ computedPcMax }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" title="Valeur de base">
            <span class="def-chip-label">Base</span>
            <span class="def-chip-value">2</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="`Mod. CHA (${character.abilities.charisma})`">
            <span class="def-chip-label">CHA</span>
            <span class="def-chip-value">{{ pcChaSign }}{{ pcChaMod }}</span>
          </div>
          <template v-if="pcFamilyBonus > 0">
            <span class="def-op">+</span>
            <div class="def-chip def-chip--aventurier" title="Bonus famille aventuriers">
              <span class="def-chip-label">Famille</span>
              <span class="def-chip-value">+2</span>
            </div>
          </template>
        </div>
      </div>

      <!-- Dé de vie + PR -->
      <div class="field recup-field">
        <span>Dé de vie &amp; récupération (PR)</span>
        <div class="dv-pr-row">
          <div class="def-chip def-chip--dv" :title="`Dé de vie : ${computedDv} (${family})`">
            <span class="def-chip-label">DV</span>
            <span class="def-chip-value">{{ computedDv }}</span>
          </div>
          <div class="pr-dots">
            <div
              v-for="i in prMax"
              :key="i"
              class="pr-dot"
              :class="{ used: i > character.prCurrent }"
            />
          </div>
        </div>
        <p class="recup-hint">1 PR → regagne {{ computedDv }} + Mod. CON + niv.</p>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
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

.bars {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1.2rem;
}

.bar-label {
  font-size: 0.87rem;
  margin-bottom: 0.35rem;
}

.def-formula {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.def-op {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--muted);
  padding: 0 0.1rem;
}

.def-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.35rem 0.6rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  cursor: default;
  min-width: 2.8rem;
}

.def-chip--total {
  border-color: var(--accent, #7c5cbf);
  background: color-mix(in srgb, var(--accent, #7c5cbf) 12%, var(--surface-2));
}

.def-chip--hp {
  border-color: #c95f56;
  background: color-mix(in srgb, #c95f56 15%, var(--surface-2));
}
.def-chip--hp .def-chip-value { color: #c95f56; }

.def-chip--growth {
  cursor: pointer;
  border-style: dashed;
  border-color: #c95f56;
  background: none;
  font: inherit;
  transition: background 0.15s;
}
.def-chip--growth:hover {
  background: color-mix(in srgb, #c95f56 15%, var(--surface-2));
}
.def-chip--growth .def-chip-label { pointer-events: none; }
.def-chip--growth .def-chip-value { color: #c95f56; pointer-events: none; }

/* ── Current HP/MP adjuster ─────────────────────────────────────────── */
.hp-current-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
}

.hp-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 120ms ease, border-color 120ms ease, transform 100ms ease;
}

.hp-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.hp-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.hp-btn--minus { border-color: #c95f56; color: #c95f56; }
.hp-btn--minus:hover:not(:disabled) { background: color-mix(in srgb, #c95f56 14%, var(--surface)); }
.hp-btn--plus { border-color: #3a8a4a; color: #3a8a4a; }
.hp-btn--plus:hover:not(:disabled) { background: color-mix(in srgb, #3a8a4a 14%, var(--surface)); }

.hp-btn--minus.mp { border-color: #678fc2; color: #678fc2; }
.hp-btn--minus.mp:hover:not(:disabled) { background: color-mix(in srgb, #678fc2 14%, var(--surface)); }
.hp-btn--plus.mp { border-color: #678fc2; color: #678fc2; }
.hp-btn--plus.mp:hover:not(:disabled) { background: color-mix(in srgb, #678fc2 14%, var(--surface)); }

.hp-current-display {
  display: flex;
  align-items: baseline;
  gap: 0.15rem;
  font-variant-numeric: tabular-nums;
}

.hp-current-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: var(--title-font);
}

.hp-current-sep {
  font-size: 1rem;
  color: var(--muted);
  font-weight: 400;
}

.hp-current-max {
  font-size: 1rem;
  color: var(--muted);
  font-weight: 600;
}

/* hp-current-display--hp color is set dynamically via :style */
.hp-current-display--mp .hp-current-value { color: #678fc2; }

.hp-formula { margin-top: 0.3rem; }

.def-chip--mp {
  border-color: #678fc2;
  background: color-mix(in srgb, #678fc2 15%, var(--surface-2));
}
.def-chip--mp .def-chip-value { color: #678fc2; }

.def-chip--mystique {
  border-color: #9c6fca;
  background: color-mix(in srgb, #9c6fca 15%, var(--surface-2));
}
.def-chip--mystique .def-chip-value { color: #9c6fca; }

.mp-formula { margin-top: 0.3rem; }

.def-chip-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.def-chip-value {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.def-chip--total .def-chip-value {
  font-size: 1.2rem;
  color: var(--accent, #7c5cbf);
}

.extra-row {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: row;
  gap: 1.2rem;
  flex-wrap: wrap;
}

.extra-row .field { flex: 1; min-width: 0; }

.def-chip--pc {
  border-color: #c89c3a;
  background: color-mix(in srgb, #c89c3a 15%, var(--surface-2));
}
.def-chip--pc .def-chip-value { color: #c89c3a; }

.def-chip--aventurier {
  border-color: #3a8a4a;
  background: color-mix(in srgb, #3a8a4a 12%, var(--surface-2));
}
.def-chip--aventurier .def-chip-value { color: #2a6a38; }
:root[data-theme="dark"] .def-chip--aventurier .def-chip-value { color: #7bcf8a; }

.recup-field { min-width: 0; }

.dv-pr-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.35rem;
  flex-wrap: wrap;
}

.def-chip--dv {
  border-color: var(--accent, #7c5cbf);
  background: color-mix(in srgb, var(--accent, #7c5cbf) 12%, var(--surface-2));
  flex-shrink: 0;
}
.def-chip--dv .def-chip-value {
  color: var(--accent-strong);
  font-size: 1rem;
}

.pr-dots {
  display: flex;
  gap: 0.38rem;
  align-items: center;
}

.pr-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--accent, #7c5cbf);
  background: color-mix(in srgb, var(--accent, #7c5cbf) 35%, var(--surface-2));
}

.pr-dot.used {
  background: var(--surface-2);
  border-color: var(--border);
  opacity: 0.45;
}

.recup-hint {
  margin: 0.35rem 0 0;
  font-size: 0.74rem;
  color: var(--muted);
}
</style>
