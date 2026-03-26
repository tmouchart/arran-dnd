<script setup lang="ts">
import { computed } from "vue";
import AppCard from "../ui/AppCard.vue";
import { ARMORS_BY_ID, SHIELDS_BY_ID } from "../../data/armorsCatalog";
import type { Character } from "../../types/character";
import type { VoieFamily } from "../../data/voies";

const props = defineProps<{
  character: Character;
  computedAttackContact: number;
  computedAttackDistance: number;
  computedAttackMagique: number;
  computedDef: number;
  computedInitiative: number;
  abilityModifier: (score: number) => number;
  family: VoieFamily;
}>();

const armor = computed(() =>
  props.character.armorId ? ARMORS_BY_ID[props.character.armorId] ?? null : null,
);
const shield = computed(() =>
  props.character.shieldId ? SHIELDS_BY_ID[props.character.shieldId] ?? null : null,
);

const equipTotalBonus = computed(() => (armor.value?.defBonus ?? 0) + (shield.value?.defBonus ?? 0));
const armorPenaltyDistance = computed(() => Math.floor(equipTotalBonus.value / 2));
const armorPenaltyMagique = computed(() => equipTotalBonus.value);

const familyBonusContact = computed(() => {
  if (props.family === "combattants") return 2;
  if (props.family === "aventuriers") return 1;
  return 0;
});
const familyBonusDistance = computed(() => familyBonusContact.value);
const familyBonusMagique = computed(() => (props.family === "mystiques" ? 2 : 0));

const forMod = computed(() => props.abilityModifier(props.character.abilities.strength));
const dexMod = computed(() => props.abilityModifier(props.character.abilities.dexterity));
const intMod = computed(() => props.abilityModifier(props.character.abilities.intelligence));

