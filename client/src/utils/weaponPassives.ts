import type { PathEffects } from '../composables/usePathEffects'
import type { CharacterAbilities, WeaponRow } from '../types/character'
import { abilityModifier } from './attackBonus'

export function isBow(w: WeaponRow): boolean {
  return w.catalogId ? w.catalogId.startsWith('arc-') : /^arc\b/i.test(w.name.trim())
}

export function isRapier(w: WeaponRow): boolean {
  return w.catalogId ? w.catalogId === 'rapiere' : /rapi[eè]re/i.test(w.name)
}

export interface WeaponPassives {
  /** Bonus d'attaque des passifs (arme de prédilection). */
  attack: number
  /** Bonus de DM des passifs (Spécialisation, Sens affûtés). */
  damage: number
  /** Plus petit résultat du d20 qui fait un critique avec cette arme. */
  critMin: number
}

/**
 * Ce que les passifs des voies ajoutent à une arme précise.
 * `abilities` : les caracs finales (passifs compris).
 */
export function weaponPassives(
  w: WeaponRow,
  effects: PathEffects,
  abilities: CharacterAbilities,
): WeaponPassives {
  let damage = w.favorite ? effects.favoriteDamage : 0
  if (isBow(w)) {
    for (const key of effects.bowDamage) damage += abilityModifier(abilities[key])
  }
  return {
    attack: w.favorite ? effects.favoriteAttack : 0,
    damage,
    critMin: isRapier(w) ? effects.critMinRapiere : effects.critMin,
  }
}

/**
 * Le dé d'attaque fait-il un critique ? Le seuil abaissé (19-20) ne vaut que
 * pour le d20 : affaibli au d12, seul le 12 compte.
 */
export function isCriticalAttack(die: number, sides: number, critMin: number): boolean {
  if (sides !== 20) return die === sides
  return die >= critMin
}
