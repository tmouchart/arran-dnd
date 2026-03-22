import { eq, and } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { characters, users } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'
import {
  sessions,
  sseClients,
  getClientsForSession,
  broadcastToSession,
  buildGmState,
  buildPlayerState,
  type GameSession,
} from '../sessions/store.js'

const router = Router()
router.use(requireAuth)

// ── POST /api/sessions — créer une session ────────────────────────────────────
router.post('/', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const { name } = req.body as { name?: string }
  if (!name?.trim()) {
    res.status(400).json({ error: 'name requis' })
    return
  }

  const sessionId = crypto.randomUUID()
  const session: GameSession = {
    id: sessionId,
    name: name.trim(),
    gmUserId: userId,
    participants: new Map(),
    monsters: new Map(),
    createdAt: new Date(),
  }
  sessions.set(sessionId, session)

  res.status(201).json(buildGmState(session))
})

// ── GET /api/sessions — lister les sessions actives ───────────────────────────
router.get('/', (_req, res) => {
  const list = [...sessions.values()].map((s) => ({
    id: s.id,
    name: s.name,
    gmUserId: s.gmUserId,
    participantCount: s.participants.size,
    createdAt: s.createdAt,
  }))
  res.json(list)
})

// ── POST /api/sessions/:id/join — rejoindre ───────────────────────────────────
router.post('/:id/join', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const session = sessions.get(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session introuvable' })
    return
  }
  if (userId === session.gmUserId) {
    // Le MJ ne rejoint pas comme joueur — renvoyer l'état courant
    res.json(buildGmState(session))
    return
  }
  if (session.participants.has(userId)) {
    // Déjà membre — renvoyer l'état courant
    res.json(buildPlayerState(session))
    return
  }

  const [userRow] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!userRow) {
    res.status(401).json({ error: 'Utilisateur introuvable' })
    return
  }

  const [activeChar] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.userId, userId), eq(characters.isActive, true)))
    .limit(1)
  if (!activeChar) {
    res.status(400).json({ error: 'Aucun personnage actif' })
    return
  }

  const { hpCurrent } = req.body as { hpCurrent?: number }
  session.participants.set(userId, {
    userId,
    username: userRow.username,
    characterId: activeChar.id,
    characterName: activeChar.name,
    hpCurrent: typeof hpCurrent === 'number' ? hpCurrent : activeChar.hpCurrent,
    hpMax: activeChar.hpMax,
    initiative: null,
  })

  broadcastToSession(session.id, session)

  const payload =
    userId === session.gmUserId
      ? buildGmState(session)
      : buildPlayerState(session)
  res.json(payload)
})

// ── POST /api/sessions/:id/leave — quitter ────────────────────────────────────
router.post('/:id/leave', (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const session = sessions.get(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session introuvable' })
    return
  }

  if (userId === session.gmUserId) {
    // Le MJ termine la session
    sessions.delete(session.id)
    sseClients.delete(session.id)
  } else {
    session.participants.delete(userId)
    broadcastToSession(session.id, session)
  }

  res.json({ ok: true })
})

// ── POST /api/sessions/:id/monsters — ajouter un monstre (MJ) ────────────────
router.post('/:id/monsters', (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const session = sessions.get(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session introuvable' })
    return
  }
  if (session.gmUserId !== userId) {
    res.status(403).json({ error: 'Réservé au MJ' })
    return
  }

  const { name, hpMax, initiative } = req.body as {
    name?: string
    hpMax?: number
    initiative?: number
  }
  if (!name?.trim() || typeof hpMax !== 'number' || hpMax < 1) {
    res.status(400).json({ error: 'name et hpMax (≥1) requis' })
    return
  }

  const monsterId = crypto.randomUUID()
  const monster = {
    id: monsterId,
    name: name.trim(),
    hpMax,
    hpCurrent: hpMax,
    initiative: typeof initiative === 'number' ? initiative : null,
  }
  session.monsters.set(monsterId, monster)

  broadcastToSession(session.id, session)
  res.status(201).json(monster)
})

// ── PATCH /api/sessions/:id/monsters/:mid — update HP/initiative (MJ) ─────────
router.patch('/:id/monsters/:mid', (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const session = sessions.get(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session introuvable' })
    return
  }
  if (session.gmUserId !== userId) {
    res.status(403).json({ error: 'Réservé au MJ' })
    return
  }

  const monster = session.monsters.get(req.params.mid)
  if (!monster) {
    res.status(404).json({ error: 'Monstre introuvable' })
    return
  }

  const { hpCurrent, initiative, name } = req.body as {
    hpCurrent?: number
    initiative?: number
    name?: string
  }
  if (typeof hpCurrent === 'number') {
    monster.hpCurrent = Math.max(0, Math.min(hpCurrent, monster.hpMax))
  }
  if (typeof initiative === 'number') {
    monster.initiative = initiative
  }
  if (typeof name === 'string' && name.trim()) {
    monster.name = name.trim()
  }

  broadcastToSession(session.id, session)
  res.json(monster)
})

// ── DELETE /api/sessions/:id/monsters/:mid — retirer un monstre (MJ) ──────────
router.delete('/:id/monsters/:mid', (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const session = sessions.get(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session introuvable' })
    return
  }
  if (session.gmUserId !== userId) {
    res.status(403).json({ error: 'Réservé au MJ' })
    return
  }
  if (!session.monsters.has(req.params.mid)) {
    res.status(404).json({ error: 'Monstre introuvable' })
    return
  }

  session.monsters.delete(req.params.mid)
  broadcastToSession(session.id, session)
  res.json({ ok: true })
})

// ── PATCH /api/sessions/:id/initiative — joueur set son initiative ─────────────
router.patch('/:id/initiative', (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const session = sessions.get(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session introuvable' })
    return
  }
  if (!session.participants.has(userId)) {
    res.status(403).json({ error: 'Non participant à cette session' })
    return
  }

  const { initiative } = req.body as { initiative?: unknown }
  if (typeof initiative !== 'number' || !Number.isInteger(initiative) || initiative < -10 || initiative > 100) {
    res.status(400).json({ error: 'initiative doit être un entier entre -10 et 100' })
    return
  }

  const participant = session.participants.get(userId)!
  participant.initiative = initiative

  broadcastToSession(session.id, session)
  res.json({ ok: true })
})

// ── GET /api/sessions/:id/events — flux SSE ───────────────────────────────────
router.get('/:id/events', (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const session = sessions.get(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session introuvable' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const client = { res, userId }
  const clients = getClientsForSession(req.params.id)
  clients.add(client)

  // Envoyer l'état courant immédiatement
  const payload =
    userId === session.gmUserId
      ? buildGmState(session)
      : buildPlayerState(session)
  res.write(`event: session-updated\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)

  req.on('close', () => {
    clients.delete(client)
  })
})

export default router
