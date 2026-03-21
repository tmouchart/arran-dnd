import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { characters } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'
type SkillRow = { name: string; rank: number }
type AttackRow = { name: string; attackBonus: string; damage: string; notes?: string }
type PathRow = { id?: string; name: string; rank: number; kind?: string; notes?: string }

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
    people: string
    level: number
    hpMax: number
    mpMax: number
    defense: number
    initiativeBonus: number
    str: number; dex: number; con: number; int: number; wis: number; cha: number
    skills: SkillRow[]
    attacks: AttackRow[]
    paths: PathRow[]
    mysticTalent: string | null
  }>

  const existing = await db.select({ id: characters.id }).from(characters).where(eq(characters.userId, userId)).limit(1)
  const isFirst = existing.length === 0

  const [row] = await db.insert(characters).values({
    userId,
    isActive: isFirst,
    name: body.name ?? 'Nouveau héros',
    profile: body.profile ?? '',
    people: body.people ?? '',
    level: body.level ?? 1,
    hpMax: body.hpMax ?? 10,
    mpMax: body.mpMax ?? 0,
    defense: body.defense ?? 12,
    initiativeBonus: body.initiativeBonus ?? 0,
    str: body.str ?? 10,
    dex: body.dex ?? 10,
    con: body.con ?? 10,
    int: body.int ?? 10,
    wis: body.wis ?? 10,
    cha: body.cha ?? 10,
    skills: body.skills ?? [],
    attacks: body.attacks ?? [],
    paths: body.paths ?? [],
    mysticTalent: body.mysticTalent ?? null,
  }).returning()

  res.status(201).json(row)
})

// PUT /api/characters/:id — met à jour la fiche statique
router.put('/:id', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId
  const id = Number(req.params.id)
  const body = req.body as Partial<{
    name: string
    profile: string
    people: string
    level: number
    hpMax: number
    mpMax: number
    defense: number
    initiativeBonus: number
    str: number; dex: number; con: number; int: number; wis: number; cha: number
    skills: SkillRow[]
    attacks: AttackRow[]
    paths: PathRow[]
    mysticTalent: string | null
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
