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
}
