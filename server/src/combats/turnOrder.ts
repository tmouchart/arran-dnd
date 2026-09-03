/**
 * Ordre de tour d'un combat.
 *
 * Le tour courant est stocké en base par l'**id** du participant
 * (`combat.current_participant_id`), pas par sa position. L'ordre trié n'est
 * qu'une vue recalculée à la demande : ajouter, retirer ou modifier un
 * participant ne peut donc plus décaler le tour de quelqu'un d'autre.
 */

export interface Orderable {
  id: number
  kind: string
  initiative: number
  hpCurrent: number | null
  /** PNJ en réserve : il n'entre dans aucun ordre tant qu'il est caché. */
  hidden?: boolean
}

/**
 * Ordre de jeu : initiative décroissante, id croissant en cas d'égalité.
 * Le tri par id garantit un ordre stable entre deux requêtes.
 *
 * Les PNJ cachés sont écartés : ils ne sont pas encore entrés en scène.
 */
export function turnOrder<T extends Orderable>(participants: T[]): T[] {
  return participants.filter((p) => !p.hidden).sort((a, b) => b.initiative - a.initiative || a.id - b.id)
}

/**
 * Un joueur reste dans l'ordre même à 0 PV (agonie) ; un monstre mort est sauté.
 * Un caché n'y est jamais, quoi qu'il arrive.
 */
export function isActive(p: Orderable): boolean {
  if (p.hidden) return false
  return p.kind === 'player' || (p.hpCurrent ?? 0) > 0
}

/** Premier participant actif de l'ordre, ou `null` si tout le monde est à terre. */
export function firstActiveId(order: Orderable[]): number | null {
  return order.find(isActive)?.id ?? null
}

export interface TurnStep {
  participantId: number
  /** Nombre de fois où l'on a bouclé sur le début de l'ordre (0 ou 1). */
  wrapped: number
}

/**
 * Avance (`+1`) ou recule (`-1`) jusqu'au prochain participant actif.
 *
 * `currentId` inconnu (participant supprimé, combat qui démarre) → on repart du
 * premier actif sans compter de tour de boucle.
 * Renvoie `null` si plus personne n'est actif.
 */
export function step(order: Orderable[], currentId: number | null, direction: 1 | -1): TurnStep | null {
  if (order.length === 0) return null

  const from = order.findIndex((p) => p.id === currentId)
  if (from === -1) {
    const id = firstActiveId(order)
    return id === null ? null : { participantId: id, wrapped: 0 }
  }

  let index = from
  let wrapped = 0
  for (let i = 0; i < order.length; i++) {
    index += direction
    if (index >= order.length) { index = 0; wrapped++ }
    if (index < 0) { index = order.length - 1; wrapped++ }
    if (isActive(order[index])) return { participantId: order[index].id, wrapped }
  }
  return null
}

/**
 * Position du tour courant dans l'ordre — valeur **dérivée**, calculée à la
 * sérialisation pour le client. `-1` si le tour ne pointe sur personne.
 */
export function turnIndexOf(order: Orderable[], currentId: number | null): number {
  return order.findIndex((p) => p.id === currentId)
}
