import type express from 'express'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { combats, combatParticipants } from '../db/schema.js'

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

/** Compute qualitative HP status for a monster */
function hpStatus(hpCurrent: number, hpMax: number): string {
  if (hpCurrent <= 0) return 'mort'
  const pct = (hpCurrent / hpMax) * 100
  if (pct > 75) return 'intact'
  if (pct > 50) return 'blesse'
  if (pct > 25) return 'mal_en_point'
  return 'agonisant'
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

  // Sort by initiative DESC for the ordered list
  const sorted = [...participants].sort((a, b) => b.initiative - a.initiative)

  for (const client of clients) {
    const isGm = client.userId === gmUserId
    const payload = {
      id: combat.id,
      campaignId: combat.campaignId,
      name: combat.name,
      status: combat.status,
      currentTurnIndex: combat.currentTurnIndex,
      roundNumber: combat.roundNumber,
      createdAt: combat.createdAt,
      finishedAt: combat.finishedAt,
      participants: sorted.map((p) => {
        if (isGm || p.kind === 'player') {
          return p
        }
        // Players see qualitative HP for monsters, not exact values
        return {
          id: p.id,
          combatId: p.combatId,
          kind: p.kind,
          userId: p.userId,
          name: p.name,
          initiative: p.initiative,
          def: p.def,
          hpMax: null,
          hpCurrent: null,
          hpStatus: hpStatus(p.hpCurrent, p.hpMax),
          nc: null,
          statFor: null, statDex: null, statCon: null,
          statInt: null, statSag: null, statCha: null,
          attacks: null, abilities: null, monsterDescription: null,
        }
      }),
    }
    writeSse(client.res, 'combat-updated', payload)
  }
}
