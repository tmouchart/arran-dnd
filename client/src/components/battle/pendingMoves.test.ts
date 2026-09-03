import { describe, it, expect } from 'vitest'
import {
  startMove, confirmMove, releaseMove, settleMoves, isCurrent, PENDING_TIMEOUT_MS,
  type PendingMove, type PendingMoves,
} from './pendingMoves'

const T0 = 1_000_000
const move = (over: Partial<PendingMove> = {}): PendingMove =>
  ({ seq: 1, x: 2, z: 3, at: T0, ...over })

const at = (moves: PendingMoves, id: string) => {
  const m = moves.get(id)!
  return [m.x, m.z]
}
const positions = (entries: Record<string, [number, number]>) =>
  new Map(Object.entries(entries).map(([id, [x, z]]) => [id, { x, z }]))

describe('startMove', () => {
  it('affiche le pion tout de suite, sans attendre le serveur', () => {
    const m = startMove(new Map(), '7', move())
    expect(at(m, '7')).toEqual([2, 3])
  })

  it('ne mute pas la table source', () => {
    const before = new Map<string, PendingMove>()
    startMove(before, '7', move())
    expect(before.size).toBe(0)
  })

  it('un second geste écrase le premier sur le même pion', () => {
    let m = startMove(new Map(), '7', move({ seq: 1, x: 2, z: 3 }))
    m = startMove(m, '7', move({ seq: 2, x: -1, z: 0 }))
    expect(m.size).toBe(1)
    expect(at(m, '7')).toEqual([-1, 0])
    expect(isCurrent(m, '7', 1)).toBe(false)
    expect(isCurrent(m, '7', 2)).toBe(true)
  })
})

describe('confirmMove', () => {
  it('cale l’affichage sur la position retenue par le serveur', () => {
    // Le joueur a tapé hors de la grille, le serveur a clampé à 6.
    const m = confirmMove(startMove(new Map(), '7', move({ x: 9, z: 3 })), '7', 1, 6, 3)
    expect(at(m, '7')).toEqual([6, 3])
  })

  it('ignore la réponse d’un geste périmé', () => {
    let m = startMove(new Map(), '7', move({ seq: 1, x: 2, z: 3 }))
    m = startMove(m, '7', move({ seq: 2, x: -1, z: 0 }))
    // La réponse du PREMIER tap arrive après le second : elle ne doit rien toucher.
    m = confirmMove(m, '7', 1, 2, 3)
    expect(at(m, '7')).toEqual([-1, 0])
  })

  it('ne ressuscite pas un pion déjà lâché', () => {
    const m = confirmMove(new Map(), '7', 1, 2, 3)
    expect(m.has('7')).toBe(false)
  })
})

describe('releaseMove', () => {
  it('lâche le pion et rend la main au serveur', () => {
    const m = releaseMove(startMove(new Map(), '7', move()), '7', 1)
    expect(m.has('7')).toBe(false)
  })

  it('un geste périmé ne lâche pas le geste en cours', () => {
    // Le setTimeout du 1er tap tombe alors que le 2e tient déjà le pion.
    let m = startMove(new Map(), '7', move({ seq: 1 }))
    m = startMove(m, '7', move({ seq: 2, x: -1, z: 0 }))
    m = releaseMove(m, '7', 1)
    expect(at(m, '7')).toEqual([-1, 0])
  })
})

describe('settleMoves', () => {
  const pending = startMove(new Map(), '7', move({ x: 2, z: 3 }))

  it('lâche quand le serveur annonce NOTRE position', () => {
    expect(settleMoves(pending, positions({ '7': [2, 3] }), T0).has('7')).toBe(false)
  })

  it('tolère l’arrondi de la base', () => {
    expect(settleMoves(pending, positions({ '7': [2.0000001, 3] }), T0).has('7')).toBe(false)
  })

  it('garde le pion quand l’état porte une AUTRE position', () => {
    // Événement en retard d'un tap précédent : le lâcher téléporterait en arrière.
    expect(settleMoves(pending, positions({ '7': [0, 0] }), T0).has('7')).toBe(true)
  })

  it('lâche au bout du délai, même si le serveur n’a jamais répondu', () => {
    const late = T0 + PENDING_TIMEOUT_MS + 1
    expect(settleMoves(pending, positions({ '7': [0, 0] }), late).has('7')).toBe(false)
  })

  it('lâche un pion qui a quitté la carte', () => {
    expect(settleMoves(pending, positions({}), T0).has('7')).toBe(false)
  })

  it('ne touche pas aux autres pions en vol', () => {
    const two = startMove(pending, '9', move({ seq: 2, x: -4, z: 1 }))
    const out = settleMoves(two, positions({ '7': [2, 3], '9': [0, 0] }), T0)
    expect(out.has('7')).toBe(false)
    expect(at(out, '9')).toEqual([-4, 1])
  })

  it('ne fait rien sur une table vide', () => {
    expect(settleMoves(new Map(), positions({ '7': [1, 1] }), T0).size).toBe(0)
  })
})

describe('un aller-retour complet', () => {
  it('le pion reste sur la case du serveur, pas sur le geste clampé', () => {
    let m = startMove(new Map(), '7', move({ seq: 1, x: 9, z: 9 }))
    expect(at(m, '7')).toEqual([9, 9])          // affichage optimiste
    m = confirmMove(m, '7', 1, 6, 6)            // le serveur a clampé
    expect(at(m, '7')).toEqual([6, 6])
    m = settleMoves(m, positions({ '7': [6, 6] }), T0) // l'état diffusé arrive
    expect(m.size).toBe(0)                      // plus rien en vol, aucun saut
  })

  it('deux taps rapides : le pion finit sur le second, jamais sur le premier', () => {
    let m = startMove(new Map(), '7', move({ seq: 1, x: 1, z: 1 }))
    m = startMove(m, '7', move({ seq: 2, x: 5, z: 5 }))
    m = confirmMove(m, '7', 1, 1, 1)                   // réponse du 1er tap
    m = settleMoves(m, positions({ '7': [1, 1] }), T0) // état du 1er tap
    m = releaseMove(m, '7', 1)                         // timeout du 1er tap
    expect(at(m, '7')).toEqual([5, 5])
    m = confirmMove(m, '7', 2, 5, 5)
    m = settleMoves(m, positions({ '7': [5, 5] }), T0)
    expect(m.size).toBe(0)
  })
})
