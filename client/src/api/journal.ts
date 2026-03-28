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
  lock: LockInfo | null
  lastEditedBy: string | null
  updatedAt: string | null
}

export async function fetchJournalCompagnie(): Promise<CompagnieData> {
  return apiFetch('/api/journal/compagnie')
}

export async function saveJournalCompagnie(content: string): Promise<void> {
  await apiFetch('/api/journal/compagnie', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
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

export interface JournalPageSummary {
  id: number
  title: string
  createdByUserId: number
  createdByCharacterName: string
  updatedAt: string
}

export interface JournalPage {
  id: number
  title: string
  content: string
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

export async function createPage(title: string, content?: string): Promise<JournalPage> {
  return apiFetch('/api/journal/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  })
}

export async function fetchPage(id: number): Promise<JournalPage> {
  return apiFetch(`/api/journal/pages/${id}`)
}

export async function savePage(id: number, data: { title?: string; content?: string }): Promise<void> {
  await apiFetch(`/api/journal/pages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
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
