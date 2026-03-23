import type { CharacterAbilities } from '../types/character'

export type AbilityMods = Partial<Record<keyof CharacterAbilities, number>>

/** Modificateurs de caractéristiques par peuple (atouts / faiblesses raciaux). */
export const RACIAL_MODS_BY_PEUPLE: Record<string, AbilityMods> = {
  'elfe':       { charisma: 2, strength: -2 },
  'nain':       { constitution: 2, dexterity: -2 },
  'humain':     {},
  'sang-mele':  {},   // variable selon les parents
  // peau-verte : les mods dépendent de la sous-culture (orc / gobelin / ogre)
  'peau-verte': {},
}

/** Modificateurs complémentaires par culture (utilisés pour les Peaux vertes). */
export const RACIAL_MODS_BY_CULTURE: Record<string, AbilityMods> = {
  'culture-orc':     { strength: 2, constitution: 2, intelligence: -2, charisma: -2 },
  'culture-gobelin': { dexterity: 2, intelligence: 2, strength: -2, constitution: -2 },
  'culture-ogre':    { constitution: 4, strength: 2, dexterity: -4, intelligence: -2, charisma: -2 },
}

export const ABILITY_LABELS: Record<keyof CharacterAbilities, string> = {
  strength:     'FOR',
  dexterity:    'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom:       'SAG',
  charisma:     'CHA',
}

/**
 * Retourne les modificateurs raciaux effectifs pour un personnage donné.
 * Pour les Peaux vertes, utilise les mods culturels si une culture est sélectionnée.
 */
export function getRacialMods(peupleId: string, cultureId: string): AbilityMods {
  if (peupleId === 'peau-verte' && cultureId && RACIAL_MODS_BY_CULTURE[cultureId]) {
    return RACIAL_MODS_BY_CULTURE[cultureId]
  }
  return RACIAL_MODS_BY_PEUPLE[peupleId] ?? {}
}
