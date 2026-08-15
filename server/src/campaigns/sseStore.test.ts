import { describe, it, expect, beforeEach } from 'vitest'
import type express from 'express'
import { broadcastCampaignRoll, criticalOutcome, getClientsForCampaign } from './sseStore.js'

const CAMPAIGN = 9001
const GM = 1
const PLAYER = 2

function fakeClient(userId: number) {
  const written: string[] = []
  const res = { write: (chunk: string) => { written.push(chunk); return true } } as unknown as express.Response
  return { client: { res, userId }, written }
}

function roll(over: Record<string, unknown> = {}) {
  return {
    visibility: 'gm', actorName: 'Dragon rouge', kind: 'weapon',
    die: 20, sides: 20, total: 27, ...over,
  }
}

describe('criticalOutcome', () => {
  it('note le d20 et le d12 d’attaque, pas les autres dés', () => {
    expect(criticalOutcome({ kind: 'weapon', die: 20, sides: 20 })).toBe('critical')
    expect(criticalOutcome({ kind: 'weapon', die: 1, sides: 20 })).toBe('fumble')
    expect(criticalOutcome({ kind: 'weapon', die: 12, sides: 12 })).toBe('critical')
    expect(criticalOutcome({ kind: 'libre', die: 12, sides: 12 })).toBeNull()
    expect(criticalOutcome({ kind: 'weapon', die: 6, sides: 6 })).toBeNull()
    expect(criticalOutcome({ kind: 'weapon', die: 14, sides: 20 })).toBeNull()
  })

  it('respecte le drapeau explicite des dégâts', () => {
    expect(criticalOutcome({ kind: 'weapon', die: 5, sides: 20, damage: { critical: true } })).toBe('critical')
  })
})

describe('broadcastCampaignRoll', () => {
  beforeEach(() => {
    getClientsForCampaign(CAMPAIGN).clear()
  })

  it('sends public rolls to everyone, gm rolls only to the GM', () => {
    const gm = fakeClient(GM)
    const p = fakeClient(PLAYER)
    const clients = getClientsForCampaign(CAMPAIGN)
    clients.add(gm.client)
    clients.add(p.client)

    broadcastCampaignRoll(CAMPAIGN, GM, { visibility: 'public', actorName: 'Thorin' })
    broadcastCampaignRoll(CAMPAIGN, GM, { visibility: 'gm', actorName: 'Gobelin' })

    const gmData = gm.written.join('')
    const playerData = p.written.join('')
    expect(gmData).toContain('Thorin')
    expect(gmData).toContain('Gobelin')
    expect(playerData).toContain('Thorin')
    expect(playerData).not.toContain('Gobelin')
  })

  it('does nothing when nobody is connected', () => {
    expect(() => broadcastCampaignRoll(4242, GM, { visibility: 'public' })).not.toThrow()
  })

  it('envoie le jet complet au MJ et rien au joueur pour un jet banal', () => {
    const gm = fakeClient(GM)
    const player = fakeClient(PLAYER)
    const clients = getClientsForCampaign(CAMPAIGN)
    clients.add(gm.client); clients.add(player.client)

    broadcastCampaignRoll(CAMPAIGN, GM, roll({ die: 14, total: 21 }))

    expect(gm.written.join('')).toContain('event: roll')
    expect(player.written).toEqual([])
  })

  // Le cœur de la feature : la table vibre, mais le chiffre reste secret.
  it('envoie un `critical` allégé au joueur sur un 20 caché', () => {
    const player = fakeClient(PLAYER)
    getClientsForCampaign(CAMPAIGN).add(player.client)

    broadcastCampaignRoll(CAMPAIGN, GM, roll())

    const payload = player.written.join('')
    expect(payload).toContain('event: critical')
    expect(payload).toContain('Dragon rouge')
    expect(payload).not.toContain('event: roll')
    expect(payload).not.toContain('27')
    expect(payload).not.toContain('"die"')
  })

  it('envoie le jet complet à tout le monde quand il est public', () => {
    const player = fakeClient(PLAYER)
    getClientsForCampaign(CAMPAIGN).add(player.client)

    broadcastCampaignRoll(CAMPAIGN, GM, roll({ visibility: 'public', actorName: 'Théos' }))

    expect(player.written.join('')).toContain('event: roll')
  })
})
