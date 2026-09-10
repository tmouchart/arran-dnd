import type { Character, CharacterAbilities } from '../types/character'
import type { VoieFamily } from '../data/voies'
import { ARMORS_BY_ID, SHIELDS_BY_ID } from '../data/armorsCatalog'
import { inferProfileFamily } from './inferProfileFamily'
import { abilityModifier } from './attackBonus'
import { pathEffects } from '../composables/usePathEffects'

/** Maximum die face per family (level 1 = max; subsequent levels = roll). */
export const FAMILY_DIE_MAX: Record<VoieFamily, number> = {
  combattants: 10,
  aventuriers: 8,
  mystiques: 6,
  prestige: 8,
}

/**
 * Point d'entrée UNIQUE pour lire les caractéristiques dans une formule dérivée :
 * scores de base + bonus passifs des voies débloquées.
 *
 * `c.abilities` reste le score de base — c'est lui qui est édité et persisté.
 * Le bonus n'est jamais écrit, sinon il serait recompté à chaque chargement.
 */
export function effectiveAbilities(c: Character): CharacterAbilities {
  const bonus = pathEffects(c.paths).abilityBonus
  const out = { ...c.abilities }
  for (const key of Object.keys(out) as (keyof CharacterAbilities)[]) {
    out[key] += bonus[key] ?? 0
  }
  return out
}

// Bonus d'attaque par famille
function familyAttackBonus(family: VoieFamily): { contact: number; distance: number; magique: number } {
  if (family === 'combattants') return { contact: 2, distance: 2, magique: 0 }
  if (family === 'aventuriers') return { contact: 1, distance: 1, magique: 0 }
  if (family === 'mystiques') return { contact: 0, distance: 0, magique: 2 }
  return { contact: 1, distance: 1, magique: 0 } // prestige → aventuriers par défaut
}

/** DEF = 10 + mod DEX (si armure non encombrante) + bonus armure + bonus bouclier + bonus divers */
export function computeDef(c: Character): number {
  const dexMod = abilityModifier(effectiveAbilities(c).dexterity)
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  const dexContrib = armor?.encombrant ? 0 : dexMod
  return 10 + dexContrib + (armor?.defBonus ?? 0) + (shield?.defBonus ?? 0) + c.defenseBonus
}

/**
 * PM = (Niveau + mod SAG) × multiplicateur de famille
 * - Combattants / Aventuriers / Prestige : ×1
 * - Mystiques : ×2
 */
export function computeMp(c: Character): number {
  const wisMod = abilityModifier(effectiveAbilities(c).wisdom)
  const base = c.level + wisMod
  return inferProfileFamily(c.paths) === 'mystiques' ? 2 * base : base
}

/** Valeur du dé de vie (nombre max, ex: 10 pour combattants). */
export function computeHpDv(c: Character): number {
  return FAMILY_DIE_MAX[inferProfileFamily(c.paths)]
}

/** Mod CON appliqué aux PV. */
export function computeHpConMod(c: Character): number {
  return abilityModifier(effectiveAbilities(c).constitution)
}

/** PV de base (niveau 1) = dé max de la famille + mod CON */
export function computeHpBase(c: Character): number {
  return computeHpDv(c) + computeHpConMod(c)
}

/** Croissance PV (niveaux 2+) = somme des jets + mod CON par niveau */
export function computeHpGrowth(c: Character): number {
  const conMod = computeHpConMod(c)
  return c.hpLevelGains.reduce((sum, roll) => sum + roll + conMod, 0)
}

/** PV max = base niv.1 + croissance niv.2..N + bonus divers */
export function computeHp(c: Character): number {
  return Math.max(1, computeHpBase(c) + computeHpGrowth(c) + (Number(c.hpBonus) || 0))
}

/** Dé de vie de la famille (label affiché). */
export function computeDv(c: Character): string {
  const faces: Record<VoieFamily, string> = {
    combattants: 'd10',
    aventuriers: 'd8',
    mystiques: 'd6',
    prestige: 'd8',
  }
  return faces[inferProfileFamily(c.paths)]
}

/** Initiative = valeur DEX - bonus DEF armure - bonus DEF bouclier (règles Terres d'Arran). */
export function computeInitiative(c: Character): number {
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  return (
    effectiveAbilities(c).dexterity -
    (armor?.defBonus ?? 0) -
    (shield?.defBonus ?? 0) +
    (c.initiativeBonus ?? 0)
  )
}

/** PC max = 2 + Mod. CHA + (aventuriers : +2). */
export function computePcMax(c: Character): number {
  const chaMod = abilityModifier(effectiveAbilities(c).charisma)
  return 2 + chaMod + (inferProfileFamily(c.paths) === 'aventuriers' ? 2 : 0)
}

/**
 * Bonus d'attaque de contact = niveau + Mod. FOR + bonus famille
 * Pas de pénalité d'armure sur le contact.
 */
export function computeAttackContact(c: Character): number {
  const forMod = abilityModifier(effectiveAbilities(c).strength)
  const bonus = familyAttackBonus(inferProfileFamily(c.paths))
  return c.level + forMod + bonus.contact + (c.attackContactBonus ?? 0)
}

/**
 * Bonus d'attaque à distance = niveau + Mod. DEX + bonus famille - floor((armorDef + shieldDef) / 2)
 */
export function computeAttackDistance(c: Character): number {
  const dexMod = abilityModifier(effectiveAbilities(c).dexterity)
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  const equipPenalty = Math.floor(((armor?.defBonus ?? 0) + (shield?.defBonus ?? 0)) / 2)
  const bonus = familyAttackBonus(inferProfileFamily(c.paths))
  return c.level + dexMod + bonus.distance - equipPenalty + (c.attackDistanceBonus ?? 0)
}

/**
 * Bonus d'attaque magique = niveau + Mod. INT + bonus famille - (armorDef + shieldDef)
 */
export function computeAttackMagique(c: Character): number {
  const intMod = abilityModifier(effectiveAbilities(c).intelligence)
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  const equipPenalty = (armor?.defBonus ?? 0) + (shield?.defBonus ?? 0)
  const bonus = familyAttackBonus(inferProfileFamily(c.paths))
  return c.level + intMod + bonus.magique - equipPenalty + (c.attackMagiqueBonus ?? 0)
}
