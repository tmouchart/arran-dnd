import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { and, eq } from 'drizzle-orm'
import '../loadEnv.js'
import { db } from '../db/index.js'
import { notes, revisions, users } from '../db/schema.js'
import { getRevision, listRevisions, restoreRevision, saveWithRevision } from './service.js'

/**
 * Test d'intégration sur la base locale. Il crée sa propre note jetable et la
 * supprime ensuite : aucune donnée existante n'est touchée.
 */

let userId: number
let noteId: number

beforeAll(async () => {
  const [someUser] = await db.select({ id: users.id }).from(users).limit(1)
  if (!someUser) throw new Error('Base locale vide : impossible de tester (crée un utilisateur).')
  userId = someUser.id

  const [note] = await db
    .insert(notes)
    .values({ ownerUserId: userId, title: 'test-revisions', type: 'text', content: '' })
    .returning()
  noteId = note.id
})

afterAll(async () => {
  await db.delete(revisions).where(and(eq(revisions.entityType, 'note'), eq(revisions.entityId, noteId)))
  await db.delete(notes).where(eq(notes.id, noteId))
})

async function save(content: string, expectedVersion?: number) {
  return saveWithRevision({
    type: 'note',
    id: noteId,
    snapshot: { title: 'test-revisions', content },
    userId,
    expectedVersion: expectedVersion ?? null,
  })
}

describe('saveWithRevision', () => {
  it('incrémente la version à chaque écriture réelle', async () => {
    const first = await save('bonjour')
    expect(first).toMatchObject({ status: 'ok' })
    const second = await save('bonjour le monde')
    expect(second.status).toBe('ok')
    if (first.status !== 'ok' || second.status !== 'ok') throw new Error('unreachable')
    expect(second.version).toBe(first.version + 1)
  })

  it("n'écrit rien quand le contenu est identique", async () => {
    const before = await save('contenu stable')
    const after = await save('contenu stable')
    if (before.status !== 'ok' || after.status !== 'ok') throw new Error('unreachable')
    expect(after.version).toBe(before.version)
  })

  it('refuse une écriture basée sur une version périmée', async () => {
    const current = await save('version courante')
    if (current.status !== 'ok') throw new Error('unreachable')
    const stale = await save('écriture aveugle', current.version - 1)
    expect(stale.status).toBe('conflict')
    if (stale.status !== 'conflict') throw new Error('unreachable')
    // Le serveur renvoie l'état réel pour que le client puisse se resynchroniser.
    expect(stale.snapshot.content).toBe('version courante')
  })

  it('accepte une écriture qui annonce la bonne version', async () => {
    const current = await save('base')
    if (current.status !== 'ok') throw new Error('unreachable')
    const next = await save('base + suite', current.version)
    expect(next.status).toBe('ok')
  })

  it('regroupe les écritures rapprochées du même auteur', async () => {
    const before = (await listRevisions('note', noteId, userId))!.length
    await save('regroupe a')
    await save('regroupe ab')
    await save('regroupe abc')
    const after = (await listRevisions('note', noteId, userId))!.length
    // Les 3 écritures tiennent dans la même révision (même auteur, < 3 min).
    expect(after).toBe(before)
  })

  it('fige une révision distincte quand le contenu fond (Ctrl+A)', async () => {
    await save('x'.repeat(1000))
    const before = (await listRevisions('note', noteId, userId))!.length
    await save('')
    const after = (await listRevisions('note', noteId, userId))!
    expect(after.length).toBe(before + 1)
    // La perte massive est visible dans la liste : c'est le repère de l'UI.
    expect(after[0].sizeDelta).toBeLessThan(-900)
  })
})

describe('restoreRevision', () => {
  it('remet le contenu et crée une nouvelle révision au lieu d\'effacer', async () => {
    const precious = 'le texte précieux '.repeat(50)
    await save(precious)
    const list = (await listRevisions('note', noteId, userId))!
    const target = list[0].id
    const countBefore = list.length

    await save('') // Ctrl+A : perte massive → révision distincte
    const restored = await restoreRevision({ type: 'note', id: noteId, revisionId: target, userId })
    expect(restored.status).toBe('ok')

    const [row] = await db.select().from(notes).where(eq(notes.id, noteId))
    expect(row.content).toBe(precious)

    const listAfter = (await listRevisions('note', noteId, userId))!
    expect(listAfter.length).toBeGreaterThan(countBefore)
    expect(listAfter[0].kind).toBe('restore')
  })

  it("cible un identifiant stable, que le regroupement ne réécrit pas", async () => {
    const anchor = 'ancre '.repeat(100)
    await save(anchor)
    const target = (await listRevisions('note', noteId, userId))![0].id

    // Petites retouches successives : elles sont absorbées par regroupement et
    // font bouger le numéro de version de cette même révision.
    await save(anchor + 'a')
    await save(anchor + 'ab')

    // La cible reste atteignable malgré le déplacement du numéro de version.
    const snapshot = await getRevision('note', noteId, target, userId)
    expect(snapshot).not.toBeNull()
  })

  it('refuse la lecture et la restauration à un autre utilisateur', async () => {
    const intruder = userId + 99999
    expect(await listRevisions('note', noteId, intruder)).toBeNull()
    const result = await restoreRevision({ type: 'note', id: noteId, revisionId: 1, userId: intruder })
    expect(result.status).toBe('forbidden')
  })
})
