/**
 * Outils de dev. Le serveur ne monte `/api/dev` que si `DEV_TOOLS=1` hors prod ;
 * côté client tout est en plus derrière `import.meta.env.DEV`, donc ce fichier
 * ne part jamais dans un build de prod.
 */
const BASE = '/api/dev'

export interface DevUser {
  id: number
  username: string
  avatarUrl: string | null
  /** Nom de la campagne dont il est MJ, sinon null. */
  gmOf: string | null
}

export interface DevPreset {
  id: string
  label: string
  hint: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchDevUsers(): Promise<DevUser[]> {
  return request('/users')
}

export function switchUser(userId: number): Promise<void> {
  return request('/switch-user', { method: 'POST', body: JSON.stringify({ userId }) })
}

export function seedDev(): Promise<{ campaignId: number }> {
  return request('/seed', { method: 'POST', body: JSON.stringify({}) })
}

export function fetchDevPresets(): Promise<DevPreset[]> {
  return request('/combat-presets')
}

export function createDevCombat(campaignId: number, preset: string): Promise<{ combatId: number }> {
  return request('/combat', { method: 'POST', body: JSON.stringify({ campaignId, preset }) })
}
