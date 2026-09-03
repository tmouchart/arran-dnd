import { and, eq, desc, asc, or, inArray } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import {
  combats, combatParticipants, campaigns, campaignMembers, characters, encounterTemplates, encounterMonsters,
} from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'
import { broadcastCombatState, broadcastParticipantMoved, enrichParticipantHp, getClientsForCombat, sendCombatStateTo, type SseClient } from '../combats/sseStore.js'
import { serializeCombat } from '../combats/serialize.js'
import { generateText } from '../ai/client.js'
import { turnOrder, firstActiveId, step } from '../combats/turnOrder.js'

// Armor/shield lookup for initiative calculation (mirrors client armorsCatalog.ts)
const ARMOR_DEF: Record<string, number> = {
  'tissu-matelasse': 1, 'cuir': 2, 'cuir-renforce': 3,
  'chemise-mailles': 4, 'cotte-mailles': 5, 'demi-plaque': 6, 'armure-plaques': 7,
}
const SHIELD_DEF: Record<string, number> = {
  'petit-bouclier': 1, 'grand-bouclier': 2,
}

export function computeInitiative(char: { dex: number; armorId: string | null; shieldId: string | null; initiativeBonus: number }): number {
  const armorDef = char.armorId ? (ARMOR_DEF[char.armorId] ?? 0) : 0
  const shieldDef = char.shieldId ? (SHIELD_DEF[char.shieldId] ?? 0) : 0
  return char.dex - armorDef - shieldDef + (char.initiativeBonus ?? 0)
}

const router = Router()

/** Demi-côté de la grille du champ de bataille, en cases (grille 12x12). */
const BATTLE_HALF = 6
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

// Helper: charge un combat en vérifiant qu'il appartient bien à la campagne de l'URL.
// Sans ce check, un MJ/membre d'une autre campagne pourrait piloter ce combat.
async function loadCombatInCampaign(combatId: number, campaignId: number) {
  const [combat] = await db.select().from(combats).where(eq(combats.id, combatId))
  if (!combat || combat.campaignId !== campaignId) return null
  return combat
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
      hpMax: null,
      hpCurrent: null,
      def: char.defense,
    })
  }

  // Add monsters from encounter template
  if (encounterId) {
    const monsters = await db.select().from(encounterMonsters).where(eq(encounterMonsters.encounterId, encounterId)).orderBy(asc(encounterMonsters.id))
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
        hidden: m.hidden,
      })
    }
  }

  // Le combat démarre sur la meilleure initiative. Il faut les participants en
  // base pour la connaître, d'où ce second UPDATE.
  const created = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combat.id))
  await db.update(combats)
    .set({ currentParticipantId: firstActiveId(turnOrder(created)) })
    .where(eq(combats.id, combat.id))

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

  const participants = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combatId)).orderBy(asc(combatParticipants.id))
  const enriched = await enrichParticipantHp(campaignId, participants)

  res.json(serializeCombat(combat, enriched, userId === check.gmUserId))
})

// POST /:id/combats/:cid/next-turn
router.post('/:id/combats/:cid/next-turn', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyMember(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Non autorisé' }); return }

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }
  if (combat.status !== 'active') { res.status(400).json({ error: 'Combat inactif' }); return }

  const participants = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combatId))
  const sorted = turnOrder(participants)

  // Verify requester is GM or current active participant
  const currentParticipant = sorted.find((p) => p.id === combat.currentParticipantId)
  const isGm = userId === check.gmUserId
  const isCurrentPlayer = currentParticipant?.userId === userId
  if (!isGm && !isCurrentPlayer) {
    res.status(403).json({ error: "Ce n'est pas ton tour" }); return
  }

  const next = step(sorted, combat.currentParticipantId, 1)
  if (!next) { res.status(400).json({ error: 'Aucun participant actif' }); return }

  await db.update(combats)
    .set({ currentParticipantId: next.participantId, roundNumber: combat.roundNumber + next.wrapped })
    .where(eq(combats.id, combatId))
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

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }
  if (combat.status !== 'active') { res.status(400).json({ error: 'Combat inactif' }); return }

  const participants = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combatId))
  const sorted = turnOrder(participants)

  const prev = step(sorted, combat.currentParticipantId, -1)
  if (!prev) { res.status(400).json({ error: 'Aucun participant actif' }); return }

  await db.update(combats)
    .set({
      currentParticipantId: prev.participantId,
      roundNumber: Math.max(1, combat.roundNumber - prev.wrapped),
    })
    .where(eq(combats.id, combatId))
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

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }

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

  if (participant.kind === 'player' && participant.userId != null) {
    // Player HP is owned by the character sheet — write there, not on the snapshot.
    const [member] = await db
      .select({ characterId: campaignMembers.characterId })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, participant.userId)))
    if (member?.characterId != null) {
      const [char] = await db.select({ hpMax: characters.hpMax }).from(characters).where(eq(characters.id, member.characterId))
      if (char) {
        const clamped = Math.max(0, Math.min(Math.round(hpCurrent), char.hpMax))
        await db.update(characters).set({ hpCurrent: clamped, updatedAt: new Date() }).where(eq(characters.id, member.characterId))
      }
    }
  } else {
    const clamped = Math.max(0, Math.min(Math.round(hpCurrent), participant.hpMax ?? 0))
    await db.update(combatParticipants).set({ hpCurrent: clamped }).where(eq(combatParticipants.id, pid))
  }

  await broadcastCombatState(combatId, check.gmUserId)
  res.json({ ok: true })
})

