import type { ServerCharacter } from './characters'

const BASE = '/api/campaigns'

export interface CampaignSummary {
  id: number
  name: string
  gmUserId: number
  gmUsername: string
  memberCount: number
  isMember: boolean
  createdAt: string
}

export interface CampaignMember {
  userId: number
  username: string
  avatarUrl: string | null
  characterId: number | null
  characterName: string | null
  portraitUrl: string | null
  joinedAt: string
}

export interface CampaignDetail {
  id: number
  name: string
  gmUserId: number
  gmUsername: string
  members: CampaignMember[]
  createdAt: string
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

export function fetchCampaigns(): Promise<CampaignSummary[]> {
  return request<CampaignSummary[]>('/')
}

export function createCampaign(name: string): Promise<{ id: number; name: string }> {
  return request('/', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function fetchCampaign(id: number): Promise<CampaignDetail> {
  return request<CampaignDetail>(`/${id}`)
}

export function deleteCampaign(id: number): Promise<void> {
  return request(`/${id}`, { method: 'DELETE' })
}

export function joinCampaign(id: number): Promise<void> {
  return request(`/${id}/join`, { method: 'POST', body: JSON.stringify({}) })
}

export function leaveCampaign(id: number): Promise<void> {
  return request(`/${id}/leave`, { method: 'POST', body: JSON.stringify({}) })
}

export function fetchMemberCharacter(campaignId: number, userId: number): Promise<ServerCharacter> {
  return request<ServerCharacter>(`/${campaignId}/members/${userId}/character`)
}

// ── Encounters ──────────────────────────────────────────────────────────────

export interface EncounterMonsterAttack {
  name: string
  bonus: number
  damage: string
  range?: number
}

export interface EncounterMonsterAbility {
  name: string
  description: string
}

export interface EncounterMonster {
  id: number
  encounterId: number
  name: string
  nc: number
  size: string
  def: number
  pv: number
  init: number
  rd: string | null
  statFor: number
  statDex: number
  statCon: number
  statInt: number
  statSag: number
  statCha: number
  attacks: EncounterMonsterAttack[]
  abilities: EncounterMonsterAbility[]
  description: string | null
  /** Démarre le combat en réserve : caché aux joueurs, hors initiative. */
  hidden: boolean
}

export interface EncounterSummary {
  id: number
  name: string
  description: string | null
  monsterCount: number
  createdAt: string
}

export interface EncounterDetail {
  id: number
  campaignId: number
  name: string
  description: string | null
  monsters: EncounterMonster[]
  createdAt: string
}

export function fetchEncounters(campaignId: number): Promise<EncounterSummary[]> {
  return request(`/${campaignId}/encounters`)
}

export function createEncounter(campaignId: number, data: { name: string; description?: string }): Promise<EncounterDetail> {
  return request(`/${campaignId}/encounters`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function fetchEncounter(campaignId: number, eid: number): Promise<EncounterDetail> {
  return request(`/${campaignId}/encounters/${eid}`)
}

export function updateEncounter(campaignId: number, eid: number, data: { name?: string; description?: string }): Promise<void> {
  return request(`/${campaignId}/encounters/${eid}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteEncounter(campaignId: number, eid: number): Promise<void> {
  return request(`/${campaignId}/encounters/${eid}`, { method: 'DELETE' })
}

export function addEncounterMonster(campaignId: number, eid: number, data: Omit<EncounterMonster, 'id' | 'encounterId'>): Promise<EncounterMonster> {
  return request(`/${campaignId}/encounters/${eid}/monsters`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function duplicateEncounterMonster(campaignId: number, eid: number, mid: number): Promise<EncounterMonster[]> {
  return request(`/${campaignId}/encounters/${eid}/monsters/${mid}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function updateEncounterMonster(campaignId: number, eid: number, mid: number, data: Partial<Omit<EncounterMonster, 'id' | 'encounterId'>>): Promise<EncounterMonster> {
  return request(`/${campaignId}/encounters/${eid}/monsters/${mid}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteEncounterMonster(campaignId: number, eid: number, mid: number): Promise<void> {
  return request(`/${campaignId}/encounters/${eid}/monsters/${mid}`, { method: 'DELETE' })
}

// ── Log de jets (portée campagne) ───────────────────────────────────────────

export interface RollEvent {
  id: number
  campaignId: number
  /** NULL quand le jet a été fait hors combat. */
  combatId: number | null
  userId: number
  actorName: string
  actorKind: 'player' | 'monster'
  visibility: 'public' | 'gm'
  kind: string
  label: string
  context: string
  die: number
  sides: number
  bonus: number
  total: number
  rolls: number[] | null
  damage: { total: number; critical: boolean; fumble: boolean } | null
  createdAt: string
}

export interface RollInput {
  kind: string
  label: string
  context: string
  die: number
  sides: number
  bonus: number
  total: number
  rolls?: number[]
  damage?: { total: number; critical: boolean; fumble: boolean }
  /** MJ uniquement : poste le jet au nom d'un monstre (visible MJ seulement) */
  asMonster?: string
}

export function postCampaignRoll(campaignId: number, roll: RollInput): Promise<RollEvent> {
  return request(`/${campaignId}/rolls`, { method: 'POST', body: JSON.stringify(roll) })
}

export function fetchCampaignRolls(campaignId: number): Promise<RollEvent[]> {
  return request(`/${campaignId}/rolls`)
}

// ── Repos partagé ───────────────────────────────────────────────────────────

/** Le repos court (1 PR contre des PV) reste une décision de joueur : il n'est pas ici. */
export type RestKind = 'long' | 'complet'

export interface RestChange {
  before: number
  after: number
}

export interface RestDelta {
  hp?: RestChange
  mp?: RestChange
  pr?: RestChange
}

export interface RestState {
  hpCurrent: number
  hpMax: number
  mpCurrent: number
  mpMax: number
  prCurrent: number
  affaibli: boolean
}

export interface RestEvent {
  kind: RestKind
  deltas: {
    userId: number
    characterName: string
    delta: RestDelta
    after: RestState
  }[]
}

export function postRest(campaignId: number, kind: RestKind): Promise<RestEvent> {
  return request(`/${campaignId}/rest`, { method: 'POST', body: JSON.stringify({ kind }) })
}