function sign(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

const defDexContrib = computed(() =>
  armor.value?.encombrant ? 0 : props.abilityModifier(props.character.abilities.dexterity),
);
const defArmorBonus = computed(() => armor.value?.defBonus ?? 0);
const defShieldBonus = computed(() => shield.value?.defBonus ?? 0);
const defDexSign = computed(() => (defDexContrib.value >= 0 ? "+" : ""));
const defDexBlocked = computed(() => defDexContrib.value === 0 && !!armor.value?.encombrant);
const defDexTooltip = computed(() => {
  if (armor.value?.encombrant) return "DEX annulée (armure encombrante)";
  const mod = props.abilityModifier(props.character.abilities.dexterity);
  return `Mod. DEX (${props.character.abilities.dexterity} → ${mod >= 0 ? "+" : ""}${mod})`;
});
</script>

<template>
  <AppCard title="Combat">
    <div class="attack-grid">

      <!-- Contact -->
      <div class="attack-row">
        <span class="attack-label">Contact</span>
        <div class="def-formula">
          <div class="def-chip def-chip--total def-chip--contact" title="Bonus d'attaque au contact">
            <span class="def-chip-label">Total</span>
            <span class="def-chip-value">{{ sign(computedAttackContact) }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" :title="`Niveau ${character.level}`">
            <span class="def-chip-label">Niv.</span>
            <span class="def-chip-value">{{ character.level }}</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="`Mod. FOR (${character.abilities.strength})`">
            <span class="def-chip-label">FOR</span>
            <span class="def-chip-value">{{ sign(forMod) }}</span>
          </div>
          <template v-if="familyBonusContact > 0">
            <span class="def-op">+</span>
            <div class="def-chip def-chip--family" :title="`Bonus famille ${family}`">
              <span class="def-chip-label">Famille</span>
              <span class="def-chip-value">+{{ familyBonusContact }}</span>
            </div>
          </template>
          <span class="def-op">+</span>
          <label class="def-chip def-chip--editable" title="Bonus divers (capacités, magie…)">
            <span class="def-chip-label">Bonus</span>
            <input v-model.number="character.attackContactBonus" type="number" class="def-bonus-input" placeholder="0" />
          </label>
        </div>
      </div>

      <!-- Distance -->
      <div class="attack-row">
        <span class="attack-label">Distance</span>
        <div class="def-formula">
          <div class="def-chip def-chip--total def-chip--distance" title="Bonus d'attaque à distance">
            <span class="def-chip-label">Total</span>
            <span class="def-chip-value">{{ sign(computedAttackDistance) }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" :title="`Niveau ${character.level}`">
            <span class="def-chip-label">Niv.</span>
            <span class="def-chip-value">{{ character.level }}</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="`Mod. DEX (${character.abilities.dexterity})`">
            <span class="def-chip-label">DEX</span>
            <span class="def-chip-value">{{ sign(dexMod) }}</span>
          </div>
          <template v-if="familyBonusDistance > 0">
            <span class="def-op">+</span>
            <div class="def-chip def-chip--family" :title="`Bonus famille ${family}`">
              <span class="def-chip-label">Famille</span>
              <span class="def-chip-value">+{{ familyBonusDistance }}</span>
            </div>
          </template>
          <template v-if="armorPenaltyDistance > 0">
            <span class="def-op">−</span>
            <div class="def-chip def-chip--penalty" :title="`Pénalité équipement (½ × ${equipTotalBonus})`">
              <span class="def-chip-label">Équip.</span>
              <span class="def-chip-value">{{ armorPenaltyDistance }}</span>
            </div>
          </template>
          <span class="def-op">+</span>
          <label class="def-chip def-chip--editable" title="Bonus divers (capacités, magie…)">
            <span class="def-chip-label">Bonus</span>
            <input v-model.number="character.attackDistanceBonus" type="number" class="def-bonus-input" placeholder="0" />
          </label>
        </div>
      </div>

      <!-- Magique -->
      <div class="attack-row">
        <span class="attack-label">Magique</span>
        <div class="def-formula">
          <div class="def-chip def-chip--total def-chip--magique" title="Bonus d'attaque magique">
            <span class="def-chip-label">Total</span>
            <span class="def-chip-value">{{ sign(computedAttackMagique) }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" :title="`Niveau ${character.level}`">
            <span class="def-chip-label">Niv.</span>
            <span class="def-chip-value">{{ character.level }}</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="`Mod. INT (${character.abilities.intelligence})`">
            <span class="def-chip-label">INT</span>
            <span class="def-chip-value">{{ sign(intMod) }}</span>
          </div>
          <template v-if="familyBonusMagique > 0">
            <span class="def-op">+</span>
            <div class="def-chip def-chip--family" :title="`Bonus famille mystiques`">
              <span class="def-chip-label">Famille</span>
              <span class="def-chip-value">+{{ familyBonusMagique }}</span>
            </div>
          </template>
          <template v-if="armorPenaltyMagique > 0">
            <span class="def-op">−</span>
            <div class="def-chip def-chip--penalty" :title="`Pénalité équipement (${equipTotalBonus})`">
              <span class="def-chip-label">Équip.</span>
              <span class="def-chip-value">{{ armorPenaltyMagique }}</span>
            </div>
          </template>
          <span class="def-op">+</span>
          <label class="def-chip def-chip--editable" title="Bonus divers (capacités, magie…)">
            <span class="def-chip-label">Bonus</span>
            <input v-model.number="character.attackMagiqueBonus" type="number" class="def-bonus-input" placeholder="0" />
          </label>
        </div>
      </div>

      <!-- Défense -->
      <div class="attack-row">
        <span class="attack-label">Défense</span>
        <div class="def-formula">
          <div class="def-chip def-chip--total def-chip--def" title="DEF totale calculée">
            <span class="def-chip-label">Total</span>
            <span class="def-chip-value">{{ computedDef }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" title="Valeur de base (règle CO)">
            <span class="def-chip-label">Base</span>
            <span class="def-chip-value">10</span>
          </div>
          <span class="def-op">+</span>
          <div :class="['def-chip', defDexBlocked && 'def-chip--blocked']" :title="defDexTooltip">
            <span class="def-chip-label">DEX</span>
            <span class="def-chip-value">{{ defDexSign }}{{ defDexContrib }}</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="armor?.name ?? 'Aucune armure'">
            <span class="def-chip-label">Armure</span>
            <span class="def-chip-value">{{ defArmorBonus }}</span>
          </div>
          <span class="def-op">+</span>
          <div class="def-chip" :title="shield?.name ?? 'Aucun bouclier'">
            <span class="def-chip-label">Bouclier</span>
            <span class="def-chip-value">{{ defShieldBonus }}</span>
          </div>
          <span class="def-op">+</span>
          <label class="def-chip def-chip--editable" title="Bonus divers (capacités, magie…)">
            <span class="def-chip-label">Bonus</span>
            <input v-model.number="character.defenseBonus" type="number" class="def-bonus-input" placeholder="0" />
          </label>
        </div>
      </div>

      <!-- Initiative -->
      <div class="attack-row">
        <span class="attack-label">Initiative</span>
        <div class="def-formula">
          <div class="def-chip def-chip--total def-chip--init" title="Score d'initiative = DEX − bonus armure">
            <span class="def-chip-label">Total</span>
            <span class="def-chip-value">{{ computedInitiative }}</span>
          </div>
          <span class="def-op">=</span>
          <div class="def-chip" title="Valeur de DEX">
            <span class="def-chip-label">DEX</span>
            <span class="def-chip-value">{{ character.abilities.dexterity }}</span>
          </div>
          <template v-if="armor">
            <span class="def-op">−</span>
            <div class="def-chip" :title="`Pénalité armure : ${armor.name}`">
              <span class="def-chip-label">Armure</span>
              <span class="def-chip-value">{{ armor.defBonus }}</span>
            </div>
          </template>
          <template v-if="shield">
            <span class="def-op">−</span>
            <div class="def-chip" :title="`Pénalité bouclier : ${shield.name}`">
              <span class="def-chip-label">Bouclier</span>
              <span class="def-chip-value">{{ shield.defBonus }}</span>
            </div>
          </template>
          <span class="def-op">+</span>
          <label class="def-chip def-chip--editable" title="Bonus divers (capacités, magie…)">
            <span class="def-chip-label">Bonus</span>
            <input v-model.number="character.initiativeBonus" type="number" class="def-bonus-input" placeholder="0" />
          </label>
        </div>
      </div>

    </div>

  </AppCard>
</template>

<style scoped>
.attack-grid {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.attack-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.attack-label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
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
  min-width: 2.8rem;
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

.def-chip--total .def-chip-value { font-size: 1.2rem; }

.def-chip--contact {
  border-color: #b05c35;
  background: color-mix(in srgb, #b05c35 14%, var(--surface-2));
}
.def-chip--contact .def-chip-value { color: #b05c35; }

.def-chip--distance {
  border-color: #3a7a4a;
  background: color-mix(in srgb, #3a7a4a 14%, var(--surface-2));
}
.def-chip--distance .def-chip-value { color: #2a6a38; }
:root[data-theme="dark"] .def-chip--distance .def-chip-value { color: #7bcf8a; }

.def-chip--magique {
  border-color: var(--accent, #7c5cbf);
  background: color-mix(in srgb, var(--accent, #7c5cbf) 14%, var(--surface-2));
}
.def-chip--magique .def-chip-value { color: var(--accent-strong); }

.def-chip--family {
  border-color: #c89c3a;
  background: color-mix(in srgb, #c89c3a 12%, var(--surface-2));
}
.def-chip--family .def-chip-value { color: #a07828; }
:root[data-theme="dark"] .def-chip--family .def-chip-value { color: #d4a843; }

.def-chip--penalty {
  border-color: #a04040;
  background: color-mix(in srgb, #a04040 10%, var(--surface-2));
  opacity: 0.8;
}
.def-chip--penalty .def-chip-value { color: #a04040; }

.def-chip--def {
  border-color: #5a7fb0;
  background: color-mix(in srgb, #5a7fb0 14%, var(--surface-2));
}
.def-chip--def .def-chip-value { color: #3a5f90; }
:root[data-theme="dark"] .def-chip--def .def-chip-value { color: #8ab0d8; }

.def-chip--init {
  border-color: #6a9a6a;
  background: color-mix(in srgb, #6a9a6a 14%, var(--surface-2));
}
.def-chip--init .def-chip-value { color: #3a6a3a; }
:root[data-theme="dark"] .def-chip--init .def-chip-value { color: #8acf8a; }

.def-chip--blocked {
  opacity: 0.45;
  text-decoration: line-through;
}

.def-chip--editable {
  cursor: text;
  border-style: dashed;
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

</style>
