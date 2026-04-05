import { and, eq, desc } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import {
  combats, combatParticipants, campaigns, campaignMembers, characters, encounterTemplates, encounterMonsters,
} from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'
import { broadcastCombatState, getClientsForCombat, type SseClient } from '../combats/sseStore.js'

// Armor/shield lookup for initiative calculation (mirrors client armorsCatalog.ts)
const ARMOR_DEF: Record<string, number> = {
  'tissu-matelasse': 1, 'cuir': 2, 'cuir-renforce': 3,
  'chemise-mailles': 4, 'cotte-mailles': 5, 'demi-plaque': 6, 'armure-plaques': 7,
}
const SHIELD_DEF: Record<string, number> = {
  'petit-bouclier': 1, 'grand-bouclier': 2,
}

function computeInitiative(char: { dex: number; armorId: string | null; shieldId: string | null; initiativeBonus: number }): number {
  const armorDef = char.armorId ? (ARMOR_DEF[char.armorId] ?? 0) : 0
  const shieldDef = char.shieldId ? (SHIELD_DEF[char.shieldId] ?? 0) : 0
  return char.dex - armorDef - shieldDef + (char.initiativeBonus ?? 0)
}

const router = Router()
router.use(requireAuth)

// Helper: verify GM
async function verifyGm(campaignId: number, userId: number) {
  const [campaign] = await db.select({ gmUserId: campaigns.gmUserId }).from(campaigns).where(eq(campaigns.id, campaignId))
  if (!campaign) return { status: 'not_found' as const, gmUserId: 0 }
  if (campaign.gmUserId !== userId) return { status: 'forbidden' as const, gmUserId: campaign.gmUserId }
  return { status: 'ok' as const, gmUserId: campaign.gmUserId }
}

// Helper: verify member (GM or campaign member)
async function verifyMember(campaignId: number, userId: number) {
  const [campaign] = await db.select({ gmUserId: campaigns.gmUserId }).from(campaigns).where(eq(campaigns.id, campaignId))
  if (!campaign) return { status: 'not_found' as const, gmUserId: 0 }
  if (campaign.gmUserId === userId) return { status: 'ok' as const, gmUserId: campaign.gmUserId }
  const [membership] = await db
    .select({ id: campaignMembers.id })
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
  if (!membership) return { status: 'forbidden' as const, gmUserId: campaign.gmUserId }
  return { status: 'ok' as const, gmUserId: campaign.gmUserId }
}

// POST /:id/combats — lancer un combat
router.post('/:id/combats', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const { encounterId, excludedUserIds = [], name } = req.body as {
    encounterId?: number
    excludedUserIds?: number[]
    name?: string
  }

  const check = await verifyGm(campaignId, userId)
  if (check.status === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check.status === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  // Determine combat name
  let combatName = name?.trim() || 'Combat'
  if (encounterId) {
    const [enc] = await db.select({ name: encounterTemplates.name }).from(encounterTemplates)
      .where(and(eq(encounterTemplates.id, encounterId), eq(encounterTemplates.campaignId, campaignId)))
    if (enc) combatName = enc.name
  }

  // Create combat
  const [combat] = await db.insert(combats).values({
    campaignId,
    encounterId: encounterId ?? null,
    name: combatName,
  }).returning()

  // Add players
  const members = await db
    .select({
      userId: campaignMembers.userId,
      characterId: campaignMembers.characterId,
    })
    .from(campaignMembers)
    .where(eq(campaignMembers.campaignId, campaignId))

  const excludedSet = new Set(excludedUserIds)

  for (const member of members) {
    if (excludedSet.has(member.userId) || !member.characterId) continue

    const [char] = await db.select().from(characters).where(eq(characters.id, member.characterId))
    if (!char) continue

    const initiative = computeInitiative({
      dex: char.dex,
      armorId: char.armorId,
      shieldId: char.shieldId,
      initiativeBonus: char.initiativeBonus,
    })

    await db.insert(combatParticipants).values({
      combatId: combat.id,
      kind: 'player',
      userId: member.userId,
      name: char.name,
      initiative,
      hpMax: char.hpMax,
      hpCurrent: char.hpCurrent,
      def: char.defense,
    })
  }

  // Add monsters from encounter template
  if (encounterId) {
    const monsters = await db.select().from(encounterMonsters).where(eq(encounterMonsters.encounterId, encounterId))
    for (const m of monsters) {
      await db.insert(combatParticipants).values({
        combatId: combat.id,
        kind: 'monster',
        name: m.name,
        initiative: m.init,
        hpMax: m.pv,
        hpCurrent: m.pv,
        def: m.def,
        nc: m.nc,
        statFor: m.statFor,
        statDex: m.statDex,
        statCon: m.statCon,
        statInt: m.statInt,
        statSag: m.statSag,
        statCha: m.statCha,
        attacks: m.attacks,
        abilities: m.abilities,
        monsterDescription: m.description,
      })
    }
  }

  await broadcastCombatState(combat.id, check.gmUserId)

  console.log(`[combat] created: "${combatName}" in campaign ${campaignId}`)
  res.status(201).json({ id: combat.id })
})

