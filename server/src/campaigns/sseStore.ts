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

/**
 * Diffuse un jet aux clients de la campagne.
 * Les jets `visibility: 'gm'` (monstres) ne partent qu'au MJ — tout le filtrage
 * de visibilité vit ici et dans le GET, jamais côté client.
 */
export function broadcastCampaignRoll(
  campaignId: number,
  gmUserId: number,
  event: { visibility: string } & Record<string, unknown>,
): void {
  const clients = clientsByCampaign.get(campaignId)
  if (!clients || clients.size === 0) return
  for (const client of clients) {
    if (event.visibility === 'gm' && client.userId !== gmUserId) continue
    client.res.write('event: roll\n')
    client.res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
}
