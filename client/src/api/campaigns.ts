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
