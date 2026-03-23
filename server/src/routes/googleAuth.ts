import { OAuth2Client } from 'google-auth-library'
import { Router } from 'express'
import { eq, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { signToken } from '../auth/jwt.js'

const router = Router()

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ''
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/auth/google/callback'
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173'

const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

// GET /api/auth/google
router.get('/', (_req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  })
  res.redirect(url)
})

// GET /api/auth/google/callback
router.get('/callback', async (req, res) => {
  const code = req.query.code as string | undefined
  if (!code) {
    res.redirect(`${CLIENT_URL}/login?error=google_cancelled`)
    return
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: CLIENT_ID,
    })
    const payload = ticket.getPayload()!

    const googleId = payload.sub
    const email = payload.email ?? null
    const displayName = payload.name ?? email?.split('@')[0] ?? 'Aventurier'

    // Find existing user by googleId or email
    const conditions = [eq(users.googleId, googleId)]
    if (email) conditions.push(eq(users.email, email))

    let [user] = await db
      .select()
      .from(users)
      .where(or(...conditions))
      .limit(1)

    if (!user) {
      // New user — generate unique username from display name
      const base = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 20)
        .replace(/_+$/g, '')
      let username = base || 'aventurier'
      let suffix = 1
      while (true) {
        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, username))
          .limit(1)
        if (!existing) break
        username = `${base}_${suffix++}`
      }

      ;[user] = await db
        .insert(users)
        .values({ username, passwordHash: null, googleId, email })
        .returning()
    } else if (!user.googleId) {
      // Existing password account with matching email — link Google ID
      ;[user] = await db
        .update(users)
        .set({ googleId, email: email ?? user.email })
        .where(eq(users.id, user.id))
        .returning()
    }

    const token = signToken(user.id, user.username)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })
    console.log(`[auth] google-login: user=${user.username}`)
    res.redirect(CLIENT_URL)
  } catch (err) {
    console.error('[google-auth] OAuth callback error:', err)
    res.redirect(`${CLIENT_URL}/login?error=google_failed`)
  }
})

export default router
