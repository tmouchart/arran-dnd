import bcrypt from 'bcryptjs'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  users, characters, campaigns, campaignMembers, encounterTemplates, encounterMonsters,
} from '../db/schema.js'
import { DEV_BESTIARY } from './bestiary.js'

export const SEED_CAMPAIGN_NAME = 'Bac à sable'
export const SEED_PASSWORD = 'dev'

/** Le MJ du bac à sable. Les autres comptes sont ses joueurs. */
export const SEED_GM = 'mj-dev'

/**
 * Fiches volontairement variées : c'est là qu'on attrape les bugs.
 * - une armure lourde → initiative très basse, voire négative
 * - un perso à 2 PV → teste l'agonie et les seuils de couleur
 * - deux DEX identiques → teste les égalités d'initiative
 */
export const SEED_PLAYERS = [
  {
    username: 'bracco',
    character: {
      name: 'Bracco Pouce-Cassé', profile: 'Guerrier', people: 'Nain', level: 5,
      hpMax: 48, hpCurrent: 48, defense: 18, armorId: 'cotte-mailles', shieldId: 'grand-bouclier',
      str: 17, dex: 12, con: 16, int: 8, wis: 10, cha: 9, initiativeBonus: 0,
    },
  },
  {
    username: 'nym',
    character: {
      name: 'Nym la Vive', profile: 'Voleur', people: 'Halfelin', level: 5,
      hpMax: 30, hpCurrent: 30, defense: 16, armorId: 'cuir', shieldId: null,
      str: 9, dex: 18, con: 11, int: 13, wis: 12, cha: 14, initiativeBonus: 2,
    },
  },
  {
    username: 'orlane',
    character: {
      // À 2 PV : teste l'agonie, les seuils de couleur et le tri des mourants.
      name: 'Orlane du Vent', profile: 'Magicien', people: 'Humain', level: 5,
      hpMax: 26, hpCurrent: 2, mpMax: 20, mpCurrent: 14, defense: 12, armorId: null, shieldId: null,
      str: 8, dex: 14, con: 10, int: 18, wis: 13, cha: 12, initiativeBonus: 0,
    },
  },
  {
    username: 'kaeliss',
    character: {
      // Même DEX que Nym, sans le bonus : teste les égalités d'initiative.
      name: 'Kaeliss Feuille-Grise', profile: 'Rôdeur', people: 'Elfe sylvain', level: 5,
      hpMax: 34, hpCurrent: 34, defense: 15, armorId: 'cuir-renforce', shieldId: null,
      str: 12, dex: 18, con: 12, int: 11, wis: 15, cha: 10, initiativeBonus: 0,
    },
  },
] as const

async function upsertUser(username: string, passwordHash: string): Promise<number> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username))
  if (existing) return existing.id
  const [created] = await db.insert(users).values({ username, passwordHash }).returning({ id: users.id })
  return created.id
}

export interface SeedResult {
  campaignId: number
  gmUserId: number
  playerUserIds: number[]
  encounterId: number
}

/**
 * (Re)construit le bac à sable de dev. Idempotent : les comptes sont réutilisés,
 * mais la campagne est **supprimée puis recréée** — c'est ce qui garantit qu'on
 * repart d'un état propre (la cascade emporte combats, journal, codex…).
 *
 * Ne touche jamais aux comptes ni aux campagnes qui ne sont pas du seed.
 */
export async function seedDev(): Promise<SeedResult> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12)

  const gmUserId = await upsertUser(SEED_GM, passwordHash)
  const playerUserIds: number[] = []
  for (const p of SEED_PLAYERS) {
    playerUserIds.push(await upsertUser(p.username, passwordHash))
  }

  // Table rase : on ne garde pas l'ancien bac à sable.
  const stale = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.gmUserId, gmUserId))
  if (stale.length > 0) {
    await db.delete(campaigns).where(inArray(campaigns.id, stale.map((c) => c.id)))
  }
  await db.delete(characters).where(inArray(characters.userId, playerUserIds))

  const [campaign] = await db.insert(campaigns)
    .values({ name: SEED_CAMPAIGN_NAME, gmUserId })
    .returning({ id: campaigns.id })

  for (const [i, p] of SEED_PLAYERS.entries()) {
    const userId = playerUserIds[i]
    const [char] = await db.insert(characters)
      .values({ userId, isActive: true, ...p.character })
      .returning({ id: characters.id })
    await db.insert(campaignMembers).values({ campaignId: campaign.id, userId, characterId: char.id })
  }

  // Campagne active pour tout le monde : sinon le premier « combat bidon »
  // échoue faute de campagne courante, juste après un seed.
  await db.update(users)
    .set({ activeCampaignId: campaign.id })
    .where(inArray(users.id, [gmUserId, ...playerUserIds]))

  // Une rencontre prête à lancer, avec la moitié du bestiaire.
  const [encounter] = await db.insert(encounterTemplates)
    .values({ campaignId: campaign.id, name: 'Embuscade sur la route', description: 'Rencontre de test.' })
    .returning({ id: encounterTemplates.id })

  for (const m of DEV_BESTIARY.slice(0, 3)) {
    await db.insert(encounterMonsters).values({ encounterId: encounter.id, ...m })
  }

  return { campaignId: campaign.id, gmUserId, playerUserIds, encounterId: encounter.id }
}
