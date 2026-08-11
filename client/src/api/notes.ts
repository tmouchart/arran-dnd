async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', ...options })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(`Notes API error ${res.status}`), { status: res.status, body })
  }
  return res.json()
}

export type NoteType = 'text' | 'drawing'

export interface Note {
  id: number
  title: string
  type: NoteType
  content: string
  createdAt: string
  updatedAt: string
}

export async function fetchNotes(): Promise<Note[]> {
  return apiFetch('/api/notes')
}

export async function createNote(data?: { title?: string; content?: string; type?: NoteType }): Promise<Note> {
  return apiFetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
  })
}

export async function updateNote(id: number, data: { title?: string; content?: string }): Promise<Note> {
  return apiFetch(`/api/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function deleteNote(id: number): Promise<void> {
  await apiFetch(`/api/notes/${id}`, { method: 'DELETE' })
}
