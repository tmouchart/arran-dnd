import { describe, it, expect } from 'vitest'
import {
  backgroundCss,
  defaultDiceStyle,
  dominantColor,
  inkIsRisky,
  parseDiceStyle,
  resolvedInk,
  solidStyle,
  styleKey,
  type DiceStyle,
} from './diceStyle'

const gradient = (from: string, to: string, angle = 160): DiceStyle => ({
  bg: { type: 'gradient', from, to, angle },
  ink: null,
  font: null,
})

describe('parseDiceStyle', () => {
  it('accepte un aplat, un dégradé, et normalise le hex', () => {
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#A1B2C3' } })).toEqual(solidStyle('#a1b2c3'))
    expect(parseDiceStyle(gradient('#f0a13a', '#b02a1f'))).toEqual(gradient('#f0a13a', '#b02a1f'))
  })

  it('accepte un slug de police connu, refuse un inconnu', () => {
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#a1b2c3' }, font: 'uncial' })?.font).toBe('uncial')
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#a1b2c3' }, font: 'comic-sans' })).toBeNull()
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#a1b2c3' } })?.font).toBeNull()
  })

  it('refuse ce qui ne tient pas debout', () => {
    expect(parseDiceStyle({ bg: { type: 'gradient', from: '#f0a13a', angle: 90 } })).toBeNull()
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#abc' } })).toBeNull()
    expect(parseDiceStyle(null)).toBeNull()
  })
})

describe('dominantColor', () => {
  it("un aplat, c'est sa propre couleur ; un dégradé, le mélange", () => {
    expect(dominantColor(solidStyle('#d64545'))).toBe('#d64545')
    expect(dominantColor(gradient('#000000', '#ffffff'))).toBe('#808080')
  })
})

describe('resolvedInk', () => {
  it("l'encre choisie prime", () => {
    expect(resolvedInk({ bg: { type: 'solid', from: '#000000' }, ink: '#ff0000', font: null })).toBe('#ff0000')
  })

  it("sans encre choisie, c'est la luminance de la dominante qui décide", () => {
    expect(resolvedInk(solidStyle('#ffffff'))).toBe('#241a0d')
    expect(resolvedInk(solidStyle('#000000'))).toBe('#fdf3e6')
    // Dominante grise : le dégradé noir→blanc prend l'encre claire.
    expect(resolvedInk(gradient('#000000', '#ffffff'))).toBe('#fdf3e6')
  })
})

describe('inkIsRisky', () => {
  it('un fond noir avec des chiffres noirs, oui', () => {
    expect(inkIsRisky({ bg: { type: 'solid', from: '#111111' }, ink: '#1a1a1a', font: null })).toBe(true)
  })

  it("un aplat avec l'encre automatique, jamais", () => {
    expect(inkIsRisky(solidStyle('#d64545'))).toBe(false)
    expect(inkIsRisky(solidStyle('#fdf3e6'))).toBe(false)
  })

  it("c'est l'arrêt le moins lisible du dégradé qui décide", () => {
    // Encre sombre : lisible sur le blanc, perdue sur le noir.
    expect(inkIsRisky({ bg: { type: 'gradient', from: '#ffffff', to: '#241a0d', angle: 160 }, ink: '#241a0d', font: null }))
      .toBe(true)
  })
})

describe('backgroundCss', () => {
  it("rend l'aplat tel quel et le dégradé en CSS", () => {
    expect(backgroundCss(solidStyle('#d64545'))).toBe('#d64545')
    expect(backgroundCss(gradient('#f0a13a', '#b02a1f'))).toBe('linear-gradient(160deg, #f0a13a, #b02a1f)')
  })
})

describe('styleKey', () => {
  it('deux styles identiques partagent leur clé, deux styles proches non', () => {
    expect(styleKey(solidStyle('#d64545'))).toBe(styleKey(solidStyle('#d64545')))
    expect(styleKey(gradient('#000000', '#ffffff', 0))).not.toBe(styleKey(gradient('#000000', '#ffffff', 90)))
    expect(styleKey(solidStyle('#d64545'))).not.toBe(
      styleKey({ bg: { type: 'solid', from: '#d64545' }, ink: '#ffffff', font: null }),
    )
    expect(styleKey(solidStyle('#d64545'))).not.toBe(
      styleKey({ ...solidStyle('#d64545'), font: 'uncial' }),
    )
  })
})

describe('defaultDiceStyle', () => {
  it('8 fonds distincts, puis ça recommence', () => {
    const fonds = Array.from({ length: 8 }, (_, i) => defaultDiceStyle(i).bg.from)
    expect(new Set(fonds).size).toBe(8)
    expect(defaultDiceStyle(8).bg.from).toBe(defaultDiceStyle(0).bg.from)
    expect(defaultDiceStyle(-1).bg.from).toBe(defaultDiceStyle(0).bg.from)
  })
})
