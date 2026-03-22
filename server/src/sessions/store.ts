import type express from 'express'

export interface SessionParticipant {
  userId: number
  username: string
  characterId: number
  characterName: string
  hpCurrent: number
  hpMax: number
  initiative: number | null
}

export interface SessionMonster {
  id: string
  name: string
  hpMax: number
  hpCurrent: number
  initiative: number | null
}

export interface GameSession {
  id: string
  name: string
  gmUserId: number
  participants: Map<number, SessionParticipant>
  monsters: Map<string, SessionMonster>
  createdAt: Date
}

export interface SseClient {
  res: express.Response
  userId: number
}

// ── In-memory stores ──────────────────────────────────────────────────────────

export const sessions = new Map<string, GameSession>()
export const sseClients = new Map<string, Set<SseClient>>()

export function getClientsForSession(sessionId: string): Set<SseClient> {
  if (!sseClients.has(sessionId)) sseClients.set(sessionId, new Set())
  return sseClients.get(sessionId)!
}

// ── State builders ────────────────────────────────────────────────────────────

export interface SessionStateForGm {
  id: string
  name: string
  gmUserId: number
  participants: SessionParticipant[]
  monsters: SessionMonster[]
}

export interface SessionMonsterPublic {
  id: string
  name: string
  initiative: number | null
}

export interface SessionStateForPlayer {
  id: string
  name: string
  gmUserId: number
  participants: SessionParticipant[]
  monsters: SessionMonsterPublic[]
}

export function buildGmState(session: GameSession): SessionStateForGm {
  return {
    id: session.id,
    name: session.name,
    gmUserId: session.gmUserId,
    participants: [...session.participants.values()],
    monsters: [...session.monsters.values()],
  }
}

export function buildPlayerState(session: GameSession): SessionStateForPlayer {
  return {
    id: session.id,
    name: session.name,
    gmUserId: session.gmUserId,
    participants: [...session.participants.values()],
    monsters: [...session.monsters.values()].map(({ id, name, initiative }) => ({
      id,
      name,
      initiative,
    })),
  }
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

function writeSse(res: express.Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export function broadcastToSession(sessionId: string, session: GameSession): void {
  const clients = sseClients.get(sessionId)
  if (!clients) return
  for (const client of clients) {
    const payload =
      client.userId === session.gmUserId
        ? buildGmState(session)
        : buildPlayerState(session)
    writeSse(client.res, 'session-updated', payload)
  }
}
