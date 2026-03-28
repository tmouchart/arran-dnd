import { describe, it, expect, beforeEach } from 'vitest'
import {
  useCharacter,
  createDefaultCharacter,
  computedDef,
  computedInitiative,
  computedPcMax,
  computedAttackContact,
  computedAttackDistance,
  computedAttackMagique,
} from './useCharacter'
import type { PathRow } from '../types/character'

// ── Voies réelles ────────────────────────────────────────────────────────────

const COMBATTANT_1: PathRow = { id: 'voie-du-bastion', name: 'Voie du bastion', rank: 1 }
const COMBATTANT_2: PathRow = { id: 'voie-de-la-bravoure', name: 'Voie de la bravoure', rank: 1 }
const MYSTIQUE_1: PathRow = { id: 'voie-de-lalchimie', name: "Voie de l'alchimie", rank: 1 }
const MYSTIQUE_2: PathRow = { id: 'voie-des-arts-druidiques', name: 'Voie des arts druidiques', rank: 1 }

// ── Setup ────────────────────────────────────────────────────────────────────

let character: ReturnType<typeof useCharacter>['character']

beforeEach(() => {
  character = useCharacter().character
  character.value = createDefaultCharacter() // famille = aventuriers par défaut
})

// ── computedDef ──────────────────────────────────────────────────────────────

describe('computedDef', () => {
  it('base DEF = 10 + mod DEX (aucune armure)', () => {
    character.value.abilities.dexterity = 14 // mod +2
    expect(computedDef.value).toBe(10 + 2)
  })

  it('ajoute le bonus armure', () => {
    character.value.armorId = 'cuir' // defBonus 2
    expect(computedDef.value).toBe(10 + 0 + 2) // DEX 10 → mod 0
  })

  it('ajoute le bonus de bouclier', () => {
    character.value.shieldId = 'grand-bouclier' // defBonus 2
    expect(computedDef.value).toBe(10 + 0 + 2)
  })

  it('armure + bouclier + DEX cumulent', () => {
    character.value.abilities.dexterity = 14 // mod +2
    character.value.armorId = 'cuir-renforce' // defBonus 3
    character.value.shieldId = 'petit-bouclier' // defBonus 1
    expect(computedDef.value).toBe(10 + 2 + 3 + 1)
  })

  it('armure encombrante annule bonus DEX', () => {
    character.value.abilities.dexterity = 16 // mod +3, mais ignoré
    character.value.armorId = 'demi-plaque' // defBonus 6, encombrant
    expect(computedDef.value).toBe(10 + 0 + 6)
  })

  it('ajoute le defenseBonus divers', () => {
    character.value.defenseBonus = 3
    expect(computedDef.value).toBe(10 + 0 + 3)
  })

  it('cumul complet : armure encombrante + bouclier + bonus divers', () => {
    character.value.abilities.dexterity = 18 // ignoré (encombrant)
    character.value.armorId = 'armure-plaques' // defBonus 7, encombrant
    character.value.shieldId = 'grand-bouclier' // defBonus 2
    character.value.defenseBonus = 1
    expect(computedDef.value).toBe(10 + 0 + 7 + 2 + 1)
  })
})

// ── computedInitiative ───────────────────────────────────────────────────────

describe('computedInitiative', () => {
  it('base = valeur DEX sans armure', () => {
    character.value.abilities.dexterity = 14
    expect(computedInitiative.value).toBe(14)
  })

  it('soustrait le bonus DEF armure', () => {
    character.value.abilities.dexterity = 14
    character.value.armorId = 'cuir' // defBonus 2
    expect(computedInitiative.value).toBe(14 - 2)
  })

  it('soustrait le bonus DEF du bouclier', () => {
    character.value.abilities.dexterity = 14
    character.value.shieldId = 'grand-bouclier' // defBonus 2
    expect(computedInitiative.value).toBe(14 - 2)
  })

  it('cumule pénalité armure + bouclier', () => {
    character.value.abilities.dexterity = 16
    character.value.armorId = 'cotte-mailles' // defBonus 5
    character.value.shieldId = 'grand-bouclier' // defBonus 2
    expect(computedInitiative.value).toBe(16 - 5 - 2)
  })

  it('ajoute le bonus initiative divers', () => {
    character.value.abilities.dexterity = 12
    character.value.initiativeBonus = 3
    expect(computedInitiative.value).toBe(12 + 3)
  })
})

// ── computedPcMax ────────────────────────────────────────────────────────────

