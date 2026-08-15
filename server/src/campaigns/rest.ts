/**
 * Repos partagé — la règle, et rien d'autre.
 *
 * Deux repos seulement passent par le MJ : ceux qui s'appliquent à tout le
 * monde sans coût ni choix. Le repos court (5 min, 1 PR contre des PV) reste
 * une décision de joueur et vit sur la fiche, pas ici.
 */

/** PR max de base (CO / Terres d'Arran). */
export const PR_MAX = 5

export type RestKind = 'long' | 'complet'

export function isRestKind(value: unknown): value is RestKind {
  return value === 'long' || value === 'complet'
}

/** Ce qu'un repos peut toucher sur une fiche. */
export interface RestState {
  hpCurrent: number
  hpMax: number
  mpCurrent: number
  mpMax: number
  prCurrent: number
  affaibli: boolean
}

/**
 * Applique un repos et rend le nouvel état.
 *
 * - `long` : la règle stricte de la nuit — tous les PM, +1 PR, **aucun PV**.
 *   Les PV ne remontent que par PR dépensés ou par soins, c'est ce qui donne
 *   leur poids aux PR.
 * - `complet` : maison-règle du MJ entre deux sessions — tout au maximum.
 *
 * Les PC ne sont jamais touchés ici : ils reviennent au passage de niveau
 * (règle), et leur maximum se calcule côté client, qui seul connaît la famille
 * de profil. Le repos complet les remet à neuf depuis le navigateur.
 */
export function applyRest(state: RestState, kind: RestKind): RestState {
  if (kind === 'complet') {
    return {
      ...state,
      hpCurrent: state.hpMax,
      mpCurrent: state.mpMax,
      prCurrent: PR_MAX,
      affaibli: false,
    }
  }

  return {
    ...state,
    mpCurrent: state.mpMax,
    prCurrent: Math.min(PR_MAX, state.prCurrent + 1),
    affaibli: false,
  }
}

/** Ce qui a bougé, pour la modal du joueur. Une clé absente = rien n'a changé. */
export interface RestDelta {
  hp?: { before: number; after: number }
  mp?: { before: number; after: number }
  pr?: { before: number; after: number }
}

/** Ce qui part sur le flux SSE : de quoi jouer l'animation et rafraîchir la fiche. */
export interface RestBroadcast {
  kind: RestKind
  deltas: {
    userId: number
    characterName: string
    delta: RestDelta
    after: RestState
  }[]
}

export function restDelta(before: RestState, after: RestState): RestDelta {
  const delta: RestDelta = {}
  if (before.hpCurrent !== after.hpCurrent) {
    delta.hp = { before: before.hpCurrent, after: after.hpCurrent }
  }
  if (before.mpCurrent !== after.mpCurrent) {
    delta.mp = { before: before.mpCurrent, after: after.mpCurrent }
  }
  if (before.prCurrent !== after.prCurrent) {
    delta.pr = { before: before.prCurrent, after: after.prCurrent }
  }
  return delta
}
