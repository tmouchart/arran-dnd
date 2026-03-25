/** Player character sheet — CO / Terres d’Arran shaped; refine fields as you extend the app. */

import type { MartialWeaponCategoryId } from '../data/martialWeaponCategories'

export interface WeaponRow {
  id: string
  name: string
  attackType: 'contact' | 'distance'
  damageDice: string
  /** Equipment table Mod.: FOR / DEX / — */
  damageAbility: 'strength' | 'dexterity' | null
  martialFamily: MartialWeaponCategoryId
  rangeMeters: number | null
  catalogId?: string
  notes?: string
}

export interface SkillRow {
  name: string
  rank: number
}

export interface ItemRow {
  id: string
  name: string
  description?: string
  quantity: number
}

export interface PathRow {
  id?: string
  name: string
  rank: number
  /** 'peuple' et 'culturelle' sont gérés automatiquement via les dropdowns de la fiche. */
  kind?: 'peuple' | 'culturelle'
}

export interface CharacterAbilities {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

export interface CompetenceRow {
  id: string
  name: string
  /** Ability score used for the roll, or null for flat bonus only */
  ability: keyof CharacterAbilities | null
  bonus: number
}

export interface Character {
  id: string
  name: string
  profile: string
  /** Background / backstory (UI: « Histoire »). */
  histoire: string
  people: string
  level: number
  abilities: CharacterAbilities
  hpCurrent: number
  hpMax: number
  mpCurrent: number
  mpMax: number
  defense: number
  /** Initiative score; persisted as `initiative_bonus` but always equals DEX (base rule). */
  initiativeBonus: number
  skills: SkillRow[]
  /** Martial weapon categories trained (excludes `paysan`, which is always considered trained). */
  martialFormations: MartialWeaponCategoryId[]
  weapons: WeaponRow[]
  paths: PathRow[]
  /** Id from `mysticTalents.ts` when the profile family is mystiques; empty string if none */
  mysticTalent: string
  /** Id from `armorsCatalog.ts` of the equipped armor; empty string = aucune armure */
  armorId: string
  /** Id from `armorsCatalog.ts` (SHIELDS_CATALOG) of the equipped shield; empty string = aucun bouclier */
  shieldId: string
  /** Bonus de DEF divers (capacités, magie, situations…) saisi manuellement */
  defenseBonus: number
  /** Raw die rolls for HP gained at each level >= 2. Length = level - 1. CON mod is computed live. */
  hpLevelGains: number[]
  /** Inventory items. */
  items: ItemRow[]
  /** Currency. Conversion: 1 po = 10 pa = 100 pc. */
  goldCoins: number
  silverCoins: number
  copperCoins: number
  /** Points de Chance courants. Max = 2 + Mod. CHA (aventuriers +2). */
  pcCurrent: number
  /** Points de Récupération courants (max = 5). */
  prCurrent: number
  /** Custom rollable competences (nom + carac + bonus). */
  competences: CompetenceRow[]
}
