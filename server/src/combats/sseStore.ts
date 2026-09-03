import type express from 'express'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { combats, combatParticipants, campaigns, campaignMembers, characters } from '../db/schema.js'
import { serializeCombat } from './serialize.js'

type ParticipantRow = typeof combatParticipants.$inferSelect

/**
 * Pure transformation: override each player participant's hpCurrent/hpMax with the
 * live value from their character. Monsters and players without a character are
 * returned untouched. Exported for unit testing.
 */
export function applyCharacterHp<T extends { kind: string; userId: number | null; hpCurrent: number | null; hpMax: number | null }>(
  participants: T[],
  hpByUserId: Map<number, { hpCurrent: number; hpMax: number }>,
): T[] {
  return participants.map((p) => {
    if (p.kind !== 'player' || p.userId == null) return p
    const hp = hpByUserId.get(p.userId)
    if (!hp) return p
    return { ...p, hpCurrent: hp.hpCurrent, hpMax: hp.hpMax }
  })
}

/**
 * Player HP is owned by the character sheet (single source of truth), not by the
 * combat snapshot. Override each player participant's hpCurrent/hpMax with the live
 * value from their character. Monsters are returned untouched.
 */
export async function enrichParticipantHp(
  campaignId: number,
  participants: ParticipantRow[],
): Promise<ParticipantRow[]> {
  const hasPlayers = participants.some((p) => p.kind === 'player' && p.userId != null)
  if (!hasPlayers) return participants

  const members = await db
    .select({ userId: campaignMembers.userId, characterId: campaignMembers.characterId })
    .from(campaignMembers)
    .where(eq(campaignMembers.campaignId, campaignId))

  const charIdByUser = new Map<number, number>()
  for (const m of members) if (m.characterId != null) charIdByUser.set(m.userId, m.characterId)

  const charIds = [...new Set(charIdByUser.values())]
  if (charIds.length === 0) return participants

  const chars = await db
    .select({ id: characters.id, hpCurrent: characters.hpCurrent, hpMax: characters.hpMax })
    .from(characters)
    .where(inArray(characters.id, charIds))
  const charById = new Map(chars.map((c) => [c.id, c]))

  const hpByUserId = new Map<number, { hpCurrent: number; hpMax: number }>()
  for (const [userId, cid] of charIdByUser) {
    const c = charById.get(cid)
    if (c) hpByUserId.set(userId, { hpCurrent: c.hpCurrent, hpMax: c.hpMax })
  }

  return applyCharacterHp(participants, hpByUserId)
}

/** Re-broadcast every active combat this user takes part in (after their character HP changed). */
export async function broadcastUserCombats(userId: number): Promise<void> {
  const rows = await db
    .select({ combatId: combats.id, campaignId: combats.campaignId, gmUserId: campaigns.gmUserId })
    .from(combatParticipants)
    .innerJoin(combats, eq(combatParticipants.combatId, combats.id))
    .innerJoin(campaigns, eq(combats.campaignId, campaigns.id))
    .where(and(eq(combatParticipants.userId, userId), eq(combats.status, 'active')))

  const seen = new Set<number>()
  for (const r of rows) {
    if (seen.has(r.combatId)) continue
    seen.add(r.combatId)
    await broadcastCombatState(r.combatId, r.gmUserId)
  }
}

export interface SseClient {
  res: express.Response
  userId: number
}

const sseClients = new Map<number, Set<SseClient>>()

export function getClientsForCombat(combatId: number): Set<SseClient> {
  if (!sseClients.has(combatId)) sseClients.set(combatId, new Set())
  return sseClients.get(combatId)!
}

function writeSse(res: express.Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

/** Load combat state from DB and broadcast to all SSE clients */
export async function broadcastCombatState(combatId: number, gmUserId: number): Promise<void> {
  const clients = sseClients.get(combatId)
  if (!clients || clients.size === 0) return

  const [combat] = await db.select().from(combats).where(eq(combats.id, combatId))
  if (!combat) return

  const participants = await db
    .select()
    .from(combatParticipants)
    .where(eq(combatParticipants.combatId, combatId))
    .orderBy(asc(combatParticipants.id))

  const enriched = await enrichParticipantHp(combat.campaignId, participants)

  for (const client of clients) {
    writeSse(client.res, 'combat-updated', serializeCombat(combat, enriched, client.userId === gmUserId))
  }
}
