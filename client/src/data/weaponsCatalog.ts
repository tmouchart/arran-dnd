import type { MartialWeaponCategoryId } from './martialWeaponCategories'

/** Weapon stats from knowledge/topics/equipement.md (tables). */
export interface CatalogWeaponEntry {
  id: string
  name: string
  attackType: 'contact' | 'distance'
  damageDice: string
  /** Column Mod.: FOR / DEX / — */
  damageAbility: 'strength' | 'dexterity' | null
  martialFamily: MartialWeaponCategoryId
  rangeMeters: number | null
  notes?: string
}

export const WEAPONS_CATALOG: CatalogWeaponEntry[] = [
  // Contact — paysan
  { id: 'baton', name: 'Bâton', attackType: 'contact', damageDice: '(1d4)', damageAbility: 'strength', martialFamily: 'paysan', rangeMeters: null, notes: 'DM temporaires ; deux mains' },
  { id: 'baton-ferre', name: 'Bâton ferré', attackType: 'contact', damageDice: '1d6', damageAbility: 'strength', martialFamily: 'paysan', rangeMeters: null, notes: 'Deux mains' },
  { id: 'dague-contact', name: 'Dague (contact)', attackType: 'contact', damageDice: '1d4', damageAbility: 'strength', martialFamily: 'paysan', rangeMeters: null },
  { id: 'mains-nues', name: 'Mains nues', attackType: 'contact', damageDice: '(1d4)', damageAbility: 'strength', martialFamily: 'paysan', rangeMeters: null, notes: 'DM temporaires' },
  { id: 'hache-bucheron', name: 'Hache de bûcheron', attackType: 'contact', damageDice: '2d4', damageAbility: 'strength', martialFamily: 'paysan', rangeMeters: null, notes: 'Nécessite une capacité pour être maîtrisée' },
  // Contact — guerre
  { id: 'epee-longue', name: 'Épée longue', attackType: 'contact', damageDice: '1d8', damageAbility: 'strength', martialFamily: 'guerre', rangeMeters: null },
  { id: 'hache-une-main', name: 'Hache à une main', attackType: 'contact', damageDice: '1d8', damageAbility: 'strength', martialFamily: 'guerre', rangeMeters: null },
  { id: 'marteau-guerre', name: 'Marteau de guerre', attackType: 'contact', damageDice: '1d6', damageAbility: 'strength', martialFamily: 'guerre', rangeMeters: null },
  { id: 'masse-armes', name: 'Masse d’armes', attackType: 'contact', damageDice: '1d6', damageAbility: 'strength', martialFamily: 'guerre', rangeMeters: null },
  // Contact — guerre lourdes
  { id: 'epee-deux-mains', name: 'Épée à deux mains', attackType: 'contact', damageDice: '2d6', damageAbility: 'strength', martialFamily: 'guerre_lourdes', rangeMeters: null, notes: 'Deux mains' },
  { id: 'epee-batarde', name: 'Épée bâtarde', attackType: 'contact', damageDice: '1d12', damageAbility: 'strength', martialFamily: 'guerre_lourdes', rangeMeters: null, notes: 'Deux mains ; règles spéciales' },
  { id: 'marteau-deux-mains', name: 'Marteau à deux mains', attackType: 'contact', damageDice: '3d4', damageAbility: 'strength', martialFamily: 'guerre_lourdes', rangeMeters: null, notes: 'Deux mains' },
  { id: 'hache-deux-mains', name: 'Hache à deux mains', attackType: 'contact', damageDice: '2d6', damageAbility: 'strength', martialFamily: 'guerre_lourdes', rangeMeters: null, notes: 'Deux mains' },
  // Contact — hast
  { id: 'epieu', name: 'Épieu', attackType: 'contact', damageDice: '1d6', damageAbility: 'strength', martialFamily: 'hast', rangeMeters: null, notes: 'Règles spéciales' },
  { id: 'lance-contact', name: 'Lance (contact)', attackType: 'contact', damageDice: '1d8', damageAbility: 'strength', martialFamily: 'hast', rangeMeters: null, notes: 'Deux mains par défaut ; règles spéciales' },
  { id: 'lance-cavalerie', name: 'Lance de cavalerie', attackType: 'contact', damageDice: '2d6', damageAbility: 'strength', martialFamily: 'hast', rangeMeters: null, notes: 'Deux mains ; règles spéciales' },
  { id: 'pique', name: 'Pique', attackType: 'contact', damageDice: '1d8', damageAbility: 'strength', martialFamily: 'hast', rangeMeters: null, notes: 'Deux mains ; règles spéciales' },
  // Contact — duel
  { id: 'epee-courte', name: 'Épée courte', attackType: 'contact', damageDice: '1d6', damageAbility: 'strength', martialFamily: 'duel', rangeMeters: null },
  { id: 'main-gauche', name: 'Main gauche', attackType: 'contact', damageDice: '1d4', damageAbility: 'strength', martialFamily: 'duel', rangeMeters: null, notes: 'Règles spéciales' },
  { id: 'rapiere', name: 'Rapière', attackType: 'contact', damageDice: '1d6', damageAbility: 'strength', martialFamily: 'duel', rangeMeters: null, notes: 'Critique 19–20' },
  // Distance — paysan
  { id: 'fronde', name: 'Fronde', attackType: 'distance', damageDice: '1d4', damageAbility: null, martialFamily: 'paysan', rangeMeters: 20 },
  { id: 'dague-jet', name: 'Dague (jet)', attackType: 'distance', damageDice: '1d4', damageAbility: null, martialFamily: 'paysan', rangeMeters: 5 },
  // Jet
  { id: 'couteau-lancer', name: 'Couteau de lancer', attackType: 'distance', damageDice: '1d4', damageAbility: 'dexterity', martialFamily: 'jet', rangeMeters: 10, notes: 'Action limitée pour ajouter le mod. aux DM' },
  { id: 'hachette', name: 'Hachette', attackType: 'distance', damageDice: '1d6', damageAbility: 'strength', martialFamily: 'jet', rangeMeters: 5, notes: 'Action limitée pour ajouter le mod. aux DM' },
  { id: 'javelot', name: 'Javelot', attackType: 'distance', damageDice: '1d6', damageAbility: 'strength', martialFamily: 'jet', rangeMeters: 20, notes: 'Action limitée pour ajouter le mod. aux DM' },
  // Hast — jet
  { id: 'lance-jet', name: 'Lance (jet)', attackType: 'distance', damageDice: '1d8', damageAbility: 'strength', martialFamily: 'hast', rangeMeters: 10, notes: 'Règles spéciales' },
  // Trait
  { id: 'arc-composite', name: 'Arc composite', attackType: 'distance', damageDice: '1d6', damageAbility: 'strength', martialFamily: 'trait', rangeMeters: 50, notes: 'Deux mains ; FOR min 15' },
  { id: 'arc-court', name: 'Arc court', attackType: 'distance', damageDice: '1d6', damageAbility: null, martialFamily: 'trait', rangeMeters: 30, notes: 'Deux mains' },
  { id: 'arc-long', name: 'Arc long', attackType: 'distance', damageDice: '1d8', damageAbility: null, martialFamily: 'trait', rangeMeters: 50, notes: 'Deux mains ; FOR min 13' },
  // Tir
  { id: 'arbalete-poing', name: 'Arbalète de poing', attackType: 'distance', damageDice: '1d6', damageAbility: null, martialFamily: 'tir', rangeMeters: 10, notes: 'Rechargement action d’attaque' },
  { id: 'arbalete-legere', name: 'Arbalète légère', attackType: 'distance', damageDice: '2d4', damageAbility: null, martialFamily: 'tir', rangeMeters: 30, notes: 'Deux mains ; rechargement action d’attaque' },
  { id: 'arbalete-lourde', name: 'Arbalète lourde', attackType: 'distance', damageDice: '3d4', damageAbility: null, martialFamily: 'tir', rangeMeters: 60, notes: 'Deux mains ; rechargement action limitée' },
  { id: 'arbalete-repetition', name: 'Arbalète à répétition', attackType: 'distance', damageDice: '2d4', damageAbility: null, martialFamily: 'tir', rangeMeters: 60, notes: 'Capacité requise ; règles spéciales' },
]

export const WEAPONS_CATALOG_BY_ID: Record<string, CatalogWeaponEntry> = Object.fromEntries(
  WEAPONS_CATALOG.map((w) => [w.id, w]),
)
