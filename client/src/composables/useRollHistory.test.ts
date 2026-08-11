import { describe, it, expect } from 'vitest'
import { rollHighlight } from './useRollHistory'

describe('rollHighlight', () => {
  it('ne donne jamais de critique à un jet libre, même au score max', () => {
    expect(rollHighlight({ kind: 'libre', die: 6, sides: 6 })).toBeNull()
    expect(rollHighlight({ kind: 'libre', die: 20, sides: 20 })).toBeNull()
    expect(rollHighlight({ kind: 'libre', die: 100, sides: 100 })).toBeNull()
  })

  it('ne donne jamais de fumble à un jet libre', () => {
    expect(rollHighlight({ kind: 'libre', die: 1, sides: 6 })).toBeNull()
    expect(rollHighlight({ kind: 'libre', die: 1, sides: 20 })).toBeNull()
  })

  it('garde le critique pour les jets d20 (attaque/carac)', () => {
    expect(rollHighlight({ kind: 'ability', die: 20, sides: 20 })).toBe('critical')
    expect(rollHighlight({ kind: 'weapon', die: 20, sides: 20 })).toBe('critical')
  })

  it('garde le critique sur d12 en affaibli', () => {
    expect(rollHighlight({ kind: 'weapon', die: 12, sides: 12 })).toBe('critical')
  })

  it('garde le fumble sur un 1 naturel (jets non libres)', () => {
    expect(rollHighlight({ kind: 'ability', die: 1, sides: 20 })).toBe('fumble')
    expect(rollHighlight({ kind: 'weapon', die: 1, sides: 12 })).toBe('fumble')
  })

  it('respecte le flag damage.critical / damage.fumble des armes', () => {
    expect(
      rollHighlight({ kind: 'weapon', die: 15, sides: 20, damage: { total: 8, critical: true, fumble: false } }),
    ).toBe('critical')
    expect(
      rollHighlight({ kind: 'weapon', die: 3, sides: 20, damage: { total: 0, critical: false, fumble: true } }),
    ).toBe('fumble')
  })

  it('retourne null pour un jet non libre ordinaire', () => {
    expect(rollHighlight({ kind: 'ability', die: 12, sides: 20 })).toBeNull()
  })
})
