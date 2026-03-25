async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', ...options })
  if (!res.ok) throw new Error(`Journal API error ${res.status}`)
  return res.json()
}

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

export async function fetchJournalCompagnie(): Promise<string> {
  const data = await apiFetch('/api/journal/compagnie')
  return data.content ?? ''
}

export async function saveJournalCompagnie(content: string): Promise<void> {
  await apiFetch('/api/journal/compagnie', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}
