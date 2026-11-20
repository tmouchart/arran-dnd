import { describe, it, expect } from 'vitest'
import { breaksFamilyRule } from './prestigeRules'
import { VOIES_BY_ID } from '../data/voies'
import type { PathRow } from '../types/character'

const path = (id: string, rank = 1, kind?: PathRow['kind']): PathRow => ({ id, name: id, rank, kind })

// Grimm : pugilat (combattant), charme + arbalètrie (aventuriers) → profil aventurier
const GRIMM = [
  path('peuple-nain', 2, 'peuple'),
  path('culture-nain-malt', 1, 'culturelle'),
  path('voie-du-charme'),
  path('voie-de-larbeletrie'),
  path('voie-du-pugilat', 5),
]

describe('breaksFamilyRule — « la famille avant tout »', () => {
  it('une 1re voie de prestige d’une autre famille passe (2 aventuriers contre 2 combattants)', () => {
    expect(breaksFamilyRule(GRIMM, VOIES_BY_ID['voie-du-dogme-de-pierre'])).toBe(false)
  })

  it('une 2e voie de cette autre famille rendrait le profil minoritaire', () => {
    const avecDogme = [...GRIMM, path('voie-du-dogme-de-pierre')]
    expect(breaksFamilyRule(avecDogme, VOIES_BY_ID['voie-de-la-danse-de-guerre'])).toBe(true)
  })

  it('une voie de prestige de la famille du profil passe toujours', () => {
    expect(breaksFamilyRule(GRIMM, VOIES_BY_ID['voie-de-laudace'])).toBe(false)
  })

  it('profil sans majorité (1/1/1 = aventurier) : une voie combattante le rendrait minoritaire', () => {
    const mixte = [path('voie-du-bastion'), path('voie-de-lacrobatie'), path('voie-de-lalchimie')]
    expect(breaksFamilyRule(mixte, VOIES_BY_ID['voie-des-armes-lourdes'])).toBe(true)
    expect(breaksFamilyRule(mixte, VOIES_BY_ID['voie-du-duel'])).toBe(false)
  })

  it('les voies de peuple et de culture ne comptent pas', () => {
    const mystique = [
      path('peuple-nain', 5, 'peuple'),
      path('voie-du-mysticisme'),
      path('voie-de-la-magie-elementaliste'),
    ]
    expect(breaksFamilyRule(mystique, VOIES_BY_ID['voie-des-arcanes'])).toBe(false)
    expect(breaksFamilyRule(mystique, VOIES_BY_ID['voie-du-duel'])).toBe(false)
  })
})
