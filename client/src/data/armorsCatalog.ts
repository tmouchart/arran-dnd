export interface ArmorEntry {
  id: string
  name: string
  defBonus: number
  type: 'légère' | 'lourde'
  /** Encombrant = annule le bonus de DEX à la DEF (demi-plaque, armure de plaques) */
  encombrant: boolean
}

export interface ShieldEntry {
  id: string
  name: string
  defBonus: number
  type: 'légère' | 'lourde'
}

export const ARMORS_CATALOG: ArmorEntry[] = [
  // Légères
  { id: 'tissu-matelasse', name: 'Tissu matelassé',           defBonus: 1, type: 'légère', encombrant: false },
  { id: 'cuir',            name: 'Armure de cuir',            defBonus: 2, type: 'légère', encombrant: false },
  { id: 'cuir-renforce',   name: 'Armure de cuir renforcé',   defBonus: 3, type: 'légère', encombrant: false },
  // Lourdes
  { id: 'chemise-mailles', name: 'Chemise de mailles',        defBonus: 4, type: 'lourde', encombrant: false },
  { id: 'cotte-mailles',   name: 'Cotte de mailles',          defBonus: 5, type: 'lourde', encombrant: false },
  { id: 'demi-plaque',     name: 'Demi-plaque',               defBonus: 6, type: 'lourde', encombrant: true  },
  { id: 'armure-plaques',  name: 'Armure de plaques',         defBonus: 7, type: 'lourde', encombrant: true  },
]

export const ARMORS_BY_ID: Record<string, ArmorEntry> = Object.fromEntries(
  ARMORS_CATALOG.map((a) => [a.id, a]),
)

export const SHIELDS_CATALOG: ShieldEntry[] = [
  { id: 'petit-bouclier', name: 'Petit bouclier', defBonus: 1, type: 'légère' },
  { id: 'grand-bouclier', name: 'Grand bouclier', defBonus: 2, type: 'lourde' },
]

export const SHIELDS_BY_ID: Record<string, ShieldEntry> = Object.fromEntries(
  SHIELDS_CATALOG.map((s) => [s.id, s]),
)
