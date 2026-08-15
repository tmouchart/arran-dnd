import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { characters, revisions } from '../db/schema.js'
import { getActiveLock } from '../journal/locks.js'
import {
  MAX_SNAPSHOT_BYTES,
  maxRevisionsFor,
  revisionsToPrune,
  shouldCoalesce,
  snapshotSize,
  snapshotsEqual,
  type Snapshot,
} from './coalesce.js'
import { ADAPTERS, type EntityType } from './registry.js'

export type SaveResult =
  | { status: 'ok'; version: number }
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'locked'; lockedBy: string }
  | { status: 'conflict'; currentVersion: number; snapshot: Snapshot }

/** Nom du perso actif, pour signer l'historique de façon lisible. */
export async function authorName(userId: number): Promise<string> {
  const [char] = await db
    .select({ name: characters.name })
    .from(characters)
    .where(and(eq(characters.userId, userId), eq(characters.isActive, true)))
    .limit(1)
  return char?.name ?? 'Inconnu'
}

/**
 * Écrit un contenu en incrémentant sa version, et alimente l'historique.
 *
 * `expectedVersion` est le cœur de la protection anti-écrasement : si le client
 * travaille sur une version périmée, on refuse au lieu d'écraser en silence.
 */
export async function saveWithRevision(params: {
  type: EntityType
  id: number
  snapshot: Snapshot
  userId: number
  expectedVersion?: number | null
  kind?: 'edit' | 'restore'
  /** Ignorer le verrou (l'appelant l'a déjà validé, ex: PUT du journal). */
  skipLockCheck?: boolean
}): Promise<SaveResult> {
  const { type, id, snapshot, userId, expectedVersion, kind = 'edit' } = params
  const adapter = ADAPTERS[type]

  const row = await adapter.load(id)
  if (!row) return { status: 'not_found' }
  if (!(await adapter.canWrite(userId, id))) return { status: 'forbidden' }

  if (!params.skipLockCheck) {
    const key = adapter.lockKey(id)
    if (key) {
      const lock = getActiveLock(key)
      if (lock && lock.userId !== userId) {
        return { status: 'locked', lockedBy: lock.characterName }
      }
    }
  }

  if (expectedVersion != null && expectedVersion !== row.version) {
    return { status: 'conflict', currentVersion: row.version, snapshot: row.snapshot }
  }

  // Contenu identique : ne rien écrire. Bloque notamment le PUT parasite
  // déclenché par le simple chargement d'une page.
  if (snapshotsEqual(snapshot, row.snapshot)) {
    return { status: 'ok', version: row.version }
  }

  const nextVersion = row.version + 1
  await adapter.persist(id, snapshot, nextVersion, userId)
  await writeRevision({ type, id, snapshot, previous: row.snapshot, userId, kind, version: nextVersion })
  await prune(type, id, row.isDrawing)

  const name = await authorName(userId)
  adapter.broadcast(id, snapshot, { userId, characterName: name })

  return { status: 'ok', version: nextVersion }
}

async function writeRevision(params: {
  type: EntityType
  id: number
  snapshot: Snapshot
  previous: Snapshot
  userId: number
  kind: 'edit' | 'restore'
  version: number
}): Promise<void> {
  const { type, id, snapshot, previous, userId, kind, version } = params

  const size = snapshotSize(snapshot)
  if (size > MAX_SNAPSHOT_BYTES) {
    console.warn(`[revision] snapshot ignoré (${size} car.) type=${type} id=${id}`)
    return
  }
  const delta = size - snapshotSize(previous)

  const [last] = await db
    .select()
    .from(revisions)
    .where(and(eq(revisions.entityType, type), eq(revisions.entityId, id)))
    .orderBy(desc(revisions.version))
    .limit(1)

  const coalesce =
    last != null &&
    shouldCoalesce(
      {
        authorUserId: last.authorUserId,
        createdAt: last.createdAt,
        kind: last.kind,
        size: snapshotSize(last.snapshot as Snapshot),
      },
      { authorUserId: userId, size, kind },
      Date.now(),
    )

  if (coalesce) {
    // `createdAt` n'est volontairement pas rafraîchi : sinon la fenêtre de
    // regroupement glisserait sans fin et une session de 2 h tiendrait dans une
    // seule révision.
    await db
      .update(revisions)
      .set({ snapshot, version, sizeDelta: last.sizeDelta + delta })
      .where(eq(revisions.id, last.id))
    return
  }

  await db.insert(revisions).values({
    entityType: type,
    entityId: id,
    version,
    snapshot,
    authorUserId: userId,
    authorName: await authorName(userId),
    kind,
    sizeDelta: delta,
  })
}

async function prune(type: EntityType, id: number, isDrawing: boolean): Promise<void> {
  const rows = await db
    .select({ id: revisions.id })
    .from(revisions)
    .where(and(eq(revisions.entityType, type), eq(revisions.entityId, id)))
    .orderBy(desc(revisions.version))

  const doomed = revisionsToPrune(rows.map((r) => r.id), maxRevisionsFor(isDrawing))
  if (doomed.length > 0) await db.delete(revisions).where(inArray(revisions.id, doomed))
}

export interface RevisionSummary {
  /** Identifiant stable — c'est lui qu'on restaure. Le `version` d'une révision
   *  bouge quand le regroupement l'absorbe, il ne peut pas servir de cible. */
  id: number
  version: number
  authorName: string
  kind: string
  sizeDelta: number
  createdAt: string
}

/** Liste sans les snapshots : ouvrir l'historique d'un dessin ne doit pas
 *  télécharger 20 Mo sur un téléphone. */
export async function listRevisions(
  type: EntityType,
  id: number,
  userId: number,
): Promise<RevisionSummary[] | null> {
  if (!(await ADAPTERS[type].canRead(userId, id))) return null
  const rows = await db
    .select({
      id: revisions.id,
      version: revisions.version,
      authorName: revisions.authorName,
      kind: revisions.kind,
      sizeDelta: revisions.sizeDelta,
      createdAt: revisions.createdAt,
    })
    .from(revisions)
    .where(and(eq(revisions.entityType, type), eq(revisions.entityId, id)))
    .orderBy(desc(revisions.version))
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

export async function getRevision(
  type: EntityType,
  id: number,
  revisionId: number,
  userId: number,
): Promise<Snapshot | null | 'forbidden'> {
  if (!(await ADAPTERS[type].canRead(userId, id))) return 'forbidden'
  const [row] = await db
    .select({ snapshot: revisions.snapshot })
    .from(revisions)
    .where(
      and(eq(revisions.entityType, type), eq(revisions.entityId, id), eq(revisions.id, revisionId)),
    )
  return row ? (row.snapshot as Snapshot) : null
}

/**
 * Revient à une version antérieure. Rien n'est supprimé : la restauration écrit
 * une nouvelle révision, donc annuler une annulation reste possible.
 */
export async function restoreRevision(params: {
  type: EntityType
  id: number
  revisionId: number
  userId: number
}): Promise<SaveResult> {
  const { type, id, revisionId, userId } = params
  const snapshot = await getRevision(type, id, revisionId, userId)
  if (snapshot === 'forbidden') return { status: 'forbidden' }
  if (!snapshot) return { status: 'not_found' }

  return saveWithRevision({ type, id, snapshot, userId, kind: 'restore' })
}
