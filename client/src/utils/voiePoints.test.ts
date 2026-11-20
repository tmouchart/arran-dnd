import { describe, it, expect } from 'vitest'
import { incrementCost, isPrestigePath, rankCost, spentPoints } from './voiePoints'
import type { PathRow } from '../types/character'

const path = (id: string, rank: number, kind?: PathRow['kind']): PathRow => ({ id, name: id, rank, kind })

describe('rankCost', () => {
  it('voie normale : 1-1-2-2-2', () => {
    expect([0, 1, 2, 3, 4, 5].map((r) => rankCost(r, false))).toEqual([0, 1, 2, 4, 6, 8])
  })

  it('voie de prestige : 2 points par rang, rangs 1 et 2 compris', () => {
    expect([0, 1, 2, 3, 4, 5].map((r) => rankCost(r, true))).toEqual([0, 2, 4, 6, 8, 10])
  })
})

describe('incrementCost', () => {
  it('le rang 2 coûte 1 point en voie normale, 2 en prestige', () => {
    expect(incrementCost(1, false)).toBe(1)
    expect(incrementCost(1, true)).toBe(2)
  })

  it('le rang 1 de prestige coûte 2 points', () => {
    expect(incrementCost(0, true)).toBe(2)
  })
})

describe('spentPoints', () => {
  it('additionne voies normales, de peuple et de prestige avec leur propre coût', () => {
    const paths = [
      path('peuple-nain', 2, 'peuple'), // 2
      path('voie-du-pugilat', 5), // 8
      path('voie-du-dogme-de-pierre', 2), // prestige : 4
    ]
    expect(spentPoints(paths)).toBe(14)
  })
})

describe('isPrestigePath', () => {
  it('reconnaît une voie de prestige et pas une voie de profil', () => {
    expect(isPrestigePath(path('voie-des-arcanes', 1))).toBe(true)
    expect(isPrestigePath(path('voie-du-pugilat', 1))).toBe(false)
    expect(isPrestigePath({ name: 'Voie maison', rank: 1 })).toBe(false)
  })
})
