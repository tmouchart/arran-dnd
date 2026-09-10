import { ref, watch, computed } from 'vue'
import type { Character } from '../types/character'
import { isEtatId, type EtatId } from '../data/etats'
import {
  fetchCharacters,
  fetchCharacter,
  createCharacter,
  updateCharacter,
  type ServerCharacter,
} from '../api/characters'
import { inferProfileFamily } from '../utils/inferProfileFamily'
import { abilityModifier } from '../utils/attackBonus'
import {
  FAMILY_DIE_MAX,
  computeDef,
  computeMp,
  computeHpBase,
  computeHpConMod,
  computeHpGrowth,
  computeHp,
  computeHpDv,
  computeDv,
  computeInitiative,
  computePcMax,
  computeAttackContact,
  computeAttackDistance,
  computeAttackMagique,
} from '../utils/characterStats'

export { FAMILY_DIE_MAX }

// PM courants : localStorage ; PV courants : colonne serveur `hp_current` (source de vérité)
const MP_KEY = 'arran-mp-current'

// Nettoyage : ancien cache PV local, remplacé par la colonne serveur
try { localStorage.removeItem('arran-hp-current') } catch { /* noop */ }
function loadCurrentMp(mpMax: number): number {
  const v = Number(localStorage.getItem(MP_KEY))
  return Number.isFinite(v) && v >= 0 ? v : mpMax
}

/**
 * Ramène la liste des jets de croissance à exactement (niveau - 1) entrées :
 * on complète avec le dé max de la famille, on tronque l'excédent.
 * Appelé AVANT de poser la fiche, sinon le premier calcul de PV max tourne
 * avec des jets manquants et rabat les PV courants (bug « 24/31 », sept. 2026).
 */
export function normalizeHpLevelGains(gains: number[], level: number, dieMax: number): number[] {
  const needed = Math.max(0, level - 1)
  if (gains.length === needed) return gains
  if (gains.length > needed) return gains.slice(0, needed)
  return [...gains, ...Array(needed - gains.length).fill(dieMax)]
}

export function toCharacter(s: ServerCharacter): Character {
  const rawGains = Array.isArray(s.hpLevelGains) ? (s.hpLevelGains as number[]) : []
  const dieMax = FAMILY_DIE_MAX[inferProfileFamily(s.paths)]
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
    hpCurrent: Math.max(0, Math.min(s.hpCurrent, s.hpMax)),
    hpMax: s.hpMax,
    mpCurrent:
      typeof s.mpCurrent === 'number' && Number.isFinite(s.mpCurrent)
        ? Math.max(0, Math.min(s.mpCurrent, s.mpMax))
        : loadCurrentMp(s.mpMax),
    mpMax: s.mpMax,
    defense: s.defense,
    initiativeBonus: s.initiativeBonus ?? 0,
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
    attackContactBonus: s.attackContactBonus ?? 0,
    attackDistanceBonus: s.attackDistanceBonus ?? 0,
    attackMagiqueBonus: s.attackMagiqueBonus ?? 0,
    hpLevelGains: normalizeHpLevelGains(rawGains, s.level, dieMax),
    items: Array.isArray(s.items) ? s.items : [],
    goldCoins: s.goldCoins ?? 0,
    silverCoins: s.silverCoins ?? 0,
    copperCoins: s.copperCoins ?? 0,
    pcCurrent: typeof s.pcCurrent === 'number' ? s.pcCurrent : 0,
    prCurrent: typeof s.prCurrent === 'number' ? s.prCurrent : 5,
    states: Array.isArray(s.states) ? s.states.filter(isEtatId) : [],
    competences: Array.isArray(s.competences) ? s.competences : [],
    portraitImageId: s.portraitImageId ?? null,
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
    mpCurrent: c.mpCurrent,
    defense: c.defense,
    initiativeBonus: c.initiativeBonus,
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
    attackContactBonus: c.attackContactBonus,
    attackDistanceBonus: c.attackDistanceBonus,
    attackMagiqueBonus: c.attackMagiqueBonus,
    hpLevelGains: c.hpLevelGains,
    items: c.items,
    goldCoins: c.goldCoins,
    silverCoins: c.silverCoins,
    copperCoins: c.copperCoins,
    pcCurrent: c.pcCurrent,
    prCurrent: c.prCurrent,
    states: c.states,
    competences: c.competences,
    portraitImageId: c.portraitImageId,
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
    initiativeBonus: 0,
    skills: [],
    martialFormations: [],
    weapons: [],
    paths: [],
    mysticTalent: '',
    armorId: '',
    shieldId: '',
    defenseBonus: 0,
    attackContactBonus: 0,
    attackDistanceBonus: 0,
    attackMagiqueBonus: 0,
    hpLevelGains: [],
    items: [],
    goldCoins: 0,
    silverCoins: 0,
    copperCoins: 0,
    pcCurrent: 0,
    prCurrent: 5,
    states: [],
    competences: [],
    portraitImageId: null,
  }
}

