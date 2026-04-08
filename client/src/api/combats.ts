const BASE = '/api/campaigns'

export interface CombatSummary {
  id: number
  campaignId: number
  name: string
  status: 'active' | 'finished'
  roundNumber: number
  createdAt: string
  finishedAt: string | null
}

export interface CombatParticipant {
  id: number
  combatId: number
  kind: 'player' | 'monster'
  userId: number | null
  name: string
  initiative: number
  hpMax: number | null
  hpCurrent: number | null
  hpStatus?: string // 'intact' | 'blesse' | 'mal_en_point' | 'agonisant' | 'mort' — for monsters seen by players
  def: number
  nc: number | null
  statFor: number | null
  statDex: number | null
  statCon: number | null
  statInt: number | null
  statSag: number | null
  statCha: number | null
  attacks: { name: string; bonus: number; damage: string; range?: number }[] | null
  abilities: { name: string; description: string }[] | null
  monsterDescription: string | null
}

export interface CombatState {
  id: number
  campaignId: number
  name: string
  status: 'active' | 'finished'
  currentTurnIndex: number
  roundNumber: number
  participants: CombatParticipant[]
  createdAt: string
  finishedAt: string | null
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

export function fetchCombats(campaignId: number): Promise<CombatSummary[]> {
  return request(`/${campaignId}/combats`)
}

export function createCombat(
  campaignId: number,
  data: { encounterId?: number; excludedUserIds?: number[]; name?: string },
): Promise<{ id: number }> {
  return request(`/${campaignId}/combats`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function fetchCombat(campaignId: number, combatId: number): Promise<CombatState> {
  return request(`/${campaignId}/combats/${combatId}`)
}

export function nextTurn(campaignId: number, combatId: number): Promise<void> {
  return request(`/${campaignId}/combats/${combatId}/next-turn`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function prevTurn(campaignId: number, combatId: number): Promise<void> {
  return request(`/${campaignId}/combats/${combatId}/prev-turn`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function updateParticipantHp(
  campaignId: number,
  combatId: number,
  participantId: number,
  hpCurrent: number,
): Promise<void> {
  return request(`/${campaignId}/combats/${combatId}/participants/${participantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ hpCurrent }),
  })
}

export function addCombatMonster(
  campaignId: number,
  combatId: number,
  data: Record<string, unknown>,
): Promise<void> {
  return request(`/${campaignId}/combats/${combatId}/monsters`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function finishCombat(campaignId: number, combatId: number): Promise<void> {
  return request(`/${campaignId}/combats/${combatId}/finish`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function removeCombatParticipant(
  campaignId: number,
  combatId: number,
  participantId: number,
): Promise<void> {
  return request(`/${campaignId}/combats/${combatId}/participants/${participantId}`, {
    method: 'DELETE',
  })
}

export function generateLoot(campaignId: number, combatId: number): Promise<{ loot: string }> {
  return request(`/${campaignId}/combats/${combatId}/generate-loot`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
