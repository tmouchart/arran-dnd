import { describe, it, expect, beforeEach } from 'vitest'
import {
  useCharacter,
  computedHp,
  computedHpBase,
  computedHpGrowth,
  computedMp,
  FAMILY_DIE_MAX,
  createDefaultCharacter,
  toCharacter,
  normalizeHpLevelGains,
} from './useCharacter'
import type { PathRow } from '../types/character'
import type { ServerCharacter } from '../api/characters'
import { nextTick } from 'vue'

// ── Voies réelles (client/src/data/voies.ts) ──────────────────────────────────

const COMBATTANT_1: PathRow = { id: 'voie-du-bastion', name: 'Voie du bastion', rank: 1 }
const COMBATTANT_2: PathRow = { id: 'voie-de-la-bravoure', name: 'Voie de la bravoure', rank: 1 }
const MYSTIQUE_1: PathRow = { id: 'voie-de-lalchimie', name: "Voie de l'alchimie", rank: 1 }
const MYSTIQUE_2: PathRow = { id: 'voie-des-arts-druidiques', name: 'Voie des arts druidiques', rank: 1 }

// ── Setup ─────────────────────────────────────────────────────────────────────

let character: ReturnType<typeof useCharacter>['character']

beforeEach(() => {
  character = useCharacter().character
  character.value = createDefaultCharacter() // famille = aventuriers par défaut
})

// ── FAMILY_DIE_MAX ────────────────────────────────────────────────────────────

describe('FAMILY_DIE_MAX', () => {
  it('combattants → d10', () => expect(FAMILY_DIE_MAX.combattants).toBe(10))
  it('aventuriers → d8', () => expect(FAMILY_DIE_MAX.aventuriers).toBe(8))
  it('mystiques   → d6', () => expect(FAMILY_DIE_MAX.mystiques).toBe(6))
  it('prestige    → d8', () => expect(FAMILY_DIE_MAX.prestige).toBe(8))
})

// ── computedHpBase ────────────────────────────────────────────────────────────

describe('computedHpBase', () => {
  it('aventuriers (défaut), CON 10 → d8 + 0 = 8', () => {
    expect(computedHpBase.value).toBe(8)
  })

  it('combattants, CON 10 → d10 + 0 = 10', () => {
    character.value.paths = [COMBATTANT_1, COMBATTANT_2]
    expect(computedHpBase.value).toBe(10)
  })

  it('mystiques, CON 10 → d6 + 0 = 6', () => {
    character.value.paths = [MYSTIQUE_1, MYSTIQUE_2]
    expect(computedHpBase.value).toBe(6)
  })

  it('mod CON positif ajouté au dé', () => {
    character.value.abilities.constitution = 14 // mod +2
    expect(computedHpBase.value).toBe(8 + 2) // aventuriers d8
  })

  it('mod CON négatif soustrait du dé', () => {
    character.value.abilities.constitution = 6 // mod -2
    expect(computedHpBase.value).toBe(8 - 2)
  })
})

// ── computedHpGrowth ──────────────────────────────────────────────────────────

describe('computedHpGrowth', () => {
  it('aucun gain de niveau → 0', () => {
    character.value.hpLevelGains = []
    expect(computedHpGrowth.value).toBe(0)
  })

  it('un gain + mod CON nul → valeur brute', () => {
    character.value.hpLevelGains = [5]
    character.value.abilities.constitution = 10 // mod 0
    expect(computedHpGrowth.value).toBe(5)
  })

  it('mod CON positif ajouté à chaque niveau', () => {
    character.value.hpLevelGains = [4, 6] // 2 niveaux
    character.value.abilities.constitution = 12 // mod +1
    expect(computedHpGrowth.value).toBe((4 + 1) + (6 + 1))
  })

  it('mod CON négatif soustrait à chaque niveau', () => {
    character.value.hpLevelGains = [5, 5]
    character.value.abilities.constitution = 6 // mod -2
    expect(computedHpGrowth.value).toBe((5 - 2) + (5 - 2))
  })

  it('plusieurs niveaux sans mod', () => {
    character.value.hpLevelGains = [3, 7, 4]
    character.value.abilities.constitution = 10
    expect(computedHpGrowth.value).toBe(3 + 7 + 4)
  })
})

// ── computedHp ────────────────────────────────────────────────────────────────

describe('computedHp', () => {
  it('niveau 1 (aucun gain) = base uniquement', () => {
    character.value.hpLevelGains = []
    character.value.abilities.constitution = 10
    expect(computedHp.value).toBe(8) // aventuriers d8
  })

  it('base + croissance', () => {
    character.value.abilities.constitution = 10
    character.value.hpLevelGains = [6, 4] // +10 de croissance
    expect(computedHp.value).toBe(8 + 6 + 4)
  })

  it('minimum 1 même si base + croissance ≤ 0', () => {
    character.value.abilities.constitution = 1 // mod -5 → base d8 - 5 = 3
    character.value.paths = [MYSTIQUE_1, MYSTIQUE_2] // d6 → 6 - 5 = 1
    character.value.hpLevelGains = [1, 1, 1] // +1 - 5 = -4 par niveau → croissance = -12
    // base = 6 - 5 = 1, croissance = (1-5)*3 = -12 → total = -11 → clamp à 1
    expect(computedHp.value).toBe(1)
  })

  it('CON élevée augmente significativement les HP', () => {
    character.value.abilities.constitution = 18 // mod +4
    character.value.hpLevelGains = [8, 8, 8, 8] // 4 niveaux, max roll
    // base: 8 + 4 = 12 ; croissance: (8+4)*4 = 48 ; total: 60
    expect(computedHp.value).toBe(12 + 48)
  })
})

