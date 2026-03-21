/** Player character sheet — CO / Terres d’Arran shaped; refine fields as you extend the app. */

export interface SkillRow {
  name: string
  rank: number
}

export interface AttackRow {
  name: string
  /** e.g. "+5" or "DEX" */
  attackBonus: string
  /** e.g. "1d8+3 tranchant" */
  damage: string
  notes?: string
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
  people: string
  level: number
  abilities: CharacterAbilities
  hpCurrent: number
  hpMax: number
  mpCurrent: number
  mpMax: number
  defense: number
  initiativeBonus: number
  skills: SkillRow[]
  attacks: AttackRow[]
  paths: PathRow[]
  /** Id from `mysticTalents.ts` when the profile family is mystiques; empty string if none */
  mysticTalent: string
}
