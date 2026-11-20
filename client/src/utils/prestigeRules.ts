import { VOIES_BY_ID, type Voie, type VoieFamily } from '../data/voies'
import type { PathRow } from '../types/character'
import { inferProfileFamily } from './inferProfileFamily'

/** Niveau à partir duquel on peut investir dans une voie de prestige. */
export const PRESTIGE_MIN_LEVEL = 8

/**
 * « La famille avant tout » (livre p. 52) : les voies de la famille du profil
 * ne doivent jamais devenir minoritaires.
 *
 * Le livre ne dit pas comment compter. On compte les voies (profil + prestige,
 * sans peuple ni culture) : après l'ajout, la famille du profil doit en avoir
 * au moins autant que chacune des deux autres.
 */
export function breaksFamilyRule(paths: PathRow[], candidate: Voie): boolean {
  const profileFamily = inferProfileFamily(paths)
  const counts: Record<VoieFamily, number> = { combattants: 0, aventuriers: 0, mystiques: 0 }
  for (const p of paths) {
    if (p.kind) continue
    const voie = p.id ? VOIES_BY_ID[p.id] : undefined
    if (voie) counts[voie.family]++
  }
  counts[candidate.family]++
  return Object.values(counts).some((n) => n > counts[profileFamily])
}