// PATCH /:id/combats/:cid/participants/:pid/position — déplacer un pion
router.patch('/:id/combats/:cid/participants/:pid/position', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)
  const pid = Number(req.params.pid)

  const check = await verifyMember(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Non autorisé' }); return }

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }

  const [participant] = await db.select().from(combatParticipants).where(eq(combatParticipants.id, pid))
  if (!participant || participant.combatId !== combatId) {
    res.status(404).json({ error: 'Participant introuvable' }); return
  }

  // Les monstres sont au MJ. Les personnages, toute la table peut les bouger.
  if (participant.kind === 'monster' && userId !== check.gmUserId) {
    res.status(403).json({ error: 'Seul le MJ peut déplacer les monstres' }); return
  }

  const { x, y } = req.body as { x?: number; y?: number }
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    res.status(400).json({ error: 'x et y requis' }); return
  }

  const clamp = (v: number) => Math.max(-BATTLE_HALF, Math.min(BATTLE_HALF, v))
  const posX = clamp(x)
  const posY = clamp(y)
  await db
    .update(combatParticipants)
    .set({ posX, posY })
    .where(eq(combatParticipants.id, pid))

  if (participant.hidden) {
    // Un PNJ en réserve n'existe que pour le MJ : sa position ne part pas en
    // clair à toute la table, elle repasse par le sérialiseur.
    await broadcastCombatState(combatId, check.gmUserId)
  } else {
    broadcastParticipantMoved(combatId, { id: pid, x: posX, y: posY })
  }
  res.json({ ok: true })
})

// PATCH /:id/combats/:cid/environment — changer le décor (MJ seul)
router.patch('/:id/combats/:cid/environment', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyGm(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Seul le MJ peut changer le décor' }); return }

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }

  const { environment } = req.body as { environment?: string }
  if (typeof environment !== 'string' || !/^[a-z-]{1,40}$/.test(environment)) {
    res.status(400).json({ error: 'environment invalide' }); return
  }

  await db.update(combats).set({ environment }).where(eq(combats.id, combatId))
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

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }
  if (combat.status !== 'active') { res.status(400).json({ error: 'Combat inactif' }); return }

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
    // Le MJ peut préparer un renfort qui n'entre pas encore en scène.
    hidden: body.hidden === true,
  })

  await broadcastCombatState(combatId, check.gmUserId)
  res.status(201).json({ ok: true })
})

// PATCH /:id/combats/:cid/participants/:pid/visibility — réserve ↔ scène (MJ seul)
router.patch('/:id/combats/:cid/participants/:pid/visibility', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)
  const pid = Number(req.params.pid)

  const check = await verifyGm(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }

  const [participant] = await db.select().from(combatParticipants).where(eq(combatParticipants.id, pid))
  if (!participant || participant.combatId !== combatId) {
    res.status(404).json({ error: 'Participant introuvable' }); return
  }
  if (participant.kind !== 'monster') {
    res.status(400).json({ error: 'Seul un monstre peut être mis en réserve' }); return
  }

  const { hidden } = req.body as { hidden?: boolean }
  if (typeof hidden !== 'boolean') { res.status(400).json({ error: 'hidden requis' }); return }

  // Remettre en réserve celui dont c'est le tour : on passe la main avant, sinon
  // le tour pointerait sur quelqu'un qui n'est plus dans l'ordre.
  if (hidden && combat.currentParticipantId === pid) {
    const all = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combatId))
    const next = step(turnOrder(all), pid, 1)
    const nextId = next && next.participantId !== pid ? next.participantId : null
    await db.update(combats).set({ currentParticipantId: nextId }).where(eq(combats.id, combatId))
  }

  await db.update(combatParticipants).set({ hidden }).where(eq(combatParticipants.id, pid))
  await broadcastCombatState(combatId, check.gmUserId)
  res.json({ ok: true })
})

