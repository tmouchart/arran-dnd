import { describe, it, expect } from 'vitest'
import { isGradedDie, rollOutcome } from './rollOutcome'

describe('isGradedDie', () => {
  it('le d20 compte partout, bac à sable compris', () => {
    expect(isGradedDie(20, 'libre')).toBe(true)
    expect(isGradedDie(20, 'weapon')).toBe(true)
  })

  it('le d12 ne compte que quand il remplace le d20', () => {
    expect(isGradedDie(12, 'weapon')).toBe(true)
    expect(isGradedDie(12, 'ability')).toBe(true)
    expect(isGradedDie(12, 'libre')).toBe(false)
  })

  it('les autres dés ne comptent jamais', () => {
    for (const sides of [4, 6, 8, 10, 100]) {
      expect(isGradedDie(sides, 'libre')).toBe(false)
      expect(isGradedDie(sides, 'weapon')).toBe(false)
    }
  })
})

describe('rollOutcome', () => {
  it('un 20 au bac à sable est un critique', () => {
    expect(rollOutcome({ kind: 'libre', die: 20, sides: 20 })).toBe('critical')
    expect(rollOutcome({ kind: 'libre', die: 1, sides: 20 })).toBe('fumble')
  })

  it('un max sur un petit dé ne vaut rien', () => {
    expect(rollOutcome({ kind: 'libre', die: 6, sides: 6 })).toBeNull()
    expect(rollOutcome({ kind: 'libre', die: 1, sides: 6 })).toBeNull()
    expect(rollOutcome({ kind: 'libre', die: 100, sides: 100 })).toBeNull()
    expect(rollOutcome({ kind: 'libre', die: 12, sides: 12 })).toBeNull()
  })

  it('garde le critique pour les jets d20', () => {
    expect(rollOutcome({ kind: 'ability', die: 20, sides: 20 })).toBe('critical')
    expect(rollOutcome({ kind: 'weapon', die: 20, sides: 20 })).toBe('critical')
  })

  it('garde le critique sur d12 en affaibli', () => {
    expect(rollOutcome({ kind: 'weapon', die: 12, sides: 12 })).toBe('critical')
  })

  it('garde le fumble sur un 1 naturel', () => {
    expect(rollOutcome({ kind: 'ability', die: 1, sides: 20 })).toBe('fumble')
    expect(rollOutcome({ kind: 'weapon', die: 1, sides: 12 })).toBe('fumble')
  })

  it('respecte le drapeau damage.critical / damage.fumble des armes', () => {
    expect(
      rollOutcome({ kind: 'weapon', die: 15, sides: 20, damage: { critical: true, fumble: false } }),
    ).toBe('critical')
    expect(
      rollOutcome({ kind: 'weapon', die: 3, sides: 20, damage: { critical: false, fumble: true } }),
    ).toBe('fumble')
  })

  it('retourne null pour un jet ordinaire', () => {
    expect(rollOutcome({ kind: 'ability', die: 12, sides: 20 })).toBeNull()
  })

  // Le bac à sable met die à 0 quand on lance plusieurs dés : une poignée de
  // d20 ne doit pas compter comme un critique.
  it('ignore les lancers multiples du bac à sable', () => {
    expect(rollOutcome({ kind: 'libre', die: 0, sides: 20 })).toBeNull()
  })

  it('accepte un damage nul, comme le renvoie l’API de campagne', () => {
    expect(rollOutcome({ kind: 'weapon', die: 20, sides: 20, damage: null })).toBe('critical')
  })
})
