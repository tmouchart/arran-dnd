import { ref, watch, computed } from 'vue'
import type { Character } from '../types/character'
import {
  fetchCharacters,
  fetchCharacter,
  createCharacter,
  updateCharacter,
  type ServerCharacter,
} from '../api/characters'
import { ARMORS_BY_ID, SHIELDS_BY_ID } from '../data/armorsCatalog'
import { inferProfileFamily } from '../utils/inferProfileFamily'
import { type VoieFamily } from '../data/voies'

/** Maximum die face per family (level 1 = max; subsequent levels = roll). */
export const FAMILY_DIE_MAX: Record<VoieFamily, number> = {
  combattants: 10,
  aventuriers: 8,
  mystiques: 6,
  prestige: 8,
}

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
    armorId: s.armorId ?? '',
    shieldId: s.shieldId ?? '',
    defenseBonus: s.defenseBonus ?? 0,
    hpLevelGains: Array.isArray(s.hpLevelGains) ? (s.hpLevelGains as number[]) : [],
    items: Array.isArray(s.items) ? s.items : [],
    goldCoins: s.goldCoins ?? 0,
    silverCoins: s.silverCoins ?? 0,
    copperCoins: s.copperCoins ?? 0,
    pcCurrent: typeof s.pcCurrent === 'number' ? s.pcCurrent : 0,
    prCurrent: typeof s.prCurrent === 'number' ? s.prCurrent : 5,
    competences: Array.isArray(s.competences) ? s.competences : [],
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
    armorId: c.armorId || null,
    shieldId: c.shieldId || null,
    defenseBonus: c.defenseBonus,
    hpLevelGains: c.hpLevelGains,
    items: c.items,
    goldCoins: c.goldCoins,
    silverCoins: c.silverCoins,
    copperCoins: c.copperCoins,
    pcCurrent: c.pcCurrent,
    prCurrent: c.prCurrent,
    competences: c.competences,
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
    armorId: '',
    shieldId: '',
    defenseBonus: 0,
    hpLevelGains: [],
    items: [],
    goldCoins: 0,
    silverCoins: 0,
    copperCoins: 0,
    pcCurrent: 0,
    prCurrent: 5,
    competences: [],
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

/** Computed DEF = 10 + mod DEX (si armure non encombrante) + bonus armure + bonus bouclier + bonus divers */
export const computedDef = computed(() => {
  const c = character.value
  const dexMod = Math.floor((c.abilities.dexterity - 10) / 2)
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  const armorBonus = armor?.defBonus ?? 0
  const shieldBonus = shield?.defBonus ?? 0
  const dexContrib = armor?.encombrant ? 0 : dexMod
  return 10 + dexContrib + armorBonus + shieldBonus + c.defenseBonus
})

// Sync computed DEF → character.defense so the server always has the up-to-date value
watch(computedDef, (val) => {
  character.value.defense = val
}, { immediate: true })

/**
 * Computed PM = (Niveau + mod SAG) × multiplicateur de famille
 * - Combattants / Aventuriers / Prestige : ×1
 * - Mystiques : ×2
 */
export const computedMp = computed(() => {
  const c = character.value
  const wisMod = Math.floor((c.abilities.wisdom - 10) / 2)
  const base = c.level + wisMod
  const family = inferProfileFamily(c.paths)
  return family === 'mystiques' ? 2 * base : base
})

// Sync computed PM → character.mpMax so the server always has the up-to-date value
watch(computedMp, (val) => {
  character.value.mpMax = Math.max(0, val)
}, { immediate: true })

/**
 * PV de base (niveau 1) = dé max de la famille + mod CON
 */
export const computedHpBase = computed(() => {
  const c = character.value
  const family = inferProfileFamily(c.paths)
  const dieMax = FAMILY_DIE_MAX[family]
  const conMod = Math.floor((c.abilities.constitution - 10) / 2)
  return dieMax + conMod
})

/**
 * Croissance PV (niveaux 2+) = somme des jets + mod CON par niveau
 */
export const computedHpGrowth = computed(() => {
  const c = character.value
  const conMod = Math.floor((c.abilities.constitution - 10) / 2)
  return c.hpLevelGains.reduce((sum, roll) => sum + roll + conMod, 0)
})