// DELETE /:id/combats/:cid/participants/:pid — supprimer un monstre (GM seulement)
router.delete('/:id/combats/:cid/participants/:pid', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)
  const pid = Number(req.params.pid)

  const check = await verifyGm(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }

  const [participant] = await db.select().from(combatParticipants).where(eq(combatParticipants.id, pid))
  if (!participant || participant.combatId !== combatId) {
    res.status(404).json({ error: 'Participant introuvable' }); return
  }
  if (participant.kind !== 'monster') {
    res.status(400).json({ error: 'Seuls les monstres peuvent être supprimés' }); return
  }

  // Si on supprime le participant dont c'est le tour, on passe la main au
  // suivant avant de le retirer. Sinon la FK ON DELETE SET NULL laisserait le
  // tour vide et le combat repartirait du haut de l'initiative.
  if (combat.currentParticipantId === pid) {
    const all = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combatId))
    // On part de `pid` (encore présent dans l'ordre) pour trouver son suivant.
    const next = step(turnOrder(all), pid, 1)
    const nextId = next && next.participantId !== pid ? next.participantId : null
    await db.update(combats).set({ currentParticipantId: nextId }).where(eq(combats.id, combatId))
  }

  await db.delete(combatParticipants).where(eq(combatParticipants.id, pid))
  await broadcastCombatState(combatId, check.gmUserId)
  res.json({ ok: true })
})

// POST /:id/combats/:cid/generate-loot — générer du loot via IA (MJ seulement)
router.post('/:id/combats/:cid/generate-loot', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyGm(campaignId, userId)
  if (check.status === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check.status === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }

  const participants = await db
    .select({
      name: combatParticipants.name,
      nc: combatParticipants.nc,
      monsterDescription: combatParticipants.monsterDescription,
    })
    .from(combatParticipants)
    .where(and(eq(combatParticipants.combatId, combatId), eq(combatParticipants.kind, 'monster')))

  if (participants.length === 0) {
    res.status(400).json({ error: 'Aucun monstre dans ce combat' }); return
  }

  const monsterLines = participants.map((m) => {
    const nc = m.nc != null ? ` (NC ${m.nc})` : ''
    const desc = m.monsterDescription ? ` — ${m.monsterDescription}` : ''
    return `- ${m.name}${nc}${desc}`
  }).join('\n')

  const prompt = `Tu es le maître du jeu d'un jeu de rôle médiéval-fantastique (Arran). Les joueurs viennent de vaincre les ennemis suivants :\n${monsterLines}\n\nGénère un loot cohérent et immersif pour récompenser les joueurs. Tiens compte de la nature des ennemis, leur niveau de dangerosité (NC), et leur description. Propose des objets, de l'argent (pièces d'or/argent/cuivre), et éventuellement un objet spécial ou magique si le NC le justifie. Sois concis, en français, et donne directement la liste du loot sans introduction ni explication.`

  try {
    const loot = await generateText(prompt)
    res.json({ loot })
  } catch (err) {
    console.error('[generate-loot] AI error:', err)
    res.status(500).json({ error: "Erreur lors de la génération du loot" })
  }
})

// POST /:id/combats/:cid/finish — terminer le combat
router.post('/:id/combats/:cid/finish', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const combatId = Number(req.params.cid)

  const check = await verifyGm(campaignId, userId)
  if (check.status !== 'ok') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }

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

  const combat = await loadCombatInCampaign(combatId, campaignId)
  if (!combat) { res.status(404).json({ error: 'Combat introuvable' }); return }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const client: SseClient = { res, userId }
  const clients = getClientsForCombat(combatId)
  clients.add(client)

  // Heartbeat: keep the connection alive through Fly's idle proxy timeout (~60s).
  // A connection silently dropped by the proxy is what causes the "Connexion perdue" banner.
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n')
    console.log(`[sse] heartbeat → combat=${combatId} user=${userId} (clients=${clients.size})`)
  }, 25000)

  // Au seul nouveau venu : rediffuser à toute la table à chaque reconnexion
  // ferait clignoter la carte des autres pour rien.
  await sendCombatStateTo(client, combatId, check.gmUserId)

  req.on('close', () => {
    clearInterval(heartbeat)
    clients.delete(client)
  })
})

// Router monté sur /api/combats — combat actif le plus récent de l'utilisateur
// (sert au relais global des jets depuis n'importe quelle page).
export const activeCombatRouter = Router()
activeCombatRouter.use(requireAuth)
activeCombatRouter.get('/active', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId

  const [row] = await db
    .select({ combatId: combats.id, campaignId: combats.campaignId, name: combats.name })
    .from(combats)
    .innerJoin(campaigns, eq(combats.campaignId, campaigns.id))
    .leftJoin(campaignMembers, and(
      eq(campaignMembers.campaignId, campaigns.id),
      eq(campaignMembers.userId, userId),
    ))
    .where(and(
      eq(combats.status, 'active'),
      or(eq(campaigns.gmUserId, userId), eq(campaignMembers.userId, userId)),
    ))
    .orderBy(desc(combats.createdAt))
    .limit(1)

  res.json(row ?? null)
})

export default router
