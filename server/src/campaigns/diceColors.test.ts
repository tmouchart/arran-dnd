import { describe, it, expect } from 'vitest'
import { DICE_COLORS, defaultDiceColor, isDiceColor, resolveDiceColor } from './diceColors'

describe('diceColors', () => {
  it('les 8 premiers membres ont 8 couleurs distinctes', () => {
    const colors = Array.from({ length: 8 }, (_, i) => defaultDiceColor(i))
    expect(new Set(colors).size).toBe(8)
  })

  it('le 9e membre reprend la couleur du premier', () => {
    expect(defaultDiceColor(8)).toBe(DICE_COLORS[0])
  })

  it('un membre introuvable (index -1) reçoit quand même une couleur', () => {
    expect(defaultDiceColor(-1)).toBe(DICE_COLORS[0])
  })

  it('accepte seulement du #rrggbb', () => {
    expect(isDiceColor('#A1B2C3')).toBe(true)
    expect(isDiceColor('#abc')).toBe(false)
    expect(isDiceColor('red')).toBe(false)
    expect(isDiceColor(null)).toBe(false)
  })

  it('la couleur choisie prime, normalisée en minuscules', () => {
    expect(resolveDiceColor('#A1B2C3', 3)).toBe('#a1b2c3')
    expect(resolveDiceColor(null, 3)).toBe(DICE_COLORS[3])
    expect(resolveDiceColor('pas une couleur', 3)).toBe(DICE_COLORS[3])
  })
})
