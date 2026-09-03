import type { Stroke } from '../api/journal'

/**
 * Fusionne deux listes de traits d'un même dessin.
 *
 * Deux personnes qui dessinent en même temps envoient chacune la liste
 * complète : sans fusion, la dernière sauvegarde efface les traits de l'autre.
 * On unit donc par `id`, et une suppression (`deleted`) gagne toujours — c'est
 * ce qui permet à une annulation de se propager au lieu d'être ressuscitée par
 * la copie du voisin.
 */
export function mergeStrokeLists(local: Stroke[], remote: Stroke[]): Stroke[] {
  const out: Stroke[] = [...local]
  const index = new Map<string, number>()
  out.forEach((s, i) => index.set(s.id, i))

  for (const r of remote) {
    const i = index.get(r.id)
    if (i === undefined) {
      index.set(r.id, out.length)
      out.push(r)
    } else if (r.deleted && !out[i].deleted) {
      // Même réduction que le serveur : un trait effacé ne garde que son id.
      out[i] = { id: out[i].id, deleted: true } as Stroke
    }
  }
  return out
}

/** Même chose sur le JSON stocké. Renvoie `null` si rien ne change ou si le
 *  contenu distant est illisible — l'appelant n'a alors rien à faire. */
export function mergeStrokes(localJson: string, remoteJson: string): string | null {
  let local: Stroke[] = []
  let remote: Stroke[] = []
  try {
    local = localJson ? JSON.parse(localJson) : []
    remote = remoteJson ? JSON.parse(remoteJson) : []
  } catch {
    return null
  }
  if (!Array.isArray(local) || !Array.isArray(remote)) return null

  const merged = JSON.stringify(mergeStrokeLists(local, remote))
  return merged === localJson ? null : merged
}
