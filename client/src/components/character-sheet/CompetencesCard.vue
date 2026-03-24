<script setup lang="ts">
import AppCard from '../ui/AppCard.vue'
import AppIconBtn from '../ui/AppIconBtn.vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import type { Character, CharacterAbilities } from '../../types/character'

const props = defineProps<{ character: Character }>()

const ABILITY_OPTIONS: { value: keyof CharacterAbilities | ''; label: string }[] = [
  { value: '', label: '—' },
  { value: 'strength', label: 'FOR' },
  { value: 'dexterity', label: 'DEX' },
  { value: 'constitution', label: 'CON' },
  { value: 'intelligence', label: 'INT' },
  { value: 'wisdom', label: 'SAG' },
  { value: 'charisma', label: 'CHA' },
]

function addCompetence() {
  props.character.competences.push({
    id: crypto.randomUUID(),
    name: '',
    ability: null,
    bonus: 0,
  })
}

function removeCompetence(i: number) {
  props.character.competences.splice(i, 1)
}

function setAbility(i: number, val: string) {
  props.character.competences[i].ability =
    val === '' ? null : (val as keyof CharacterAbilities)
}
</script>

<template>
  <AppCard>
    <div class="card-head">
      <h2>Compétences</h2>
      <AppIconBtn variant="ghost" title="Ajouter une compétence" @click="addCompetence">
        <Plus :size="18" />
      </AppIconBtn>
    </div>

    <ul v-if="character.competences.length" class="comp-list">
      <li v-for="(comp, i) in character.competences" :key="comp.id" class="comp-row">
        <input
          v-model="comp.name"
          type="text"
          class="input comp-name"
          placeholder="Nom"
        />
        <select
          class="input comp-ability"
          :value="comp.ability ?? ''"
          @change="setAbility(i, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in ABILITY_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <input
          v-model.number="comp.bonus"
          type="number"
          class="input comp-bonus"
          placeholder="+0"
        />
        <AppIconBtn variant="ghost" :size="32" title="Supprimer" @click="removeCompetence(i)">
          <Trash2 :size="15" />
        </AppIconBtn>
      </li>
    </ul>
    <p v-else class="muted">Aucune compétence personnalisée.</p>
  </AppCard>
</template>

<style scoped>
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.9rem;
}
.card-head h2 { margin: 0; }

.comp-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.comp-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.comp-name    { flex: 1; min-width: 0; }
.comp-ability { width: 4.5rem; flex-shrink: 0; padding: 0.38rem 0.3rem; }
.comp-bonus   { width: 3.5rem; text-align: center; flex-shrink: 0; }

.muted { color: var(--muted); font-size: 0.9rem; margin: 0; }
</style>