// GET /:id/combats — liste des combats
router.get('/:id/combats', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)

  const check = await verifyMember(campaignId, userId)
  if (check.status === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check.status === 'forbidden') { res.status(403).json({ error: 'Non membre' }); return }

  const rows = await db.select().from(combats)
    .where(eq(combats.campaignId, campaignId))
    .orderBy(desc(combats.createdAt))

  res.json(rows)
})

// GET /:id/combats/:cid — état d'un combat
router.get('/:id/combats/:cid', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyMember(campaignId, userId)
  if (check.status === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check.status === 'forbidden') { res.status(403).json({ error: 'Non membre' }); return }

  const [combat] = await db.select().from(combats).where(eq(combats.id, combatId))
  if (!combat || combat.campaignId !== campaignId) {
    res.status(404).json({ error: 'Combat introuvable' }); return
  }

  const participants = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combatId))
  const sorted = [...participants].sort((a, b) => b.initiative - a.initiative)

  const isGm = userId === check.gmUserId

  function hpStatus(cur: number, max: number): string {
    if (cur <= 0) return 'mort'
    const pct = (cur / max) * 100
    if (pct > 75) return 'intact'
    if (pct > 50) return 'blesse'
    if (pct > 25) return 'mal_en_point'
    return 'agonisant'
  }

  res.json({
    ...combat,
    participants: sorted.map((p) => {
      if (isGm || p.kind === 'player') return p
      return {
        id: p.id, combatId: p.combatId, kind: p.kind, userId: p.userId,
        name: p.name, initiative: p.initiative, def: p.def,
        hpMax: null, hpCurrent: null, hpStatus: hpStatus(p.hpCurrent, p.hpMax),
        nc: null, statFor: null, statDex: null, statCon: null,
        statInt: null, statSag: null, statCha: null,
        attacks: null, abilities: null, monsterDescription: null,
      }
    }),
  })
})

// POST /:id/combats/:cid/next-turn
router.post('/:id/combats/:cid/next-turn', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyMember(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Non autorisé' }); return }

  const [combat] = await db.select().from(combats).where(eq(combats.id, combatId))
  if (!combat || combat.status !== 'active') { res.status(400).json({ error: 'Combat inactif' }); return }

  const participants = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combatId))
  const sorted = [...participants].sort((a, b) => b.initiative - a.initiative)
  const alive = sorted.filter((p) => p.kind === 'player' || p.hpCurrent > 0)

  if (alive.length === 0) { res.status(400).json({ error: 'Aucun participant actif' }); return }

  // Verify requester is GM or current active participant
  const currentParticipant = sorted[combat.currentTurnIndex]
  const isGm = userId === check.gmUserId
  const isCurrentPlayer = currentParticipant?.userId === userId
  if (!isGm && !isCurrentPlayer) {
    res.status(403).json({ error: "Ce n'est pas ton tour" }); return
  }

  // Find next alive participant
  let nextIndex = combat.currentTurnIndex
  let roundNumber = combat.roundNumber
  for (let i = 0; i < sorted.length; i++) {
    nextIndex = (nextIndex + 1) % sorted.length
    if (nextIndex === 0) roundNumber++
    const p = sorted[nextIndex]
    if (p.kind === 'player' || p.hpCurrent > 0) break
  }

  await db.update(combats).set({ currentTurnIndex: nextIndex, roundNumber }).where(eq(combats.id, combatId))
  await broadcastCombatState(combatId, check.gmUserId)
  res.json({ ok: true })
})

