import { describe, it, expect } from 'vitest'
import { allowedModes, concentratedPmCost, upgradeDie, upgradeDiceInText } from './concentration'

describe('concentratedPmCost', () => {
  it('économe : −2 PM, minimum 0', () => {
    expect(concentratedPmCost(1, 'econome')).toBe(0)
    expect(concentratedPmCost(2, 'econome')).toBe(0)
    expect(concentratedPmCost(4, 'econome')).toBe(2)
  })

  it('les autres modes gardent le coût au rang', () => {
    expect(concentratedPmCost(4, 'aucune')).toBe(4)
    expect(concentratedPmCost(4, 'etendue')).toBe(4)
    expect(concentratedPmCost(4, 'puissante')).toBe(4)
  })
})

describe('upgradeDie', () => {
  it('monte d’une catégorie', () => {
    expect(upgradeDie(4)).toBe(6)
    expect(upgradeDie(6)).toBe(8)
    expect(upgradeDie(8)).toBe(10)
    expect(upgradeDie(10)).toBe(12)
  })

  it('le d12 plafonne, le d20 ne bouge pas', () => {
    expect(upgradeDie(12)).toBe(12)
    expect(upgradeDie(20)).toBe(20)
  })
})

describe('upgradeDiceInText', () => {
  it('monte les dés dans une description', () => {
    expect(upgradeDiceInText('[2d6+Mod.INT] DM')).toBe('[2d8+Mod.INT] DM')
    expect(upgradeDiceInText('1d6 DM/rang')).toBe('1d8 DM/rang')
    expect(upgradeDiceInText('4d6')).toBe('4d8')
  })

  it('ne touche ni au d12 ni au d20', () => {
    expect(upgradeDiceInText('1d12')).toBe('1d12')
    expect(upgradeDiceInText('Lance 2d20 et garde le meilleur')).toBe('Lance 2d20 et garde le meilleur')
  })

  it('ne confond pas d10 et d100', () => {
    expect(upgradeDiceInText('1d100')).toBe('1d100')
  })
})

describe('allowedModes', () => {
  it('un sort de voie mystique a les 3 modes', () => {
    expect(allowedModes({ name: 'Boule de feu', pmCost: 4, voieFamily: 'mystiques' })).toEqual([
      'econome',
      'etendue',
      'puissante',
    ])
  })

  it('un talent magique ou une capacité sans PM n’a rien', () => {
    expect(allowedModes({ name: 'Flamme', pmCost: null, voieFamily: 'mystiques' })).toEqual([])
    expect(allowedModes({ name: 'Frappe massive', pmCost: null, voieFamily: 'prestige' })).toEqual([])
  })

  it('Sous tension refuse toute concentration', () => {
    expect(allowedModes({ name: 'Sous tension', pmCost: 2, voieFamily: 'mystiques' })).toEqual([])
  })

  it('un sort de prestige n’a pas droit à économe', () => {
    expect(allowedModes({ name: 'Sort', pmCost: 3, voieFamily: 'prestige' })).toEqual(['etendue', 'puissante'])
  })
})
