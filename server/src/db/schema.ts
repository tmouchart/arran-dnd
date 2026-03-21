import { sql } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const users = pgTable('user', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
    people: text('people').notNull().default(''),
    level: integer('level').notNull().default(1),

    hpMax: integer('hp_max').notNull().default(10),
    mpMax: integer('mp_max').notNull().default(0),
    defense: integer('defense').notNull().default(12),
    initiativeBonus: integer('initiative_bonus').notNull().default(0),

    str: integer('str').notNull().default(10),
    dex: integer('dex').notNull().default(10),
    con: integer('con').notNull().default(10),
    int: integer('int').notNull().default(10),
    wis: integer('wis').notNull().default(10),
    cha: integer('cha').notNull().default(10),

    skills: jsonb('skills').notNull().default([]),
    attacks: jsonb('attacks').notNull().default([]),
    paths: jsonb('paths').notNull().default([]),

    /** Mystic family magical talent id (client `mysticTalents.ts`), null if none */
    mysticTalent: text('mystic_talent'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('one_active_per_user').on(table.userId).where(sql`${table.isActive} = true`),
  ],
)

export type UserRow = typeof users.$inferSelect
export type CharacterRow = typeof characters.$inferSelect
export type CharacterInsert = typeof characters.$inferInsert
