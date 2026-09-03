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
} from '../journal/locks.js'
import { mergeStrokesJson } from '../journal/strokes.js'
import { saveWithRevision } from '../revisions/service.js'

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
    version: row?.version ?? 1,
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
  const { content, expectedVersion } = req.body as { content: string; expectedVersion?: number }
  renewLock('compagnie', userId)

  const result = await saveWithRevision({
    type: 'journal_compagnie',
    id: 1,
    snapshot: { content: content ?? '' },
    userId,
    expectedVersion: expectedVersion ?? null,
    skipLockCheck: true, // déjà vérifié juste au-dessus
  })
  if (result.status === 'conflict') {
    res.status(409).json({
      error: 'Le journal a été modifié entre-temps.',
      currentVersion: result.currentVersion,
      content: result.snapshot.content ?? '',
    })
    return
  }
  if (result.status !== 'ok') { res.status(404).json({ error: 'Journal introuvable' }); return }
  res.json({ ok: true, version: result.version })
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

router.get('/compagnie/events', async (req, res) => {
  const { userId } = auth(req)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const client = { res, userId }
  registerSseClient('compagnie', client)

  // Heartbeat : le proxy Fly coupe une connexion inactive (~60s). Sans ça le flux
  // meurt en silence et l'éditeur se retrouve désynchronisé sans le savoir.
  const heartbeat = setInterval(() => { res.write(': ping\n\n') }, 25000)

  const lock = getActiveLock('compagnie')
  if (lock) {
    res.write(`event: journal-locked\n`)
    res.write(`data: ${JSON.stringify({ userId: lock.userId, characterName: lock.characterName })}\n\n`)
  }

  // État initial : sans ça, un client qui se reconnecte (veille du téléphone,
  // coupure réseau) garde indéfiniment un contenu périmé et l'écrase à la
  // prochaine frappe.
  const [row] = await db.select().from(journalCompagnie).where(eq(journalCompagnie.id, 1))
  res.write(`event: journal-snapshot\n`)
  res.write(`data: ${JSON.stringify({ content: row?.content ?? '', version: row?.version ?? 1 })}\n\n`)

  req.on('close', () => {
    clearInterval(heartbeat)
    removeSseClient('compagnie', client)
    // Le verrou n'est PAS libéré ici : la mort du flux est le cas normal (proxy,
    // veille), pas un abandon. Le TTL de 60s s'en charge, et le client le
    // renouvelle tant que l'onglet est actif.
  })
})

// ── Pages CRUD ───────────────────────────────────────────────────────────────

router.get('/pages', async (_req, res) => {
  const rows = await db
    .select({
      id: journalPages.id,
      title: journalPages.title,
      type: journalPages.type,
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
  const { title, content, type } = req.body as { title: string; content?: string; type?: string }
  if (type && type !== 'text' && type !== 'drawing') {
    res.status(400).json({ error: 'Type invalide (text ou drawing).' })
    return
  }
  const [page] = await db.insert(journalPages).values({
    title,
    type: type === 'drawing' ? 'drawing' : 'text',
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

  // Drawing pages don't require locks (collaborative drawing)
  const [pageRow] = await db.select().from(journalPages).where(eq(journalPages.id, id))
  if (!pageRow) { res.status(404).json({ error: 'Page introuvable' }); return }
  if (pageRow.type !== 'drawing' && !holdsLock(resourceKey, userId)) {
    res.status(423).json({ error: 'Vous ne détenez pas le verrou.' })
    return
  }

  const { title, content, expectedVersion } = req.body as {
    title?: string; content?: string; expectedVersion?: number
  }
  renewLock(resourceKey, userId)

  // Un dessin n'a pas de verrou : deux personnes tracent en même temps et
  // envoient chacune la liste complète. On fusionne au lieu d'écraser, sinon
  // une copie vieille de trois secondes efface les traits des autres.
  const nextContent =
    content !== undefined && pageRow.type === 'drawing'
      ? mergeStrokesJson(pageRow.content, content)
      : content

  // Le PUT accepte des mises à jour partielles → on complète avec l'existant
  // pour obtenir le snapshot complet attendu par l'historique.
  const result = await saveWithRevision({
    type: 'journal_page',
    id,
    snapshot: {
      title: title ?? pageRow.title,
      content: nextContent ?? pageRow.content,
    },
    userId,
    expectedVersion: expectedVersion ?? null,
    skipLockCheck: true,
  })
  if (result.status === 'conflict') {
    res.status(409).json({
      error: 'La page a été modifiée entre-temps.',
      currentVersion: result.currentVersion,
      content: result.snapshot.content ?? '',
      title: result.snapshot.title ?? '',
    })
    return
  }
  if (result.status !== 'ok') { res.status(404).json({ error: 'Page introuvable' }); return }
  // Le dessin a pu être fusionné : on renvoie le résultat, sinon l'auteur garde
  // à l'écran une version amputée des traits des autres.
  const merged = nextContent !== undefined && nextContent !== content ? nextContent : undefined
  res.json({ ok: true, version: result.version, content: merged })
})

router.delete('/pages/:id', async (req, res) => {
  const { userId } = auth(req)
  const id = Number(req.params.id)
  const [page] = await db
    .select({ createdByUserId: journalPages.createdByUserId })
    .from(journalPages)
    .where(eq(journalPages.id, id))
  if (!page) { res.status(404).json({ error: 'Page introuvable' }); return }
  if (page.createdByUserId !== userId) {
    res.status(403).json({ error: 'Seul l’auteur de la page peut la supprimer.' })
    return
  }
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

router.get('/pages/:id/events', async (req, res) => {
  const { userId } = auth(req)
  const pageId = Number(req.params.id)
  const resourceKey = `page:${pageId}`

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const client = { res, userId }
  registerSseClient(resourceKey, client)

  // Heartbeat : voir /compagnie/events.
  const heartbeat = setInterval(() => { res.write(': ping\n\n') }, 25000)

  const lock = getActiveLock(resourceKey)
  if (lock) {
    res.write(`event: journal-locked\n`)
    res.write(`data: ${JSON.stringify({ userId: lock.userId, characterName: lock.characterName })}\n\n`)
  }

  const [row] = await db.select().from(journalPages).where(eq(journalPages.id, pageId))
  res.write(`event: journal-snapshot\n`)
  res.write(`data: ${JSON.stringify({ content: row?.content ?? '', version: row?.version ?? 1 })}\n\n`)

  req.on('close', () => {
    clearInterval(heartbeat)
    removeSseClient(resourceKey, client)
    // Verrou volontairement conservé — voir /compagnie/events.
  })
})

export default router
