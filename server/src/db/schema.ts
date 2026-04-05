import { sql } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

export const users = pgTable('user', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  /** Notes personnelles du joueur (privées). */
  notesPerso: text('notes_perso').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const journalCompagnie = pgTable('journal_compagnie', {
  id: integer('id').primaryKey().default(1),
  content: text('content').notNull().default(''),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const characters = pgTable(
  'character',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(false),

    name: text('name').notNull().default('Nouveau héros'),
    profile: text('profile').notNull().default(''),
    /** Free-form character background / story (French UI: « Histoire »). */
    histoire: text('histoire').notNull().default(''),
    people: text('people').notNull().default(''),
    level: integer('level').notNull().default(1),

    hpMax: integer('hp_max').notNull().default(10),
    hpCurrent: integer('hp_current').notNull().default(10),
    mpMax: integer('mp_max').notNull().default(0),
    mpCurrent: integer('mp_current').notNull().default(0),
    defense: integer('defense').notNull().default(12),
    initiativeBonus: integer('initiative_bonus').notNull().default(0),

    str: integer('str').notNull().default(10),
    dex: integer('dex').notNull().default(10),
    con: integer('con').notNull().default(10),
    int: integer('int').notNull().default(10),
    wis: integer('wis').notNull().default(10),
    cha: integer('cha').notNull().default(10),

    skills: jsonb('skills').notNull().default([]),
    weapons: jsonb('weapons').notNull().default([]),
    /** Martial categories trained (excludes paysan). */
    martialFormations: jsonb('martial_formations').notNull().default([]),
    paths: jsonb('paths').notNull().default([]),

    /** Mystic family magical talent id (client `mysticTalents.ts`), null if none */
    mysticTalent: text('mystic_talent'),

    /** Id of the equipped armor (client `armorsCatalog.ts`), null/empty = no armor */
    armorId: text('armor_id'),
    /** Id of the equipped shield (client `armorsCatalog.ts` SHIELDS_CATALOG), null/empty = no shield */
    shieldId: text('shield_id'),
    /** Miscellaneous DEF bonus (abilities, magic, etc.) */
    defenseBonus: integer('defense_bonus').notNull().default(0),
    /** Miscellaneous attack contact bonus */
    attackContactBonus: integer('attack_contact_bonus').notNull().default(0),
    /** Miscellaneous attack distance bonus */
    attackDistanceBonus: integer('attack_distance_bonus').notNull().default(0),
    /** Miscellaneous attack magique bonus */
    attackMagiqueBonus: integer('attack_magique_bonus').notNull().default(0),

    /** Raw die rolls for HP gained at each level >= 2 (CON mod is computed live). Length = level - 1. */
    hpLevelGains: jsonb('hp_level_gains').notNull().default([]),

    /** Inventory items: [{ id, name, description?, quantity }] */
    items: jsonb('items').notNull().default([]),
    /** Currency (po = pièces d'or). Conversion: 1 po = 10 pa = 100 pc. */
    goldCoins: integer('gold_coins').notNull().default(0),
    silverCoins: integer('silver_coins').notNull().default(0),
    copperCoins: integer('copper_coins').notNull().default(0),

    /** Points de Chance courants (max = 2 + Mod. CHA ; aventuriers +2). */
    pcCurrent: integer('pc_current').notNull().default(0),
    /** Points de Récupération courants (max = 5). */
    prCurrent: integer('pr_current').notNull().default(5),

    /** Custom rollable competences: [{ id, name, ability, bonus }] */
    competences: jsonb('competences').notNull().default([]),
    /** ID of the portrait image in generated_images table */
    portraitImageId: integer('portrait_image_id').references(() => generatedImages.id),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('one_active_per_user').on(table.userId).where(sql`${table.isActive} = true`),
  ],
)

export const journalPages = pgTable('journal_pages', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('text'),
  content: text('content').notNull().default(''),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const generatedImages = pgTable('generated_images', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  data: text('data').notNull(),
  mimeType: text('mime_type').notNull(),
  prompt: text('prompt').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const campaigns = pgTable('campaign', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  gmUserId: integer('gm_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const campaignMembers = pgTable(
  'campaign_member',
  {
    id: serial('id').primaryKey(),
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: integer('character_id').references(() => characters.id, { onDelete: 'set null' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('unique_campaign_member').on(table.campaignId, table.userId)],
)

export const encounterTemplates = pgTable('encounter_template', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const encounterMonsters = pgTable('encounter_monster', {
  id: serial('id').primaryKey(),
  encounterId: integer('encounter_id')
    .notNull()
    .references(() => encounterTemplates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nc: real('nc').notNull().default(0),
  size: text('size').notNull().default('moyenne'),
  def: integer('def').notNull().default(10),
  pv: integer('pv').notNull().default(1),
  init: integer('init').notNull().default(0),
  rd: text('rd'),
  statFor: integer('stat_for').notNull().default(0),
  statDex: integer('stat_dex').notNull().default(0),
  statCon: integer('stat_con').notNull().default(0),
  statInt: integer('stat_int').notNull().default(0),
  statSag: integer('stat_sag').notNull().default(0),
  statCha: integer('stat_cha').notNull().default(0),
  attacks: jsonb('attacks').notNull().default([]),
  abilities: jsonb('abilities').notNull().default([]),
  description: text('description'),
})

export type UserRow = typeof users.$inferSelect
export type CharacterRow = typeof characters.$inferSelect
export type CharacterInsert = typeof characters.$inferInsert
export type CampaignRow = typeof campaigns.$inferSelect
export type CampaignMemberRow = typeof campaignMembers.$inferSelect
