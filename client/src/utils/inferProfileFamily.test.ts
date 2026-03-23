import { describe, it, expect } from 'vitest'
import { inferProfileFamily } from './inferProfileFamily'
import type { PathRow } from '../types/character'

// IDs réels issus de client/src/data/voies.ts
const COMBATTANT_1: PathRow = { id: 'voie-du-bastion', name: 'Voie du bastion', rank: 1 }
const COMBATTANT_2: PathRow = { id: 'voie-de-la-bravoure', name: 'Voie de la bravoure', rank: 1 }
const AVENTURIER_1: PathRow = { id: 'voie-de-lacrobatie', name: "Voie de l'acrobatie", rank: 1 }
const AVENTURIER_2: PathRow = { id: 'voie-de-larbeletrie', name: "Voie de l'arbalètrie", rank: 1 }
const MYSTIQUE_1: PathRow = { id: 'voie-de-lalchimie', name: "Voie de l'alchimie", rank: 1 }
const MYSTIQUE_2: PathRow = { id: 'voie-des-arts-druidiques', name: 'Voie des arts druidiques', rank: 1 }

const PEUPLE: PathRow = { id: 'nain', name: 'Nain', rank: 1, kind: 'peuple' }
const CULTURELLE: PathRow = { id: 'ordre-du-malt', name: 'Ordre du Malt', rank: 1, kind: 'culturelle' }

describe('inferProfileFamily', () => {
  it('aucun path → aventuriers par défaut', () => {
    expect(inferProfileFamily([])).toBe('aventuriers')
  })

  it('uniquement des paths peuple/culturelle → aventuriers', () => {
    expect(inferProfileFamily([PEUPLE, CULTURELLE])).toBe('aventuriers')
  })

  it('2 voies combattants → combattants', () => {
    expect(inferProfileFamily([COMBATTANT_1, COMBATTANT_2])).toBe('combattants')
  })

  it('2 voies aventuriers → aventuriers', () => {
    expect(inferProfileFamily([AVENTURIER_1, AVENTURIER_2])).toBe('aventuriers')
  })

  it('1 combattant + 1 aventurier → aventuriers (pas de majorité)', () => {
    expect(inferProfileFamily([COMBATTANT_1, AVENTURIER_1])).toBe('aventuriers')
  })

  it('2 combattants + 1 aventurier → combattants (majorité)', () => {
    expect(inferProfileFamily([COMBATTANT_1, COMBATTANT_2, AVENTURIER_1])).toBe('combattants')
  })

  it('égalité 2-2 → aventuriers', () => {
    expect(inferProfileFamily([COMBATTANT_1, COMBATTANT_2, MYSTIQUE_1, MYSTIQUE_2])).toBe('aventuriers')
  })

  it('voie mystique en majorité → mystiques', () => {
    expect(inferProfileFamily([MYSTIQUE_1, MYSTIQUE_1, COMBATTANT_1])).toBe('mystiques')
  })

  it('paths peuple/culturelle ignorés dans le calcul', () => {
    // Seulement 1 combattant réel, les autres sont peuple/culturelle → pas de majorité
    expect(inferProfileFamily([COMBATTANT_1, PEUPLE, CULTURELLE])).toBe('aventuriers')
  })

  it('ID de voie inconnu → ignoré (traité comme absent)', () => {
    // Un ID inconnu ne doit pas casser, juste être ignoré
    const unknown: PathRow = { id: 'voie-inexistante', name: 'Inconnue', rank: 1 }
    expect(inferProfileFamily([unknown, unknown])).toBe('aventuriers')
  })
})
