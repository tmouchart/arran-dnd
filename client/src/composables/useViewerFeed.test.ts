import { describe, it, expect } from 'vitest'
import { feedLineFor, pushLine, secretLineFor, MAX_FEED, type FeedLine } from './useViewerFeed'
import type { RollEvent } from '../api/campaigns'

function roll(over: Partial<RollEvent> = {}): RollEvent {
  return {
    id: 1, campaignId: 1, combatId: null, userId: 2, actorName: 'Minizou', actorKind: 'player',
    visibility: 'public', kind: 'action', label: 'Boule de feu', context: 'actions',
    die: 17, sides: 20, bonus: 0, total: 17, rolls: null, damage: null, createdAt: '',
    diceColor: '#d64545', ...over,
  }
}

describe('feedLineFor', () => {
  it('garde le nom, le libellé, le total et la couleur', () => {
    const line = feedLineFor(roll())
    expect(line).toMatchObject({ actorName: 'Minizou', label: 'Boule de feu', total: 17, color: '#d64545', secret: false })
    expect(line.outcome).toBeNull()
  })

  it('note le critique et les dégâts', () => {
    const line = feedLineFor(roll({ die: 20, total: 24, damage: { total: 14, critical: true, fumble: false } }))
    expect(line.outcome).toBe('critical')
    expect(line.damage).toBe(14)
  })
})

describe('secretLineFor', () => {
  it('ne porte ni chiffre ni couleur', () => {
    const line = secretLineFor({ outcome: 'critical', actorName: 'Ogre' })
    expect(line.total).toBeNull()
    expect(line.color).toBeUndefined()
    expect(line.secret).toBe(true)
    expect(line.outcome).toBe('critical')
  })
})

describe('pushLine', () => {
  const line = (id: string): FeedLine => ({ ...feedLineFor(roll()), id })

  it('met la nouvelle ligne en tête et oublie les plus vieilles', () => {
    let lines: FeedLine[] = []
    for (let i = 0; i < MAX_FEED + 3; i++) lines = pushLine(lines, line(`l${i}`))
    expect(lines).toHaveLength(MAX_FEED)
    expect(lines[0].id).toBe(`l${MAX_FEED + 2}`)
  })

  it('ignore un doublon', () => {
    const lines = pushLine(pushLine([], line('a')), line('a'))
    expect(lines).toHaveLength(1)
  })
})
