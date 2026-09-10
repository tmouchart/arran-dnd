import { describe, it, expect } from 'vitest'
import { membresAbsents } from './combatRoster'
import type { CampaignMember } from '../api/campaigns'
import type { CombatParticipant } from '../api/combats'

function membre(userId: number, characterId: number | null): CampaignMember {
  return {
    userId,
    username: `joueur${userId}`,
    avatarUrl: null,
    characterId,
    characterName: characterId ? `perso${characterId}` : null,
    portraitUrl: null,
    joinedAt: '',
  }
}

function participant(kind: 'player' | 'monster', userId: number | null): CombatParticipant {
  return { kind, userId } as CombatParticipant
}

describe('membresAbsents', () => {
  it('garde le membre qui a une fiche et qui ne combat pas', () => {
    const out = membresAbsents([membre(1, 10)], [])
    expect(out.map((m) => m.userId)).toEqual([1])
  })

  it('écarte celui qui est déjà dans le combat', () => {
    const out = membresAbsents([membre(1, 10), membre(2, 20)], [participant('player', 1)])
    expect(out.map((m) => m.userId)).toEqual([2])
  })

  it('écarte le membre sans personnage', () => {
    expect(membresAbsents([membre(1, null)], [])).toEqual([])
  })

  it('ne confond pas un monstre avec un joueur', () => {
    const out = membresAbsents([membre(1, 10)], [participant('monster', null)])
    expect(out.map((m) => m.userId)).toEqual([1])
  })

  it('rend une liste vide quand tout le monde est là', () => {
    const out = membresAbsents([membre(1, 10)], [participant('player', 1)])
    expect(out).toEqual([])
  })
})