export const character = ref<Character>(createDefaultCharacter())
const serverId = ref<number | null>(null)


/** Computed DEF = 10 + mod DEX (si armure non encombrante) + bonus armure + bonus bouclier + bonus divers */
export const computedDef = computed(() => computeDef(character.value))

// Sync computed DEF → character.defense so the server always has the up-to-date value
watch(computedDef, (val) => {
  character.value.defense = val
}, { immediate: true })

/**
 * Computed PM = (Niveau + mod SAG) × multiplicateur de famille
 * - Combattants / Aventuriers / Prestige : ×1
 * - Mystiques : ×2
 */
export const computedMp = computed(() => computeMp(character.value))

// Sync computed PM → character.mpMax so the server always has the up-to-date value
watch(computedMp, (val) => {
  character.value.mpMax = Math.max(0, val)
}, { immediate: true })

/** PV de base (niveau 1) = dé max de la famille + mod CON */
export const computedHpBase = computed(() => computeHpBase(character.value))

/** Valeur du dé de vie (nombre max, ex: 10 pour combattants). */
export const computedHpDv = computed(() => computeHpDv(character.value))

/** Mod CON appliqué aux PV de base. */
export const computedHpConMod = computed(() => computeHpConMod(character.value))

/** Croissance PV (niveaux 2+) = somme des jets + mod CON par niveau */
export const computedHpGrowth = computed(() => computeHpGrowth(character.value))

/** PV max = base niv.1 + croissance niv.2..N */
export const computedHp = computed(() => computeHp(character.value))

/** Dé de vie de la famille (label affiché). */
export const computedDv = computed((): string => computeDv(character.value))

/** Initiative = valeur DEX - bonus DEF armure - bonus DEF bouclier (règles Terres d'Arran). */
export const computedInitiative = computed(() => computeInitiative(character.value))

/** PC max = 2 + Mod. CHA + (aventuriers : +2). */
export const computedPcMax = computed(() => computePcMax(character.value))

/** PR max = 5 (règle de base CO / Terres d'Arran). */
export const PR_MAX = 5

/** Faces du dé d'attaque/test : 12 si le personnage est affaibli, 20 sinon. */
export const attackDieSides = computed(() => (character.value.states.includes('affaibli') ? 12 : 20))

/**
 * Bonus d'attaque de contact = niveau + Mod. FOR + bonus famille
 * Pas de pénalité d'armure sur le contact.
 */
export const computedAttackContact = computed(() => computeAttackContact(character.value))

/**
 * Bonus d'attaque à distance = niveau + Mod. DEX + bonus famille - floor((armorDef + shieldDef) / 2)
 */
export const computedAttackDistance = computed(() => computeAttackDistance(character.value))

/**
 * Bonus d'attaque magique = niveau + Mod. INT + bonus famille - (armorDef + shieldDef)
 */
export const computedAttackMagique = computed(() => computeAttackMagique(character.value))

// Sync computed HP → character.hpMax (et clamp hpCurrent, qui ne doit jamais dépasser le max)
watch(computedHp, (val) => {
  character.value.hpMax = val
  if (character.value.hpCurrent > val) character.value.hpCurrent = val
}, { immediate: true })


// Auto-resize hpLevelGains when level changes
watch(
  () => character.value.level,
  (newLevel) => {
    const c = character.value
    const dieMax = FAMILY_DIE_MAX[inferProfileFamily(c.paths)]
    const normalized = normalizeHpLevelGains(c.hpLevelGains, newLevel, dieMax)
    if (normalized !== c.hpLevelGains) c.hpLevelGains = normalized
  },
)

