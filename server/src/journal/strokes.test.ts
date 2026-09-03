import { describe, it, expect } from 'vitest'
import { mergeStrokeLists, mergeStrokesJson, type Stroke } from './strokes.js'

const s = (id: string, extra: Partial<Stroke> = {}): Stroke => ({ id, color: '#000', ...extra })

describe('mergeStrokeLists', () => {
  it('garde les traits des deux dessinateurs', () => {
    expect(mergeStrokeLists([s('a')], [s('b')]).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('ne perd pas un trait absent de la copie périmée du client', () => {
    // Le cas qui effaçait le dessin des autres : B envoie une liste où le
    // trait de A n'existe pas encore.
    expect(mergeStrokeLists([s('a'), s('b')], [s('b'), s('c')]).map((x) => x.id))
      .toEqual(['a', 'b', 'c'])
  })

  it('propage une annulation', () => {
    expect(mergeStrokeLists([s('a')], [s('a', { deleted: true })])[0].deleted).toBe(true)
  })

  it('ne ressuscite pas un trait déjà annulé', () => {
    expect(mergeStrokeLists([s('a', { deleted: true })], [s('a')])[0].deleted).toBe(true)
  })

  it("ne garde que l'id d'un trait annulé", () => {
    const merged = mergeStrokeLists([s('a', { points: [1, 2, 3] })], [s('a', { deleted: true })])
    expect(merged[0]).toEqual({ id: 'a', deleted: true })
  })

  it('ignore les entrées sans id', () => {
    const merged = mergeStrokeLists([s('a')], [{ color: '#fff' } as Stroke])
    expect(merged.map((x) => x.id)).toEqual(['a'])
  })
})

describe('mergeStrokesJson', () => {
  it('fusionne deux listes JSON', () => {
    const out = JSON.parse(mergeStrokesJson(JSON.stringify([s('a')]), JSON.stringify([s('b')])))
    expect(out.map((x: Stroke) => x.id)).toEqual(['a', 'b'])
  })

  it('accepte une base vide', () => {
    const incoming = JSON.stringify([s('a')])
    expect(mergeStrokesJson('', incoming)).toBe(incoming)
  })

  it("garde l'entrant si la base est illisible", () => {
    const incoming = JSON.stringify([s('a')])
    expect(mergeStrokesJson('pas du json', incoming)).toBe(incoming)
  })
})
