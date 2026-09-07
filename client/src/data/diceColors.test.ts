import { describe, it, expect } from 'vitest'
import { DICE_COLORS, inkFor } from './diceColors'

describe('inkFor', () => {
  it('encre sombre sur un fond clair, claire sur un fond sombre', () => {
    expect(inkFor('#ffffff')).toBe('#241a0d')
    expect(inkFor('#000000')).toBe('#fdf3e6')
  })

  it('le doré du thème garde des chiffres sombres, comme avant', () => {
    expect(inkFor('#d9a544')).toBe('#241a0d')
  })

  it('seul le safran de la palette prend des chiffres sombres', () => {
    const dark = DICE_COLORS.filter((c) => inkFor(c.hex) === '#241a0d').map((c) => c.label)
    expect(dark).toEqual(['Safran'])
  })

  it('une valeur cassée retombe sur l’encre sombre', () => {
    expect(inkFor('rouge')).toBe('#241a0d')
  })
})
