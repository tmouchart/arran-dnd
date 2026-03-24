import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { users, journalCompagnie } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'

const router = Router()
router.use(requireAuth)

function userId(req: unknown): number {
  return (req as AuthRequest).userId!
}

// GET /api/journal/perso — notes personnelles de l'utilisateur courant
router.get('/perso', async (req, res) => {
  const [user] = await db.select({ notesPerso: users.notesPerso }).from(users).where(eq(users.id, userId(req)))
  res.json({ content: user?.notesPerso ?? '' })
})

// PUT /api/journal/perso — sauvegarde les notes personnelles
router.put('/perso', async (req, res) => {
  const { content } = req.body as { content: string }
  await db.update(users).set({ notesPerso: content ?? '' }).where(eq(users.id, userId(req)))
  res.json({ ok: true })
})

// GET /api/journal/compagnie — journal partagé
router.get('/compagnie', async (_req, res) => {
  const [row] = await db.select().from(journalCompagnie).where(eq(journalCompagnie.id, 1))
  res.json({ content: row?.content ?? '' })
})

// PUT /api/journal/compagnie — mise à jour journal partagé
router.put('/compagnie', async (req, res) => {
  const { content } = req.body as { content: string }
  await db.update(journalCompagnie)
    .set({ content: content ?? '', updatedAt: new Date() })
    .where(eq(journalCompagnie.id, 1))
  res.json({ ok: true })
})

export default router
