<script setup lang="ts">
import { computed, ref } from "vue";
import { CirclePlus, CircleMinus } from "lucide-vue-next";
import AppCard from "../ui/AppCard.vue";
import HpGrowthModal from "./HpGrowthModal.vue";
import { ARMORS_CATALOG, SHIELDS_CATALOG } from "../../data/armorsCatalog";
import type { Character } from "../../types/character";
import type { VoieFamily } from "../../data/voies";

const props = defineProps<{
  character: Character;
  computedDef: number;
  computedMp: number;
  computedHp: number;
  computedHpBase: number;
  computedHpGrowth: number;
  family: VoieFamily;
  abilityModifier: (score: number) => number;
  computedDv: string;
  computedInitiative: number;
  computedPcMax: number;
  prMax: number;
}>();

const showHpModal = ref(false);

const ARMOR_GROUPS = [
  { label: "Armures légères", type: "légère" as const },
  { label: "Armures lourdes", type: "lourde" as const },
];

function armorOptionLabel(armor: (typeof ARMORS_CATALOG)[number]): string {
  const enc = armor.encombrant ? ", encombrante" : "";
  return `${armor.name} (+${armor.defBonus} DEF${enc})`;
}

function shieldOptionLabel(shield: (typeof SHIELDS_CATALOG)[number]): string {
  return `${shield.name} (+${shield.defBonus} DEF)`;
}

const currentArmor = computed(() =>
  props.character.armorId
    ? ARMORS_CATALOG.find((a) => a.id === props.character.armorId) ?? null
    : null,
);

const currentShield = computed(() =>
  props.character.shieldId
    ? SHIELDS_CATALOG.find((s) => s.id === props.character.shieldId) ?? null
    : null,
);

const defDexContrib = computed(() =>
  currentArmor.value?.encombrant ? 0 : props.abilityModifier(props.character.abilities.dexterity),
);

const defArmorBonus = computed(() => currentArmor.value?.defBonus ?? 0);
const defShieldBonus = computed(() => currentShield.value?.defBonus ?? 0);

const defDexTooltip = computed(() => {
  if (currentArmor.value?.encombrant) return "DEX annulée (armure encombrante)";
  const mod = props.abilityModifier(props.character.abilities.dexterity);
  const sign = mod >= 0 ? "+" : "";
  return `Mod. DEX (${props.character.abilities.dexterity} → ${sign}${mod})`;
});

const defDexBlocked = computed(() => defDexContrib.value === 0 && !!currentArmor.value?.encombrant);
const defDexClasses = computed(() =>
  defDexBlocked.value ? ["def-chip", "def-chip--blocked"] : ["def-chip"],
);
const defDexSign = computed(() => (defDexContrib.value >= 0 ? "+" : ""));
const defArmorTitle = computed(() => currentArmor.value?.name ?? "Aucune armure");

// PC
const pcChaMod = computed(() => props.abilityModifier(props.character.abilities.charisma));
const pcChaSign = computed(() => (pcChaMod.value >= 0 ? "+" : ""));
const pcFamilyBonus = computed(() => props.family === "aventuriers" ? 2 : 0);

// PR
function togglePr(index: number) {
  // index 0 = premier PR. Si le bouton est "disponible" (index < prCurrent), on dépense. Sinon on récupère.
  const cur = props.character.prCurrent;
  if (index < cur) {
    props.character.prCurrent = index; // dépense jusqu'à cet index
  } else {
    props.character.prCurrent = index + 1; // récupère jusqu'à cet index
  }
}

const mpWisMod = computed(() => props.abilityModifier(props.character.abilities.wisdom));
const mpWisSign = computed(() => (mpWisMod.value >= 0 ? "+" : ""));
const mpWisTooltip = computed(() => {
  const mod = mpWisMod.value;
  const sign = mod >= 0 ? "+" : "";
  return `Mod. SAG (${props.character.abilities.wisdom} → ${sign}${mod})`;
});
const mpIsMystique = computed(() => props.family === "mystiques");
const mpBase = computed(() => props.character.level + mpWisMod.value);
</script>

