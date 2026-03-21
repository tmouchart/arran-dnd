import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { signToken } from '../auth/jwt.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'

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

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Identifiants incorrects' })
    return
  }

  const token = signToken(user.id)
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  })
  res.json({ user: { id: user.id, username: user.username } })
})

router.post('/logout', requireAuth, (_req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId
  const [user] = await db.select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user) {
    res.status(401).json({ error: 'Utilisateur introuvable' })
    return
  }
  res.json({ user })
})

export default router
