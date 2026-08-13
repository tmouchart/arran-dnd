import { describe, it, expect } from 'vitest'
import { applyCharacterHp } from './sseStore.js'

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
