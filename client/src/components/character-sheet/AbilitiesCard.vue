<script setup lang="ts">
import { ref } from "vue";
import { Wand2, ChevronUp, ChevronDown } from "lucide-vue-next";
import AppCard from "../ui/AppCard.vue";
import AppIconBtn from "../ui/AppIconBtn.vue";
import AbilityInitModal from "./AbilityInitModal.vue";
import type { Character, CharacterAbilities } from "../../types/character";

const props = defineProps<{
  character: Character;
  abilityModifier: (score: number) => number;
}>();

const showInitModal = ref(false);

function applyAbilities(abilities: CharacterAbilities) {
  Object.assign(props.character.abilities, abilities);
}

const abilityList = [
  { key: "strength" as const, label: "FOR" },
  { key: "dexterity" as const, label: "DEX" },
  { key: "constitution" as const, label: "CON" },
  { key: "intelligence" as const, label: "INT" },
  { key: "wisdom" as const, label: "SAG" },
  { key: "charisma" as const, label: "CHA" },
];

function modDisplay(score: number): string {
  const m = props.abilityModifier(score);
  return (m >= 0 ? "+" : "") + m;
}
</script>

<template>
  <AbilityInitModal
    v-model:show="showInitModal"
    :character="character"
    @confirm="applyAbilities"
  />

  <AppCard title="Caractéristiques">
    <template #titleActions>
      <AppIconBtn title="Initialiser les caractéristiques" @click="showInitModal = true">
        <Wand2 :size="16" />
      </AppIconBtn>
    </template>
    <div class="abilities">
      <div v-for="a in abilityList" :key="a.key" class="ability">
        <span class="abil-label">{{ a.label }}</span>
        <div class="ability-row">
          <div class="score-mod">
            <span class="score-val">{{ character.abilities[a.key] }}</span>
            <span class="mod" :class="abilityModifier(character.abilities[a.key]) > 0 ? 'mod-pos' : abilityModifier(character.abilities[a.key]) < 0 ? 'mod-neg' : 'mod-zero'">
              ({{ modDisplay(character.abilities[a.key]) }})
            </span>
          </div>
          <div class="ab-btns">
            <button type="button" class="ab-btn" @click="character.abilities[a.key]++">
              <ChevronUp :size="12" :stroke-width="2.5" />
            </button>
            <button type="button" class="ab-btn" :disabled="character.abilities[a.key] <= 1" @click="character.abilities[a.key]--">
              <ChevronDown :size="12" :stroke-width="2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppCard>
</template>


<style scoped>
.abilities {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem 0.75rem;
}

@media (min-width: 520px) {
  .abilities {
    grid-template-columns: repeat(6, 1fr);
  }
}

.ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.abil-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.ability-row {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.3rem 0.3rem 0.3rem 0.4rem;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.score-mod {
  display: flex;
  align-items: baseline;
  gap: 0.15rem;
  min-width: 0;
  overflow: hidden;
}

.score-val {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  line-height: 1;
}

.mod {
  font-size: 0.72rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.mod-pos { color: var(--accent-strong); }
.mod-neg { color: var(--danger); }
.mod-zero { color: var(--muted); }

.ab-btns {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 14px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 4px;
  transition: background 100ms ease, color 100ms ease;
}

.ab-btn:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.ab-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
