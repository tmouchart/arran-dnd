import { eq, desc, and } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { users, characters, journalCompagnie, journalPages } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'
import {
  acquireLock,
  releaseLock,
  renewLock,
  getActiveLock,
  holdsLock,
  registerSseClient,
  removeSseClient,
  broadcastContentUpdate,
} from '../journal/locks.js'

const router = Router()
router.use(requireAuth)

function auth(req: unknown): { userId: number; username: string } {
  const r = req as AuthRequest
  return { userId: r.userId!, username: r.username! }
}

/** Get the active character name for a user, falling back to username. */
async function activeCharacterName(userId: number): Promise<string> {
  const [char] = await db
    .select({ name: characters.name })
    .from(characters)
    .where(and(eq(characters.userId, userId), eq(characters.isActive, true)))
    .limit(1)
  return char?.name ?? 'Inconnu'
}

/** Get a character name by userId (for "last modified by" display). */
async function characterNameByUserId(userId: number | null): Promise<string | null> {
  if (userId == null) return null
  return activeCharacterName(userId)
}

// ── Notes personnelles ───────────────────────────────────────────────────────

router.get('/perso', async (req, res) => {
  const { userId } = auth(req)
  const [user] = await db.select({ notesPerso: users.notesPerso }).from(users).where(eq(users.id, userId))
  res.json({ content: user?.notesPerso ?? '' })
})

router.put('/perso', async (req, res) => {
  const { userId } = auth(req)
  const { content } = req.body as { content: string }
  await db.update(users).set({ notesPerso: content ?? '' }).where(eq(users.id, userId))
  res.json({ ok: true })
})

// ── Journal de la compagnie (live) ───────────────────────────────────────────

router.get('/compagnie', async (_req, res) => {
  const [row] = await db.select().from(journalCompagnie).where(eq(journalCompagnie.id, 1))
  const lock = getActiveLock('compagnie')
  const lastEditedBy = await characterNameByUserId(row?.updatedByUserId ?? null)
  res.json({
    content: row?.content ?? '',
    lock: lock ? { userId: lock.userId, characterName: lock.characterName } : null,
    lastEditedBy,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  })
})

router.put('/compagnie', async (req, res) => {
  const { userId } = auth(req)
  if (!holdsLock('compagnie', userId)) {
    res.status(423).json({ error: 'Vous ne détenez pas le verrou.' })
    return
  }
  const { content } = req.body as { content: string }
  const charName = await activeCharacterName(userId)
  await db.update(journalCompagnie)
    .set({ content: content ?? '', updatedByUserId: userId, updatedAt: new Date() })
    .where(eq(journalCompagnie.id, 1))
  renewLock('compagnie', userId)
  broadcastContentUpdate('compagnie', content, { userId, characterName: charName })
  res.json({ ok: true })
})

router.post('/compagnie/lock', async (req, res) => {
  const { userId } = auth(req)
  const charName = await activeCharacterName(userId)
  const result = acquireLock('compagnie', userId, charName)
  if (result.ok) {
    res.json({ ok: true })
  } else {
    res.status(423).json({ ok: false, lockedBy: result.lockedBy })
  }
})

router.delete('/compagnie/lock', (req, res) => {
  const { userId } = auth(req)
  releaseLock('compagnie', userId)
  res.json({ ok: true })
})

router.get('/compagnie/events', (req, res) => {
  const { userId } = auth(req)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const client = { res, userId }
  registerSseClient('compagnie', client)

  const lock = getActiveLock('compagnie')
  if (lock) {
    res.write(`event: journal-locked\n`)
    res.write(`data: ${JSON.stringify({ userId: lock.userId, characterName: lock.characterName })}\n\n`)
  }

  req.on('close', () => {
    removeSseClient('compagnie', client)
    releaseLock('compagnie', userId)
  })
})

// ── Pages CRUD ───────────────────────────────────────────────────────────────

router.get('/pages', async (_req, res) => {
  const rows = await db
    .select({
      id: journalPages.id,
      title: journalPages.title,
      createdByUserId: journalPages.createdByUserId,
      updatedAt: journalPages.updatedAt,
    })
    .from(journalPages)
    .orderBy(desc(journalPages.createdAt))

  // Resolve character names for each page creator
  const enriched = await Promise.all(rows.map(async (row) => ({
    ...row,
    createdByCharacterName: await activeCharacterName(row.createdByUserId),
  })))

  res.json(enriched)
})

router.post('/pages', async (req, res) => {
  const { userId } = auth(req)
  const { title, content } = req.body as { title: string; content?: string }
  const [page] = await db.insert(journalPages).values({
    title,
    content: content ?? '',
    createdByUserId: userId,
    updatedByUserId: userId,
  }).returning()
  res.json(page)
})

router.get('/pages/:id', async (req, res) => {
  const id = Number(req.params.id)
  const [page] = await db.select().from(journalPages).where(eq(journalPages.id, id))
  if (!page) { res.status(404).json({ error: 'Page introuvable' }); return }
  const lock = getActiveLock(`page:${id}`)
  const lastEditedBy = await characterNameByUserId(page.updatedByUserId)
  res.json({
    ...page,
    lock: lock ? { userId: lock.userId, characterName: lock.characterName } : null,
    lastEditedBy,
  })
})

router.put('/pages/:id', async (req, res) => {
  const { userId } = auth(req)
  const id = Number(req.params.id)
  const resourceKey = `page:${id}`
  if (!holdsLock(resourceKey, userId)) {
    res.status(423).json({ error: 'Vous ne détenez pas le verrou.' })
    return
  }
  const { title, content } = req.body as { title?: string; content?: string }
  const updates: Record<string, unknown> = { updatedByUserId: userId, updatedAt: new Date() }
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content
  await db.update(journalPages).set(updates).where(eq(journalPages.id, id))
  renewLock(resourceKey, userId)
  if (content !== undefined) {
    const charName = await activeCharacterName(userId)
    broadcastContentUpdate(resourceKey, content, { userId, characterName: charName })
  }
  res.json({ ok: true })
})

router.delete('/pages/:id', async (req, res) => {
  const id = Number(req.params.id)
  await db.delete(journalPages).where(eq(journalPages.id, id))
  res.json({ ok: true })
})

// ── Pages lock + SSE ─────────────────────────────────────────────────────────

router.post('/pages/:id/lock', async (req, res) => {
  const { userId } = auth(req)
  const charName = await activeCharacterName(userId)
  const resourceKey = `page:${Number(req.params.id)}`
  const result = acquireLock(resourceKey, userId, charName)
  if (result.ok) {
    res.json({ ok: true })
  } else {
    res.status(423).json({ ok: false, lockedBy: result.lockedBy })
  }
})

router.delete('/pages/:id/lock', (req, res) => {
  const { userId } = auth(req)
  releaseLock(`page:${Number(req.params.id)}`, userId)
  res.json({ ok: true })
})

router.get('/pages/:id/events', (req, res) => {
  const { userId } = auth(req)
  const resourceKey = `page:${Number(req.params.id)}`

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const client = { res, userId }
  registerSseClient(resourceKey, client)

  const lock = getActiveLock(resourceKey)
  if (lock) {
    res.write(`event: journal-locked\n`)
    res.write(`data: ${JSON.stringify({ userId: lock.userId, characterName: lock.characterName })}\n\n`)
  }

  req.on('close', () => {
    removeSseClient(resourceKey, client)
    releaseLock(resourceKey, userId)
  })
})

export default router
