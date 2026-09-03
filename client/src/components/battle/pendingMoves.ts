/**
 * Les déplacements joués à l'écran mais pas encore confirmés par le serveur.
 *
 * Sans eux, taper un pion ne fait rien pendant l'aller-retour réseau — 150 à
 * 600 ms sur un téléphone en 4G — puis le pion saute. On le bouge donc tout de
 * suite, et cette table fait aussi office de garde anti-rebond : tant qu'un
 * déplacement est en vol, les positions qui arrivent pour ce pion sont ignorées
 * (elles datent d'avant notre geste).
 *
 * Tout est pur et rend une NOUVELLE table : le composant n'a qu'à réassigner sa
 * `ref` pour que la carte se redessine.
 */

export interface PendingMove {
  /**
   * Numéro de geste, pour qu'une réponse ne confirme que SON déplacement.
   *
   * Deux taps rapides et la réponse du premier arrivait sur l'entrée du second :
   * elle la marquait confirmée puis la lâchait 600 ms plus tard, alors que le
   * serveur en était encore à la première position — le pion se téléportait en
   * arrière. Un geste plus récent périme donc le précédent.
   */
  seq: number
  x: number
  z: number
  /** Instant du geste, pour lâcher prise si le serveur ne répond jamais. */
  at: number
}

export type PendingMoves = ReadonlyMap<string, PendingMove>

/** Au-delà, on considère que le serveur ne répondra jamais et on lâche prise. */
export const PENDING_TIMEOUT_MS = 3000

/** Deux positions sont la même case. `real` en base arrondit au millionième. */
const EPSILON = 1e-3

function replace(moves: PendingMoves, mutate: (next: Map<string, PendingMove>) => void): Map<string, PendingMove> {
  const next = new Map(moves)
  mutate(next)
  return next
}

/** Le doigt vient de poser le pion : on l'affiche là tout de suite. */
export function startMove(
  moves: PendingMoves,
  id: string,
  move: PendingMove,
): Map<string, PendingMove> {
  return replace(moves, (next) => next.set(id, move))
}

/** Le geste `seq` est-il toujours celui qui tient le pion `id` ? */
export function isCurrent(moves: PendingMoves, id: string, seq: number): boolean {
  return moves.get(id)?.seq === seq
}

/**
 * Le serveur a répondu. On cale l'affichage optimiste sur la position qu'il a
 * RETENUE : s'il l'a ramenée dans la grille, c'est elle qu'on attend dans l'état
 * diffusé, pas notre geste. Sans ça la comparaison ne tombait jamais juste et le
 * pion sautait.
 *
 * Un geste plus récent a pris la main → on ne touche à rien.
 */
export function confirmMove(
  moves: PendingMoves,
  id: string,
  seq: number,
  x: number,
  z: number,
): Map<string, PendingMove> {
  const move = moves.get(id)
  if (move?.seq !== seq) return new Map(moves)
  return replace(moves, (next) => next.set(id, { ...move, x, z }))
}

/** On lâche le pion : l'état du serveur reprend la main. */
export function releaseMove(
  moves: PendingMoves,
  id: string,
  seq: number,
): Map<string, PendingMove> {
  if (!isCurrent(moves, id, seq)) return new Map(moves)
  return replace(moves, (next) => next.delete(id))
}

/**
 * Un état vient d'arriver. On lâche les pions que le serveur a rattrapés.
 *
 * On ne lâche que sur NOTRE position. Un état qui en porte une autre est soit un
 * geste plus ancien qui traîne, soit quelqu'un qui a écrit après nous : dans les
 * deux cas c'est le délai de grâce après la réponse qui tranche, pas cet état-là.
 * Sans ça, l'événement en retard d'un tap précédent téléportait le pion en
 * arrière.
 *
 * Un pion absent de l'état (monstre mort, PNJ renvoyé en réserve) est lâché
 * aussi : plus rien ne viendra jamais le confirmer.
 */
export function settleMoves(
  moves: PendingMoves,
  positions: ReadonlyMap<string, { x: number; z: number }>,
  now: number,
): Map<string, PendingMove> {
  if (moves.size === 0) return new Map(moves)
  return replace(moves, (next) => {
    for (const [id, move] of moves) {
      const p = positions.get(id)
      const settled =
        !p ||
        now - move.at > PENDING_TIMEOUT_MS ||
        (Math.abs(p.x - move.x) < EPSILON && Math.abs(p.z - move.z) < EPSILON)
      if (settled) next.delete(id)
    }
  })
}
