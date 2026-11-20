import { VOIES_BY_ID, type Voie, type VoieFamily } from '../data/voies'
import type { PathRow } from '../types/character'

/**
 * Profile family (Terres d’Arran / creation-personnage.md):
 * if at least two of the profile paths share the same family → that family;
 * otherwise (one path per family, or no majority) → aventuriers.
 * Only counts paths that are not peuple/culturelle (the profile voies from VOIES),
 * and never the prestige voies.
 */
export function inferProfileFamily(paths: PathRow[]): VoieFamily {
  const families = paths
    .filter((p) => p.kind !== 'peuple' && p.kind !== 'culturelle')
    .map((p) => (p.id ? VOIES_BY_ID[p.id] : undefined))
    // Une voie de prestige ne change pas la famille du profil.
    .filter((v): v is Voie => v != null && !v.prestige)
    .map((v) => v.family)

  if (families.length === 0) return 'aventuriers'

  const counts = new Map<VoieFamily, number>()
  for (const f of families) {
    counts.set(f, (counts.get(f) ?? 0) + 1)
  }

  let maxCount = 0
  for (const c of counts.values()) maxCount = Math.max(maxCount, c)

  if (maxCount < 2) return 'aventuriers'

  const winners = [...counts.entries()]
    .filter(([, c]) => c === maxCount)
    .map(([f]) => f)
  if (winners.length !== 1) return 'aventuriers'

  return winners[0]
}
