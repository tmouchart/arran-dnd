import { and, eq, sql } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { campaigns, campaignMembers, characters, users, generatedImages, encounterTemplates, encounterMonsters } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'

const router = Router()
router.use(requireAuth)

// GET /api/campaigns — liste toutes les campagnes
router.get('/', async (_req, res) => {
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      gmUserId: campaigns.gmUserId,
      gmUsername: users.username,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .innerJoin(users, eq(users.id, campaigns.gmUserId))

  // Count members per campaign
  const memberCounts = await db
    .select({
      campaignId: campaignMembers.campaignId,
      count: sql<number>`count(*)::int`,
    })
    .from(campaignMembers)
    .groupBy(campaignMembers.campaignId)

  const countMap = new Map(memberCounts.map((r) => [r.campaignId, r.count]))

  // For each campaign, check if current user is a member
  const userId = (_req as unknown as AuthRequest).userId
  const myMemberships = await db
    .select({ campaignId: campaignMembers.campaignId })
    .from(campaignMembers)
    .where(eq(campaignMembers.userId, userId))
  const mySet = new Set(myMemberships.map((r) => r.campaignId))

  res.json(
    rows.map((r) => ({
      ...r,
      memberCount: countMap.get(r.id) ?? 0,
      isMember: mySet.has(r.id),
    })),
  )
})

// POST /api/campaigns — créer une campagne
router.post('/', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const { name } = req.body as { name?: string }
  if (!name?.trim()) {
    res.status(400).json({ error: 'Le nom est requis' })
    return
  }

  const [row] = await db
    .insert(campaigns)
    .values({ name: name.trim(), gmUserId: userId })
    .returning()

  // Set as active campaign for the GM
  await db.update(users).set({ activeCampaignId: row.id }).where(eq(users.id, userId))

  console.log(`[campaign] created: "${row.name}" by user ${userId}`)
  res.status(201).json(row)
})

// GET /api/campaigns/:id — détail + membres
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)

  const [campaign] = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      gmUserId: campaigns.gmUserId,
      gmUsername: users.username,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .innerJoin(users, eq(users.id, campaigns.gmUserId))
    .where(eq(campaigns.id, id))

  if (!campaign) {
    res.status(404).json({ error: 'Campagne introuvable' })
    return
  }

  const members = await db
    .select({
      userId: campaignMembers.userId,
      username: users.username,
      avatarUrl: users.avatarUrl,
      characterId: campaignMembers.characterId,
      characterName: characters.name,
      portraitImageId: characters.portraitImageId,
      portraitData: generatedImages.data,
      portraitMimeType: generatedImages.mimeType,
      joinedAt: campaignMembers.joinedAt,
    })
    .from(campaignMembers)
    .innerJoin(users, eq(users.id, campaignMembers.userId))
    .leftJoin(characters, eq(characters.id, campaignMembers.characterId))
    .leftJoin(generatedImages, eq(generatedImages.id, characters.portraitImageId))
    .where(eq(campaignMembers.campaignId, id))

  const membersWithPortrait = members.map((m) => ({
    userId: m.userId,
    username: m.username,
    avatarUrl: m.avatarUrl,
    characterId: m.characterId,
    characterName: m.characterName,
    portraitUrl: m.portraitData ? `data:${m.portraitMimeType};base64,${m.portraitData}` : null,
    joinedAt: m.joinedAt,
  }))

  res.json({ ...campaign, members: membersWithPortrait })
})

// DELETE /api/campaigns/:id — supprimer (GM only)
router.delete('/:id', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)

  const [row] = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.gmUserId, userId)))
    .returning({ id: campaigns.id })

  if (!row) {
    res.status(403).json({ error: 'Seul le MJ peut supprimer la campagne' })
    return
  }

  console.log(`[campaign] deleted: id=${id} by user ${userId}`)
  res.json({ ok: true })
})

