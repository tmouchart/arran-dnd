import { and, desc, eq, like } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { campaigns, campaignMembers, codexEntries, journalPages, notes } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'

const CODEX_TYPES = ['personnage', 'lieu', 'autre'] as const
type CodexType = (typeof CODEX_TYPES)[number]

function isCodexType(value: unknown): value is CodexType {
  return typeof value === 'string' && (CODEX_TYPES as readonly string[]).includes(value)
}

const router = Router()
router.use(requireAuth)

// Helper: verify member (GM or campaign member) — same pattern as combats.ts
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

// GET /:id/codex — liste des fiches de la campagne
router.get('/:id/codex', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  if (!Number.isInteger(campaignId) || campaignId <= 0) { res.status(400).json({ error: 'Id invalide' }); return }

  const check = await verifyMember(campaignId, userId)
  if (check.status === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check.status === 'forbidden') { res.status(403).json({ error: 'Réservé aux membres de la campagne' }); return }

  const rows = await db
    .select()
    .from(codexEntries)
    .where(eq(codexEntries.campaignId, campaignId))
    .orderBy(codexEntries.name)
  res.json(rows)
})

// POST /:id/codex — créer une fiche
router.post('/:id/codex', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  if (!Number.isInteger(campaignId) || campaignId <= 0) { res.status(400).json({ error: 'Id invalide' }); return }
  const { name, type, description } = req.body as { name?: string; type?: string; description?: string }

  const check = await verifyMember(campaignId, userId)
  if (check.status === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check.status === 'forbidden') { res.status(403).json({ error: 'Réservé aux membres de la campagne' }); return }

  if (!name?.trim()) { res.status(400).json({ error: 'Nom requis' }); return }
  if (!isCodexType(type)) { res.status(400).json({ error: 'Type invalide (personnage, lieu ou autre)' }); return }

  const [entry] = await db.insert(codexEntries).values({
    campaignId,
    type,
    name: name.trim(),
    description: description ?? '',
    createdByUserId: userId,
  }).returning()
  res.json(entry)
})

// PUT /:id/codex/:entryId — modifier (tout membre)
router.put('/:id/codex/:entryId', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  if (!Number.isInteger(campaignId) || campaignId <= 0) { res.status(400).json({ error: 'Id invalide' }); return }
  const entryId = Number(req.params.entryId)
  if (!Number.isInteger(entryId) || entryId <= 0) { res.status(400).json({ error: 'Id invalide' }); return }
  const { name, type, description } = req.body as { name?: string; type?: string; description?: string }

  const check = await verifyMember(campaignId, userId)
  if (check.status === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check.status === 'forbidden') { res.status(403).json({ error: 'Réservé aux membres de la campagne' }); return }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined) {
    if (!name.trim()) { res.status(400).json({ error: 'Nom requis' }); return }
    updates.name = name.trim()
  }
  if (type !== undefined) {
    if (!isCodexType(type)) { res.status(400).json({ error: 'Type invalide (personnage, lieu ou autre)' }); return }
    updates.type = type
  }
  if (description !== undefined) updates.description = description

  const [entry] = await db
    .update(codexEntries)
    .set(updates)
    .where(and(eq(codexEntries.id, entryId), eq(codexEntries.campaignId, campaignId)))
    .returning()
  if (!entry) { res.status(404).json({ error: 'Fiche introuvable' }); return }
  res.json(entry)
})

// GET /:id/codex/:entryId/mentions — mes notes privées + pages partagées qui mentionnent la fiche
router.get('/:id/codex/:entryId/mentions', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  if (!Number.isInteger(campaignId) || campaignId <= 0) { res.status(400).json({ error: 'Id invalide' }); return }
  const entryId = Number(req.params.entryId)
  if (!Number.isInteger(entryId) || entryId <= 0) { res.status(400).json({ error: 'Id invalide' }); return }

  const check = await verifyMember(campaignId, userId)
  if (check.status === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check.status === 'forbidden') { res.status(403).json({ error: 'Réservé aux membres de la campagne' }); return }

  const [entry] = await db
    .select({ id: codexEntries.id })
    .from(codexEntries)
    .where(and(eq(codexEntries.id, entryId), eq(codexEntries.campaignId, campaignId)))
  if (!entry) { res.status(404).json({ error: 'Fiche introuvable' }); return }

  // Le token stocké est "@[Nom](codex:ID)" — les parenthèses évitent de matcher codex:12 dans codex:123.
  const pattern = `%(codex:${entryId})%`
  const [myNotes, pages] = await Promise.all([
    db
      .select({ id: notes.id, title: notes.title, content: notes.content, updatedAt: notes.updatedAt })
      .from(notes)
      .where(and(eq(notes.ownerUserId, userId), like(notes.content, pattern)))
      .orderBy(desc(notes.updatedAt)),
    db
      .select({ id: journalPages.id, title: journalPages.title, content: journalPages.content, updatedAt: journalPages.updatedAt })
      .from(journalPages)
      .where(and(eq(journalPages.type, 'text'), like(journalPages.content, pattern)))
      .orderBy(desc(journalPages.updatedAt)),
  ])
  res.json({ notes: myNotes, pages })
})

// DELETE /:id/codex/:entryId — auteur ou MJ uniquement
router.delete('/:id/codex/:entryId', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const campaignId = Number(req.params.id)
  if (!Number.isInteger(campaignId) || campaignId <= 0) { res.status(400).json({ error: 'Id invalide' }); return }
  const entryId = Number(req.params.entryId)
  if (!Number.isInteger(entryId) || entryId <= 0) { res.status(400).json({ error: 'Id invalide' }); return }

  const check = await verifyMember(campaignId, userId)
  if (check.status === 'not_found') { res.status(404).json({ error: 'Campagne introuvable' }); return }
  if (check.status === 'forbidden') { res.status(403).json({ error: 'Réservé aux membres de la campagne' }); return }

  const [entry] = await db
    .select({ createdByUserId: codexEntries.createdByUserId })
    .from(codexEntries)
    .where(and(eq(codexEntries.id, entryId), eq(codexEntries.campaignId, campaignId)))
  if (!entry) { res.status(404).json({ error: 'Fiche introuvable' }); return }
  if (entry.createdByUserId !== userId && check.gmUserId !== userId) {
    res.status(403).json({ error: "Seul l'auteur ou le MJ peut supprimer cette fiche" })
    return
  }

  await db.delete(codexEntries).where(eq(codexEntries.id, entryId))
  res.json({ ok: true })
})

export default router
