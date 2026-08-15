async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', ...options })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(`Revisions API error ${res.status}`), { status: res.status, body })
  }
  return res.json()
}

/** Les 4 surfaces éditables du journal qui ont un historique. */
export type RevisionEntity = 'journal_compagnie' | 'journal_page' | 'note' | 'codex_entry'

export interface RevisionSummary {
  /** Cible stable d'une restauration (le n° de version, lui, peut bouger). */
  id: number
  version: number
  authorName: string
  kind: 'edit' | 'restore'
  /** Caractères gagnés (+) ou perdus (−) par rapport à la version précédente. */
  sizeDelta: number
  createdAt: string
}

export type RevisionSnapshot = Record<string, string>

export async function fetchRevisions(
  type: RevisionEntity,
  id: number,
): Promise<RevisionSummary[]> {
  return apiFetch(`/api/revisions/${type}/${id}`)
}

export async function fetchRevisionSnapshot(
  type: RevisionEntity,
  id: number,
  revisionId: number,
): Promise<RevisionSnapshot> {
  const data = await apiFetch(`/api/revisions/${type}/${id}/${revisionId}`)
  return data.snapshot
}

export async function restoreRevision(
  type: RevisionEntity,
  id: number,
  revisionId: number,
): Promise<void> {
  await apiFetch(`/api/revisions/${type}/${id}/restore/${revisionId}`, { method: 'POST' })
}