// POST /api/campaigns/:id/join — rejoindre avec son personnage actif
router.post('/:id/join', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)

  // Verify campaign exists
  const [campaign] = await db
    .select({ id: campaigns.id, gmUserId: campaigns.gmUserId })
    .from(campaigns)
    .where(eq(campaigns.id, id))
  if (!campaign) {
    res.status(404).json({ error: 'Campagne introuvable' })
    return
  }
  if (campaign.gmUserId === userId) {
    res.status(400).json({ error: 'Le MJ ne peut pas rejoindre sa propre campagne en tant que joueur' })
    return
  }

  // Find active character
  const [activeChar] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(and(eq(characters.userId, userId), eq(characters.isActive, true)))
  if (!activeChar) {
    res.status(400).json({ error: 'Aucun personnage actif' })
    return
  }

  // Check not already a member
  const [existing] = await db
    .select({ id: campaignMembers.id })
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, id), eq(campaignMembers.userId, userId)))
  if (existing) {
    res.status(400).json({ error: 'Déjà membre de cette campagne' })
    return
  }

  const [member] = await db
    .insert(campaignMembers)
    .values({ campaignId: id, userId, characterId: activeChar.id })
    .returning()

  // Set as active campaign
  await db.update(users).set({ activeCampaignId: id }).where(eq(users.id, userId))

  console.log(`[campaign] user ${userId} joined campaign ${id}`)
  res.status(201).json(member)
})

// POST /api/campaigns/:id/leave — quitter la campagne
router.post('/:id/leave', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)

  const [row] = await db
    .delete(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, id), eq(campaignMembers.userId, userId)))
    .returning({ id: campaignMembers.id })

  if (!row) {
    res.status(404).json({ error: 'Pas membre de cette campagne' })
    return
  }

  // Update active campaign: pick another membership or clear
  const [remaining] = await db
    .select({ campaignId: campaignMembers.campaignId })
    .from(campaignMembers)
    .where(eq(campaignMembers.userId, userId))
    .orderBy(campaignMembers.joinedAt)
    .limit(1)
  await db.update(users).set({ activeCampaignId: remaining?.campaignId ?? null }).where(eq(users.id, userId))

  console.log(`[campaign] user ${userId} left campaign ${id}`)
  res.json({ ok: true })
})

// GET /api/campaigns/:id/members/:userId/character — fiche d'un joueur (GM only)
router.get('/:id/members/:userId/character', async (req, res) => {
  const currentUserId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const targetUserId = Number(req.params.userId)

  // Verify current user is GM or member of this campaign
  const [campaign] = await db
    .select({ gmUserId: campaigns.gmUserId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
  if (!campaign) {
    res.status(404).json({ error: 'Campagne introuvable' })
    return
  }
  if (campaign.gmUserId !== currentUserId) {
    const [membership] = await db
      .select({ id: campaignMembers.id })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, currentUserId)))
    if (!membership) {
      res.status(403).json({ error: 'Accès réservé aux membres de la campagne' })
      return
    }
  }

  // Get the member's character
  const [member] = await db
    .select({ characterId: campaignMembers.characterId })
    .from(campaignMembers)
    .where(
      and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, targetUserId)),
    )
  if (!member || !member.characterId) {
    res.status(404).json({ error: 'Membre ou personnage introuvable' })
    return
  }

  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, member.characterId))
  if (!character) {
    res.status(404).json({ error: 'Personnage introuvable' })
    return
  }

  // Build portrait data URL so the GM can see it (bypassing owner-only /api/images)
  let portraitDataUrl: string | null = null
  if (character.portraitImageId) {
    const [img] = await db
      .select({ data: generatedImages.data, mimeType: generatedImages.mimeType })
      .from(generatedImages)
      .where(eq(generatedImages.id, character.portraitImageId))
    if (img) {
      portraitDataUrl = `data:${img.mimeType};base64,${img.data}`
    }
  }

  res.json({ ...character, portraitDataUrl })
})

// ── Helper: verify GM ownership ─────────────────────────────────────────────
async function verifyGm(campaignId: number, userId: number) {
  const [campaign] = await db
    .select({ gmUserId: campaigns.gmUserId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
  if (!campaign) return 'not_found' as const
  if (campaign.gmUserId !== userId) return 'forbidden' as const
  return 'ok' as const
}

// ── Encounter Templates ─────────────────────────────────────────────────────

// GET /api/campaigns/:id/encounters — liste les rencontres
router.get('/:id/encounters', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)

  const check = await verifyGm(campaignId, userId)
  if (check === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const rows = await db
    .select({
      id: encounterTemplates.id,
      name: encounterTemplates.name,
      description: encounterTemplates.description,
      createdAt: encounterTemplates.createdAt,
    })
    .from(encounterTemplates)
    .where(eq(encounterTemplates.campaignId, campaignId))

  // Count monsters per encounter
  const counts = await db
    .select({
      encounterId: encounterMonsters.encounterId,
      count: sql<number>`count(*)::int`,
    })
    .from(encounterMonsters)
    .groupBy(encounterMonsters.encounterId)

  const countMap = new Map(counts.map((r) => [r.encounterId, r.count]))

  res.json(rows.map((r) => ({ ...r, monsterCount: countMap.get(r.id) ?? 0 })))
})

// POST /api/campaigns/:id/encounters — créer une rencontre
router.post('/:id/encounters', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)

  const check = await verifyGm(campaignId, userId)
  if (check === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const { name, description } = req.body as { name?: string; description?: string }
  if (!name?.trim()) { res.status(400).json({ error: 'Le nom est requis' }); return }

  const [row] = await db
    .insert(encounterTemplates)
    .values({ campaignId, name: name.trim(), description: description?.trim() || null })
    .returning()

  res.status(201).json(row)
})

