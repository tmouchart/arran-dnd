import type express from 'express'

/**
 * Flux SSE à l'échelle d'une campagne — porte le log de jets, qui n'est plus
 * lié à un combat. Le flux SSE du combat (état, initiative, PV) reste séparé.
 */
export interface SseClient {
  res: express.Response
  userId: number
}

const clientsByCampaign = new Map<number, Set<SseClient>>()

export function getClientsForCampaign(campaignId: number): Set<SseClient> {
  if (!clientsByCampaign.has(campaignId)) clientsByCampaign.set(campaignId, new Set())
  return clientsByCampaign.get(campaignId)!
}

/** Diffuse un évènement à tous les clients de la campagne, sans filtre. */
export function broadcastCampaignEvent(campaignId: number, name: string, payload: unknown): void {
  const clients = clientsByCampaign.get(campaignId)
  if (!clients || clients.size === 0) return
  const data = JSON.stringify(payload)
  for (const client of clients) {
    client.res.write(`event: ${name}\n`)
    client.res.write(`data: ${data}\n\n`)
  }
}

/** Un 20 ou un 1 naturel sur un dé qui compte (d20 toujours, d12 hors jet libre). */
export function criticalOutcome(event: Record<string, unknown>): 'critical' | 'fumble' | null {
  const damage = event.damage as { critical?: boolean; fumble?: boolean } | null | undefined
  if (damage?.critical) return 'critical'
  if (damage?.fumble) return 'fumble'

  const sides = Number(event.sides)
  const die = Number(event.die)
  const graded = sides === 20 || (sides === 12 && event.kind !== 'libre')
  if (!graded) return null
  if (die === sides) return 'critical'
  if (die === 1) return 'fumble'
  return null
}

/**
 * Diffuse un jet aux clients de la campagne.
 * Les jets `visibility: 'gm'` (monstres) ne partent qu'au MJ — tout le filtrage
 * de visibilité vit ici et dans le GET, jamais côté client.
 *
 * Exception : quand un jet caché est un critique, les joueurs reçoivent quand
 * même un event `critical` allégé (issue + nom de l'acteur, sans le chiffre).
 * Le 20 du dragon fait vibrer la table sans vendre la mèche.
 */
export function broadcastCampaignRoll(
  campaignId: number,
  gmUserId: number,
  event: { visibility: string } & Record<string, unknown>,
): void {
  const clients = clientsByCampaign.get(campaignId)
  if (!clients || clients.size === 0) return

  const hidden = event.visibility === 'gm'
  const outcome = hidden ? criticalOutcome(event) : null
  const teaser = outcome
    ? JSON.stringify({ outcome, actorName: event.actorName })
    : null

  for (const client of clients) {
    if (hidden && client.userId !== gmUserId) {
      if (!teaser) continue
      client.res.write('event: critical\n')
      client.res.write(`data: ${teaser}\n\n`)
      continue
    }
    client.res.write('event: roll\n')
    client.res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
}
