/**
 * Fusion des traits d'un dessin partagé.
 *
 * Un dessin n'a pas de verrou : plusieurs personnes tracent en même temps et
 * chacune envoie la liste complète. Si le serveur écrasait avec ce qu'il reçoit,
 * un client qui a une copie d'il y a trois secondes effacerait les traits des
 * autres. On fusionne donc à l'écriture, côté serveur — c'est le seul endroit
 * qui voit toutes les versions.
 */

export interface Stroke {
  id: string
  /** Trait annulé. On garde une pierre tombale au lieu de retirer l'entrée,
   *  sinon la copie d'un autre joueur le ferait revenir à la fusion suivante. */
  deleted?: boolean
  [key: string]: unknown
}

export function mergeStrokeLists(base: Stroke[], incoming: Stroke[]): Stroke[] {
  const out: Stroke[] = [...base]
  const index = new Map<string, number>()
  out.forEach((s, i) => { if (typeof s?.id === 'string') index.set(s.id, i) })

  for (const s of incoming) {
    if (!s || typeof s.id !== 'string') continue
    const i = index.get(s.id)
    if (i === undefined) {
      index.set(s.id, out.length)
      out.push(s.deleted ? { id: s.id, deleted: true } : s)
    } else if (s.deleted && !out[i].deleted) {
      // La pierre tombale ne garde que l'id : conserver les points d'un trait
      // effacé alourdirait le dessin pour toujours.
      out[i] = { id: out[i].id, deleted: true }
    }
  }
  return out
}

/**
 * Fusionne le JSON reçu avec celui déjà en base. Si l'un des deux est illisible
 * on renvoie l'entrant tel quel : mieux vaut enregistrer que tout jeter.
 */
export function mergeStrokesJson(baseJson: string, incomingJson: string): string {
  let base: unknown
  let incoming: unknown
  try {
    base = baseJson ? JSON.parse(baseJson) : []
    incoming = incomingJson ? JSON.parse(incomingJson) : []
  } catch {
    return incomingJson
  }
  if (!Array.isArray(base) || !Array.isArray(incoming)) return incomingJson
  return JSON.stringify(mergeStrokeLists(base as Stroke[], incoming as Stroke[]))
}
