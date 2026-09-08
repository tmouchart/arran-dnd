import { describe, it, expect } from 'vitest'
import { isDiceColor } from './diceColors'

describe('diceColors', () => {
  it('accepte seulement du #rrggbb', () => {
    expect(isDiceColor('#A1B2C3')).toBe(true)
    expect(isDiceColor('#abc')).toBe(false)
    expect(isDiceColor('red')).toBe(false)
    expect(isDiceColor(null)).toBe(false)
  })
})
