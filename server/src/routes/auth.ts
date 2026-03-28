import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { signToken } from '../auth/jwt.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'
import googleAuthRouter from './googleAuth.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string }
  if (!username || !password) {
    res.status(400).json({ error: 'username et password requis' })
    return
  }

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1)
  if (!user) {
    res.status(401).json({ error: 'Identifiants incorrects' })
    return
  }

  if (!user.passwordHash) {
    res.status(401).json({ error: 'Ce compte utilise la connexion Google' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Identifiants incorrects' })
    return
  }

  const token = signToken(user.id, user.username)
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  console.log(`[auth] login: user=${user.username}`)
  res.json({ user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl ?? null } })
})

router.post('/register', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string }
  if (!username || !password) {
    res.status(400).json({ error: 'username et password requis' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' })
    return
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
  if (existing) {
    res.status(409).json({ error: 'Cet identifiant est déjà utilisé' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const [newUser] = await db.insert(users).values({ username, passwordHash }).returning({ id: users.id, username: users.username })

  const token = signToken(newUser.id, newUser.username)
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  console.log(`[auth] register: user=${newUser.username}`)
  res.status(201).json({ user: { id: newUser.id, username: newUser.username } })
})

router.post('/logout', requireAuth, (_req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId
  const [user] = await db.select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user) {
    res.status(401).json({ error: 'Utilisateur introuvable' })
    return
  }
  res.json({ user: { ...user, avatarUrl: user.avatarUrl ?? null } })
})

router.patch('/me', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId
  const { avatarUrl, username } = req.body as { avatarUrl?: string | null; username?: string }

  if (username !== undefined) {
    if (!username.trim()) {
      res.status(400).json({ error: "Le nom d'utilisateur ne peut pas être vide" })
      return
    }
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username.trim()))
      .limit(1)
    if (existing && existing.id !== userId) {
      res.status(409).json({ error: 'Ce nom est déjà utilisé' })
      return
    }
  }

  const patch: Partial<typeof users.$inferInsert> = {}
  if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl ?? null
  if (username !== undefined) patch.username = username.trim()

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
  res.json({ user: { ...updated, avatarUrl: updated.avatarUrl ?? null } })
})

router.use('/google', googleAuthRouter)

export default router
