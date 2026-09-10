import { describe, it, expect } from 'vitest'
import { rollDetailParts } from './rollDetail'

describe('rollDetailParts', () => {
  it('un jet simple : le dé et son bonus', () => {
    expect(rollDetailParts({ die: 14, sides: 20, bonus: 3 })).toEqual({
      label: 'd20',
      kept: [14],
      dropped: [],
      bonus: 3,
    })
  })

  it("un bonus nul reste à 0 — c'est à l'affichage de l'omettre", () => {
    expect(rollDetailParts({ die: 14, sides: 20, bonus: 0 }).bonus).toBe(0)
  })

  it('plusieurs dés qui comptent : ils sont tous gardés', () => {
    expect(rollDetailParts({ die: 4, sides: 6, bonus: 0, rolls: [4, 2, 5] })).toEqual({
      label: '3d6',
      kept: [4, 2, 5],
      dropped: [],
      bonus: 0,
    })
  })

  it('un seul dé dans rolls reste un jet simple', () => {
    const parts = rollDetailParts({ die: 17, sides: 20, bonus: 2, rolls: [17] })
    expect(parts.label).toBe('d20')
    expect(parts.kept).toEqual([17])
  })

  it('avantage : le dé gardé, puis le dé écarté', () => {
    expect(rollDetailParts({ die: 17, sides: 20, bonus: 3, dropped: [4] })).toEqual({
      label: 'd20',
      kept: [17],
      dropped: [4],
      bonus: 3,
    })
  })

  it('dropped vide, null ou absent donnent le même résultat', () => {
    const base = { die: 12, sides: 20, bonus: 1 }
    const absent = rollDetailParts(base)
    expect(rollDetailParts({ ...base, dropped: [] })).toEqual(absent)
    expect(rollDetailParts({ ...base, dropped: null })).toEqual(absent)
    expect(rollDetailParts({ ...base, rolls: null })).toEqual(absent)
  })
})
