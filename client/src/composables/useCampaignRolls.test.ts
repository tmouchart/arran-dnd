import { describe, it, expect } from 'vitest'
import { filterRolls } from './useCampaignRolls'
import type { RollEvent } from '../api/campaigns'

function roll(over: Partial<RollEvent>): RollEvent {
  return {
    id: 1, campaignId: 1, combatId: null, userId: 1,
    actorName: 'Thorin', actorKind: 'player', visibility: 'public',
    kind: 'weapon', label: 'Épée', context: 'actions',
    die: 12, sides: 20, bonus: 3, total: 15, rolls: null, damage: null,
    createdAt: '2026-08-13T10:00:00Z',
    ...over,
  }
}

const list = [
  roll({ id: 1, combatId: null, actorKind: 'player' }),
  roll({ id: 2, combatId: 7, actorKind: 'player' }),
  roll({ id: 3, combatId: 7, actorKind: 'monster', visibility: 'gm' }),
]

describe('filterRolls', () => {
  it('renvoie tout par défaut', () => {
    expect(filterRolls(list, 'all')).toHaveLength(3)
  })

  it('« combat » ne garde que les jets taggés avec un combat', () => {
    expect(filterRolls(list, 'combat').map((r) => r.id)).toEqual([2, 3])
  })

  it('« PJ » exclut les jets de monstres', () => {
    expect(filterRolls(list, 'player').map((r) => r.id)).toEqual([1, 2])
  })

  it('« PNJ » ne garde que les jets de monstres', () => {
    expect(filterRolls(list, 'monster').map((r) => r.id)).toEqual([3])
  })

  it('ne mute pas la liste source', () => {
    filterRolls(list, 'combat')
    expect(list).toHaveLength(3)
  })
})
