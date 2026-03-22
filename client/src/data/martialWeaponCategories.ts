/**
 * Martial weapon categories (Terres d’Arran — creation-personnage.md).
 * `paysan` is always considered trained; not stored in character.martialFormations.
 */

export const MARTIAL_WEAPON_CATEGORIES = [
  { id: 'paysan', label: 'Armes de paysan' },
  { id: 'guerre', label: 'Armes de guerre' },
  { id: 'guerre_lourdes', label: 'Armes de guerre lourdes' },
  { id: 'hast', label: 'Armes d’hast' },
  { id: 'duel', label: 'Armes de duel' },
  { id: 'trait', label: 'Armes de trait' },
  { id: 'tir', label: 'Armes de tir' },
  { id: 'jet', label: 'Armes de jet' },
] as const

export type MartialWeaponCategoryId = (typeof MARTIAL_WEAPON_CATEGORIES)[number]['id']

/** Categories the player can toggle (excludes paysan). */
export const MARTIAL_FORMATION_SELECTABLE_IDS = MARTIAL_WEAPON_CATEGORIES.filter((c) => c.id !== 'paysan').map(
  (c) => c.id,
) as Exclude<MartialWeaponCategoryId, 'paysan'>[]

export const MARTIAL_WEAPON_CATEGORY_BY_ID: Record<MartialWeaponCategoryId, string> = Object.fromEntries(
  MARTIAL_WEAPON_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<MartialWeaponCategoryId, string>