// GET /api/campaigns/:id/encounters/:eid — détail d'une rencontre
router.get('/:id/encounters/:eid', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const eid = Number(req.params.eid)

  const check = await verifyGm(campaignId, userId)
  if (check === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const [encounter] = await db
    .select()
    .from(encounterTemplates)
    .where(and(eq(encounterTemplates.id, eid), eq(encounterTemplates.campaignId, campaignId)))
  if (!encounter) { res.status(404).json({ error: 'Rencontre introuvable' }); return }

  const monsters = await db
    .select()
    .from(encounterMonsters)
    .where(eq(encounterMonsters.encounterId, eid))

  res.json({ ...encounter, monsters })
})

// PUT /api/campaigns/:id/encounters/:eid — modifier nom/description
router.put('/:id/encounters/:eid', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const eid = Number(req.params.eid)

  const check = await verifyGm(campaignId, userId)
  if (check === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const { name, description } = req.body as { name?: string; description?: string }

  const [row] = await db
    .update(encounterTemplates)
    .set({
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() || null } : {}),
    })
    .where(and(eq(encounterTemplates.id, eid), eq(encounterTemplates.campaignId, campaignId)))
    .returning()

  if (!row) { res.status(404).json({ error: 'Rencontre introuvable' }); return }
  res.json(row)
})

// DELETE /api/campaigns/:id/encounters/:eid — supprimer une rencontre
router.delete('/:id/encounters/:eid', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const eid = Number(req.params.eid)

  const check = await verifyGm(campaignId, userId)
  if (check === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const [row] = await db
    .delete(encounterTemplates)
    .where(and(eq(encounterTemplates.id, eid), eq(encounterTemplates.campaignId, campaignId)))
    .returning({ id: encounterTemplates.id })

  if (!row) { res.status(404).json({ error: 'Rencontre introuvable' }); return }
  res.json({ ok: true })
})

// ── Encounter Monsters ──────────────────────────────────────────────────────

// POST /api/campaigns/:id/encounters/:eid/monsters — ajouter un monstre
router.post('/:id/encounters/:eid/monsters', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const eid = Number(req.params.eid)

  const check = await verifyGm(campaignId, userId)
  if (check === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  // Verify encounter belongs to campaign
  const [enc] = await db
    .select({ id: encounterTemplates.id })
    .from(encounterTemplates)
    .where(and(eq(encounterTemplates.id, eid), eq(encounterTemplates.campaignId, campaignId)))
  if (!enc) { res.status(404).json({ error: 'Rencontre introuvable' }); return }

  const body = req.body as Record<string, unknown>

  const [row] = await db
    .insert(encounterMonsters)
    .values({
      encounterId: eid,
      name: String(body.name ?? 'Monstre'),
      nc: Number(body.nc ?? 0),
      size: String(body.size ?? 'moyenne'),
      def: Number(body.def ?? 10),
      pv: Number(body.pv ?? 1),
      init: Number(body.init ?? 0),
      rd: body.rd ? String(body.rd) : null,
      statFor: Number(body.statFor ?? 0),
      statDex: Number(body.statDex ?? 0),
      statCon: Number(body.statCon ?? 0),
      statInt: Number(body.statInt ?? 0),
      statSag: Number(body.statSag ?? 0),
      statCha: Number(body.statCha ?? 0),
      attacks: body.attacks ?? [],
      abilities: body.abilities ?? [],
      description: body.description ? String(body.description) : null,
    })
    .returning()

  res.status(201).json(row)
})

