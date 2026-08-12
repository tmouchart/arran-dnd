import { describe, it, expect } from 'vitest'
import type express from 'express'
import { applyCharacterHp, broadcastCombatRoll, getClientsForCombat } from './sseStore.js'

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

describe('broadcastCombatRoll', () => {
  const GM_ID = 1
  const PLAYER_ID = 2

  function fakeClient(userId: number) {
    const written: string[] = []
    const res = { write: (chunk: string) => { written.push(chunk); return true } } as unknown as express.Response
    return { client: { res, userId }, written }
  }

  it('sends public rolls to everyone, gm rolls only to the GM', () => {
    const combatId = 991
    const gm = fakeClient(GM_ID)
    const p = fakeClient(PLAYER_ID)
    const clients = getClientsForCombat(combatId)
    clients.add(gm.client)
    clients.add(p.client)

    broadcastCombatRoll(combatId, GM_ID, { visibility: 'public', actorName: 'Thorin' })
    broadcastCombatRoll(combatId, GM_ID, { visibility: 'gm', actorName: 'Gobelin' })

    const gmData = gm.written.join('')
    const playerData = p.written.join('')
    expect(gmData).toContain('Thorin')
    expect(gmData).toContain('Gobelin')
    expect(playerData).toContain('Thorin')
    expect(playerData).not.toContain('Gobelin')

    clients.clear()
  })
})