// ── computedMp ────────────────────────────────────────────────────────────────

describe('computedMp', () => {
  it('aventuriers × 1 : niveau + mod SAG', () => {
    character.value.level = 3
    character.value.abilities.wisdom = 10 // mod 0
    expect(computedMp.value).toBe(3)
  })

  it('mystiques × 2 : (niveau + mod SAG) × 2', () => {
    character.value.paths = [MYSTIQUE_1, MYSTIQUE_2]
    character.value.level = 3
    character.value.abilities.wisdom = 10
    expect(computedMp.value).toBe(6)
  })

  it('mod SAG positif augmente les PM', () => {
    character.value.level = 2
    character.value.abilities.wisdom = 14 // mod +2
    expect(computedMp.value).toBe(2 + 2) // aventuriers × 1
  })

  it('mystiques + mod SAG élevé → double bénéfice', () => {
    character.value.paths = [MYSTIQUE_1, MYSTIQUE_2]
    character.value.level = 2
    character.value.abilities.wisdom = 14 // mod +2
    expect(computedMp.value).toBe((2 + 2) * 2)
  })

  it('mod SAG négatif réduit les PM (peut être négatif avant clamp du watch)', () => {
    character.value.level = 1
    character.value.abilities.wisdom = 6 // mod -2 → 1 + (-2) = -1
    expect(computedMp.value).toBe(-1)
  })

  it('combattants × 1 (pas de multiplicateur)', () => {
    character.value.paths = [COMBATTANT_1, COMBATTANT_2]
    character.value.level = 4
    character.value.abilities.wisdom = 12 // mod +1
    expect(computedMp.value).toBe(4 + 1)
  })
})

// ── Chargement d'une fiche dont les jets de croissance sont incomplets ────────
// Régression prod (sept. 2026) : niveau 5 avec 3 jets → au chargement, le
// premier calcul de PV max (avec 3 jets) rabattait les PV courants, puis le
// 4e jet était ajouté et le max remontait. Résultat : « 24/31 » à chaque
// ouverture de la fiche.

describe('normalizeHpLevelGains', () => {
  it('complète avec le dé max jusqu’à niveau - 1', () => {
    expect(normalizeHpLevelGains([5, 5, 4], 5, 6)).toEqual([5, 5, 4, 6])
  })
  it('tronque si trop de jets', () => {
    expect(normalizeHpLevelGains([5, 5, 4, 6], 3, 6)).toEqual([5, 5])
  })
  it('ne touche pas à une liste déjà complète', () => {
    expect(normalizeHpLevelGains([5, 5, 4, 2], 5, 6)).toEqual([5, 5, 4, 2])
  })
  it('niveau 1 → aucun jet', () => {
    expect(normalizeHpLevelGains([3], 1, 6)).toEqual([])
  })
})

describe('chargement d’une fiche avec des jets de croissance manquants', () => {
  const MINIZOU: ServerCharacter = {
    id: 5, userId: 9, isActive: true, name: 'Minizou', profile: '', histoire: '', people: 'nain',
    level: 5, hpMax: 31, hpCurrent: 30, mpMax: 12, mpCurrent: 12, defense: 12, initiativeBonus: 0,
    str: 10, dex: 12, con: 13, int: 16, wis: 12, cha: 10,
    skills: [], weapons: [], martialFormations: [],
    paths: [MYSTIQUE_1, MYSTIQUE_2],
    mysticTalent: null, armorId: null, shieldId: null,
    defenseBonus: 0, attackContactBonus: 0, attackDistanceBonus: 0, attackMagiqueBonus: 0,
    hpLevelGains: [5, 5, 4], // 3 jets pour un niveau 5 : il en manque un
    items: [], goldCoins: 0, silverCoins: 0, copperCoins: 0,
    pcCurrent: 2, prCurrent: 5, affaibli: false, competences: [], portraitImageId: null,
  }

  it('toCharacter complète les jets avant tout calcul', () => {
    expect(toCharacter(MINIZOU).hpLevelGains).toEqual([5, 5, 4, 6])
  })

  it('les PV courants ne sont pas rabattus au chargement', async () => {
    character.value = toCharacter(MINIZOU)
    await nextTick()
    // d6 + 1 (CON 13) + (5+1) + (5+1) + (4+1) + (6+1) = 31
    expect(computedHp.value).toBe(31)
    expect(character.value.hpCurrent).toBe(30)
    expect(character.value.hpMax).toBe(31)
  })
})
