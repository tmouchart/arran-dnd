import { describe, it, expect } from 'vitest'
import { turnOrder, isActive, firstActiveId, step, turnIndexOf, type Orderable } from './turnOrder.js'

function p(id: number, initiative: number, kind = 'monster', hpCurrent: number | null = 10): Orderable {
  return { id, kind, initiative, hpCurrent }
}

/** Le même, mais en réserve. */
function hidden(id: number, initiative: number, kind = 'monster'): Orderable {
  return { id, kind, initiative, hpCurrent: 10, hidden: true }
}

describe('turnOrder', () => {
  it('trie par initiative décroissante', () => {
    expect(turnOrder([p(1, 3), p(2, 9), p(3, 5)]).map((x) => x.id)).toEqual([2, 3, 1])
  })

  it('départage les initiatives égales par id croissant (ordre stable)', () => {
    const order = turnOrder([p(7, 5), p(2, 5), p(4, 5)])
    expect(order.map((x) => x.id)).toEqual([2, 4, 7])
    // Même entrée dans un autre ordre → même sortie
    expect(turnOrder([p(4, 5), p(7, 5), p(2, 5)]).map((x) => x.id)).toEqual([2, 4, 7])
  })

  it('ne modifie pas le tableau reçu', () => {
    const input = [p(1, 3), p(2, 9)]
    turnOrder(input)
    expect(input.map((x) => x.id)).toEqual([1, 2])
  })
})

describe('isActive', () => {
  it('garde un joueur à 0 PV (agonie) mais saute un monstre mort', () => {
    expect(isActive(p(1, 5, 'player', 0))).toBe(true)
    expect(isActive(p(2, 5, 'monster', 0))).toBe(false)
    expect(isActive(p(3, 5, 'monster', 1))).toBe(true)
  })

  it('traite les PV null d\'un monstre comme mort', () => {
    expect(isActive(p(1, 5, 'monster', null))).toBe(false)
  })
})

describe('firstActiveId', () => {
  it('prend la meilleure initiative encore debout', () => {
    expect(firstActiveId(turnOrder([p(1, 9, 'monster', 0), p(2, 7), p(3, 3)]))).toBe(2)
  })

  it('renvoie null si tout le monde est à terre', () => {
    expect(firstActiveId([p(1, 9, 'monster', 0)])).toBeNull()
    expect(firstActiveId([])).toBeNull()
  })
})

describe('step', () => {
  // Ordre : 3 (init 9), 1 (init 5), 2 (init 2)
  const order = turnOrder([p(1, 5), p(2, 2), p(3, 9)])

  it('avance au suivant sans boucler', () => {
    expect(step(order, 3, 1)).toEqual({ participantId: 1, wrapped: 0 })
  })

  it('boucle en fin d\'ordre et signale le nouveau round', () => {
    expect(step(order, 2, 1)).toEqual({ participantId: 3, wrapped: 1 })
  })

  it('recule et boucle vers la fin', () => {
    expect(step(order, 1, -1)).toEqual({ participantId: 3, wrapped: 0 })
    expect(step(order, 3, -1)).toEqual({ participantId: 2, wrapped: 1 })
  })

  it('saute les monstres morts', () => {
    const withDead = turnOrder([p(1, 5), p(2, 2, 'monster', 0), p(3, 9)])
    expect(step(withDead, 1, 1)).toEqual({ participantId: 3, wrapped: 1 })
  })

  it('repart du premier actif si le tour courant est inconnu', () => {
    expect(step(order, null, 1)).toEqual({ participantId: 3, wrapped: 0 })
    expect(step(order, 999, 1)).toEqual({ participantId: 3, wrapped: 0 })
  })

  it('tourne sur place quand un seul participant est actif', () => {
    const solo = turnOrder([p(1, 5), p(2, 9, 'monster', 0)])
    expect(step(solo, 1, 1)).toEqual({ participantId: 1, wrapped: 1 })
  })

  it('renvoie null si plus personne n\'est actif', () => {
    expect(step([p(1, 5, 'monster', 0)], 1, 1)).toBeNull()
    expect(step([], null, 1)).toBeNull()
  })
})

describe('le tour ne bouge plus quand la liste change', () => {
  const before = turnOrder([p(1, 5), p(2, 2), p(3, 9)])
  const currentId = 1 // c'est au tour de 1

  it('un renfort de grosse initiative ne vole pas le tour', () => {
    const after = turnOrder([p(1, 5), p(2, 2), p(3, 9), p(4, 20)])
    // L'index bouge…
    expect(turnIndexOf(before, currentId)).toBe(1)
    expect(turnIndexOf(after, currentId)).toBe(2)
    // …mais c'est toujours 1 qui joue.
    expect(after[turnIndexOf(after, currentId)].id).toBe(currentId)
  })

  it('supprimer un monstre au-dessus ne vole pas le tour', () => {
    const after = turnOrder([p(1, 5), p(2, 2)])
    expect(after[turnIndexOf(after, currentId)].id).toBe(currentId)
  })

  it('renvoie -1 quand le tour ne pointe sur personne', () => {
    expect(turnIndexOf(before, null)).toBe(-1)
  })
})

describe('PNJ en réserve (hidden)', () => {
  it("turnOrder les écarte de l'ordre", () => {
    const order = turnOrder([p(1, 5), hidden(2, 20), p(3, 9)])
    expect(order.map((x) => x.id)).toEqual([3, 1])
  })

  it('isActive : un caché est inactif, même vivant et même joueur', () => {
    expect(isActive(hidden(1, 5))).toBe(false)
    expect(isActive({ id: 2, kind: 'player', initiative: 5, hpCurrent: 30, hidden: true })).toBe(false)
  })

  it('firstActiveId saute une réserve de meilleure initiative', () => {
    expect(firstActiveId(turnOrder([hidden(1, 99), p(2, 7)]))).toBe(2)
  })

  it("step ne s'arrête jamais sur un caché resté dans la liste", () => {
    // Liste construite à la main, sans passer par turnOrder : même dans ce cas
    // `step` doit sauter le caché — c'est la ceinture en plus des bretelles.
    const order = [p(3, 9), hidden(2, 8), p(1, 5)]
    expect(step(order, 3, 1)).toEqual({ participantId: 1, wrapped: 0 })
  })

  it('révéler un renfort de grosse initiative ne vole pas le tour', () => {
    const before = turnOrder([p(1, 5), p(3, 9), hidden(4, 20)])
    const currentId = 1
    expect(turnIndexOf(before, currentId)).toBe(1)

    // Le MJ clique sur l'œil : le même participant, plus caché.
    const after = turnOrder([p(1, 5), p(3, 9), p(4, 20)])
    expect(turnIndexOf(after, currentId)).toBe(2) // l'index bouge…
    expect(after[turnIndexOf(after, currentId)].id).toBe(currentId) // …le joueur non
  })

  it('remettre en réserve le participant courant : step trouve le suivant', () => {
    // Ce que fait la route /visibility avant de cacher : on part de l'id qui
    // s'en va, dans l'ordre où il est encore présent.
    const order = turnOrder([p(1, 5), p(2, 8), p(3, 9)])
    expect(step(order, 2, 1)).toEqual({ participantId: 1, wrapped: 0 })
  })

  it('cacher le dernier actif ne laisse personne', () => {
    expect(firstActiveId(turnOrder([hidden(1, 5), hidden(2, 9)]))).toBeNull()
    expect(step(turnOrder([hidden(1, 5)]), null, 1)).toBeNull()
  })
})
