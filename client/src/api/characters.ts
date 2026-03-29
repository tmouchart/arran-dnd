import type { Character } from '../types/character'

const BASE = '/api/characters'

export interface ServerCharacter {
  id: number
  userId: number
  isActive: boolean
  name: string
  profile: string
  histoire: string
  people: string
  level: number
  hpMax: number
  hpCurrent: number
  mpMax: number
  mpCurrent: number | undefined
  defense: number
  initiativeBonus: number
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
  skills: Character['skills']
  weapons: Character['weapons']
  martialFormations: Character['martialFormations']
  paths: Character['paths']
  mysticTalent: string | null | undefined
  armorId: string | null | undefined
  shieldId: string | null | undefined
  defenseBonus: number | undefined
  attackContactBonus: number | undefined
  attackDistanceBonus: number | undefined
  attackMagiqueBonus: number | undefined
  hpLevelGains: number[] | undefined
  items: Character['items'] | undefined
  goldCoins: number | undefined
  silverCoins: number | undefined
  copperCoins: number | undefined
  pcCurrent: number | undefined
  prCurrent: number | undefined
  competences: Character['competences'] | undefined
  portraitImageId: number | null | undefined
}

export async function fetchCharacter(id: number): Promise<ServerCharacter> {
  const res = await fetch(`${BASE}/${id}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Personnage introuvable')
  return res.json()
}

export async function fetchCharacters(): Promise<ServerCharacter[]> {
  const res = await fetch(BASE, { credentials: 'include' })
  if (!res.ok) throw new Error('Erreur lors du chargement des personnages')
  return res.json()
}

export async function createCharacter(data: Partial<ServerCharacter>): Promise<ServerCharacter> {
  const res = await fetch(BASE, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Erreur lors de la création du personnage')
  return res.json()
}

export async function updateCharacter(id: number, data: Partial<ServerCharacter>): Promise<ServerCharacter> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Erreur lors de la sauvegarde')
  return res.json()
}

export async function patchCharacterHp(id: number, hpCurrent: number): Promise<ServerCharacter> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hpCurrent }),
  })
  if (!res.ok) throw new Error('Erreur lors de la mise à jour des PV')
  return res.json()
}

export async function deleteCharacter(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) throw new Error('Erreur lors de la suppression')
}

export async function activateCharacter(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}/activate`, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error('Erreur lors de l\'activation')
}
