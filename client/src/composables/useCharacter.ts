import { ref, watch } from 'vue'
import type { Character } from '../types/character'
import {
  fetchCharacters,
  fetchCharacter,
  createCharacter,
  updateCharacter,
  type ServerCharacter,
} from '../api/characters'

// PM courants : localStorage ; PV courants : colonne serveur `hp_current` (+ cache localStorage)
const HP_KEY = 'arran-hp-current'
const MP_KEY = 'arran-mp-current'

function loadCurrentHp(hpMax: number): number {
  const v = Number(localStorage.getItem(HP_KEY))
  return Number.isFinite(v) && v > 0 ? v : hpMax
}
function loadCurrentMp(mpMax: number): number {
  const v = Number(localStorage.getItem(MP_KEY))
  return Number.isFinite(v) && v >= 0 ? v : mpMax
}

function toCharacter(s: ServerCharacter): Character {
  return {
    id: String(s.id),
    name: s.name,
    profile: s.profile,
    histoire: s.histoire ?? '',
    people: s.people,
    level: s.level,
    abilities: {
      strength: s.str,
      dexterity: s.dex,
      constitution: s.con,
      intelligence: s.int,
      wisdom: s.wis,
      charisma: s.cha,
    },
    hpCurrent:
      typeof s.hpCurrent === 'number' && Number.isFinite(s.hpCurrent)
        ? Math.max(0, Math.min(s.hpCurrent, s.hpMax))
        : loadCurrentHp(s.hpMax),
    hpMax: s.hpMax,
    mpCurrent: loadCurrentMp(s.mpMax),
    mpMax: s.mpMax,
    defense: s.defense,
    // CO / Terres d’Arran: initiative score equals DEX value (see creation-personnage.md)
    initiativeBonus: s.dex,
    skills: s.skills,
    weapons: Array.isArray(s.weapons) ? s.weapons : [],
    martialFormations: Array.isArray(s.martialFormations)
      ? s.martialFormations.filter((id) => id !== 'paysan')
      : [],
    paths: s.paths,
    mysticTalent: s.mysticTalent ?? '',
  }
}

function toServerPayload(c: Character): Omit<ServerCharacter, 'id' | 'userId' | 'isActive'> {
  return {
    name: c.name,
    profile: c.profile,
    histoire: c.histoire,
    people: c.people,
    level: c.level,
    hpMax: c.hpMax,
    hpCurrent: c.hpCurrent,
    mpMax: c.mpMax,
    defense: c.defense,
    initiativeBonus: c.abilities.dexterity,
    str: c.abilities.strength,
    dex: c.abilities.dexterity,
    con: c.abilities.constitution,
    int: c.abilities.intelligence,
    wis: c.abilities.wisdom,
    cha: c.abilities.charisma,
    skills: c.skills,
    weapons: c.weapons,
    martialFormations: c.martialFormations,
    paths: c.paths,
    mysticTalent: c.mysticTalent || null,
  }
}

export function createDefaultCharacter(): Character {
  return {
    id: '',
    name: 'Nouveau héros',
    profile: '',
    histoire: '',
    people: '',
    level: 1,
    abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    hpCurrent: 10,
    hpMax: 10,
    mpCurrent: 0,
    mpMax: 0,
    defense: 12,
    initiativeBonus: 10,
    skills: [],
    martialFormations: [],
    weapons: [],
    paths: [],
    mysticTalent: '',
  }
}

const character = ref<Character>(createDefaultCharacter())
const serverId = ref<number | null>(null)

watch(
  () => character.value.abilities.dexterity,
  (dex) => {
    character.value.initiativeBonus = dex
  },
)
const loading = ref(false)
const loadError = ref<string | null>(null)
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export async function loadCharacter(id?: number): Promise<void> {
  // Annule tout debounce en cours et remet les états propres
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  loading.value = true
  loadError.value = null
  character.value = createDefaultCharacter()
  serverId.value = null
  try {
    if (id) {
      const row = await fetchCharacter(id)
      serverId.value = row.id
      character.value = toCharacter(row)
    } else {
      const list = await fetchCharacters()
      const active = list.find((c) => c.isActive) ?? list[0] ?? null
      if (active) {
        serverId.value = active.id
        character.value = toCharacter(active)
      } else {
        const created = await createCharacter({ name: 'Nouveau héros' })
        serverId.value = created.id
        character.value = toCharacter(created)
      }
    }
  } catch {
    loadError.value =
      "Impossible de charger le personnage (API arrêtée, erreur serveur ou base non à jour). Relance l’API et exécute npm run db:migrate si besoin."
  } finally {
    loading.value = false
  }
}

watch(
  character,
  (c) => {
    // Persister hp/mp courants en localStorage uniquement
    try {
      localStorage.setItem(HP_KEY, String(c.hpCurrent))
      localStorage.setItem(MP_KEY, String(c.mpCurrent))
    } catch { /* quota */ }

    // Ne pas sauvegarder pendant le chargement (évite un PUT inutile au mount)
    if (loading.value || !serverId.value) return

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      if (!serverId.value) return
      saveStatus.value = 'saving'
      try {
        await updateCharacter(serverId.value, toServerPayload(c))
        saveStatus.value = 'saved'
        setTimeout(() => { saveStatus.value = 'idle' }, 2000)
      } catch {
        saveStatus.value = 'error'
      }
    }, 800)
  },
  { deep: true },
)

export function useCharacter() {
  function abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2)
  }

  return {
    character,
    loading,
    loadError,
    saveStatus,
    abilityModifier,
  }
}
