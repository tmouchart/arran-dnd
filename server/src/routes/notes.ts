import { and, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { notes } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'

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
  const { title, content } = req.body as { title?: string; content?: string }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content

  const [note] = await db
    .update(notes)
    .set(updates)
    .where(and(eq(notes.id, id), eq(notes.ownerUserId, userId)))
    .returning()
  if (!note) { res.status(404).json({ error: 'Note introuvable' }); return }
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
