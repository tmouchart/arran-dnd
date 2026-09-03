import { describe, it, expect } from 'vitest'
import { serializeCombat, hpStatus } from './serialize.js'
import { combatParticipants, combats } from '../db/schema.js'

type CombatRow = typeof combats.$inferSelect
type ParticipantRow = typeof combatParticipants.$inferSelect

function combat(overrides: Partial<CombatRow> = {}): CombatRow {
  return {
    id: 1,
    campaignId: 1,
    encounterId: null,
    name: 'Embuscade',
    status: 'active',
    currentParticipantId: null,
    roundNumber: 1,
    environment: 'foret',
    createdAt: new Date('2026-01-01'),
    finishedAt: null,
    ...overrides,
  } as CombatRow
}

function monster(overrides: Partial<ParticipantRow> = {}): ParticipantRow {
  return {
    id: 10,
    combatId: 1,
    kind: 'monster',
    userId: null,
    name: 'Ogre bilieux',
    initiative: 6,
    hpMax: 34,
    hpCurrent: 34,
    def: 15,
    nc: 3,
    statFor: 4, statDex: -1, statCon: 3, statInt: -2, statSag: 0, statCha: -2,
    attacks: [{ name: 'Gourdin', bonus: 6, damage: '2d6+4' }],
    abilities: [{ name: 'Coup ample', description: 'Touche deux cibles.' }],
    monsterDescription: 'Lent, mais on ne le rate pas deux fois.',
    posX: 2,
    posY: -1,
    hidden: false,
    ...overrides,
  } as ParticipantRow
}

function player(overrides: Partial<ParticipantRow> = {}): ParticipantRow {
  return monster({
    id: 20,
    kind: 'player',
    userId: 7,
    name: 'Nym la Vive',
    initiative: 18,
    hpMax: 30,
    hpCurrent: 30,
    nc: null,
    attacks: null,
    abilities: null,
    monsterDescription: null,
    ...overrides,
  })
}

describe('hpStatus', () => {
  it('mappe les PV sur les 5 paliers', () => {
    expect(hpStatus(0, 20)).toBe('mort')
    expect(hpStatus(-5, 20)).toBe('mort')
    expect(hpStatus(20, 20)).toBe('intact')
    expect(hpStatus(16, 20)).toBe('intact')
    expect(hpStatus(15, 20)).toBe('blesse')
    expect(hpStatus(11, 20)).toBe('blesse')
    expect(hpStatus(10, 20)).toBe('mal_en_point')
    expect(hpStatus(6, 20)).toBe('mal_en_point')
    expect(hpStatus(5, 20)).toBe('agonisant')
    expect(hpStatus(1, 20)).toBe('agonisant')
  })
})

describe('serializeCombat — ordre et tour', () => {
  it('trie les participants et dérive currentTurnIndex de l\'id stocké', () => {
    const parts = [monster({ id: 10, initiative: 6 }), player({ id: 20, initiative: 18 })]
    const out = serializeCombat(combat({ currentParticipantId: 10 }), parts, true)

    expect(out.participants.map((p) => p.id)).toEqual([20, 10])
    expect(out.currentTurnIndex).toBe(1)
  })

  it('currentTurnIndex vaut -1 quand le tour ne pointe sur personne', () => {
    const out = serializeCombat(combat({ currentParticipantId: null }), [player()], true)
    expect(out.currentTurnIndex).toBe(-1)
  })

  it('MJ et joueur voient le même ordre et le même tour', () => {
    const parts = [monster({ id: 10, initiative: 6 }), player({ id: 20, initiative: 18 })]
    const asGm = serializeCombat(combat({ currentParticipantId: 10 }), parts, true)
    const asPlayer = serializeCombat(combat({ currentParticipantId: 10 }), parts, false)

    expect(asPlayer.participants.map((p) => p.id)).toEqual(asGm.participants.map((p) => p.id))
    expect(asPlayer.currentTurnIndex).toBe(asGm.currentTurnIndex)
  })
})

describe('serializeCombat — ce qu\'un joueur a le droit de voir', () => {
  it('masque les PV chiffrés et la fiche du monstre', () => {
    const out = serializeCombat(combat(), [monster({ hpCurrent: 12, hpMax: 34 })], false)
    const m = out.participants[0] as Record<string, unknown>

    expect(m.hpCurrent).toBeNull()
    expect(m.hpMax).toBeNull()
    expect(m.hpStatus).toBe('mal_en_point')
    for (const secret of ['nc', 'statFor', 'statDex', 'statCon', 'statInt', 'statSag', 'statCha', 'attacks', 'abilities', 'monsterDescription']) {
      expect(m[secret], `${secret} ne doit pas fuiter`).toBeNull()
    }
  })

  it('laisse passer nom, initiative, défense et position', () => {
    const out = serializeCombat(combat(), [monster()], false)
    const m = out.participants[0] as Record<string, unknown>

    expect(m.name).toBe('Ogre bilieux')
    expect(m.initiative).toBe(6)
    expect(m.def).toBe(15)
    // Sans la position, les joueurs ne verraient pas les monstres sur la carte.
    expect(m.posX).toBe(2)
    expect(m.posY).toBe(-1)
  })

  it('ne masque jamais un personnage joueur', () => {
    const out = serializeCombat(combat(), [player({ hpCurrent: 4 })], false)
    expect(out.participants[0].hpCurrent).toBe(4)
  })

  it('le MJ reçoit la fiche monstre intacte', () => {
    const out = serializeCombat(combat(), [monster({ hpCurrent: 12 })], true)
    const m = out.participants[0] as Record<string, unknown>

    expect(m.hpCurrent).toBe(12)
    expect(m.nc).toBe(3)
    expect(m.attacks).not.toBeNull()
    expect(m.hpStatus).toBeUndefined()
  })
})

describe('serializeCombat — la réserve du MJ', () => {
  const parts = [
    player({ id: 20, initiative: 18 }),
    monster({ id: 10, initiative: 6 }),
    monster({ id: 11, name: 'Sarkan le Brûlé', initiative: 30, hidden: true }),
  ]

  it('un caché est hors de l\'ordre, même avec la meilleure initiative', () => {
    const out = serializeCombat(combat(), parts, true)
    expect(out.participants.map((p) => p.id)).toEqual([20, 10])
  })

  it('le MJ voit sa réserve, en clair', () => {
    const out = serializeCombat(combat(), parts, true)
    expect(out.reserve.map((p) => p.name)).toEqual(['Sarkan le Brûlé'])
    expect(out.reserve[0].hpCurrent).toBe(34)
  })

  it('pour un joueur, la réserve n\'existe pas du tout', () => {
    const out = serializeCombat(combat(), parts, false)

    expect(out.reserve).toEqual([])
    // Aucune trace du caché ailleurs : ni carte grisée, ni nom, ni initiative.
    const leaked = JSON.stringify(out).includes('Sarkan')
    expect(leaked, 'le nom du PNJ caché fuite dans la réponse joueur').toBe(false)
  })

  it('révéler le renfort ne déplace pas le tour courant', () => {
    const current = 10
    const before = serializeCombat(combat({ currentParticipantId: current }), parts, true)
    expect(before.currentTurnIndex).toBe(1)

    const revealed = parts.map((p) => (p.id === 11 ? { ...p, hidden: false } : p))
    const after = serializeCombat(combat({ currentParticipantId: current }), revealed, true)

    // L'index glisse parce que le renfort passe devant…
    expect(after.currentTurnIndex).toBe(2)
    // …mais c'est toujours le même monstre qui joue.
    expect(after.participants[after.currentTurnIndex].id).toBe(current)
  })
})
