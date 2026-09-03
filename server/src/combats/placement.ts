/**
 * Place de départ d'un pion sur le champ de bataille.
 *
 * Avant, le client la calculait depuis l'index du participant dans la liste
 * affichée. Cette liste bouge (un PNJ sort de réserve, un monstre meurt), donc
 * tous les pions jamais déplacés sautaient de case. La place est donc fixée une
 * fois pour toutes à la création, en base.
 *
 * Les héros au sud, les monstres au nord, cinq par rangée.
 */

/** Demi-côté de la grille, en cases. Doit rester aligné sur le client. */
export const BATTLE_HALF = 6

/** Cases entre deux pions voisins. En dessous, les étiquettes se chevauchent. */
const COLUMN_GAP = 1.4
const ROW_GAP = 1.5
const PER_ROW = 5

/** La première rangée, à cette distance du centre. */
const FRONT_LINE = 3

export function clampToBoard(v: number): number {
  return Math.max(-BATTLE_HALF, Math.min(BATTLE_HALF, v))
}

/**
 * `slot` est le rang d'arrivée du pion dans son camp (0 pour le premier).
 * Deux pions du même camp avec le même `slot` se superposeraient — c'est à
 * l'appelant de compter ceux déjà présents.
 */
export function startingPosition(kind: string, slot: number): { posX: number; posY: number } {
  const column = slot % PER_ROW
  const row = Math.floor(slot / PER_ROW)
  const posX = clampToBoard((column - (PER_ROW - 1) / 2) * COLUMN_GAP)
  const depth = FRONT_LINE + row * ROW_GAP
  // Le sud est positif. Au-delà de la grille, on empile sur la dernière rangée
  // plutôt que de poser le pion hors du plateau.
  const posY = clampToBoard(kind === 'player' ? depth : -depth)
  return { posX, posY }
}
