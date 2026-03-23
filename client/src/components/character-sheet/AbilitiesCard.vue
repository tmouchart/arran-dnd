<script setup lang="ts">
import { ref } from "vue";
import { Wand2 } from "lucide-vue-next";
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
        <input v-model.number="character.abilities[a.key]" type="number" class="input score" />
        <span class="mod">
          {{ abilityModifier(character.abilities[a.key]) >= 0 ? "+" : "" }}{{ abilityModifier(character.abilities[a.key]) }}
        </span>
      </div>
    </div>
  </AppCard>
</template>


<style scoped>
.abilities {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
  gap: 0.75rem;
}

.ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0;
}

.abil-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.input.score {
  width: 3.5rem;
  text-align: center;
  font-size: 1.1rem;
}

.mod {
  font-size: 0.9rem;
  color: var(--accent-strong);
  font-weight: 600;
}
</style>
