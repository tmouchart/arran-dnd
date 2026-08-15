import { and, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { notes } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'
import { saveWithRevision } from '../revisions/service.js'

const router = Router()
router.use(requireAuth)

// GET / — mes notes
router.get('/', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.ownerUserId, userId))
    .orderBy(desc(notes.updatedAt))
  res.json(rows)
})

// POST / — créer une note
router.post('/', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const { title, content, type } = req.body as { title?: string; content?: string; type?: string }
  if (type && type !== 'text' && type !== 'drawing') {
    res.status(400).json({ error: 'Type invalide' }); return
  }
  const [note] = await db.insert(notes).values({
    ownerUserId: userId,
    title: title ?? '',
    type: type === 'drawing' ? 'drawing' : 'text',
    content: content ?? '',
  }).returning()
  res.json(note)
})

// PUT /:id — modifier (owner uniquement)
router.put('/:id', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'Id invalide' }); return }
  const { title, content, expectedVersion } = req.body as {
    title?: string; content?: string; expectedVersion?: number
  }

  const [current] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.ownerUserId, userId)))
  if (!current) { res.status(404).json({ error: 'Note introuvable' }); return }

  // Mise à jour partielle → on complète avec l'existant pour l'historique.
  const result = await saveWithRevision({
    type: 'note',
    id,
    snapshot: { title: title ?? current.title, content: content ?? current.content },
    userId,
    expectedVersion: expectedVersion ?? null,
  })
  if (result.status === 'conflict') {
    res.status(409).json({
      error: 'La note a été modifiée entre-temps.',
      currentVersion: result.currentVersion,
      title: result.snapshot.title ?? '',
      content: result.snapshot.content ?? '',
    })
    return
  }
  if (result.status !== 'ok') { res.status(404).json({ error: 'Note introuvable' }); return }

  const [note] = await db.select().from(notes).where(eq(notes.id, id))
  res.json(note)
})

// DELETE /:id — owner uniquement
router.delete('/:id', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'Id invalide' }); return }
  const [deleted] = await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.ownerUserId, userId)))
    .returning({ id: notes.id })
  if (!deleted) { res.status(404).json({ error: 'Note introuvable' }); return }
  res.json({ ok: true })
})

export default router