// POST /:id/combats/:cid/prev-turn — GM only
router.post('/:id/combats/:cid/prev-turn', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyGm(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const [combat] = await db.select().from(combats).where(eq(combats.id, combatId))
  if (!combat || combat.status !== 'active') { res.status(400).json({ error: 'Combat inactif' }); return }

  const participants = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combatId))
  const sorted = [...participants].sort((a, b) => b.initiative - a.initiative)

  let prevIndex = combat.currentTurnIndex
  let roundNumber = combat.roundNumber
  for (let i = 0; i < sorted.length; i++) {
    prevIndex = prevIndex - 1
    if (prevIndex < 0) {
      prevIndex = sorted.length - 1
      roundNumber = Math.max(1, roundNumber - 1)
    }
    const p = sorted[prevIndex]
    if (p.kind === 'player' || p.hpCurrent > 0) break
  }

  await db.update(combats).set({ currentTurnIndex: prevIndex, roundNumber }).where(eq(combats.id, combatId))
  await broadcastCombatState(combatId, check.gmUserId)
  res.json({ ok: true })
})

// PATCH /:id/combats/:cid/participants/:pid — modifier HP
router.patch('/:id/combats/:cid/participants/:pid', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)
  const pid = Number(req.params.pid)

  const check = await verifyMember(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Non autorisé' }); return }

  const [participant] = await db.select().from(combatParticipants).where(eq(combatParticipants.id, pid))
  if (!participant || participant.combatId !== combatId) {
    res.status(404).json({ error: 'Participant introuvable' }); return
  }

  const isGm = userId === check.gmUserId

  // Monsters: GM only. Players: self only.
  if (participant.kind === 'monster' && !isGm) {
    res.status(403).json({ error: 'Seul le MJ peut modifier les HP des monstres' }); return
  }
  if (participant.kind === 'player' && participant.userId !== userId) {
    res.status(403).json({ error: 'Tu ne peux modifier que tes propres HP' }); return
  }

  const { hpCurrent } = req.body as { hpCurrent?: number }
  if (typeof hpCurrent !== 'number') { res.status(400).json({ error: 'hpCurrent requis' }); return }

  const clamped = Math.max(0, Math.min(Math.round(hpCurrent), participant.hpMax))

  await db.update(combatParticipants).set({ hpCurrent: clamped }).where(eq(combatParticipants.id, pid))
  await broadcastCombatState(combatId, check.gmUserId)
  res.json({ ok: true })
})

// POST /:id/combats/:cid/monsters — ajouter un monstre (renforts)
router.post('/:id/combats/:cid/monsters', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyGm(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const [combat] = await db.select().from(combats).where(eq(combats.id, combatId))
  if (!combat || combat.status !== 'active') { res.status(400).json({ error: 'Combat inactif' }); return }

  const body = req.body as Record<string, unknown>

  await db.insert(combatParticipants).values({
    combatId,
    kind: 'monster',
    name: String(body.name ?? 'Monstre'),
    initiative: Number(body.initiative ?? body.init ?? 0),
    hpMax: Number(body.pv ?? body.hpMax ?? 1),
    hpCurrent: Number(body.pv ?? body.hpMax ?? 1),
    def: Number(body.def ?? 10),
    nc: body.nc != null ? Number(body.nc) : null,
    statFor: body.statFor != null ? Number(body.statFor) : null,
    statDex: body.statDex != null ? Number(body.statDex) : null,
    statCon: body.statCon != null ? Number(body.statCon) : null,
    statInt: body.statInt != null ? Number(body.statInt) : null,
    statSag: body.statSag != null ? Number(body.statSag) : null,
    statCha: body.statCha != null ? Number(body.statCha) : null,
    attacks: body.attacks ?? null,
    abilities: body.abilities ?? null,
    monsterDescription: body.description ? String(body.description) : null,
  })

  await broadcastCombatState(combatId, check.gmUserId)
  res.status(201).json({ ok: true })
})

// POST /:id/combats/:cid/finish — terminer le combat
router.post('/:id/combats/:cid/finish', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyGm(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  await db.update(combats).set({ status: 'finished', finishedAt: new Date() }).where(eq(combats.id, combatId))
  await broadcastCombatState(combatId, check.gmUserId)

  console.log(`[combat] finished: id=${combatId}`)
  res.json({ ok: true })
})

// GET /:id/combats/:cid/events — SSE stream
router.get('/:id/combats/:cid/events', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyMember(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Non autorisé' }); return }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const client: SseClient = { res, userId }
  const clients = getClientsForCombat(combatId)
  clients.add(client)

  // Send initial state
  await broadcastCombatState(combatId, check.gmUserId)

  req.on('close', () => {
    clients.delete(client)
  })
})

export default router
