import { describe, it, expect, beforeEach } from 'vitest'
import {
  sessions,
  sseClients,
  buildGmState,
  buildPlayerState,
  syncParticipantHpFromCharacter,
} from './store'
import type { GameSession, SessionParticipant, SessionMonster } from './store'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeParticipant(overrides: Partial<SessionParticipant> = {}): SessionParticipant {
  return {
    userId: 1,
    username: 'Aragorn',
    characterId: 10,
    characterName: 'Aragorn le Rôdeur',
    hpCurrent: 20,
    hpMax: 30,
    initiative: null,
    ...overrides,
  }
}

function makeMonster(overrides: Partial<SessionMonster> = {}): SessionMonster {
  return {
    id: 'monster-1',
    name: 'Gobelin',
    hpMax: 12,
    hpCurrent: 12,
    initiative: 8,
    ...overrides,
  }
}

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 'session-abc',
    name: 'La Forêt Maudite',
    gmUserId: 99,
    participants: new Map(),
    monsters: new Map(),
    createdAt: new Date(),
    ...overrides,
  }
}

// ── buildGmState ──────────────────────────────────────────────────────────────

describe('buildGmState', () => {
  it('retourne les participants sous forme de tableau', () => {
    const p1 = makeParticipant({ userId: 1 })
    const p2 = makeParticipant({ userId: 2, username: 'Legolas' })
    const session = makeSession({ participants: new Map([[1, p1], [2, p2]]) })

    const state = buildGmState(session)

    expect(state.participants).toHaveLength(2)
    expect(state.participants).toContain(p1)
    expect(state.participants).toContain(p2)
  })

  it('expose les HP des monstres au MJ', () => {
    const monster = makeMonster({ hpCurrent: 5, hpMax: 12 })
    const session = makeSession({ monsters: new Map([['monster-1', monster]]) })

    const state = buildGmState(session)

    expect(state.monsters[0]).toMatchObject({ hpCurrent: 5, hpMax: 12 })
  })

  it('conserve les infos de base de la session', () => {
    const session = makeSession({ id: 'xyz', name: 'Donjon', gmUserId: 42 })

    const state = buildGmState(session)

    expect(state.id).toBe('xyz')
    expect(state.name).toBe('Donjon')
    expect(state.gmUserId).toBe(42)
  })
})

// ── buildPlayerState ──────────────────────────────────────────────────────────

describe('buildPlayerState', () => {
  it('cache les HP des monstres aux joueurs', () => {
    const monster = makeMonster({ hpCurrent: 3, hpMax: 12 })
    const session = makeSession({ monsters: new Map([['monster-1', monster]]) })

    const state = buildPlayerState(session)

    expect(state.monsters[0]).not.toHaveProperty('hpCurrent')
    expect(state.monsters[0]).not.toHaveProperty('hpMax')
  })

  it('expose initiative et nom des monstres aux joueurs', () => {
    const monster = makeMonster({ name: 'Gobelin', initiative: 8 })
    const session = makeSession({ monsters: new Map([['monster-1', monster]]) })

    const state = buildPlayerState(session)

    expect(state.monsters[0]).toMatchObject({ id: 'monster-1', name: 'Gobelin', initiative: 8 })
  })

  it('expose les participants avec leurs HP', () => {
    const p = makeParticipant({ hpCurrent: 15, hpMax: 30 })
    const session = makeSession({ participants: new Map([[1, p]]) })

    const state = buildPlayerState(session)

    expect(state.participants[0]).toMatchObject({ hpCurrent: 15, hpMax: 30 })
  })
})

// ── syncParticipantHpFromCharacter ────────────────────────────────────────────

describe('syncParticipantHpFromCharacter', () => {
  beforeEach(() => {
    sessions.clear()
    sseClients.clear()
  })

  it('met à jour hpCurrent et hpMax dans la session', () => {
    const participant = makeParticipant({ userId: 1, characterId: 10, hpCurrent: 20, hpMax: 30 })
    const session = makeSession({ participants: new Map([[1, participant]]) })
    sessions.set(session.id, session)

    syncParticipantHpFromCharacter(10, 1, 18, 30)

    expect(participant.hpCurrent).toBe(18)
    expect(participant.hpMax).toBe(30)
  })

  it('clamp hpCurrent à 0 si valeur négative', () => {
    const participant = makeParticipant({ userId: 1, characterId: 10, hpCurrent: 5, hpMax: 20 })
    const session = makeSession({ participants: new Map([[1, participant]]) })
    sessions.set(session.id, session)

    syncParticipantHpFromCharacter(10, 1, -5, 20)

    expect(participant.hpCurrent).toBe(0)
  })

  it('clamp hpCurrent à hpMax si valeur trop haute', () => {
    const participant = makeParticipant({ userId: 1, characterId: 10, hpCurrent: 10, hpMax: 20 })
    const session = makeSession({ participants: new Map([[1, participant]]) })
    sessions.set(session.id, session)

    syncParticipantHpFromCharacter(10, 1, 999, 20)

    expect(participant.hpCurrent).toBe(20)
  })

  it("ignore les sessions où le personnage n'est pas présent", () => {
    const participant = makeParticipant({ userId: 1, characterId: 99 }) // characterId différent
    const session = makeSession({ participants: new Map([[1, participant]]) })
    sessions.set(session.id, session)

    syncParticipantHpFromCharacter(10, 1, 5, 20) // characterId 10 ≠ 99

    expect(participant.hpCurrent).toBe(20) // inchangé
  })

  it('fonctionne sur plusieurs sessions en parallèle', () => {
    const p1 = makeParticipant({ userId: 1, characterId: 10, hpCurrent: 20, hpMax: 30 })
    const p2 = makeParticipant({ userId: 1, characterId: 10, hpCurrent: 15, hpMax: 30 })
    const s1 = makeSession({ id: 's1', participants: new Map([[1, p1]]) })
    const s2 = makeSession({ id: 's2', participants: new Map([[1, p2]]) })
    sessions.set('s1', s1)
    sessions.set('s2', s2)

    syncParticipantHpFromCharacter(10, 1, 25, 30)

    expect(p1.hpCurrent).toBe(25)
    expect(p2.hpCurrent).toBe(25)
  })
})
