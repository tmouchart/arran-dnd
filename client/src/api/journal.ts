async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', ...options })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(`Journal API error ${res.status}`), { status: res.status, body })
  }
  return res.json()
}

// ── Notes personnelles ───────────────────────────────────────────────────────

export async function fetchNotesPerso(): Promise<string> {
  const data = await apiFetch('/api/journal/perso')
  return data.content ?? ''
}

export async function saveNotesPerso(content: string): Promise<void> {
  await apiFetch('/api/journal/perso', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

// ── Journal compagnie ────────────────────────────────────────────────────────

export interface LockInfo {
  userId: number
  characterName: string
}

export interface CompagnieData {
  content: string
  version: number
  lock: LockInfo | null
  lastEditedBy: string | null
  updatedAt: string | null
}

export async function fetchJournalCompagnie(): Promise<CompagnieData> {
  return apiFetch('/api/journal/compagnie')
}

/** Renvoie la nouvelle version. `expectedVersion` protège contre l'écrasement
 *  d'un contenu modifié entre-temps (409). */
export async function saveJournalCompagnie(
  content: string,
  expectedVersion?: number | null,
): Promise<number> {
  const data = await apiFetch('/api/journal/compagnie', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, expectedVersion }),
  })
  return data.version
}

export async function lockCompagnie(): Promise<{ ok: boolean; lockedBy?: string }> {
  try {
    await apiFetch('/api/journal/compagnie/lock', { method: 'POST' })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, lockedBy: e.body?.lockedBy }
  }
}

export async function unlockCompagnie(): Promise<void> {
  await apiFetch('/api/journal/compagnie/lock', { method: 'DELETE' })
}

// ── Pages ────────────────────────────────────────────────────────────────────

export type JournalPageType = 'text' | 'drawing'

export interface Stroke {
  id: string
  points: { x: number; y: number }[]
  color: string
  width: number
  eraser: boolean
}

export interface JournalPageSummary {
  id: number
  title: string
  type: JournalPageType
  createdByUserId: number
  createdByCharacterName: string
  updatedAt: string
}

export interface JournalPage {
  id: number
  title: string
  type: JournalPageType
  content: string
  version: number
  createdByUserId: number
  updatedByUserId: number | null
  createdAt: string
  updatedAt: string
  lock: LockInfo | null
  lastEditedBy: string | null
}

export async function fetchPages(): Promise<JournalPageSummary[]> {
  return apiFetch('/api/journal/pages')
}

export async function createPage(title: string, content?: string, type?: JournalPageType): Promise<JournalPage> {
  return apiFetch('/api/journal/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, type }),
  })
}

export async function fetchPage(id: number): Promise<JournalPage> {
  return apiFetch(`/api/journal/pages/${id}`)
}

export async function savePage(
  id: number,
  data: { title?: string; content?: string; expectedVersion?: number | null },
): Promise<number> {
  const res = await apiFetch(`/api/journal/pages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.version
}

export async function deletePage(id: number): Promise<void> {
  await apiFetch(`/api/journal/pages/${id}`, { method: 'DELETE' })
}

export async function lockPage(id: number): Promise<{ ok: boolean; lockedBy?: string }> {
  try {
    await apiFetch(`/api/journal/pages/${id}/lock`, { method: 'POST' })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, lockedBy: e.body?.lockedBy }
  }
}

export async function unlockPage(id: number): Promise<void> {
  await apiFetch(`/api/journal/pages/${id}/lock`, { method: 'DELETE' })
}