/** PV max = base niv.1 + croissance niv.2..N */
export const computedHp = computed(() => Math.max(1, computedHpBase.value + computedHpGrowth.value))

/** Dé de vie de la famille (label affiché). */
export const computedDv = computed((): string => {
  const family = inferProfileFamily(character.value.paths)
  const faces: Record<VoieFamily, string> = { combattants: 'd10', aventuriers: 'd8', mystiques: 'd6', prestige: 'd8' }
  return faces[family]
})

/** Initiative = valeur DEX - bonus DEF armure - bonus DEF bouclier (règles Terres d'Arran). */
export const computedInitiative = computed(() => {
  const c = character.value
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  return c.abilities.dexterity - (armor?.defBonus ?? 0) - (shield?.defBonus ?? 0)
})

/** PC max = 2 + Mod. CHA + (aventuriers : +2). */
export const computedPcMax = computed(() => {
  const c = character.value
  const chaMod = Math.floor((c.abilities.charisma - 10) / 2)
  const family = inferProfileFamily(c.paths)
  return 2 + chaMod + (family === 'aventuriers' ? 2 : 0)
})

/** PR max = 5 (règle de base CO / Terres d'Arran). */
export const PR_MAX = 5

// Bonus d'attaque par famille
function familyAttackBonus(family: VoieFamily): { contact: number; distance: number; magique: number } {
  if (family === 'combattants') return { contact: 2, distance: 2, magique: 0 }
  if (family === 'aventuriers') return { contact: 1, distance: 1, magique: 0 }
  if (family === 'mystiques') return { contact: 0, distance: 0, magique: 2 }
  return { contact: 1, distance: 1, magique: 0 } // prestige → aventuriers par défaut
}

/**
 * Bonus d'attaque de contact = niveau + Mod. FOR + bonus famille
 * Pas de pénalité d'armure sur le contact.
 */
export const computedAttackContact = computed(() => {
  const c = character.value
  const forMod = Math.floor((c.abilities.strength - 10) / 2)
  const bonus = familyAttackBonus(inferProfileFamily(c.paths))
  return c.level + forMod + bonus.contact
})

/**
 * Bonus d'attaque à distance = niveau + Mod. DEX + bonus famille - floor((armorDef + shieldDef) / 2)
 */
export const computedAttackDistance = computed(() => {
  const c = character.value
  const dexMod = Math.floor((c.abilities.dexterity - 10) / 2)
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  const equipPenalty = Math.floor(((armor?.defBonus ?? 0) + (shield?.defBonus ?? 0)) / 2)
  const bonus = familyAttackBonus(inferProfileFamily(c.paths))
  return c.level + dexMod + bonus.distance - equipPenalty
})

/**
 * Bonus d'attaque magique = niveau + Mod. INT + bonus famille - (armorDef + shieldDef)
 */
export const computedAttackMagique = computed(() => {
  const c = character.value
  const intMod = Math.floor((c.abilities.intelligence - 10) / 2)
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  const equipPenalty = (armor?.defBonus ?? 0) + (shield?.defBonus ?? 0)
  const bonus = familyAttackBonus(inferProfileFamily(c.paths))
  return c.level + intMod + bonus.magique - equipPenalty
})

// Sync computed HP → character.hpMax
watch(computedHp, (val) => {
  character.value.hpMax = val
}, { immediate: true })

// Auto-resize hpLevelGains when level changes
watch(
  () => character.value.level,
  (newLevel) => {
    const needed = Math.max(0, newLevel - 1)
    const gains = character.value.hpLevelGains
    if (gains.length < needed) {
      const family = inferProfileFamily(character.value.paths)
      const dieMax = FAMILY_DIE_MAX[family]
      while (character.value.hpLevelGains.length < needed) {
        character.value.hpLevelGains.push(dieMax)
      }
    } else if (gains.length > needed) {
      character.value.hpLevelGains = gains.slice(0, needed)
    }
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
    computedDef,
    computedMp,
    computedHp,
    computedHpBase,
    computedHpGrowth,
    computedDv,
    computedInitiative,
    computedPcMax,
    computedAttackContact,
    computedAttackDistance,
    computedAttackMagique,
  }
}
