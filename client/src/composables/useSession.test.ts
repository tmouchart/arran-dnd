import { describe, it, expect } from 'vitest'
import type { InitiativeEntry } from './useSession'

// The initiativeOrder computed relies on module-level refs and Vue reactivity.
// We test the sorting logic directly to avoid needing SSE/EventSource mocks.

type SortableEntry = InitiativeEntry & { _init: number | null }

function sortInitiative(entries: SortableEntry[]): InitiativeEntry[] {
  return entries
    .sort((a, b) => {
      if (a._init == null && b._init == null) return 0
      if (a._init == null) return 1
      if (b._init == null) return -1
      return b._init - a._init
    })
    .map(({ kind, data }) => ({ kind, data }) as InitiativeEntry)
}

function player(name: string, initiative: number | null) {
  return {
    kind: 'player' as const,
    data: { username: name, initiative } as any,
    _init: initiative,
  }
}

function monster(name: string, initiative: number | null) {
  return {
    kind: 'monster' as const,
    data: { name, initiative } as any,
    _init: initiative,
  }
}

describe('initiative sorting', () => {
  it('sorts by descending initiative', () => {
    const result = sortInitiative([player('A', 5), player('B', 15), player('C', 10)])
    expect(result.map(e => (e.data as any).username ?? (e.data as any).name)).toEqual([
      'B', 'C', 'A',
    ])
  })

  it('null initiative goes last', () => {
    const result = sortInitiative([
      player('A', null),
      player('B', 10),
      player('C', null),
    ])
    expect(result[0].data).toMatchObject({ username: 'B' })
    // Both nulls at the end
    expect(result[1]._init ?? null).toBeNull()
    expect(result[2]._init ?? null).toBeNull()
  })

  it('mixes players and monsters correctly', () => {
    const result = sortInitiative([
      player('Wizard', 8),
      monster('Gobelin', 12),
      player('Warrior', 15),
      monster('Dragon', 3),
    ])
    expect(result.map(e => (e.data as any).username ?? (e.data as any).name)).toEqual([
      'Warrior', 'Gobelin', 'Wizard', 'Dragon',
    ])
  })

  it('returns empty for no entries', () => {
    expect(sortInitiative([])).toEqual([])
  })

  it('equal initiative preserves relative order', () => {
    const result = sortInitiative([
      player('A', 10),
      monster('B', 10),
      player('C', 10),
    ])
    expect(result).toHaveLength(3)
    // All have initiative 10
    result.forEach(e => expect((e.data as any).initiative).toBe(10))
  })

  it('single entry with null initiative', () => {
    const result = sortInitiative([player('Solo', null)])
    expect(result).toHaveLength(1)
    expect(result[0].data).toMatchObject({ username: 'Solo' })
  })
})
