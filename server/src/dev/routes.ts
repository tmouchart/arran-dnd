import { asc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { campaigns, users } from '../db/schema.js'
import { signToken } from '../auth/jwt.js'
import { toAvatarLink } from '../avatarUrl.js'
import { devToolsEnabled } from './enabled.js'
import { seedDev } from './seed.js'
import { createPresetCombat, PRESETS, type PresetId } from './presets.js'
import { broadcastCombatState } from '../combats/sseStore.js'

const router = Router()

/**
 * Deuxième verrou. Le routeur n'est déjà monté qu'en dev, mais un endpoint qui
 * délivre le compte de n'importe qui mérite une ceinture ET des bretelles :
 * si `devToolsEnabled()` devient faux, tout renvoie 404.
 */
router.use((_req, res, next) => {
  if (!devToolsEnabled()) { res.status(404).json({ error: 'Not found' }); return }
  next()
})

/** Qui puis-je incarner, et où. */
router.get('/users', async (_req, res) => {
  const rows = await db
    .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
    .from(users)
    .orderBy(asc(users.id))
  const gmCampaigns = await db
    .select({ gmUserId: campaigns.gmUserId, name: campaigns.name })
    .from(campaigns)
    .orderBy(asc(campaigns.id))

  // Un MJ peut avoir plusieurs campagnes : on les liste toutes, sinon on ne sait
  // pas laquelle on va incarner.
  const gmOf = new Map<number, string[]>()
  for (const c of gmCampaigns) {
    gmOf.set(c.gmUserId, [...(gmOf.get(c.gmUserId) ?? []), c.name])
  }

  res.json(rows.map((u) => ({
    id: u.id,
    username: u.username,
    // Les avatars sont stockés en base64 : sans ça la réponse pèse des mégas.
    avatarUrl: toAvatarLink(u.id, u.avatarUrl),
    gmOf: gmOf.get(u.id)?.join(', ') ?? null,
  })))
})

/** Change d'identité sans mot de passe. Dev uniquement, évidemment. */
router.post('/switch-user', async (req, res) => {
  const { userId } = req.body as { userId?: number }
  if (typeof userId !== 'number') { res.status(400).json({ error: 'userId requis' }); return }

  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return }

  res.cookie('token', signToken(user.id, user.username), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
  })
  console.log(`[dev] switch-user → ${user.username} (id=${user.id})`)
  res.json({ user: { id: user.id, username: user.username } })
})

/** Recrée le bac à sable. */
router.post('/seed', async (_req, res) => {
  const result = await seedDev()
  console.log(`[dev] seed → campagne ${result.campaignId}`)
  res.json(result)
})

/** Les presets disponibles, pour que le client n'ait pas à les redéclarer. */
router.get('/combat-presets', (_req, res) => {
  res.json(PRESETS)
})

/** Lance un combat bidon dans une campagne. */
router.post('/combat', async (req, res) => {
  const { campaignId, preset } = req.body as { campaignId?: number; preset?: PresetId }
  if (typeof campaignId !== 'number') { res.status(400).json({ error: 'campaignId requis' }); return }
  if (!PRESETS.some((p) => p.id === preset)) { res.status(400).json({ error: 'preset inconnu' }); return }

  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId))
  if (!campaign) { res.status(404).json({ error: 'Campagne introuvable' }); return }

  const result = await createPresetCombat(campaignId, preset as PresetId)
  await broadcastCombatState(result.combatId, campaign.gmUserId)
  console.log(`[dev] combat "${preset}" → id=${result.combatId} (${result.participantCount} participants)`)
  res.status(201).json(result)
})

export default router
