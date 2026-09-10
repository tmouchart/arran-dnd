import { describe, it, expect } from 'vitest'
import { sanitizeObstacles } from './obstacles.js'

const wall = (id: string) => ({
  id,
  points: [
    { x: 0, z: 0 },
    { x: 1, z: 1 },
  ],
})

describe('sanitizeObstacles', () => {
  it('laisse passer une liste correcte', () => {
    expect(sanitizeObstacles([wall('a')])).toEqual([wall('a')])
  })

  it('accepte une liste vide (le MJ a tout effacé)', () => {
    expect(sanitizeObstacles([])).toEqual([])
  })

  it('ramène les points dans la grille', () => {
    const out = sanitizeObstacles([{ id: 'a', points: [{ x: 99, z: -99 }, { x: 0, z: 0 }] }])
    expect(out?.[0].points[0]).toEqual({ x: 6, z: -6 })
  })

  it('refuse ce qui n’est pas une liste', () => {
    expect(sanitizeObstacles(null)).toBeNull()
    expect(sanitizeObstacles({ id: 'a' })).toBeNull()
    expect(sanitizeObstacles('a')).toBeNull()
  })

  it('refuse un mur sans id exploitable', () => {
    expect(sanitizeObstacles([{ points: wall('a').points }])).toBeNull()
    expect(sanitizeObstacles([{ id: '', points: wall('a').points }])).toBeNull()
    expect(sanitizeObstacles([{ id: 'x'.repeat(65), points: wall('a').points }])).toBeNull()
  })

  it('refuse un mur qui n’a pas au moins deux points', () => {
    expect(sanitizeObstacles([{ id: 'a', points: [{ x: 0, z: 0 }] }])).toBeNull()
    expect(sanitizeObstacles([{ id: 'a', points: [] }])).toBeNull()
  })

  it('refuse des coordonnées qui n’en sont pas', () => {
    expect(sanitizeObstacles([{ id: 'a', points: [{ x: 'nord', z: 0 }, { x: 1, z: 1 }] }])).toBeNull()
    expect(sanitizeObstacles([{ id: 'a', points: [{ x: NaN, z: 0 }, { x: 1, z: 1 }] }])).toBeNull()
    expect(sanitizeObstacles([{ id: 'a', points: [{ x: Infinity, z: 0 }, { x: 1, z: 1 }] }])).toBeNull()
  })

  it('refuse une liste trop longue', () => {
    const many = Array.from({ length: 41 }, (_, i) => wall(String(i)))
    expect(sanitizeObstacles(many)).toBeNull()
  })

  it('refuse un mur avec trop de points', () => {
    const points = Array.from({ length: 201 }, (_, i) => ({ x: i * 0.01, z: 0 }))
    expect(sanitizeObstacles([{ id: 'a', points }])).toBeNull()
  })
})

describe('sanitizeObstacles — le matériau', () => {
  it('laisse passer un matériau valide', () => {
    const out = sanitizeObstacles([{ ...wall('a'), material: 'brique' }])
    expect(out?.[0].material).toBe('brique')
  })

  it('accepte un mur sans matériau (les murs d’avant la palette)', () => {
    const out = sanitizeObstacles([wall('a')])
    expect(out?.[0].material).toBeUndefined()
  })

  it('refuse un matériau qui n’est pas un id', () => {
    expect(sanitizeObstacles([{ ...wall('a'), material: 'Brique 2' }])).toBeNull()
    expect(sanitizeObstacles([{ ...wall('a'), material: 42 }])).toBeNull()
    expect(sanitizeObstacles([{ ...wall('a'), material: 'x'.repeat(41) }])).toBeNull()
  })
})
