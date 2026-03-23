import { describe, it, expect } from 'vitest'
import {
  abilityModifier,
  attackRollBonus,
  isMartialWeaponProficient,
  weaponAttackBonusWithProficiency,
  formatWeaponDamage,
} from './attackBonus'
import type { WeaponRow, Character, CharacterAbilities } from '../types/character'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAbilities(overrides: Partial<CharacterAbilities> = {}): CharacterAbilities {
  return {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    ...overrides,
  }
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: '1',
    name: 'Test',
    profile: '',
    histoire: '',
    people: '',
    level: 1,
    abilities: makeAbilities(),
    hpCurrent: 10,
    hpMax: 10,
    mpCurrent: 0,
    mpMax: 0,
    defense: 10,
    initiativeBonus: 10,
    skills: [],
    weapons: [],
    martialFormations: [],
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
    ...overrides,
  }
}

function makeWeapon(overrides: Partial<WeaponRow> = {}): WeaponRow {
  return {
    id: 'w1',
    name: 'Épée',
    attackType: 'contact',
    damageDice: '1d8',
    damageAbility: 'strength',
    martialFamily: 'epee',
    rangeMeters: null,
    ...overrides,
  }
}

// ── abilityModifier ───────────────────────────────────────────────────────────

describe('abilityModifier', () => {
  it('10 → 0 (score neutre)', () => expect(abilityModifier(10)).toBe(0))
  it('11 → 0 (arrondi vers le bas)', () => expect(abilityModifier(11)).toBe(0))
  it('12 → +1', () => expect(abilityModifier(12)).toBe(1))
  it('8  → -1', () => expect(abilityModifier(8)).toBe(-1))
  it('9  → -1 (arrondi vers le bas des négatifs)', () => expect(abilityModifier(9)).toBe(-1))
  it('20 → +5 (score max standard)', () => expect(abilityModifier(20)).toBe(5))
  it('1  → -5 (score min)', () => expect(abilityModifier(1)).toBe(-5))
})

// ── attackRollBonus ───────────────────────────────────────────────────────────

describe('attackRollBonus', () => {
  it('contact, combattants : niv + mod FOR + 2', () => {
    const abilities = makeAbilities({ strength: 14 }) // mod +2
    expect(attackRollBonus('contact', 3, abilities, 'combattants')).toBe(3 + 2 + 2)
  })

  it('contact, aventuriers : niv + mod FOR + 1', () => {
    const abilities = makeAbilities({ strength: 14 })
    expect(attackRollBonus('contact', 2, abilities, 'aventuriers')).toBe(2 + 2 + 1)
  })

  it('contact, mystiques : niv + mod FOR + 0', () => {
    const abilities = makeAbilities({ strength: 10 })
    expect(attackRollBonus('contact', 1, abilities, 'mystiques')).toBe(1 + 0 + 0)
  })

  it('distance, combattants : niv + mod DEX + 2', () => {
    const abilities = makeAbilities({ dexterity: 16 }) // mod +3
    expect(attackRollBonus('distance', 2, abilities, 'combattants')).toBe(2 + 3 + 2)
  })

  it('magique, mystiques : niv + mod INT + 2', () => {
    const abilities = makeAbilities({ intelligence: 16 }) // mod +3
    expect(attackRollBonus('magique', 1, abilities, 'mystiques')).toBe(1 + 3 + 2)
  })

  it('magique, combattants : pas de bonus magique', () => {
    const abilities = makeAbilities({ intelligence: 10 })
    expect(attackRollBonus('magique', 2, abilities, 'combattants')).toBe(2 + 0 + 0)
  })

  it('prestige → pas de bonus de famille (meleeFam = 0)', () => {
    const abilities = makeAbilities({ strength: 10 })
    expect(attackRollBonus('contact', 1, abilities, 'prestige')).toBe(1 + 0 + 0)
  })
})

// ── isMartialWeaponProficient ─────────────────────────────────────────────────

describe('isMartialWeaponProficient', () => {
  it('arme de type "paysan" → toujours compétent', () => {
    const weapon = makeWeapon({ martialFamily: 'paysan' })
    expect(isMartialWeaponProficient(weapon, [])).toBe(true)
  })

  it('formation correspondante → compétent', () => {
    const weapon = makeWeapon({ martialFamily: 'epee' })
    expect(isMartialWeaponProficient(weapon, ['epee', 'arc'])).toBe(true)
  })

  it('formation absente → non compétent', () => {
    const weapon = makeWeapon({ martialFamily: 'epee' })
    expect(isMartialWeaponProficient(weapon, ['arc'])).toBe(false)
  })

  it('aucune formation → non compétent', () => {
    const weapon = makeWeapon({ martialFamily: 'hache' })
    expect(isMartialWeaponProficient(weapon, [])).toBe(false)
  })
})

// ── weaponAttackBonusWithProficiency ──────────────────────────────────────────

describe('weaponAttackBonusWithProficiency', () => {
  it('compétent → bonus sans malus', () => {
    const character = makeCharacter({ level: 2, abilities: makeAbilities({ strength: 12 }), martialFormations: ['epee'] })
    const weapon = makeWeapon({ martialFamily: 'epee', attackType: 'contact' })
    // niveau 2 + mod FOR +1 + aventuriers +1 = 4 (pas de malus)
    expect(weaponAttackBonusWithProficiency(weapon, character, 'aventuriers')).toBe(4)
  })

  it('non compétent → bonus - 3', () => {
    const character = makeCharacter({ level: 2, abilities: makeAbilities({ strength: 12 }), martialFormations: [] })
    const weapon = makeWeapon({ martialFamily: 'hache', attackType: 'contact' })
    expect(weaponAttackBonusWithProficiency(weapon, character, 'aventuriers')).toBe(4 - 3)
  })

  it('arme paysan → toujours compétent (jamais de malus)', () => {
    const character = makeCharacter({ level: 1, abilities: makeAbilities(), martialFormations: [] })
    const weapon = makeWeapon({ martialFamily: 'paysan', attackType: 'contact' })
    expect(weaponAttackBonusWithProficiency(weapon, character, 'aventuriers')).toBe(1 + 0 + 1)
  })
})

// ── formatWeaponDamage ────────────────────────────────────────────────────────

describe('formatWeaponDamage', () => {
  it('ability null → dés seuls', () => {
    expect(formatWeaponDamage('1d6', null, makeAbilities())).toBe('1d6')
  })

  it('mod positif → "1d6 +2"', () => {
    expect(formatWeaponDamage('1d6', 'strength', makeAbilities({ strength: 14 }))).toBe('1d6 +2')
  })

  it('mod nul → "1d8 +0"', () => {
    expect(formatWeaponDamage('1d8', 'strength', makeAbilities({ strength: 10 }))).toBe('1d8 +0')
  })

  it('mod négatif → "1d4 -1"', () => {
    expect(formatWeaponDamage('1d4', 'dexterity', makeAbilities({ dexterity: 8 }))).toBe('1d4 -1')
  })

  it('espaces autour des dés sont supprimés', () => {
    expect(formatWeaponDamage('  2d6  ', null, makeAbilities())).toBe('2d6')
  })
})