// POST /api/campaigns/:id/encounters/:eid/monsters/:mid/duplicate — dupliquer
router.post('/:id/encounters/:eid/monsters/:mid/duplicate', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const eid = Number(req.params.eid)
  const mid = Number(req.params.mid)

  const check = await verifyGm(campaignId, userId)
  if (check === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  // Get the monster to duplicate
  const [source] = await db.select().from(encounterMonsters).where(eq(encounterMonsters.id, mid))
  if (!source || source.encounterId !== eid) {
    res.status(404).json({ error: 'Monstre introuvable' }); return
  }

  // Get all monsters in this encounter to determine numbering
  const allMonsters = await db
    .select({ id: encounterMonsters.id, name: encounterMonsters.name })
    .from(encounterMonsters)
    .where(eq(encounterMonsters.encounterId, eid))

  // Strip trailing " <number>" suffix (space required before digits) to get base name
  const baseNameMatch = source.name.match(/^(.+)\s+(\d+)$/)
  const baseName = baseNameMatch ? baseNameMatch[1] : source.name

  // Find existing numbered copies
  const regex = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+(\\d+))?$`)
  const existingNumbers = allMonsters
    .filter((m) => regex.test(m.name))
    .map((m) => {
      const match = m.name.match(regex)
      return match?.[1] ? Number(match[1]) : 0
    })

  const nextNumber = Math.max(...existingNumbers, 0) + 1

  // If source has no number yet and this is the first duplicate, rename it to 1
  const sourceHasNumber = baseNameMatch !== null
  if (!sourceHasNumber && nextNumber === 1) {
    await db
      .update(encounterMonsters)
      .set({ name: `${baseName} 1` })
      .where(eq(encounterMonsters.id, mid))
  }

  const duplicateNumber = sourceHasNumber ? nextNumber : nextNumber + 1

  // Create the copy
  const { id: _id, ...sourceData } = source
  const [newRow] = await db
    .insert(encounterMonsters)
    .values({
      ...sourceData,
      name: `${baseName} ${duplicateNumber}`,
    })
    .returning()

  // Return all monsters so client can update the full list (source may have been renamed)
  const updatedMonsters = await db
    .select()
    .from(encounterMonsters)
    .where(eq(encounterMonsters.encounterId, eid))

  res.status(201).json(updatedMonsters)
})

// PUT /api/campaigns/:id/encounters/:eid/monsters/:mid — modifier un monstre
router.put('/:id/encounters/:eid/monsters/:mid', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const mid = Number(req.params.mid)

  const check = await verifyGm(campaignId, userId)
  if (check === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const body = req.body as Record<string, unknown>

  const [row] = await db
    .update(encounterMonsters)
    .set({
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.nc !== undefined ? { nc: Number(body.nc) } : {}),
      ...(body.size !== undefined ? { size: String(body.size) } : {}),
      ...(body.def !== undefined ? { def: Number(body.def) } : {}),
      ...(body.pv !== undefined ? { pv: Number(body.pv) } : {}),
      ...(body.init !== undefined ? { init: Number(body.init) } : {}),
      ...(body.rd !== undefined ? { rd: body.rd ? String(body.rd) : null } : {}),
      ...(body.statFor !== undefined ? { statFor: Number(body.statFor) } : {}),
      ...(body.statDex !== undefined ? { statDex: Number(body.statDex) } : {}),
      ...(body.statCon !== undefined ? { statCon: Number(body.statCon) } : {}),
      ...(body.statInt !== undefined ? { statInt: Number(body.statInt) } : {}),
      ...(body.statSag !== undefined ? { statSag: Number(body.statSag) } : {}),
      ...(body.statCha !== undefined ? { statCha: Number(body.statCha) } : {}),
      ...(body.attacks !== undefined ? { attacks: body.attacks } : {}),
      ...(body.abilities !== undefined ? { abilities: body.abilities } : {}),
      ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
    })
    .where(eq(encounterMonsters.id, mid))
    .returning()

  if (!row) { res.status(404).json({ error: 'Monstre introuvable' }); return }
  res.json(row)
})

// DELETE /api/campaigns/:id/encounters/:eid/monsters/:mid — supprimer un monstre
router.delete('/:id/encounters/:eid/monsters/:mid', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  const mid = Number(req.params.mid)

  const check = await verifyGm(campaignId, userId)
  if (check === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check === 'forbidden') { res.status(403).json({ error: 'Réservé au MJ' }); return }

  const [row] = await db
    .delete(encounterMonsters)
    .where(eq(encounterMonsters.id, mid))
    .returning({ id: encounterMonsters.id })

  if (!row) { res.status(404).json({ error: 'Monstre introuvable' }); return }
  res.json({ ok: true })
})

export default router
