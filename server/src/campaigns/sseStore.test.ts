import { describe, it, expect } from 'vitest'
import type express from 'express'
import { broadcastCampaignRoll, getClientsForCampaign } from './sseStore.js'

describe('broadcastCampaignRoll', () => {
  const GM_ID = 1
  const PLAYER_ID = 2

  function fakeClient(userId: number) {
    const written: string[] = []
    const res = { write: (chunk: string) => { written.push(chunk); return true } } as unknown as express.Response
    return { client: { res, userId }, written }
  }

  it('sends public rolls to everyone, gm rolls only to the GM', () => {
    const campaignId = 991
    const gm = fakeClient(GM_ID)
    const p = fakeClient(PLAYER_ID)
    const clients = getClientsForCampaign(campaignId)
    clients.add(gm.client)
    clients.add(p.client)

    broadcastCampaignRoll(campaignId, GM_ID, { visibility: 'public', actorName: 'Thorin' })
    broadcastCampaignRoll(campaignId, GM_ID, { visibility: 'gm', actorName: 'Gobelin' })

    const gmData = gm.written.join('')
    const playerData = p.written.join('')
    expect(gmData).toContain('Thorin')
    expect(gmData).toContain('Gobelin')
    expect(playerData).toContain('Thorin')
    expect(playerData).not.toContain('Gobelin')

    clients.clear()
  })

  it('does nothing when nobody is connected', () => {
    expect(() => broadcastCampaignRoll(4242, GM_ID, { visibility: 'public' })).not.toThrow()
  })
})
