import { describe, it, expect } from 'vitest'
import {
  COALESCE_WINDOW_MS,
  MASS_DELETION_MIN_LOSS,
  isMassDeletion,
  maxRevisionsFor,
  revisionsToPrune,
  shouldCoalesce,
  snapshotSize,
  snapshotsEqual,
  type LastRevision,
} from './coalesce.js'

const NOW = 1_700_000_000_000

function last(over: Partial<LastRevision> = {}): LastRevision {
  return {
    authorUserId: 1,
    createdAt: new Date(NOW - 30_000),
    kind: 'edit',
    size: 1000,
    ...over,
  }
}

describe('snapshotSize', () => {
  it('additionne tous les champs versionnés', () => {
    expect(snapshotSize({ name: 'abc', description: 'de' })).toBe(5)
  })

  it('vaut 0 pour un snapshot vide', () => {
    expect(snapshotSize({})).toBe(0)
    expect(snapshotSize({ content: '' })).toBe(0)
  })
})

describe('snapshotsEqual', () => {
  it('compare champ par champ', () => {
    expect(snapshotsEqual({ content: 'a' }, { content: 'a' })).toBe(true)
    expect(snapshotsEqual({ content: 'a' }, { content: 'b' })).toBe(false)
  })

  it('traite un champ absent comme une chaîne vide', () => {
    expect(snapshotsEqual({ content: 'a' }, { content: 'a', title: '' })).toBe(true)
    expect(snapshotsEqual({ content: 'a' }, { content: 'a', title: 'x' })).toBe(false)
  })
})

describe('isMassDeletion', () => {
  it('détecte un Ctrl+A sur un long texte', () => {
    expect(isMassDeletion(2000, 0)).toBe(true)
  })

  it('ignore une petite suppression, même si elle vide tout', () => {
    // Perte de 50 caractères : sous le seuil absolu, on regroupe normalement.
    expect(isMassDeletion(50, 0)).toBe(false)
  })

  it('applique le seuil absolu à la limite', () => {
    expect(isMassDeletion(MASS_DELETION_MIN_LOSS - 1, 0)).toBe(false)
    expect(isMassDeletion(MASS_DELETION_MIN_LOSS, 0)).toBe(true)
  })

  it("ignore une coupe qui laisse plus de la moitié du texte", () => {
    // 1000 → 600 : grosse perte absolue, mais le texte reste majoritaire.
    expect(isMassDeletion(1000, 600)).toBe(false)
  })

  it('déclenche dès que le texte passe sous la moitié', () => {
    expect(isMassDeletion(1000, 400)).toBe(true)
  })

  it("ne déclenche jamais quand le texte grossit", () => {
    expect(isMassDeletion(100, 5000)).toBe(false)
  })
})

describe('shouldCoalesce', () => {
  it("crée une révision quand il n'y a pas d'historique", () => {
    expect(shouldCoalesce(null, { authorUserId: 1, size: 100 }, NOW)).toBe(false)
  })

  it('regroupe deux écritures rapprochées du même auteur', () => {
    expect(shouldCoalesce(last(), { authorUserId: 1, size: 1100 }, NOW)).toBe(true)
  })

  it("ne regroupe jamais deux auteurs différents", () => {
    expect(shouldCoalesce(last({ authorUserId: 2 }), { authorUserId: 1, size: 1100 }, NOW)).toBe(false)
  })

  it('ouvre une nouvelle révision passé la fenêtre de regroupement', () => {
    const old = last({ createdAt: new Date(NOW - COALESCE_WINDOW_MS) })
    expect(shouldCoalesce(old, { authorUserId: 1, size: 1100 }, NOW)).toBe(false)
  })

  it('regroupe encore juste avant la fin de la fenêtre', () => {
    const almost = last({ createdAt: new Date(NOW - COALESCE_WINDOW_MS + 1) })
    expect(shouldCoalesce(almost, { authorUserId: 1, size: 1100 }, NOW)).toBe(true)
  })

  it("n'absorbe jamais un point de restauration existant", () => {
    expect(shouldCoalesce(last({ kind: 'restore' }), { authorUserId: 1, size: 1100 }, NOW)).toBe(false)
  })

  it("ne noie jamais une restauration dans la révision précédente", () => {
    expect(shouldCoalesce(last(), { authorUserId: 1, size: 1100, kind: 'restore' }, NOW)).toBe(false)
  })

  it('fige la version précédente en cas de Ctrl+A', () => {
    // Le cas qui a motivé la feature : sans ça, le texte d'avant est écrasé.
    expect(shouldCoalesce(last({ size: 2000 }), { authorUserId: 1, size: 0 }, NOW)).toBe(false)
  })
})

describe('revisionsToPrune', () => {
  it('ne supprime rien tant que la limite n\'est pas atteinte', () => {
    expect(revisionsToPrune([3, 2, 1], 50)).toEqual([])
  })

  it('supprime les plus anciennes au-delà de la limite', () => {
    expect(revisionsToPrune([5, 4, 3, 2, 1], 3)).toEqual([2, 1])
  })

  it('garde toujours au moins une révision', () => {
    expect(revisionsToPrune([2, 1], 0)).toEqual([1])
  })
})

describe('maxRevisionsFor', () => {
  it('garde moins de versions pour les dessins, plus lourds', () => {
    expect(maxRevisionsFor(true)).toBeLessThan(maxRevisionsFor(false))
  })
})
