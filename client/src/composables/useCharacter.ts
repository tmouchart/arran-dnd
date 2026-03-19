import { ref, watch } from 'vue'
import type { Character } from '../types/character'

const STORAGE_KEY = 'arran-dnd-character-v1'

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `pc-${Date.now()}`
}

export function createDefaultCharacter(): Character {
  return {
    id: newId(),
    name: 'Nouveau héros',
    profile: '',
    people: '',
    level: 1,
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    hpCurrent: 10,
    hpMax: 10,
    mpCurrent: 0,
    mpMax: 0,
    defense: 12,
    initiativeBonus: 0,
    skills: [],
    attacks: [],
    paths: [],
  }
}

function loadFromStorage(): Character {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Character
      if (parsed && typeof parsed.name === 'string') return parsed
    }
  } catch {
    /* ignore */
  }
  return createDefaultCharacter()
}

const character = ref<Character>(loadFromStorage())

watch(
  character,
  (c) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
    } catch {
      /* quota / private mode */
    }
  },
  { deep: true },
)

export function useCharacter() {
  function reset() {
    character.value = createDefaultCharacter()
  }

  function abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2)
  }

  return {
    character,
    reset,
    abilityModifier,
  }
}
