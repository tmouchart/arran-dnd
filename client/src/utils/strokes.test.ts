import { describe, it, expect } from 'vitest'
import { mergeStrokeLists, mergeStrokes } from './strokes'
import type { Stroke } from '../api/journal'

const s = (id: string, extra: Partial<Stroke> = {}): Stroke => ({
  id,
  points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  color: '#000',
  width: 3,
  eraser: false,
  ...extra,
})

describe('mergeStrokeLists', () => {
  it('garde les traits des deux dessinateurs', () => {
    const merged = mergeStrokeLists([s('a')], [s('b')])
    expect(merged.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('ne duplique pas un trait déjà connu', () => {
    const merged = mergeStrokeLists([s('a'), s('b')], [s('a')])
    expect(merged.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it("propage l'annulation d'un trait venue d'ailleurs", () => {
    const merged = mergeStrokeLists([s('a')], [s('a', { deleted: true })])
    expect(merged[0].deleted).toBe(true)
  })

  it('ne ressuscite pas un trait que j’ai annulé', () => {
    const merged = mergeStrokeLists([s('a', { deleted: true })], [s('a')])
    expect(merged[0].deleted).toBe(true)
  })

  it("ne garde que l'id d'un trait annulé", () => {
    expect(mergeStrokeLists([s('a')], [s('a', { deleted: true })])[0]).toEqual({
      id: 'a',
      deleted: true,
    })
  })

  it('conserve l’ordre local puis ajoute les nouveaux', () => {
    const merged = mergeStrokeLists([s('a'), s('b')], [s('c'), s('b')])
    expect(merged.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('mergeStrokes', () => {
  it('renvoie null quand rien ne change', () => {
    const json = JSON.stringify([s('a')])
    expect(mergeStrokes(json, json)).toBeNull()
  })

  it('renvoie null sur du JSON illisible', () => {
    expect(mergeStrokes('[]', 'pas du json')).toBeNull()
  })

  it('gère une liste locale vide', () => {
    const remote = JSON.stringify([s('a')])
    expect(mergeStrokes('', remote)).toBe(remote)
  })
})