describe('computedPcMax', () => {
  it('base = 2 + mod CHA pour aventuriers (+2 bonus)', () => {
    character.value.abilities.charisma = 10 // mod 0
    // aventuriers par défaut → +2
    expect(computedPcMax.value).toBe(2 + 0 + 2)
  })

  it('combattants : pas de bonus aventurier', () => {
    character.value.paths = [COMBATTANT_1, COMBATTANT_2]
    character.value.abilities.charisma = 10
    expect(computedPcMax.value).toBe(2 + 0)
  })

  it('mystiques : pas de bonus aventurier', () => {
    character.value.paths = [MYSTIQUE_1, MYSTIQUE_2]
    character.value.abilities.charisma = 10
    expect(computedPcMax.value).toBe(2 + 0)
  })

  it('mod CHA positif augmente les PC', () => {
    character.value.abilities.charisma = 16 // mod +3
    expect(computedPcMax.value).toBe(2 + 3 + 2) // aventuriers
  })

  it('mod CHA négatif réduit les PC', () => {
    character.value.paths = [COMBATTANT_1, COMBATTANT_2]
    character.value.abilities.charisma = 6 // mod -2
    expect(computedPcMax.value).toBe(2 - 2)
  })
})

// ── computedAttackContact ────────────────────────────────────────────────────

describe('computedAttackContact', () => {
  it('aventuriers : niveau + mod FOR + 1', () => {
    character.value.level = 3
    character.value.abilities.strength = 14 // mod +2
    expect(computedAttackContact.value).toBe(3 + 2 + 1)
  })

  it('combattants : bonus famille +2', () => {
    character.value.paths = [COMBATTANT_1, COMBATTANT_2]
    character.value.level = 1
    character.value.abilities.strength = 10
    expect(computedAttackContact.value).toBe(1 + 0 + 2)
  })

  it('mystiques : bonus famille 0', () => {
    character.value.paths = [MYSTIQUE_1, MYSTIQUE_2]
    character.value.level = 2
    character.value.abilities.strength = 10
    expect(computedAttackContact.value).toBe(2 + 0 + 0)
  })

  it('ajoute le attackContactBonus divers', () => {
    character.value.level = 1
    character.value.abilities.strength = 10
    character.value.attackContactBonus = 2
    expect(computedAttackContact.value).toBe(1 + 0 + 1 + 2) // aventuriers +1
  })
})

// ── computedAttackDistance ────────────────────────────────────────────────────

describe('computedAttackDistance', () => {
  it('aventuriers sans armure : niveau + mod DEX + 1', () => {
    character.value.level = 3
    character.value.abilities.dexterity = 14 // mod +2
    expect(computedAttackDistance.value).toBe(3 + 2 + 1)
  })

  it('pénalité = floor((armorDef + shieldDef) / 2)', () => {
    character.value.level = 3
    character.value.abilities.dexterity = 14 // mod +2
    character.value.armorId = 'cotte-mailles' // defBonus 5
    character.value.shieldId = 'petit-bouclier' // defBonus 1
    // penalty = floor((5 + 1) / 2) = 3
    expect(computedAttackDistance.value).toBe(3 + 2 + 1 - 3)
  })

  it('ajoute attackDistanceBonus divers', () => {
    character.value.level = 1
    character.value.abilities.dexterity = 10
    character.value.attackDistanceBonus = 2
    expect(computedAttackDistance.value).toBe(1 + 0 + 1 + 2)
  })
})

// ── computedAttackMagique ────────────────────────────────────────────────────

describe('computedAttackMagique', () => {
  it('mystiques : niveau + mod INT + 2', () => {
    character.value.paths = [MYSTIQUE_1, MYSTIQUE_2]
    character.value.level = 3
    character.value.abilities.intelligence = 16 // mod +3
    expect(computedAttackMagique.value).toBe(3 + 3 + 2)
  })

  it('aventuriers : bonus famille magique = 0', () => {
    character.value.level = 2
    character.value.abilities.intelligence = 14 // mod +2
    expect(computedAttackMagique.value).toBe(2 + 2 + 0)
  })

  it('pénalité totale = armorDef + shieldDef', () => {
    character.value.paths = [MYSTIQUE_1, MYSTIQUE_2]
    character.value.level = 3
    character.value.abilities.intelligence = 10
    character.value.armorId = 'cuir' // defBonus 2
    character.value.shieldId = 'petit-bouclier' // defBonus 1
    // penalty = 2 + 1 = 3
    expect(computedAttackMagique.value).toBe(3 + 0 + 2 - 3)
  })

  it('ajoute attackMagiqueBonus divers', () => {
    character.value.paths = [MYSTIQUE_1, MYSTIQUE_2]
    character.value.level = 1
    character.value.abilities.intelligence = 10
    character.value.attackMagiqueBonus = 3
    expect(computedAttackMagique.value).toBe(1 + 0 + 2 + 3)
  })
})
