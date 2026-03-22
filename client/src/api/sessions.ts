const BASE = '/api/sessions'

export interface SessionParticipant {
  userId: number
  username: string
  characterId: number
  characterName: string
  hpCurrent: number
  hpMax: number
  initiative: number | null
}

export interface SessionMonster {
  id: string
  name: string
  initiative: number | null
  // Présent uniquement pour le MJ
  hpCurrent?: number
  hpMax?: number
}

export interface SessionSummary {
  id: string
  name: string
  gmUserId: number
  participantCount: number
  createdAt: string
}

export interface SessionState {
  id: string
  name: string
  gmUserId: number
  participants: SessionParticipant[]
  monsters: SessionMonster[]
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchSessions(): Promise<SessionSummary[]> {
  return request<SessionSummary[]>('/')
}

export function createSession(name: string, hpCurrent?: number): Promise<SessionState> {
  return request<SessionState>('/', {
    method: 'POST',
    body: JSON.stringify({ name, hpCurrent }),
  })
}

export function joinSession(id: string, hpCurrent?: number): Promise<SessionState> {
  return request<SessionState>(`/${id}/join`, {
    method: 'POST',
    body: JSON.stringify({ hpCurrent }),
  })
}

export function leaveSession(id: string): Promise<void> {
  return request<void>(`/${id}/leave`, { method: 'POST', body: JSON.stringify({}) })
}

export function addMonster(
  id: string,
  data: { name: string; hpMax: number; initiative?: number },
): Promise<SessionMonster> {
  return request<SessionMonster>(`/${id}/monsters`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMonster(
  sessionId: string,
  monsterId: string,
  data: { hpCurrent?: number; initiative?: number; name?: string },
): Promise<SessionMonster> {
  return request<SessionMonster>(`/${sessionId}/monsters/${monsterId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function removeMonster(sessionId: string, monsterId: string): Promise<void> {
  return request<void>(`/${sessionId}/monsters/${monsterId}`, { method: 'DELETE' })
}

export function setInitiative(sessionId: string, initiative: number): Promise<void> {
  return request<void>(`/${sessionId}/initiative`, {
    method: 'PATCH',
    body: JSON.stringify({ initiative }),
  })
}
