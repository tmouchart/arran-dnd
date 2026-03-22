const BASE = '/api/auth'

export interface AuthUser {
  id: number
  username: string
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erreur de connexion')
  return data.user as AuthUser
}

export async function register(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erreur lors de la création du compte')
  return data.user as AuthUser
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/logout`, { method: 'POST', credentials: 'include' })
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${BASE}/me`, { credentials: 'include' })
  if (!res.ok) return null
  const data = await res.json()
  return data.user as AuthUser
}
