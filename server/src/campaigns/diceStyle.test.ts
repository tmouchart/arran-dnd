import { describe, it, expect } from 'vitest'
import { DICE_COLORS } from './diceColors'
import { defaultDiceStyle, dominantColor, parseDiceStyle, resolveDiceStyle } from './diceStyle'

describe('parseDiceStyle', () => {
  it('accepte un aplat et normalise le hex', () => {
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#A1B2C3' } })).toEqual({
      bg: { type: 'solid', from: '#a1b2c3' },
      ink: null,
      font: null,
    })
  })

  it('accepte un dégradé complet', () => {
    expect(parseDiceStyle({ bg: { type: 'gradient', from: '#f0a13a', to: '#b02a1f', angle: 160 }, ink: '#2a1206' }))
      .toEqual({ bg: { type: 'gradient', from: '#f0a13a', to: '#b02a1f', angle: 160 }, ink: '#2a1206', font: null })
  })

  it('refuse un dégradé sans second arrêt', () => {
    expect(parseDiceStyle({ bg: { type: 'gradient', from: '#f0a13a', angle: 90 } })).toBeNull()
  })

  it("refuse un angle hors bornes ou pas entier", () => {
    const bg = { type: 'gradient', from: '#f0a13a', to: '#b02a1f' }
    expect(parseDiceStyle({ bg: { ...bg, angle: 360 } })).toBeNull()
    expect(parseDiceStyle({ bg: { ...bg, angle: -1 } })).toBeNull()
    expect(parseDiceStyle({ bg: { ...bg, angle: NaN } })).toBeNull()
    expect(parseDiceStyle({ bg: { ...bg, angle: '90' } })).toBeNull()
  })

  it('refuse un hex invalide, un type inconnu, un objet vide', () => {
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#abc' } })).toBeNull()
    expect(parseDiceStyle({ bg: { type: 'radial', from: '#a1b2c3' } })).toBeNull()
    expect(parseDiceStyle({})).toBeNull()
    expect(parseDiceStyle(null)).toBeNull()
    expect(parseDiceStyle('#a1b2c3')).toBeNull()
  })

  it("une encre invalide invalide tout le style, une encre absente vaut l'automatique", () => {
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#a1b2c3' }, ink: 'blanc' })).toBeNull()
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#a1b2c3' }, ink: null })?.ink).toBeNull()
  })
})

describe('la police des chiffres', () => {
  it('accepte un slug connu, refuse un inconnu', () => {
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#a1b2c3' }, font: 'pirata' })?.font).toBe('pirata')
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#a1b2c3' }, font: 'comic-sans' })).toBeNull()
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#a1b2c3' }, font: 42 })).toBeNull()
  })

  it("absente, c'est celle du thème", () => {
    expect(parseDiceStyle({ bg: { type: 'solid', from: '#a1b2c3' } })?.font).toBeNull()
    expect(defaultDiceStyle(0).font).toBeNull()
  })
})

describe('defaultDiceStyle', () => {
  it('les 8 premiers membres ont 8 fonds distincts', () => {
    const fonds = Array.from({ length: 8 }, (_, i) => defaultDiceStyle(i).bg.from)
    expect(new Set(fonds).size).toBe(8)
  })

  it('le 9e membre reprend le fond du premier', () => {
    expect(defaultDiceStyle(8).bg.from).toBe(DICE_COLORS[0])
  })

  it('un membre introuvable (index -1) reçoit quand même un style', () => {
    expect(defaultDiceStyle(-1).bg.from).toBe(DICE_COLORS[0])
  })
})

describe('resolveDiceStyle', () => {
  it('le style stocké prime', () => {
    const stored = { bg: { type: 'solid', from: '#123456' }, ink: null, font: null }
    expect(resolveDiceStyle(stored, 3)).toEqual(stored)
  })

  it('un style absent ou corrompu retombe sur celui du rang', () => {
    expect(resolveDiceStyle(null, 3)).toEqual(defaultDiceStyle(3))
    expect(resolveDiceStyle({ bg: 'rouge' }, 3)).toEqual(defaultDiceStyle(3))
  })
})

describe('dominantColor', () => {
  it("un aplat, c'est sa propre couleur", () => {
    expect(dominantColor({ bg: { type: 'solid', from: '#d64545' }, ink: null, font: null })).toBe('#d64545')
  })

  it('un dégradé, le mélange de ses deux arrêts', () => {
    expect(dominantColor({ bg: { type: 'gradient', from: '#000000', to: '#ffffff', angle: 0 }, ink: null, font: null }))
      .toBe('#808080')
  })
})
