import { describe, it, expect } from 'vitest'
import { pathEffects, unlockedCapacites } from './usePathEffects'
import type { PathRow } from '../types/character'

const path = (id: string, rank: number, name = id): PathRow => ({ id, name, rank })

describe('pathEffects — passifs de caractéristique', () => {
  it("élémentaliste rang 5 donne +2 INT et l'avantage en INT", () => {
    const e = pathEffects([path('voie-de-la-magie-elementaliste', 5)])
    expect(e.abilityBonus.intelligence).toBe(2)
    expect(e.advantage.has('intelligence')).toBe(true)
  })

  it('élémentaliste rang 4 ne donne rien', () => {
    const e = pathEffects([path('voie-de-la-magie-elementaliste', 4)])
    expect(e.abilityBonus).toEqual({})
    expect(e.advantage.size).toBe(0)
  })

  it('Hyperconscience monte SAG et INT, avec avantage sur les deux', () => {
    const e = pathEffects([path('voie-de-la-divination', 5)])
    expect(e.abilityBonus.wisdom).toBe(2)
    expect(e.abilityBonus.intelligence).toBe(2)
    expect(e.advantage.has('wisdom')).toBe(true)
    expect(e.advantage.has('intelligence')).toBe(true)
  })

  it('Sagesse héroïque et Perception héroïque cumulent à +4 SAG', () => {
    const e = pathEffects([
      path('voie-des-arts-druidiques', 5),
      path('voie-de-la-chasse', 5),
    ])
    expect(e.abilityBonus.wisdom).toBe(4)
    expect(e.advantage.has('wisdom')).toBe(true)
  })

  it('une capacité de peuple donne le bonus sans avantage', () => {
    const e = pathEffects([path('culture-orc', 5)])
    expect(e.abilityBonus.strength).toBe(2)
    expect(e.abilityBonus.constitution).toBe(2)
    expect(e.advantage.size).toBe(0)
  })

  it('sources nomme la capacité qui donne le bonus', () => {
    const e = pathEffects([path('voie-du-pugilat', 5)])
    expect(e.sources).toEqual([{ ability: 'strength', bonus: 2, from: 'Force héroïque' }])
  })

  it('une voie sans id ou au rang 0 est ignorée', () => {
    expect(pathEffects([{ name: 'Voie maison', rank: 5 }]).abilityBonus).toEqual({})
    expect(pathEffects([path('voie-du-pugilat', 0)]).abilityBonus).toEqual({})
  })
})

describe('unlockedCapacites', () => {
  it('ne remonte que les capacités de rang inférieur ou égal au rang de la voie', () => {
    const found = unlockedCapacites([path('voie-du-pugilat', 2)])
    expect(found).toHaveLength(2)
    expect(found.map((u) => u.rank)).toEqual([1, 2])
  })

  it('parcourt aussi les voies de peuple', () => {
    const found = unlockedCapacites([path('peuple-nain', 5)])
    expect(found.map((u) => u.capacite.name)).toContain('Ténacité naine')
  })

  it("Attaque parfaite est une action limitée porteuse de l'avantage", () => {
    const cap = unlockedCapacites([path('voie-de-la-maitrise-des-armes', 4)]).find(
      (u) => u.capacite.name === 'Attaque parfaite',
    )
    expect(cap?.capacite.active).toBe(true)
    expect(cap?.capacite.effects).toEqual([{ kind: 'attackAdvantage' }])
  })
})

describe('pathEffects — passifs de combat', () => {
  it('Robustesse : un effet PV par palier de la voie atteint', () => {
    expect(pathEffects([path('voie-de-la-bravoure', 2)]).hp).toHaveLength(1)
    expect(pathEffects([path('voie-de-la-bravoure', 4)]).hp).toHaveLength(2)
    expect(pathEffects([path('voie-de-la-bravoure', 5)]).hp).toHaveLength(3)
  })

  it('les bonus aux tests de peuple sont rangés par carac', () => {
    const e = pathEffects([path('peuple-nain', 2), path('culture-orc', 1)])
    expect(e.testBonus.constitution).toEqual([{ bonus: 5, from: 'Résistance' }])
    expect(e.testBonus.strength).toEqual([{ bonus: 5, from: 'Force de la nature' }])
  })

  it('Science du critique abaisse le seuil, plus bas encore à la rapière', () => {
    const e = pathEffects([path('voie-de-la-maitrise-des-armes', 2)])
    expect(e.critMin).toBe(19)
    expect(e.critMinRapiere).toBe(18)
    expect(pathEffects([]).critMin).toBe(20)
  })

  it('arme de prédilection : +1 attaque au rang 1, +2 DM au rang 3', () => {
    const r1 = pathEffects([path('voie-de-la-maitrise-des-armes', 1)])
    expect([r1.favoriteAttack, r1.favoriteDamage]).toEqual([1, 0])
    const r3 = pathEffects([path('voie-de-la-maitrise-des-armes', 3)])
    expect([r3.favoriteAttack, r3.favoriteDamage]).toEqual([1, 2])
  })

  it('Combat à deux armes parfait rend « Combat à deux armes » plus rapide', () => {
    expect(pathEffects([path('voie-du-combat-a-deux-armes', 4)]).fasterActions.size).toBe(0)
    expect(pathEffects([path('voie-du-combat-a-deux-armes', 5)]).fasterActions.has('Combat à deux armes')).toBe(true)
  })
})
