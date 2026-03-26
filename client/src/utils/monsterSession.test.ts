import { describe, it, expect } from 'vitest'
import {
  formatMod,
  hpPercent,
  hpColor,
  findCatalogMonster,
  filterCatalog,
} from './monsterSession'
import type { Monster } from '../data/monstersCatalog'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_CATALOG: Monster[] = [
  {
    name: 'GRIFFON',
    nc: 4,
    size: 'grande',
    stats: { for: 6, dex: 3, con: 6, int: -2, sag: 2, cha: 0 },
    def: 18,
    pv: 50,
    init: 16,
    attacks: [{ name: 'Morsures et griffes', bonus: 10, damage: '2d6+8' }],
    abilities: [{ name: 'Vol rapide', description: 'action de mouvement supplementaire en vol' }],
    description: 'Un griffon majestueux.',
  },
  {
    name: 'Araignee geante',
    nc: 2,
    size: 'grande',
    stats: { for: 4, dex: 2, con: 4, int: -4, sag: 2, cha: -2 },
    def: 14,
    pv: 20,
    init: 12,
    attacks: [{ name: 'Morsure', bonus: 6, damage: '1d8+3' }],
    abilities: [
      { name: 'Toile', description: 'immobilise la cible' },
      { name: 'Venin', description: 'inflige du poison' },
    ],
  },
  {
    name: 'Ours brun',
    nc: 4,
    size: 'grande',
    stats: { for: 6, dex: 1, con: 6, int: -4, sag: 2, cha: -2 },
    def: 18,
    pv: 50,
    init: 12,
    rd: '10',
    attacks: [{ name: 'Morsure et griffes', bonus: 10, damage: '2d6+10' }],
    abilities: [{ name: 'Charge', description: 'charge puissante' }],
  },
]

// ── formatMod ────────────────────────────────────────────────────────────────

describe('formatMod', () => {
  it("modificateur positif affiche le signe +", () => {
    expect(formatMod(6)).toBe('+6')
  })

  it("modificateur negatif affiche le signe -", () => {
    expect(formatMod(-3)).toBe('-3')
  })

  it("zero affiche +0", () => {
    expect(formatMod(0)).toBe('+0')
  })
})

// ── hpPercent ────────────────────────────────────────────────────────────────

describe('hpPercent', () => {
  it("PV pleins = 100%", () => {
    expect(hpPercent(50, 50)).toBe(100)
  })

  it("moitie des PV = 50%", () => {
    expect(hpPercent(25, 50)).toBe(50)
  })

  it("zero PV = 0%", () => {
    expect(hpPercent(0, 50)).toBe(0)
  })

  it("arrondi au pourcentage entier", () => {
    expect(hpPercent(1, 3)).toBe(33)
  })

  it("hpCurrent undefined retourne null", () => {
    expect(hpPercent(undefined, 50)).toBeNull()
  })

  it("hpMax undefined retourne null", () => {
    expect(hpPercent(30, undefined)).toBeNull()
  })

  it("hpMax zero retourne null (division par zero)", () => {
    expect(hpPercent(0, 0)).toBeNull()
  })
})

// ── hpColor ──────────────────────────────────────────────────────────────────

describe('hpColor', () => {
  it("plus de 50% = hp-ok", () => {
    expect(hpColor(75)).toBe('hp-ok')
    expect(hpColor(51)).toBe('hp-ok')
  })

  it("exactement 50% = hp-warn", () => {
    expect(hpColor(50)).toBe('hp-warn')
  })

  it("entre 26% et 50% = hp-warn", () => {
    expect(hpColor(30)).toBe('hp-warn')
    expect(hpColor(26)).toBe('hp-warn')
  })

  it("25% et moins = hp-danger", () => {
    expect(hpColor(25)).toBe('hp-danger')
    expect(hpColor(10)).toBe('hp-danger')
    expect(hpColor(0)).toBe('hp-danger')
  })

  it("null retourne chaine vide", () => {
    expect(hpColor(null)).toBe('')
  })

  it("100% = hp-ok", () => {
    expect(hpColor(100)).toBe('hp-ok')
  })
})

// ── findCatalogMonster ───────────────────────────────────────────────────────

describe('findCatalogMonster', () => {
  it("trouve un monstre par nom exact", () => {
    const result = findCatalogMonster('GRIFFON', FAKE_CATALOG)
    expect(result).toBeDefined()
    expect(result!.name).toBe('GRIFFON')
  })

  it("recherche insensible a la casse", () => {
    expect(findCatalogMonster('griffon', FAKE_CATALOG)).toBeDefined()
    expect(findCatalogMonster('Griffon', FAKE_CATALOG)).toBeDefined()
    expect(findCatalogMonster('araignee geante', FAKE_CATALOG)).toBeDefined()
  })

  it("retourne undefined pour un nom inconnu", () => {
    expect(findCatalogMonster('Dragon inexistant', FAKE_CATALOG)).toBeUndefined()
  })

  it("retourne undefined sur catalogue vide", () => {
    expect(findCatalogMonster('GRIFFON', [])).toBeUndefined()
  })
})

// ── filterCatalog ────────────────────────────────────────────────────────────

describe('filterCatalog', () => {
  it("recherche vide retourne tout le catalogue", () => {
    expect(filterCatalog('', FAKE_CATALOG)).toHaveLength(3)
  })

  it("espaces seuls retournent tout le catalogue", () => {
    expect(filterCatalog('   ', FAKE_CATALOG)).toHaveLength(3)
  })

  it("filtre par sous-chaine du nom", () => {
    const results = filterCatalog('grif', FAKE_CATALOG)
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('GRIFFON')
  })

  it("recherche insensible a la casse", () => {
    expect(filterCatalog('OURS', FAKE_CATALOG)).toHaveLength(1)
    expect(filterCatalog('ours', FAKE_CATALOG)).toHaveLength(1)
  })

  it("aucun resultat pour une recherche sans correspondance", () => {
    expect(filterCatalog('licorne', FAKE_CATALOG)).toHaveLength(0)
  })

  it("filtre avec accents partiels", () => {
    const results = filterCatalog('araignee', FAKE_CATALOG)
    expect(results).toHaveLength(1)
  })
})
