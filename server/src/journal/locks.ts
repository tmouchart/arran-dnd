import type express from 'express'

// ── Types ────────────────────────────────────────────────────────────────────

interface JournalLock {
  userId: number
  characterName: string
  expiresAt: number
}

interface SseClient {
  res: express.Response
  userId: number
}

// ── In-memory stores ─────────────────────────────────────────────────────────

const locks = new Map<string, JournalLock>()
const sseClients = new Map<string, Set<SseClient>>()

const LOCK_TTL = 60_000 // 60 seconds

// ── Lock management ──────────────────────────────────────────────────────────

export function acquireLock(
  resourceKey: string,
  userId: number,
  characterName: string,
): { ok: true } | { ok: false; lockedBy: string } {
  const existing = getActiveLock(resourceKey)
  if (existing && existing.userId !== userId) {
    return { ok: false, lockedBy: existing.characterName }
  }
  locks.set(resourceKey, { userId, characterName, expiresAt: Date.now() + LOCK_TTL })
  broadcastLockStatus(resourceKey)
  return { ok: true }
}

export function releaseLock(resourceKey: string, userId: number): void {
  const existing = locks.get(resourceKey)
  if (existing && existing.userId === userId) {
    locks.delete(resourceKey)
    broadcastLockStatus(resourceKey)
  }
}

export function renewLock(resourceKey: string, userId: number): void {
  const existing = locks.get(resourceKey)
  if (existing && existing.userId === userId) {
    existing.expiresAt = Date.now() + LOCK_TTL
  }
}

export function getActiveLock(resourceKey: string): JournalLock | null {
  const lock = locks.get(resourceKey)
  if (!lock) return null
  if (lock.expiresAt < Date.now()) {
    locks.delete(resourceKey)
    return null
  }
  return lock
}

export function holdsLock(resourceKey: string, userId: number): boolean {
  const lock = getActiveLock(resourceKey)
  return lock !== null && lock.userId === userId
}

// ── SSE client management ────────────────────────────────────────────────────

function getClients(resourceKey: string): Set<SseClient> {
  if (!sseClients.has(resourceKey)) sseClients.set(resourceKey, new Set())
  return sseClients.get(resourceKey)!
}

export function registerSseClient(resourceKey: string, client: SseClient): void {
  getClients(resourceKey).add(client)
}

export function removeSseClient(resourceKey: string, client: SseClient): void {
  const clients = sseClients.get(resourceKey)
  if (clients) {
    clients.delete(client)
    if (clients.size === 0) sseClients.delete(resourceKey)
  }
}

// ── Broadcast helpers ────────────────────────────────────────────────────────

function writeSse(res: express.Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function broadcastLockStatus(resourceKey: string): void {
  const lock = getActiveLock(resourceKey)
  const clients = sseClients.get(resourceKey)
  if (!clients) return
  for (const client of clients) {
    if (lock) {
      writeSse(client.res, 'journal-locked', { userId: lock.userId, characterName: lock.characterName })
    } else {
      writeSse(client.res, 'journal-unlocked', {})
    }
  }
}

export function broadcastContentUpdate(
  resourceKey: string,
  content: string,
  updatedBy: { userId: number; characterName: string },
): void {
  const clients = sseClients.get(resourceKey)
  if (!clients) return
  for (const client of clients) {
    if (client.userId === updatedBy.userId) continue
    writeSse(client.res, 'journal-updated', { content, updatedBy: updatedBy.characterName })
  }
}

// ── Expiration timer ─────────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now()
  for (const [key, lock] of locks) {
    if (lock.expiresAt < now) {
      locks.delete(key)
      broadcastLockStatus(key)
    }
  }
}, 10_000)
