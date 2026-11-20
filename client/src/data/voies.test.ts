import { describe, it, expect } from 'vitest'
import { VOIES, VOIES_BY_ID } from './voies'

const prestige = VOIES.filter((v) => v.prestige)

describe('voies de prestige — données du livre (p. 118)', () => {
  it('21 voies, 7 par famille', () => {
    expect(prestige).toHaveLength(21)
    for (const family of ['combattants', 'aventuriers', 'mystiques'] as const) {
      expect(prestige.filter((v) => v.family === family)).toHaveLength(7)
    }
  })

  it('les sorts de prestige sont marqués (arcanes : les 5 capacités)', () => {
    expect(VOIES_BY_ID['voie-des-arcanes'].capacites.every((c) => c.spell)).toBe(true)
    expect(VOIES_BY_ID['voie-des-rituels'].capacites.some((c) => c.spell)).toBe(false)
  })

  it('la forme élémentaire est toujours un sort de rang 4', () => {
    const forme = VOIES_BY_ID['voie-des-elements'].capacites[4]
    expect(forme).toMatchObject({ name: 'Forme élémentaire', spell: true, spellRank: 4 })
  })

  it('la voie des rituels n’a pas de Téléportation (c’est un sort des arcanes)', () => {
    const noms = VOIES_BY_ID['voie-des-rituels'].capacites.map((c) => c.name)
    expect(noms).not.toContain('Téléportation')
  })

  it('Vives lames (duel) donne la DEX au lieu de la FOR, pas le texte de la flibusterie', () => {
    expect(VOIES_BY_ID['voie-du-duel'].capacites[0].description).toMatch(/DEX au lieu du Mod\. de FOR/)
  })
})

describe('sorts des voies de profil', () => {
  it('les potions de l’alchimie ne sont pas des sorts', () => {
    expect(VOIES_BY_ID['voie-de-lalchimie'].capacites.some((c) => c.spell)).toBe(false)
  })

  it('Intelligence héroïque est un passif, pas un sort', () => {
    expect(VOIES_BY_ID['voie-de-la-magie-elementaliste'].capacites[4].spell).toBeUndefined()
  })

  it('37 sorts dans les voies de profil (* du livre)', () => {
    const count = VOIES.filter((v) => !v.prestige).flatMap((v) => v.capacites).filter((c) => c.spell).length
    expect(count).toBe(37)
  })
})
