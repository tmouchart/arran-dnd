import { and, eq, sql } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { campaigns, campaignMembers, characters, users, generatedImages } from '../db/schema.js'
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

export default router
