import { describe, it, expect } from 'vitest'
import { ETAT_IDS, ETATS, ETAT_BY_ID, isEtatId, sortEtats, visibleEtats } from './etats'

describe('le catalogue', () => {
  it('a 13 ids uniques', () => {
    expect(ETAT_IDS).toHaveLength(13)
    expect(new Set(ETAT_IDS).size).toBe(13)
  })

  it('a exactement un état par id, dans le même ordre', () => {
    expect(ETATS.map((e) => e.id)).toEqual([...ETAT_IDS])
  })

  it('donne à chaque état un emoji et un effet non vides', () => {
    for (const e of ETATS) {
      expect(e.emoji, e.id).not.toBe('')
      expect(e.effect, e.id).not.toBe('')
      expect(e.label, e.id).not.toBe('')
    }
  })

  it('indexe tous les états dans ETAT_BY_ID', () => {
    expect(Object.keys(ETAT_BY_ID).sort()).toEqual([...ETAT_IDS].sort())
    for (const e of ETATS) expect(ETAT_BY_ID[e.id]).toBe(e)
  })
})

describe('isEtatId', () => {
  it('accepte un id du catalogue', () => {
    for (const id of ETAT_IDS) expect(isEtatId(id)).toBe(true)
  })

  it('rejette tout le reste', () => {
    expect(isEtatId('empoisonne')).toBe(false)
    expect(isEtatId('')).toBe(false)
    expect(isEtatId(3)).toBe(false)
    expect(isEtatId(null)).toBe(false)
    expect(isEtatId(undefined)).toBe(false)
  })
})

describe('sortEtats', () => {
  it('remonte les bloquants en tête', () => {
    const out = sortEtats(['renverse', 'etourdi', 'desarme', 'bloque'])
    expect(out.map((e) => e.id)).toEqual(['etourdi', 'bloque', 'renverse', 'desarme'])
  })

  it("garde l'ordre du catalogue à l'intérieur de chaque groupe", () => {
    // Ordre catalogue : etourdi < paralyse < surpris < bloque (bloquants),
    // puis aveugle < ralenti < menace (non bloquants).
    const out = sortEtats(['menace', 'bloque', 'aveugle', 'surpris', 'ralenti', 'paralyse', 'etourdi'])
    expect(out.map((e) => e.id)).toEqual([
      'etourdi', 'paralyse', 'surpris', 'bloque', 'aveugle', 'ralenti', 'menace',
    ])
  })

  it('dédoublonne', () => {
    expect(sortEtats(['renverse', 'renverse', 'renverse']).map((e) => e.id)).toEqual(['renverse'])
  })

  it('ignore silencieusement les ids inconnus', () => {
    expect(sortEtats(['renverse', 'empoisonne', '', 'enflamme']).map((e) => e.id)).toEqual(['renverse'])
    expect(sortEtats(['nawak'])).toEqual([])
  })

  it('rend une liste vide pour une entrée vide', () => {
    expect(sortEtats([])).toEqual([])
  })
})

describe('visibleEtats', () => {
  it("ne montre rien quand il n'y a aucun état", () => {
    expect(visibleEtats([])).toEqual({ etats: [], overflow: 0 })
  })

  it('ne compte aucun surplus quand il y a exactement max états', () => {
    const { etats, overflow } = visibleEtats(['renverse', 'desarme', 'ralenti'], 3)
    expect(etats).toHaveLength(3)
    expect(overflow).toBe(0)
  })

  it('coupe à max et compte le reste', () => {
    const { etats, overflow } = visibleEtats(['renverse', 'desarme', 'ralenti', 'aveugle'], 3)
    expect(etats).toHaveLength(3)
    expect(overflow).toBe(1)
  })

  it('coupe les 13 états à 3 et en compte 10', () => {
    const { etats, overflow } = visibleEtats([...ETAT_IDS], 3)
    expect(etats).toHaveLength(3)
    expect(overflow).toBe(10)
  })

  it('montre les premiers de sortEtats, donc les bloquants', () => {
    const ids = ['menace', 'renverse', 'etourdi', 'bloque', 'paralyse']
    const { etats } = visibleEtats(ids, 3)
    expect(etats.map((e) => e.id)).toEqual(sortEtats(ids).slice(0, 3).map((e) => e.id))
    expect(etats.every((e) => e.blocking)).toBe(true)
  })

  it('coupe à 3 par défaut', () => {
    expect(visibleEtats([...ETAT_IDS]).etats).toHaveLength(3)
  })
})
