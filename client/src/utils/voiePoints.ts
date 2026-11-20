import { VOIES_BY_ID } from '../data/voies'
import type { PathRow } from '../types/character'

/** Une ligne de la fiche est-elle une voie de prestige ? */
export function isPrestigePath(p: PathRow): boolean {
  return !!(p.id && VOIES_BY_ID[p.id]?.prestige)
}

/**
 * Points dépensés pour atteindre `rank` dans une voie.
 * Voie normale : 1-1-2-2-2. Voie de prestige : 2 points par rang (livre p. 52).
 */
export function rankCost(rank: number, prestige: boolean): number {
  if (prestige) return rank * 2
  return rank <= 2 ? rank : 2 + (rank - 2) * 2
}

/** Prix du rang suivant. */
export function incrementCost(currentRank: number, prestige: boolean): number {
  return rankCost(currentRank + 1, prestige) - rankCost(currentRank, prestige)
}

/** Total des points dépensés dans toutes les voies de la fiche. */
export function spentPoints(paths: PathRow[]): number {
  return paths.reduce((sum, p) => sum + rankCost(p.rank, isPrestigePath(p)), 0)
}
