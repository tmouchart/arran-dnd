import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { characters } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'

function username(req: unknown): string {
  return (req as AuthRequest).username ?? 'unknown'
}
import { syncParticipantHpFromCharacter } from '../sessions/store.js'
type SkillRow = { name: string; rank: number }
type PathRow = { id?: string; name: string; rank: number; kind?: string; notes?: string }
type ItemRow = { id: string; name: string; description?: string; quantity: number }
type WeaponRow = {
  id: string
  name: string
  attackType: 'contact' | 'distance'
  damageDice: string
  damageAbility: 'strength' | 'dexterity' | null
  martialFamily: string
  rangeMeters: number | null
  catalogId?: string
  notes?: string
}

const router = Router()
router.use(requireAuth)

// GET /api/characters — liste les personnages de l'utilisateur
router.get('/', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const rows = await db.select().from(characters).where(eq(characters.userId, userId))
  res.json(rows)
})

// GET /api/characters/:id
router.get('/:id', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)
  const [row] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
  if (!row) {
    res.status(404).json({ error: 'Personnage introuvable' })
    return
  }
  res.json(row)
})

// POST /api/characters — crée un personnage
router.post('/', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const body = req.body as Partial<{
    name: string
    profile: string
    histoire: string
    people: string
    level: number
    hpMax: number
    hpCurrent?: number
    mpMax: number
    defense: number
    initiativeBonus: number
    str: number; dex: number; con: number; int: number; wis: number; cha: number
    skills: SkillRow[]
    weapons: WeaponRow[]
    martialFormations: string[]
    paths: PathRow[]
    mysticTalent: string | null
    armorId: string | null
    shieldId: string | null
    items: ItemRow[]
    goldCoins: number
    silverCoins: number
    copperCoins: number
    pcCurrent: number
    prCurrent: number
  }>

  const existing = await db.select({ id: characters.id }).from(characters).where(eq(characters.userId, userId)).limit(1)
  const isFirst = existing.length === 0

  const dex = body.dex ?? 10
  const hpMax = body.hpMax ?? 10
  const [row] = await db.insert(characters).values({
    userId,
    isActive: isFirst,
    name: body.name ?? 'Nouveau héros',
    profile: body.profile ?? '',
    histoire: body.histoire ?? '',
    people: body.people ?? '',
    level: body.level ?? 1,
    hpMax,
    hpCurrent: typeof body.hpCurrent === 'number' ? body.hpCurrent : hpMax,
    mpMax: body.mpMax ?? 0,
    defense: body.defense ?? 12,
    // Base initiative score = DEX (Terres d’Arran); default follows dex when omitted
    initiativeBonus: body.initiativeBonus ?? dex,
    str: body.str ?? 10,
    dex,
    con: body.con ?? 10,
    int: body.int ?? 10,
    wis: body.wis ?? 10,
    cha: body.cha ?? 10,
    skills: body.skills ?? [],
    weapons: body.weapons ?? [],
    martialFormations: body.martialFormations ?? [],
    paths: body.paths ?? [],
    mysticTalent: body.mysticTalent ?? null,
  }).returning()

  console.log(`[character] created: user=${username(req)} name="${row.name}"`)
  res.status(201).json(row)
})

// PUT /api/characters/:id — met à jour la fiche statique
router.put('/:id', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)
  const { attacks: _legacyAttacks, ...rawBody } = (req.body ?? {}) as Record<string, unknown>
  const body = rawBody as Partial<{
    name: string
    profile: string
    histoire: string
    people: string
    level: number
    hpMax: number
    hpCurrent: number
    mpMax: number
    defense: number
    initiativeBonus: number
    str: number; dex: number; con: number; int: number; wis: number; cha: number
    skills: SkillRow[]
    weapons: WeaponRow[]
    martialFormations: string[]
    paths: PathRow[]
    mysticTalent: string | null
    armorId: string | null
    shieldId: string | null
    items: ItemRow[]
    goldCoins: number
    silverCoins: number
    copperCoins: number
    pcCurrent: number
    prCurrent: number
  }>

  const [row] = await db
    .update(characters)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .returning()

  if (!row) {
    res.status(404).json({ error: 'Personnage introuvable' })
    return
  }
  console.log(`[character] updated: user=${username(req)} name="${row.name}"`)
  syncParticipantHpFromCharacter(row.id, userId, row.hpCurrent, row.hpMax)
  res.json(row)
})

// PATCH /api/characters/:id — met à jour les PV courants (pj)
router.patch('/:id', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)
  const { hpCurrent } = req.body as { hpCurrent?: unknown }
  if (typeof hpCurrent !== 'number' || !Number.isFinite(hpCurrent)) {
    res.status(400).json({ error: 'hpCurrent doit être un nombre' })
    return
  }

  const [existing] = await db
    .select({ hpMax: characters.hpMax })
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))

  if (!existing) {
    res.status(404).json({ error: 'Personnage introuvable' })
    return
  }

  const clamped = Math.max(0, Math.min(Math.round(hpCurrent), existing.hpMax))
  const [row] = await db
    .update(characters)
    .set({ hpCurrent: clamped, updatedAt: new Date() })
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .returning()

  if (!row) {
    res.status(404).json({ error: 'Personnage introuvable' })
    return
  }
  syncParticipantHpFromCharacter(row.id, userId, row.hpCurrent, row.hpMax)
  res.json(row)
})

// DELETE /api/characters/:id
router.delete('/:id', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)

  const [row] = await db
    .delete(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .returning({ id: characters.id })

  if (!row) {
    res.status(404).json({ error: 'Personnage introuvable' })
    return
  }
  res.json({ ok: true })
})

// POST /api/characters/:id/activate
router.post('/:id/activate', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)

  await db.transaction(async (tx) => {
    await tx
      .update(characters)
      .set({ isActive: false })
      .where(eq(characters.userId, userId))

    const [row] = await tx
      .update(characters)
      .set({ isActive: true })
      .where(and(eq(characters.id, id), eq(characters.userId, userId)))
      .returning({ id: characters.id })

    if (!row) throw new Error('not_found')
  }).catch((err) => {
    if (err.message === 'not_found') {
      res.status(404).json({ error: 'Personnage introuvable' })
      return
    }
    throw err
  })

  if (!res.headersSent) res.json({ ok: true })
})

export default router
