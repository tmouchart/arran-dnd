import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  campaignMembers,
  campaigns,
  codexEntries,
  journalCompagnie,
  journalPages,
  notes,
} from '../db/schema.js'
import { broadcastContentUpdate } from '../journal/locks.js'
import type { Snapshot } from './coalesce.js'

export const ENTITY_TYPES = ['journal_compagnie', 'journal_page', 'note', 'codex_entry'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export function isEntityType(value: unknown): value is EntityType {
  return typeof value === 'string' && (ENTITY_TYPES as readonly string[]).includes(value)
}

export interface EntityRow {
  id: number
  version: number
  snapshot: Snapshot
  /** Les dessins sont lourds : purge plus agressive. */
  isDrawing: boolean
}

export interface EntityAdapter {
  load(id: number): Promise<EntityRow | null>
  persist(id: number, snapshot: Snapshot, version: number, userId: number): Promise<void>
  canRead(userId: number, id: number): Promise<boolean>
  canWrite(userId: number, id: number): Promise<boolean>
  /** Clé du verrou d'édition à respecter, ou null si l'entité n'en a pas. */
  lockKey(id: number): string | null
  /** Diffusion temps réel après écriture, si l'entité a un flux SSE. */
  broadcast(
    id: number,
    snapshot: Snapshot,
    version: number,
    author: { userId: number; characterName: string },
  ): void
}

/** Membre de la campagne (ou MJ) — mêmes droits que `codex.ts`. */
async function isCampaignMember(userId: number, campaignId: number): Promise<boolean> {
  const [campaign] = await db
    .select({ gmUserId: campaigns.gmUserId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
  if (!campaign) return false
  if (campaign.gmUserId === userId) return true
  const [membership] = await db
    .select({ id: campaignMembers.id })
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
  return Boolean(membership)
}

const journalCompagnieAdapter: EntityAdapter = {
  async load() {
    const [row] = await db.select().from(journalCompagnie).where(eq(journalCompagnie.id, 1))
    if (!row) return null
    return { id: 1, version: row.version, snapshot: { content: row.content }, isDrawing: false }
  },
  async persist(_id, snapshot, version, userId) {
    await db
      .update(journalCompagnie)
      .set({ content: snapshot.content ?? '', version, updatedByUserId: userId, updatedAt: new Date() })
      .where(eq(journalCompagnie.id, 1))
  },
  // Le journal de bord est commun : tout le monde lit, tout le monde restaure.
  // Sans danger, puisqu'une restauration crée une révision de plus au lieu
  // d'effacer quoi que ce soit.
  canRead: async () => true,
  canWrite: async () => true,
  lockKey: () => 'compagnie',
  broadcast(_id, snapshot, version, author) {
    broadcastContentUpdate('compagnie', { content: snapshot.content ?? '', version }, author)
  },
}

const journalPageAdapter: EntityAdapter = {
  async load(id) {
    const [row] = await db.select().from(journalPages).where(eq(journalPages.id, id))
    if (!row) return null
    return {
      id: row.id,
      version: row.version,
      snapshot: { title: row.title, content: row.content },
      isDrawing: row.type === 'drawing',
    }
  },
  async persist(id, snapshot, version, userId) {
    await db
      .update(journalPages)
      .set({
        title: snapshot.title ?? '',
        content: snapshot.content ?? '',
        version,
        updatedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(journalPages.id, id))
  },
  canRead: async () => true,
  canWrite: async () => true,
  lockKey: (id) => `page:${id}`,
  broadcast(id, snapshot, version, author) {
    broadcastContentUpdate(`page:${id}`, { content: snapshot.content ?? '', version }, author)
  },
}

const noteAdapter: EntityAdapter = {
  async load(id) {
    const [row] = await db.select().from(notes).where(eq(notes.id, id))
    if (!row) return null
    return {
      id: row.id,
      version: row.version,
      snapshot: { title: row.title, content: row.content },
      isDrawing: row.type === 'drawing',
    }
  },
  async persist(id, snapshot, version) {
    await db
      .update(notes)
      .set({ title: snapshot.title ?? '', content: snapshot.content ?? '', version, updatedAt: new Date() })
      .where(eq(notes.id, id))
  },
  // Note privée : le propriétaire, et personne d'autre.
  async canRead(userId, id) {
    const [row] = await db.select({ owner: notes.ownerUserId }).from(notes).where(eq(notes.id, id))
    return row?.owner === userId
  },
  async canWrite(userId, id) {
    return noteAdapter.canRead(userId, id)
  },
  lockKey: () => null,
  broadcast: () => {},
}

const codexEntryAdapter: EntityAdapter = {
  async load(id) {
    const [row] = await db.select().from(codexEntries).where(eq(codexEntries.id, id))
    if (!row) return null
    return {
      id: row.id,
      version: row.version,
      snapshot: { name: row.name, type: row.type, description: row.description },
      isDrawing: false,
    }
  },
  async persist(id, snapshot, version) {
    await db
      .update(codexEntries)
      .set({
        name: snapshot.name ?? '',
        type: snapshot.type ?? 'autre',
        description: snapshot.description ?? '',
        version,
        updatedAt: new Date(),
      })
      .where(eq(codexEntries.id, id))
  },
  async canRead(userId, id) {
    const [row] = await db
      .select({ campaignId: codexEntries.campaignId })
      .from(codexEntries)
      .where(eq(codexEntries.id, id))
    if (!row) return false
    return isCampaignMember(userId, row.campaignId)
  },
  async canWrite(userId, id) {
    return codexEntryAdapter.canRead(userId, id)
  },
  lockKey: () => null,
  broadcast: () => {},
}

export const ADAPTERS: Record<EntityType, EntityAdapter> = {
  journal_compagnie: journalCompagnieAdapter,
  journal_page: journalPageAdapter,
  note: noteAdapter,
  codex_entry: codexEntryAdapter,
}