<template>
  <AppCard title="PV &amp; ressources" class="resources">
    <!-- HP / MP bars -->
    <div class="bars">
      <div class="bar-block">
        <div class="bar-label">
          <span>Points de vie</span>
          <div class="stat-stepper">
            <button type="button" class="stepper-btn" @click="character.hpCurrent = Math.max(0, character.hpCurrent - 1)"><CircleMinus :size="18" /></button>
            <span class="nums">{{ character.hpCurrent }}</span>
            <button type="button" class="stepper-btn" @click="character.hpCurrent = Math.min(computedHp, character.hpCurrent + 1)"><CirclePlus :size="18" /></button>
          </div>
        </div>
        <div class="def-formula hp-formula">
          <div class="def-chip def-chip--total def-chip--hp" title="PV max calculés">
            <span class="def-chip-label">PV</span>
            <span class="def-chip-value">{{ computedHp }}</span>
          </div>
          <span class="def-op">=</span>
          <div
            class="def-chip"
            :title="`Niv. 1 — Dé max famille (${computedHpBase - abilityModifier(character.abilities.constitution)}) + Mod. CON (${abilityModifier(character.abilities.constitution) >= 0 ? '+' : ''}${abilityModifier(character.abilities.constitution)})`"
          >
            <span class="def-chip-label">Base</span>
            <span class="def-chip-value">{{ computedHpBase }}</span>
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
        <div class="bar-track" style="margin-top: 0.5rem">
          <div class="bar-fill hp" :style="{ width: computedHp > 0 ? (character.hpCurrent / computedHp * 100) + '%' : '0%' }" />
        </div>
      </div>
      <div class="bar-block">
        <div class="bar-label">
          <span>Points de mana</span>
          <div class="stat-stepper">
            <button type="button" class="stepper-btn" @click="character.mpCurrent = Math.max(0, character.mpCurrent - 1)"><CircleMinus :size="18" /></button>
            <span class="nums">{{ character.mpCurrent }}</span>
            <button type="button" class="stepper-btn" @click="character.mpCurrent = Math.min(computedMp, character.mpCurrent + 1)"><CirclePlus :size="18" /></button>
          </div>
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
        <div class="bar-track" style="margin-top: 0.5rem">
          <div class="bar-fill mp" :style="{ width: computedMp > 0 ? (character.mpCurrent / computedMp * 100) + '%' : '0%' }" />
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

    <!-- Défense + Initiative -->
    <div class="def-initiative-row">
      <div class="field">
        <span>Défense</span>
        <div class="def-formula">
          <div class="def-chip def-chip--total" title="DEF totale calculée">
            <span class="def-chip-label">Total</span>
            <span class="def-chip-value">{{ computedDef }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" title="Valeur de base (règle CO)">
            <span class="def-chip-label">Base</span>
            <span class="def-chip-value">10</span>
          </div>
          <span class="def-op">+</span>
          <div :class="defDexClasses" :title="defDexTooltip">
            <span class="def-chip-label">DEX</span>
            <span class="def-chip-value">{{ defDexSign }}{{ defDexContrib }}</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="defArmorTitle">
            <span class="def-chip-label">Armure</span>
            <span class="def-chip-value">{{ defArmorBonus }}</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="currentShield?.name ?? 'Aucun bouclier'">
            <span class="def-chip-label">Bouclier</span>
            <span class="def-chip-value">{{ defShieldBonus }}</span>
          </div>
          <span class="def-op">+</span>
          <label class="def-chip def-chip--editable" title="Bonus divers (capacités, magie…)">
            <span class="def-chip-label">Bonus</span>
            <input
              v-model.number="character.defenseBonus"
              type="number"
              class="def-bonus-input"
              placeholder="0"
            />
          </label>
        </div>
      </div>
      <div class="field">
        <span>Initiative</span>
        <div class="initiative-row">
          <div class="def-chip def-chip--total" title="Score d'initiative = DEX − bonus DEF armure">
            <span class="def-chip-label">Total</span>
            <span class="def-chip-value">{{ computedInitiative }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" title="Valeur de DEX">
            <span class="def-chip-label">DEX</span>
            <span class="def-chip-value">{{ character.abilities.dexterity }}</span>
          </div>
          <template v-if="currentArmor">
            <span class="def-op">−</span>
            <div class="def-chip" :title="`Pénalité armure : ${currentArmor.name}`">
              <span class="def-chip-label">Armure</span>
              <span class="def-chip-value">{{ currentArmor.defBonus }}</span>
            </div>
          </template>
          <template v-if="currentShield">
            <span class="def-op">−</span>
            <div class="def-chip" :title="`Pénalité bouclier : ${currentShield.name}`">
              <span class="def-chip-label">Bouclier</span>
              <span class="def-chip-value">{{ currentShield.defBonus }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Armure & Bouclier -->
    <div class="armor-section">
      <div class="armor-row">
        <div class="field">
          <span>Armure</span>
          <select v-model="character.armorId" class="input select">
            <option value="">— Aucune —</option>
            <optgroup v-for="group in ARMOR_GROUPS" :key="group.type" :label="group.label">
              <option
                v-for="armor in ARMORS_CATALOG.filter((a) => a.type === group.type)"
                :key="armor.id"
                :value="armor.id"
              >
                {{ armorOptionLabel(armor) }}
              </option>
            </optgroup>
          </select>
        </div>
        <div class="field">
          <span>Bouclier</span>
          <select v-model="character.shieldId" class="input select">
            <option value="">— Aucun —</option>
            <option v-for="shield in SHIELDS_CATALOG" :key="shield.id" :value="shield.id">
              {{ shieldOptionLabel(shield) }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- PC + DV + Récupération -->
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
        <div class="stat-stepper pc-stepper" style="margin-top: 0.4rem">
          <button type="button" class="stepper-btn" @click="character.pcCurrent = Math.max(0, character.pcCurrent - 1)"><CircleMinus :size="18" /></button>
          <span class="nums pc-nums">{{ character.pcCurrent }} / {{ computedPcMax }}</span>
          <button type="button" class="stepper-btn" @click="character.pcCurrent = Math.min(computedPcMax, character.pcCurrent + 1)"><CirclePlus :size="18" /></button>
        </div>
      </div>

      <!-- Dé de vie + Récupération -->
      <div class="field recup-field">
        <span>Dé de vie &amp; récupération (PR)</span>
        <div class="dv-pr-row">
          <div class="def-chip def-chip--dv" :title="`Dé de vie : ${computedDv} (${family})`">
            <span class="def-chip-label">DV</span>
            <span class="def-chip-value">{{ computedDv }}</span>
          </div>
          <div class="pr-checkboxes">
            <button
              v-for="i in prMax"
              :key="i"
              type="button"
              class="pr-dot"
              :class="{ used: i > character.prCurrent }"
              :title="i <= character.prCurrent ? `Dépenser PR ${i}` : `Récupérer jusqu'à PR ${i}`"
              @click="togglePr(i - 1)"
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

.input.select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  padding-right: 2rem;
  cursor: pointer;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.87rem;
  margin-bottom: 0.35rem;
  gap: 0.45rem;
}

.nums {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

.bar-track {
  height: 12px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
  border: 1px solid var(--border);
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.25s ease;
}

.bar-fill.hp { background: linear-gradient(90deg, #8d3c3c, #c95f56); }
.bar-fill.mp { background: linear-gradient(90deg, #425f8f, #678fc2); }

.stat-stepper {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.stepper-btn:hover { color: var(--accent-strong); }

.def-initiative-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.initiative-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
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

.def-chip--hp .def-chip-value {
  color: #c95f56;
}

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

.def-chip--growth .def-chip-label {
  pointer-events: none;
}

.def-chip--growth .def-chip-value {
  color: #c95f56;
  pointer-events: none;
}

.hp-formula {
  margin-top: 0.3rem;
}

.def-chip--mp {
  border-color: #678fc2;
  background: color-mix(in srgb, #678fc2 15%, var(--surface-2));
}

.def-chip--mp .def-chip-value {
  color: #678fc2;
}

.def-chip--mystique {
  border-color: #9c6fca;
  background: color-mix(in srgb, #9c6fca 15%, var(--surface-2));
}

.def-chip--mystique .def-chip-value {
  color: #9c6fca;
}

.mp-formula {
  margin-top: 0.3rem;
}

.def-chip--blocked {
  opacity: 0.45;
  text-decoration: line-through;
}

.def-chip--editable {
  cursor: text;
  border-style: dashed;
}

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

.def-bonus-input {
  width: 2.6rem;
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  padding: 0;
}

.armor-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.armor-row {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
}

.armor-row .field {
  flex: 1;
  min-width: 0;
}

.extra-row {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

@media (min-width: 520px) {
  .extra-row { flex-direction: row; gap: 1.2rem; }
  .extra-row .field { flex: 1; }
}

.pc-stepper { justify-content: flex-start; }

.pc-nums {
  font-size: 0.95rem;
  font-weight: 700;
  min-width: 3rem;
  text-align: center;
  color: var(--text);
}

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

.pr-checkboxes {
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
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, opacity 0.15s;
}

.pr-dot.used {
  background: var(--surface-2);
  border-color: var(--border);
  opacity: 0.45;
}

.pr-dot:hover { opacity: 0.8; }

.recup-hint {
  margin: 0.35rem 0 0;
  font-size: 0.74rem;
  color: var(--muted);
}
</style>
