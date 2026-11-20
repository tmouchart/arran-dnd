import { describe, it, expect } from 'vitest'
import { computeDef, computeInitiative, computeRd, pathStatBonus } from './characterStats'
import { createDefaultCharacter } from '../composables/useCharacter'
import type { Character, PathRow } from '../types/character'

const path = (id: string, rank: number, kind?: PathRow['kind']): PathRow => ({ id, name: id, rank, kind })

function makeCharacter(over: Partial<Character>): Character {
  return { ...createDefaultCharacter(), ...over }
}

describe('pathStatBonus — passifs de DEF, d’initiative et de PV', () => {
  it('Drah’Zul : Armure naturelle et Sixième sens en DEF, Robustesse et Force de la nature en PV', () => {
    const c = makeCharacter({
      abilities: { strength: 15, dexterity: 13, constitution: 16, intelligence: 14, wisdom: 15, charisma: 1 },
      paths: [
        path('culture-orc', 1, 'culturelle'),
        path('voie-de-la-bravoure', 2),
        path('voie-de-la-divination', 1),
      ],
    })
    expect(pathStatBonus(c, 'def').total).toBe(4)
    expect(pathStatBonus(c, 'init').total).toBe(2)
    // Robustesse +3, Force de la nature : Mod. FOR (15 → +2)
    expect(pathStatBonus(c, 'hp').total).toBe(5)
  })

  it('Grâce féline lit le CHA final, Charisme héroïque compris (17 + 2 = 19 → +4)', () => {
    const c = makeCharacter({
      abilities: { strength: 10, dexterity: 16, constitution: 13, intelligence: 7, wisdom: 12, charisma: 17 },
      paths: [path('voie-de-lacrobatie', 2), path('voie-du-charme', 5)],
    })
    expect(pathStatBonus(c, 'def')).toEqual({ total: 4, sources: [{ bonus: 4, from: 'Grâce féline' }] })
    expect(pathStatBonus(c, 'init').total).toBe(4)
  })

  it('Peau de pierre donne le Mod. de CON en DEF', () => {
    const c = makeCharacter({
      abilities: { strength: 11, dexterity: 13, constitution: 15, intelligence: 11, wisdom: 9, charisma: 16 },
      paths: [path('voie-du-pugilat', 2)],
    })
    expect(pathStatBonus(c, 'def').total).toBe(2)
  })

  it('le bonus entre dans la DEF et l’initiative calculées', () => {
    const base = makeCharacter({ paths: [] })
    const avec = makeCharacter({ paths: [path('voie-de-la-divination', 1)] })
    expect(computeDef(avec) - computeDef(base)).toBe(2)
    expect(computeInitiative(avec) - computeInitiative(base)).toBe(2)
  })

  it('Indéracinable (prestige) : +1 DEF, +2 au rang 3', () => {
    expect(pathStatBonus(makeCharacter({ paths: [path('voie-du-dogme-de-pierre', 2)] }), 'def').total).toBe(1)
    expect(pathStatBonus(makeCharacter({ paths: [path('voie-du-dogme-de-pierre', 3)] }), 'def').total).toBe(2)
  })
})

describe('computeRd', () => {
  it('Grimm : Solide comme un roc (1) + Peau d’acier (2) = RD 3', () => {
    const c = makeCharacter({ paths: [path('peuple-nain', 2, 'peuple'), path('voie-du-pugilat', 5)] })
    expect(computeRd(c)).toEqual({
      total: 3,
      sources: [
        { bonus: 1, from: 'Solide comme un roc' },
        { bonus: 2, from: 'Peau d\'acier' },
      ],
    })
  })

  it('pas de RD sans capacité', () => {
    expect(computeRd(makeCharacter({ paths: [] })).total).toBe(0)
  })
})
