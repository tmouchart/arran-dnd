import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import type { Character, WeaponRow } from '../types/character'
import { isDaggerWeapon, useDualWield } from './useDualWield'
import { createDefaultCharacter } from './useCharacter'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWeapon(overrides: Partial<WeaponRow> = {}): WeaponRow {
  return {
    id: 'epee-longue',
    name: 'Épée longue',
    attackType: 'contact',
    damageDice: '1d8',
    damageAbility: 'strength',
    martialFamily: 'duel',
    rangeMeters: null,
    ...overrides,
  }
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

// ── isDaggerWeapon ───────────────────────────────────────────────────────────

describe('isDaggerWeapon', () => {
  it('returns true for id "dague"', () => {
    expect(isDaggerWeapon(makeWeapon({ id: 'dague' }))).toBe(true)
  })

  it('returns true when notes mention "dague"', () => {
    expect(isDaggerWeapon(makeWeapon({ id: 'custom', notes: 'Dague empoisonnée' }))).toBe(true)
  })

  it('returns false for a normal weapon', () => {
    expect(isDaggerWeapon(makeWeapon({ id: 'epee', notes: undefined }))).toBe(false)
  })

  it('returns false when notes do not mention dague', () => {
    expect(isDaggerWeapon(makeWeapon({ id: 'hache', notes: 'Hache de guerre' }))).toBe(false)
  })
})

// ── useDualWield composable ──────────────────────────────────────────────────

describe('useDualWield', () => {
  let character: ReturnType<typeof ref<Character>>
  let attackContact: ReturnType<typeof computed<number>>
  let attackDistance: ReturnType<typeof computed<number>>

  beforeEach(() => {
    character = ref<Character>({
      ...createDefaultCharacter(),
      abilities: { strength: 14, dexterity: 16, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      martialFormations: ['duel'],
      weapons: [],
      paths: [],
    })
    attackContact = computed(() => 5) // fixed for tests
    attackDistance = computed(() => 7) // fixed for tests
  })

  function setup() {
    return useDualWield(character, attackContact, attackDistance, abilityModifier)
  }

  // ── hasFinesseVoie / hasDualWieldVoie ──────────────────────────────────────

  describe('hasFinesseVoie', () => {
    it('false when no escrime path', () => {
      const { hasFinesseVoie } = setup()
      expect(hasFinesseVoie.value).toBe(false)
    })

    it('true when voie-de-lescrime rank >= 1', () => {
      character.value.paths = [{ id: 'voie-de-lescrime', name: "Voie de l'escrime", rank: 1 }]
      const { hasFinesseVoie } = setup()
      expect(hasFinesseVoie.value).toBe(true)
    })

    it('false when rank 0', () => {
      character.value.paths = [{ id: 'voie-de-lescrime', name: "Voie de l'escrime", rank: 0 }]
      const { hasFinesseVoie } = setup()
      expect(hasFinesseVoie.value).toBe(false)
    })
  })

  describe('hasDualWieldVoie', () => {
    it('false by default', () => {
      const { hasDualWieldVoie } = setup()
      expect(hasDualWieldVoie.value).toBe(false)
    })

    it('true when voie-du-combat-a-deux-armes rank >= 1', () => {
      character.value.paths = [{ id: 'voie-du-combat-a-deux-armes', name: 'Voie du combat à deux armes', rank: 1 }]
      const { hasDualWieldVoie } = setup()
      expect(hasDualWieldVoie.value).toBe(true)
    })
  })

  // ── contactWeapons ─────────────────────────────────────────────────────────

  describe('contactWeapons', () => {
    it('filters only contact weapons', () => {
      character.value.weapons = [
        makeWeapon({ id: 'sword', attackType: 'contact' }),
        makeWeapon({ id: 'bow', attackType: 'distance' }),
        makeWeapon({ id: 'axe', attackType: 'contact' }),
      ]
      const { contactWeapons } = setup()
      expect(contactWeapons.value).toHaveLength(2)
      expect(contactWeapons.value.map(w => w.id)).toEqual(['sword', 'axe'])
    })
  })

  // ── isFinesseWeapon ────────────────────────────────────────────────────────

  describe('isFinesseWeapon', () => {
    it('returns false without finesse voie', () => {
      const { isFinesseWeapon } = setup()
      expect(isFinesseWeapon(makeWeapon({ martialFamily: 'duel' }))).toBe(false)
    })

    it('returns true for duel weapon with finesse voie', () => {
      character.value.paths = [{ id: 'voie-de-lescrime', name: "Voie de l'escrime", rank: 1 }]
      const { isFinesseWeapon } = setup()
      expect(isFinesseWeapon(makeWeapon({ martialFamily: 'duel', attackType: 'contact' }))).toBe(true)
    })

    it('returns true for dagger with finesse voie', () => {
      character.value.paths = [{ id: 'voie-de-lescrime', name: "Voie de l'escrime", rank: 1 }]
      const { isFinesseWeapon } = setup()
      expect(isFinesseWeapon(makeWeapon({ id: 'dague', attackType: 'contact', martialFamily: 'paysan' }))).toBe(true)
    })

    it('returns false for distance weapon even with finesse', () => {
      character.value.paths = [{ id: 'voie-de-lescrime', name: "Voie de l'escrime", rank: 1 }]
      const { isFinesseWeapon } = setup()
      expect(isFinesseWeapon(makeWeapon({ attackType: 'distance', martialFamily: 'duel' }))).toBe(false)
    })
  })

  // ── weaponAttackBonus ──────────────────────────────────────────────────────

  describe('weaponAttackBonus', () => {
    it('contact weapon uses attackContact', () => {
      const { weaponAttackBonus } = setup()
      expect(weaponAttackBonus(makeWeapon({ attackType: 'contact' }))).toBe(5)
    })

    it('distance weapon uses attackDistance', () => {
      const { weaponAttackBonus } = setup()
      expect(weaponAttackBonus(makeWeapon({ attackType: 'distance' }))).toBe(7)
    })

    it('finesse weapon uses max(contact, distance)', () => {
      character.value.paths = [{ id: 'voie-de-lescrime', name: "Voie de l'escrime", rank: 1 }]
      const { weaponAttackBonus } = setup()
      // attackContact = 5, attackDistance = 7 → max = 7
      expect(weaponAttackBonus(makeWeapon({ attackType: 'contact', martialFamily: 'duel' }))).toBe(7)
    })
  })

  // ── setHandRole ────────────────────────────────────────────────────────────

  describe('setHandRole', () => {
    it('assigns hand role to weapon', () => {
      const w = makeWeapon({ id: 'sword' })
      character.value.weapons = [w]
      const { setHandRole } = setup()
      setHandRole(w, 'main')
      expect(w.handRole).toBe('main')
    })

    it('clears conflicting role on other contact weapons', () => {
      const w1 = makeWeapon({ id: 'sword1', attackType: 'contact', handRole: 'main' })
      const w2 = makeWeapon({ id: 'sword2', attackType: 'contact' })
      character.value.weapons = [w1, w2]
      const { setHandRole } = setup()
      setHandRole(w2, 'main') // should clear w1.handRole
      expect(w1.handRole).toBeUndefined()
      expect(w2.handRole).toBe('main')
    })

    it('setting null clears hand role', () => {
      const w = makeWeapon({ id: 'sword', handRole: 'main' })
      character.value.weapons = [w]
      const { setHandRole } = setup()
      setHandRole(w, null)
      expect(w.handRole).toBeUndefined()
    })
  })

  // ── rollDualWieldAction ────────────────────────────────────────────────────

  describe('rollDualWieldAction', () => {
    it('returns null and sets error if no main/offhand assigned', () => {
      character.value.weapons = [makeWeapon({ id: 'sword', attackType: 'contact' })]
      const { rollDualWieldAction, dualWieldError } = setup()
      const result = rollDualWieldAction()
      expect(result).toBeNull()
      expect(dualWieldError.value).toBe(true)
    })

    it('rolls both hands when weapons are assigned', () => {
      const main = makeWeapon({ id: 'sword', name: 'Épée', attackType: 'contact', handRole: 'main', damageDice: '1d8', damageAbility: 'strength' })
      const off = makeWeapon({ id: 'dague', name: 'Dague', attackType: 'contact', handRole: 'offhand', damageDice: '1d4', damageAbility: 'strength' })
      character.value.weapons = [main, off]
      character.value.martialFormations = ['duel', 'paysan']

      // Deterministic rolls
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { rollDualWieldAction, dualWieldError, dualWieldRoll } = setup()
      const result = rollDualWieldAction()

      expect(dualWieldError.value).toBe(false)
      expect(result).not.toBeNull()
      expect(result!.mainHand.weaponName).toBe('Épée')
      expect(result!.offHand.weaponName).toBe('Dague')
      // Main hand die: d20 → floor(0.5*20)+1 = 11
      expect(result!.mainHand.attackDie).toBe(11)
      // Off hand die: d12 → floor(0.5*12)+1 = 7
      expect(result!.offHand.attackDie).toBe(7)
      // dualWieldRoll ref is updated
      expect(dualWieldRoll.value).toStrictEqual(result)

      spy.mockRestore()
    })

    it('applies -3 penalty for untrained weapons', () => {
      const main = makeWeapon({ id: 'hache', name: 'Hache', attackType: 'contact', handRole: 'main', martialFamily: 'masse' })
      const off = makeWeapon({ id: 'dague', name: 'Dague', attackType: 'contact', handRole: 'offhand', martialFamily: 'paysan' })
      character.value.weapons = [main, off]
      character.value.martialFormations = [] // no formations → -3 on hache (masse), paysan always proficient

      const spy = vi.spyOn(Math, 'random').mockReturnValue(0)
      const { rollDualWieldAction } = setup()
      const result = rollDualWieldAction()

      // attackContact = 5, untrained main → 5 - 3 = 2
      expect(result!.mainHand.attackBonus).toBe(5 - 3)
      // paysan always proficient → 5
      expect(result!.offHand.attackBonus).toBe(5)

      spy.mockRestore()
    })
  })
})
