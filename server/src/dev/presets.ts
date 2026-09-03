import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { combats, combatParticipants, campaignMembers, characters } from '../db/schema.js'
import { computeInitiative } from '../routes/combats.js'
import { turnOrder, firstActiveId, step } from '../combats/turnOrder.js'
import { DEV_BESTIARY, type DevMonster } from './bestiary.js'

export type PresetId = 'simple' | 'agonie' | 'monstre-mort' | 'foule' | 'egalites'

export const PRESETS: { id: PresetId; label: string; hint: string }[] = [
  { id: 'simple', label: 'Combat simple', hint: 'Les PJ + 3 monstres, round 1' },
  { id: 'agonie', label: 'Un PJ en agonie', hint: 'Un joueur à 0 PV, encore dans l\'ordre' },
  { id: 'monstre-mort', label: 'Round 3, un mort', hint: 'Un monstre à 0 PV doit être sauté' },
  { id: 'foule', label: 'Foule (12)', hint: 'Teste le scroll et les perfs de la liste' },
  { id: 'egalites', label: 'Égalités d\'initiative', hint: 'Tout le monde à 12 : teste le tri stable' },
]

function pick(n: number): DevMonster[] {
  const pool = [...DEV_BESTIARY]
  const out: DevMonster[] = []
  for (let i = 0; i < n; i++) {
    // Le bestiaire est petit : au-delà on repioche, en suffixant le nom.
    out.push(pool[i % pool.length])
  }
  return out
}

/** Deux « Loup des landes » dans la même liste sont illisibles : on numérote. */
function numberDuplicates(monsters: DevMonster[]): { monster: DevMonster; name: string }[] {
  const seen = new Map<string, number>()
  const total = new Map<string, number>()
  for (const m of monsters) total.set(m.name, (total.get(m.name) ?? 0) + 1)
  return monsters.map((m) => {
    const n = (seen.get(m.name) ?? 0) + 1
    seen.set(m.name, n)
    return { monster: m, name: (total.get(m.name) ?? 0) > 1 ? `${m.name} ${n}` : m.name }
  })
}

export interface PresetResult {
  combatId: number
  participantCount: number
}

/**
 * Crée un combat de test directement en base. On n'appelle pas la route normale :
 * un preset doit pouvoir poser un état arbitraire (round 3, un mort, des PV
 * précis) que l'API de jeu ne permet pas — et c'est justement le but.
 */
export async function createPresetCombat(campaignId: number, preset: PresetId): Promise<PresetResult> {
  const monsterCount = preset === 'foule' ? 8 : 3

  const [combat] = await db.insert(combats).values({
    campaignId,
    name: `[dev] ${PRESETS.find((p) => p.id === preset)?.label ?? preset}`,
    roundNumber: preset === 'monstre-mort' ? 3 : 1,
  }).returning({ id: combats.id })

  // --- Les joueurs de la campagne
  const members = await db
    .select({ userId: campaignMembers.userId, characterId: campaignMembers.characterId })
    .from(campaignMembers)
    .where(eq(campaignMembers.campaignId, campaignId))

  let firstPlayerId: number | null = null
  for (const member of members) {
    if (!member.characterId) continue
    const [char] = await db.select().from(characters).where(eq(characters.id, member.characterId))
    if (!char) continue

    const [row] = await db.insert(combatParticipants).values({
      combatId: combat.id,
      kind: 'player',
      userId: member.userId,
      name: char.name,
      initiative: preset === 'egalites' ? 12 : computeInitiative(char),
      hpMax: null,
      hpCurrent: null,
      def: char.defense,
    }).returning({ id: combatParticipants.id })
    firstPlayerId ??= row.id
  }

  // --- Les monstres
  const named = numberDuplicates(pick(monsterCount))
  const monsterIds: number[] = []
  for (const { monster, name } of named) {
    const [row] = await db.insert(combatParticipants).values({
      combatId: combat.id,
      kind: 'monster',
      name,
      initiative: preset === 'egalites' ? 12 : monster.init,
      hpMax: monster.pv,
      hpCurrent: monster.pv,
      def: monster.def,
      nc: monster.nc,
      statFor: monster.statFor, statDex: monster.statDex, statCon: monster.statCon,
      statInt: monster.statInt, statSag: monster.statSag, statCha: monster.statCha,
      attacks: monster.attacks,
      abilities: monster.abilities,
      monsterDescription: monster.description,
    }).returning({ id: combatParticipants.id })
    monsterIds.push(row.id)
  }

  // --- L'état particulier du preset
  if (preset === 'agonie' && firstPlayerId) {
    // Les PV d'un joueur vivent sur sa fiche, pas sur le participant.
    const [p] = await db.select().from(combatParticipants).where(eq(combatParticipants.id, firstPlayerId))
    const [member] = members.filter((m) => m.userId === p.userId)
    if (member?.characterId) {
      await db.update(characters).set({ hpCurrent: 0 }).where(eq(characters.id, member.characterId))
    }
  }
  if (preset === 'monstre-mort' && monsterIds.length > 0) {
    await db.update(combatParticipants).set({ hpCurrent: 0 }).where(eq(combatParticipants.id, monsterIds[0]))
  }

  // --- Qui commence
  const all = await db.select().from(combatParticipants).where(eq(combatParticipants.combatId, combat.id))
  const order = turnOrder(all)
  // Sur « round 3 », on démarre au milieu de l'ordre : plus réaliste qu'un round
  // 3 qui commencerait pile sur la meilleure initiative.
  const startId = preset === 'monstre-mort'
    ? (step(order, firstActiveId(order), 1)?.participantId ?? null)
    : firstActiveId(order)
  await db.update(combats).set({ currentParticipantId: startId }).where(eq(combats.id, combat.id))

  return { combatId: combat.id, participantCount: all.length }
}
