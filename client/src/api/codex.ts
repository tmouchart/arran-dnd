async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', ...options })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(`Codex API error ${res.status}`), { status: res.status, body })
  }
  return res.json()
}

export type CodexType = 'personnage' | 'lieu' | 'autre'

export interface CodexEntry {
  id: number
  campaignId: number
  type: CodexType
  name: string
  description: string
  createdByUserId: number
  version: number
  createdAt: string
  updatedAt: string
}

export async function fetchCodexEntries(campaignId: number): Promise<CodexEntry[]> {
  return apiFetch(`/api/campaigns/${campaignId}/codex`)
}

export async function createCodexEntry(
  campaignId: number,
  data: { name: string; type: CodexType; description?: string },
): Promise<CodexEntry> {
  return apiFetch(`/api/campaigns/${campaignId}/codex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function updateCodexEntry(
  campaignId: number,
  entryId: number,
  data: { name?: string; type?: CodexType; description?: string; expectedVersion?: number },
): Promise<CodexEntry> {
  return apiFetch(`/api/campaigns/${campaignId}/codex/${entryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function deleteCodexEntry(campaignId: number, entryId: number): Promise<void> {
  await apiFetch(`/api/campaigns/${campaignId}/codex/${entryId}`, { method: 'DELETE' })
}

export interface MentionSource {
  id: number
  title: string
  content: string
  updatedAt: string
}

export async function fetchCodexMentions(
  campaignId: number,
  entryId: number,
): Promise<{ notes: MentionSource[]; pages: MentionSource[]; board: MentionSource | null }> {
  return apiFetch(`/api/campaigns/${campaignId}/codex/${entryId}/mentions`)
}
