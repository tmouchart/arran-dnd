import { describe, it, expect } from 'vitest'
import { buildTokens, isOnMap, isDeadMonster, HERO_COLORS } from './tokens'
import type { CombatParticipant } from '../../api/combats'

function p(over: Partial<CombatParticipant>): CombatParticipant {
  return {
    id: 1, combatId: 1, kind: 'monster', userId: null, name: 'X',
    initiative: 0, def: 10, hpMax: 10, hpCurrent: 10, hpStatus: null,
    posX: null, posY: null, hidden: false,
    ...over,
  } as CombatParticipant
}

describe('isDeadMonster / isOnMap', () => {
  it('sort un monstre mort de la carte, garde le joueur à 0 PV', () => {
    expect(isOnMap(p({ kind: 'monster', hpCurrent: 0 }))).toBe(false)
    expect(isOnMap(p({ kind: 'player', hpCurrent: 0 }))).toBe(true)
  })

  it('croit le statut qualitatif quand les PV sont masqués', () => {
    expect(isDeadMonster(p({ hpCurrent: null, hpStatus: 'mort' }))).toBe(true)
    expect(isDeadMonster(p({ hpCurrent: null, hpStatus: 'agonisant' }))).toBe(false)
  })

  it('cache un PNJ en réserve', () => {
    expect(isOnMap(p({ hidden: true }))).toBe(false)
  })
})

describe('buildTokens', () => {
  const heroes = [
    p({ id: 3, kind: 'player', name: 'A', posX: 1, posY: 2 }),
    p({ id: 7, kind: 'player', name: 'B', posX: 0, posY: 2 }),
  ]

  it('reprend la position envoyée par le serveur', () => {
    const [a] = buildTokens(heroes)
    expect([a.x, a.z]).toEqual([1, 2])
  })

  it('garde la couleur d’un héros quand un monstre meurt', () => {
    const before = buildTokens([...heroes, p({ id: 5, hpCurrent: 10 })])
    const after = buildTokens([...heroes, p({ id: 5, hpCurrent: 0 })])
    const colorOf = (list: ReturnType<typeof buildTokens>, id: string) =>
      list.find((t) => t.id === id)!.color
    expect(colorOf(before, '7')).toBe(colorOf(after, '7'))
    expect(after.some((t) => t.id === '5')).toBe(false)
  })

  it('garde la couleur et la case de repli quand un PNJ entre en scène', () => {
    const m1 = p({ id: 20, initiative: 1 })
    const m2 = p({ id: 21, initiative: 99, hidden: true })
    const before = buildTokens([m1, m2])
    const after = buildTokens([m1, { ...m2, hidden: false }])
    const t = (list: ReturnType<typeof buildTokens>) => list.find((x) => x.id === '20')!
    expect(t(after).color).toBe(t(before).color)
    expect([t(after).x, t(after).z]).toEqual([t(before).x, t(before).z])
  })

  it('donne des couleurs différentes aux héros et ne dépend pas de l’ordre reçu', () => {
    const a = buildTokens(heroes)
    const b = buildTokens([...heroes].reverse())
    expect(a.map((t) => [t.id, t.color]).sort()).toEqual(b.map((t) => [t.id, t.color]).sort())
    expect(a[0].color).toBe(HERO_COLORS[0])
    expect(a[1].color).toBe(HERO_COLORS[1])
  })

  it('pose les pions non placés dans la grille', () => {
    const many = Array.from({ length: 30 }, (_, i) => p({ id: i + 1 }))
    for (const t of buildTokens(many)) {
      expect(Math.abs(t.x)).toBeLessThanOrEqual(6)
      expect(Math.abs(t.z)).toBeLessThanOrEqual(6)
    }
  })

  it('n’affiche pas de barre de PV quand le serveur les masque', () => {
    const [t] = buildTokens([p({ id: 9, hpCurrent: null, hpMax: null })])
    expect(t.hp).toBeUndefined()
    expect(t.hpMax).toBeUndefined()
  })
})
