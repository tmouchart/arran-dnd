import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { Character, WeaponRow } from '../types/character'
import { isMartialWeaponProficient } from '../utils/attackBonus'
import { rollDie, rollDiceNotation } from '../utils/dice'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SingleHandRoll {
  weaponName: string
  attackDie: number
  attackBonus: number
  attackTotal: number
  damageDice: string
  damageRolls: number[]
  damageModifier: number
  damageTotal: number
  luckUsed: boolean
}

export interface OffHandRoll {
  weaponName: string
  attackDie: number // d12
  attackBonus: number
  attackTotal: number
  damageDice: string
  damageRolls: number[]
  damageModifier: number
  damageTotal: number
}

export interface DualWieldRoll {
  mainHand: SingleHandRoll
  offHand: OffHandRoll
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function isDaggerWeapon(w: WeaponRow): boolean {
  return w.id === 'dague' || (w.notes?.toLowerCase().includes('dague') ?? false)
}

// ── Composable ─────────────────────────────────────────────────────────────────

export function useDualWield(
  character: Ref<Character>,
  attackContact: ComputedRef<number>,
  attackDistance: ComputedRef<number>,
  abilityModifier: (score: number) => number,
) {
  const dualWieldRoll = ref<DualWieldRoll | null>(null)
  const dualWieldError = ref(false)

  const hasFinesseVoie = computed(() =>
    character.value.paths.some(p => p.id === 'voie-de-lescrime' && p.rank >= 1),
  )

  const hasDualWieldVoie = computed(() =>
    character.value.paths.some(p => p.id === 'voie-du-combat-a-deux-armes' && p.rank >= 1),
  )

  const contactWeapons = computed(() =>
    character.value.weapons.filter(w => w.attackType === 'contact'),
  )

  function isFinesseWeapon(w: WeaponRow): boolean {
    return (
      hasFinesseVoie.value &&
      w.attackType === 'contact' &&
      (w.martialFamily === 'duel' || isDaggerWeapon(w))
    )
  }

  /** Effective attack bonus for a weapon, taking finesse into account. */
  function weaponAttackBonus(w: WeaponRow): number {
    if (w.attackType === 'contact') {
      return isFinesseWeapon(w)
        ? Math.max(attackContact.value, attackDistance.value)
        : attackContact.value
    }
    return attackDistance.value
  }

  function setHandRole(weapon: WeaponRow, role: 'main' | 'offhand' | null) {
    if (role !== null) {
      character.value.weapons.forEach(w => {
        if (w.attackType === 'contact' && w.id !== weapon.id && w.handRole === role) {
          w.handRole = undefined
        }
      })
    }
    weapon.handRole = role ?? undefined
  }

  function rollDualWieldAction(): DualWieldRoll | null {
    const mainWeapon = contactWeapons.value.find(w => w.handRole === 'main')
    const offWeapon = contactWeapons.value.find(w => w.handRole === 'offhand')

    if (!mainWeapon || !offWeapon) {
      dualWieldError.value = true
      return null
    }
    dualWieldError.value = false

    const c = character.value

    // Main directrice — d20
    const mainBonus =
      attackContact.value +
      (!isMartialWeaponProficient(mainWeapon, c.martialFormations) ? -3 : 0)
    const mainDie = rollDie(20)
    const mainDamAbility = mainWeapon.damageAbility
      ? abilityModifier(c.abilities[mainWeapon.damageAbility])
      : 0
    const mainDmg = rollDiceNotation(mainWeapon.damageDice, mainDamAbility)

    // Main faible — d12
    const offBonus =
      attackContact.value +
      (!isMartialWeaponProficient(offWeapon, c.martialFormations) ? -3 : 0)
    const offDie = rollDie(12)
    const offDamAbility = offWeapon.damageAbility
      ? abilityModifier(c.abilities[offWeapon.damageAbility])
      : 0
    const offDmg = rollDiceNotation(offWeapon.damageDice, offDamAbility)

    const result: DualWieldRoll = {
      mainHand: {
        weaponName: mainWeapon.name || 'Arme',
        attackDie: mainDie,
        attackBonus: mainBonus,
        attackTotal: mainDie + mainBonus,
        damageDice: mainWeapon.damageDice,
        damageRolls: mainDmg.rolls,
        damageModifier: mainDamAbility,
        damageTotal: mainDmg.total,
        luckUsed: false,
      },
      offHand: {
        weaponName: offWeapon.name || 'Arme',
        attackDie: offDie,
        attackBonus: offBonus,
        attackTotal: offDie + offBonus,
        damageDice: offWeapon.damageDice,
        damageRolls: offDmg.rolls,
        damageModifier: offDamAbility,
        damageTotal: offDmg.total,
      },
    }

    dualWieldRoll.value = result
    return result
  }

  return {
    dualWieldRoll,
    dualWieldError,
    hasFinesseVoie,
    hasDualWieldVoie,
    contactWeapons,
    isFinesseWeapon,
    weaponAttackBonus,
    setHandRole,
    rollDualWieldAction,
  }
}
