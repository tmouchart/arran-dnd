import { describe, it, expect } from 'vitest'
import { isBow, isCriticalAttack, isRapier, weaponPassives } from './weaponPassives'
import { pathEffects } from '../composables/usePathEffects'
import type { CharacterAbilities, PathRow, WeaponRow } from '../types/character'

const path = (id: string, rank: number): PathRow => ({ id, name: id, rank })

const weapon = (over: Partial<WeaponRow>): WeaponRow => ({
  id: 'w',
  name: 'Arme',
  attackType: 'contact',
  damageDice: '1d6',
  damageAbility: null,
  martialFamily: 'guerre',
  rangeMeters: null,
  ...over,
})

const ABILITIES: CharacterAbilities = {
  strength: 10, dexterity: 19, constitution: 12, intelligence: 12, wisdom: 14, charisma: 15,
}

// Thrazik : archerie 4, maîtrise des armes 3
const THRAZIK = pathEffects([path('voie-de-larcherie', 4), path('voie-de-la-maitrise-des-armes', 3)])
const ARC = weapon({ name: 'Arc court', catalogId: 'arc-court', attackType: 'distance' })

describe('weaponPassives', () => {
  it('arc de prédilection : +1 attaque, +2 DM (Spécialisation) + Mod. SAG (Sens affûtés)', () => {
    expect(weaponPassives({ ...ARC, favorite: true }, THRAZIK, ABILITIES)).toEqual({
      attack: 1,
      damage: 2 + 2,
      critMin: 19,
    })
  })

  it('un arc qui n’est pas l’arme de prédilection garde Sens affûtés seulement', () => {
    expect(weaponPassives(ARC, THRAZIK, ABILITIES)).toEqual({ attack: 0, damage: 2, critMin: 19 })
  })

  it('rapière : critique dès 18 avec Science du critique', () => {
    const rapiere = weapon({ name: 'Rapière', catalogId: 'rapiere' })
    expect(weaponPassives(rapiere, THRAZIK, ABILITIES).critMin).toBe(18)
  })

  it('sans capacité : rien du tout, critique sur 20', () => {
    expect(weaponPassives({ ...ARC, favorite: true }, pathEffects([]), ABILITIES)).toEqual({
      attack: 0,
      damage: 0,
      critMin: 20,
    })
  })
})

describe('isBow / isRapier', () => {
  it('reconnaît les arcs du catalogue, pas les arbalètes', () => {
    expect(isBow(weapon({ catalogId: 'arc-long' }))).toBe(true)
    expect(isBow(weapon({ catalogId: 'arbalete-legere' }))).toBe(false)
  })

  it('reconnaît une arme maison par son nom', () => {
    expect(isBow(weapon({ name: 'Arc elfique' }))).toBe(true)
    expect(isBow(weapon({ name: 'Arbalète' }))).toBe(false)
    expect(isRapier(weapon({ name: 'Rapière de duel' }))).toBe(true)
  })
})

describe('isCriticalAttack', () => {
  it('19-20 au d20 avec un seuil à 19', () => {
    expect(isCriticalAttack(19, 20, 19)).toBe(true)
    expect(isCriticalAttack(18, 20, 19)).toBe(false)
  })

  it('affaibli au d12 : seul le 12 compte, même avec un seuil abaissé', () => {
    expect(isCriticalAttack(11, 12, 19)).toBe(false)
    expect(isCriticalAttack(12, 12, 19)).toBe(true)
  })
})