const loading = ref(false)
const loadError = ref<string | null>(null)
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Génération de chargement : si un loadCharacter plus récent démarre, les réponses
// des chargements précédents sont ignorées (évite qu'une réponse lente écrase la bonne).
let loadGen = 0
// Snapshot du dernier état connu du serveur : la sauvegarde auto ne part que si le
// personnage a réellement changé (bloque le PUT parasite déclenché par le load lui-même,
// la garde `loading` étant inopérante avec un watcher asynchrone).
let lastSavedPayload = ''

function applyLoaded(row: ServerCharacter): void {
  serverId.value = row.id
  character.value = toCharacter(row)
  lastSavedPayload = JSON.stringify(toServerPayload(character.value))
}

/**
 * Applique des PV qui viennent DÉJÀ du serveur (flux SSE du combat) sans
 * déclencher la sauvegarde auto. Sans ça, chaque coup encaissé faisait renvoyer
 * la fiche entière par le navigateur du joueur — et une fiche locale périmée
 * écrasait alors tout le reste.
 */
export function applyServerHp(hpCurrent: number): void {
  if (character.value.hpCurrent === hpCurrent) return
  character.value.hpCurrent = hpCurrent
  // Le serveur a déjà cette valeur : on aligne le témoin pour que le watcher
  // ne voie aucun changement à sauvegarder.
  lastSavedPayload = JSON.stringify(toServerPayload(character.value))
}

/**
 * Applique des états qui viennent DÉJÀ du serveur (le MJ les a posés depuis le
 * combat) sans déclencher la sauvegarde auto — même raison qu'`applyServerHp`.
 */
export function applyServerStates(states: EtatId[]): void {
  const current = character.value.states
  if (current.length === states.length && current.every((id, i) => id === states[i])) return
  character.value.states = [...states]
  lastSavedPayload = JSON.stringify(toServerPayload(character.value))
}

/**
 * Applique un repos que le serveur a DÉJÀ écrit en base, sans déclencher la
 * sauvegarde auto — même raison que `applyServerHp` : une fiche locale périmée
 * renverrait tout le reste par-dessus.
 */
export function applyServerRest(state: {
  hpCurrent: number
  mpCurrent: number
  prCurrent: number
  states: EtatId[]
}): void {
  const c = character.value
  c.hpCurrent = state.hpCurrent
  c.mpCurrent = state.mpCurrent
  c.prCurrent = state.prCurrent
  c.states = state.states
  lastSavedPayload = JSON.stringify(toServerPayload(c))
}

export async function loadCharacter(id?: number): Promise<void> {
  // Annule tout debounce en cours et remet les états propres
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  const gen = ++loadGen
  loading.value = true
  loadError.value = null
  character.value = createDefaultCharacter()
  serverId.value = null
  try {
    if (id) {
      const row = await fetchCharacter(id)
      if (gen !== loadGen) return
      applyLoaded(row)
    } else {
      const list = await fetchCharacters()
      if (gen !== loadGen) return
      const active = list.find((c) => c.isActive) ?? list[0] ?? null
      if (active) {
        applyLoaded(active)
      } else {
        const created = await createCharacter({ name: 'Nouveau héros' })
        if (gen !== loadGen) return
        applyLoaded(created)
      }
    }
  } catch {
    if (gen !== loadGen) return
    loadError.value =
      "Impossible de charger le personnage (API arrêtée, erreur serveur ou base non à jour). Relance l’API et exécute npm run db:migrate si besoin."
  } finally {
    if (gen === loadGen) loading.value = false
  }
}

watch(
  character,
  (c) => {
    // Persister mp courant en localStorage uniquement
    try {
      localStorage.setItem(MP_KEY, String(c.mpCurrent))
    } catch { /* quota */ }

    // Ne pas sauvegarder pendant le chargement (évite un PUT inutile au mount)
    if (loading.value || !serverId.value) return

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      if (!serverId.value) return
      const payload = toServerPayload(character.value)
      const json = JSON.stringify(payload)
      // Rien n'a changé depuis le dernier état serveur connu → pas de PUT
      if (json === lastSavedPayload) return
      saveStatus.value = 'saving'
      try {
        await updateCharacter(serverId.value, payload)
        lastSavedPayload = json
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
    computedHpDv,
    computedHpConMod,
    computedHpGrowth,
    computedDv,
    computedInitiative,
    computedPcMax,
    attackDieSides,
    computedAttackContact,
    computedAttackDistance,
    computedAttackMagique,
  }
}
