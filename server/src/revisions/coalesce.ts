/**
 * Règles de regroupement de l'historique — fonctions pures.
 *
 * La sauvegarde auto part ~800 ms après chaque pause de frappe : une révision
 * par sauvegarde ferait des centaines de lignes illisibles pour une seule
 * session. On regroupe donc les écritures rapprochées d'un même auteur dans une
 * seule révision, sauf quand le contenu vient de fondre (le cas « Ctrl+A »),
 * où l'état d'avant doit absolument rester récupérable.
 */

/** Champs versionnés d'une entité (ex: { content }, { name, type, description }). */
export type Snapshot = Record<string, string>

/** Deux écritures d'un même auteur dans cette fenêtre partagent une révision. */
export const COALESCE_WINDOW_MS = 3 * 60 * 1000

/** En dessous de ce ratio de taille, on considère qu'il y a eu une amputation. */
export const MASS_DELETION_RATIO = 0.5
/** …à condition que la perte absolue soit significative (évite « ab » → « a »). */
export const MASS_DELETION_MIN_LOSS = 200

export const MAX_REVISIONS_TEXT = 50
/** Les dessins sont lourds : on en garde moins. */
export const MAX_REVISIONS_DRAWING = 20
/** Au-delà, on ne versionne pas (protège la base d'un dessin monstrueux). */
export const MAX_SNAPSHOT_BYTES = 1_000_000

/** Taille d'un snapshot = total des caractères de ses champs versionnés. */
export function snapshotSize(snapshot: Snapshot): number {
  let total = 0
  for (const value of Object.values(snapshot)) total += value.length
  return total
}

export function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if ((a[key] ?? '') !== (b[key] ?? '')) return false
  }
  return true
}

/**
 * Le contenu a-t-il fondu au point qu'il faille figer l'état précédent ?
 * C'est le garde-fou du Ctrl+A : sans lui, la suppression serait fusionnée dans
 * la révision en cours et écraserait justement le texte qu'on veut récupérer.
 */
export function isMassDeletion(prevSize: number, nextSize: number): boolean {
  const loss = prevSize - nextSize
  if (loss < MASS_DELETION_MIN_LOSS) return false
  return nextSize < prevSize * MASS_DELETION_RATIO
}

export interface LastRevision {
  authorUserId: number | null
  /** Début du regroupement — volontairement jamais rafraîchi, sinon une longue
   *  session d'écriture tiendrait dans une seule révision sans fin. */
  createdAt: Date
  kind: string
  size: number
}

/** Faut-il écraser la dernière révision plutôt qu'en créer une nouvelle ? */
export function shouldCoalesce(
  last: LastRevision | null,
  next: { authorUserId: number; size: number; kind?: string },
  now: number,
): boolean {
  if (!last) return false
  if (last.authorUserId !== next.authorUserId) return false
  // Un point de restauration reste un repère visible, qu'il soit celui qu'on
  // absorberait ou celui qu'on est en train d'écrire.
  if (last.kind === 'restore' || next.kind === 'restore') return false
  if (now - last.createdAt.getTime() >= COALESCE_WINDOW_MS) return false
  if (isMassDeletion(last.size, next.size)) return false
  return true
}

export function maxRevisionsFor(isDrawing: boolean): number {
  return isDrawing ? MAX_REVISIONS_DRAWING : MAX_REVISIONS_TEXT
}

/**
 * Parmi des révisions triées de la plus récente à la plus ancienne, celles à
 * supprimer. On garde toujours au moins une révision.
 */
export function revisionsToPrune(idsNewestFirst: number[], limit: number): number[] {
  const keep = Math.max(1, limit)
  return idsNewestFirst.slice(keep)
}
