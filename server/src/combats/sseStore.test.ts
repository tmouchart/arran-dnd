import { describe, it, expect } from 'vitest'
import { applyCharacterHp, getClientsForCombat, releaseClient, type SseClient } from './sseStore.js'

type P = { kind: string; userId: number | null; hpCurrent: number; hpMax: number; name: string }

const player = (userId: number, hpCurrent: number, hpMax: number, name = 'Hero'): P =>
  ({ kind: 'player', userId, hpCurrent, hpMax, name })
const monster = (hpCurrent: number, hpMax: number, name = 'Gobelin'): P =>
  ({ kind: 'monster', userId: null, hpCurrent, hpMax, name })

describe('applyCharacterHp', () => {
  it('overrides player HP with the live character value', () => {
    const out = applyCharacterHp([player(1, 10, 10)], new Map([[1, { hpCurrent: 3, hpMax: 12 }]]))
    expect(out[0].hpCurrent).toBe(3)
    expect(out[0].hpMax).toBe(12)
  })

  it('leaves monsters untouched', () => {
    const m = monster(5, 8)
    const out = applyCharacterHp([m], new Map([[1, { hpCurrent: 3, hpMax: 12 }]]))
    expect(out[0]).toEqual(m)
  })

  it('leaves players without a mapped character untouched', () => {
    const p = player(2, 7, 7)
    const out = applyCharacterHp([p], new Map([[1, { hpCurrent: 3, hpMax: 12 }]]))
    expect(out[0].hpCurrent).toBe(7)
    expect(out[0].hpMax).toBe(7)
  })

  it('does not mutate the input participants', () => {
    const p = player(1, 10, 10)
    applyCharacterHp([p], new Map([[1, { hpCurrent: 1, hpMax: 10 }]]))
    expect(p.hpCurrent).toBe(10)
  })

  it('preserves other fields when overriding', () => {
    const out = applyCharacterHp([player(1, 10, 10, 'Aragorn')], new Map([[1, { hpCurrent: 4, hpMax: 10 }]]))
    expect(out[0].name).toBe('Aragorn')
    expect(out[0].kind).toBe('player')
  })
})

describe('le registre des clients SSE', () => {
  // Un id par test : la table est un singleton de module.
  let nextCombat = 9000
  const combatId = () => ++nextCombat
  const client = (userId: number): SseClient =>
    ({ userId, res: { write: () => true } } as unknown as SseClient)

  it('retient les clients d’un combat', () => {
    const id = combatId()
    const a = client(1)
    getClientsForCombat(id).add(a)
    expect(getClientsForCombat(id).has(a)).toBe(true)
  })

  it('sépare deux combats', () => {
    const [x, y] = [combatId(), combatId()]
    const a = client(1)
    getClientsForCombat(x).add(a)
    expect(getClientsForCombat(y).size).toBe(0)
  })

  it('retire un client sans toucher aux autres', () => {
    const id = combatId()
    const [a, b] = [client(1), client(2)]
    getClientsForCombat(id).add(a).add(b)
    releaseClient(id, a)
    expect([...getClientsForCombat(id)]).toEqual([b])
  })

  it('oublie le combat quand le dernier client part', () => {
    // Sans ça la table gardait une entrée par combat, pour la vie du process.
    // On le prouve par l'identité : l'entrée ayant été supprimée, l'appel
    // suivant reconstruit un Set neuf au lieu de rendre l'ancien.
    const id = combatId()
    const a = client(1)
    const before = getClientsForCombat(id)
    before.add(a)
    releaseClient(id, a)
    expect(getClientsForCombat(id)).not.toBe(before)
  })

  it('garde le combat tant qu’il reste quelqu’un', () => {
    const id = combatId()
    const [a, b] = [client(1), client(2)]
    const set = getClientsForCombat(id)
    set.add(a).add(b)
    releaseClient(id, a)
    expect(getClientsForCombat(id)).toBe(set)
  })

  it('ne casse pas sur un combat inconnu ou un client déjà parti', () => {
    const id = combatId()
    expect(() => releaseClient(id, client(1))).not.toThrow()
    const a = client(1)
    getClientsForCombat(id).add(a)
    releaseClient(id, a)
    expect(() => releaseClient(id, a)).not.toThrow()
  })
})
