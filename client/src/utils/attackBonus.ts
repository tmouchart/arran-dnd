import type { VoieFamily } from '../data/voies'
import type { Character, CharacterAbilities, WeaponRow } from '../types/character'

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/**
 * Attack roll bonus (before incompetence malus): level + ability + profile family bonus.
 * Same rules as ActionsView base attacks.
 */
export function attackRollBonus(
  attackType: 'contact' | 'distance' | 'magique',
  level: number,
  abilities: CharacterAbilities,
  profileFamily: VoieFamily,
): number {
  const meleeFam = profileFamily === 'combattants' ? 2 : profileFamily === 'aventuriers' ? 1 : 0
  const magicFam = profileFamily === 'mystiques' ? 2 : 0
  if (attackType === 'contact') return level + abilityModifier(abilities.strength) + meleeFam
  if (attackType === 'distance') return level + abilityModifier(abilities.dexterity) + meleeFam
  if (attackType === 'magique') return level + abilityModifier(abilities.intelligence) + magicFam
  return 0
}

export function isMartialWeaponProficient(weapon: WeaponRow, martialFormations: string[]): boolean {
  if (weapon.martialFamily === 'paysan') return true
  return martialFormations.includes(weapon.martialFamily)
}

/** Total attack bonus including −3 when the weapon category is not trained. */
export function weaponAttackBonusWithProficiency(
  weapon: WeaponRow,
  character: Character,
  profileFamily: VoieFamily,
): number {
  const atk = weapon.attackType === 'contact' ? 'contact' : 'distance'
  const base = attackRollBonus(atk, character.level, character.abilities, profileFamily)
  if (isMartialWeaponProficient(weapon, character.martialFormations)) return base
  return base - 3
}

/** Display string for damage dice + ability mod (equipment Mod. column). */
export function formatWeaponDamage(
  damageDice: string,
  damageAbility: 'strength' | 'dexterity' | null,
  abilities: CharacterAbilities,
): string {
  const dice = damageDice.trim()
  if (damageAbility === null) return dice
  const m = abilityModifier(abilities[damageAbility])
  const sign = m >= 0 ? '+' : ''
  return `${dice} ${sign}${m}`
}
