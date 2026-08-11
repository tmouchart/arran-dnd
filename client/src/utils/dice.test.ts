import { describe, it, expect, vi } from 'vitest'
import { parseDiceNotation, rollDie, rollDiceNotation } from './dice'

// ── parseDiceNotation ────────────────────────────────────────────────────────

describe('parseDiceNotation', () => {
  it('parses standard notation "2d6"', () => {
    expect(parseDiceNotation('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 })
  })

  it('parses single die "1d20"', () => {
    expect(parseDiceNotation('1d20')).toEqual({ count: 1, sides: 20, modifier: 0 })
  })

  it('is case-insensitive "1D8"', () => {
    expect(parseDiceNotation('1D8')).toEqual({ count: 1, sides: 8, modifier: 0 })
  })

  it('trims whitespace', () => {
    expect(parseDiceNotation('  3d4  ')).toEqual({ count: 3, sides: 4, modifier: 0 })
  })

  it('parses inline positive modifier "2d6+3"', () => {
    expect(parseDiceNotation('2d6+3')).toEqual({ count: 2, sides: 6, modifier: 3 })
  })

  it('parses inline negative modifier "1d8-2"', () => {
    expect(parseDiceNotation('1d8-2')).toEqual({ count: 1, sides: 8, modifier: -2 })
  })

  it('tolerates spaces around the modifier "2d10 + 4"', () => {
    expect(parseDiceNotation('2d10 + 4')).toEqual({ count: 2, sides: 10, modifier: 4 })
  })

  it('returns null for a dangling modifier "2d6+"', () => {
    expect(parseDiceNotation('2d6+')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseDiceNotation('')).toBeNull()
  })

  it('returns null for invalid notation "abc"', () => {
    expect(parseDiceNotation('abc')).toBeNull()
  })

  it('returns null for missing count "d6"', () => {
    expect(parseDiceNotation('d6')).toBeNull()
  })

  it('returns null for plain number "42"', () => {
    expect(parseDiceNotation('42')).toBeNull()
  })

  it('parses parenthesised notation "(1d4)" (temporary damage)', () => {
    expect(parseDiceNotation('(1d4)')).toEqual({ count: 1, sides: 4, modifier: 0 })
  })
})

// ── rollDie ──────────────────────────────────────────────────────────────────

describe('rollDie', () => {
  it('returns a value between 1 and sides inclusive', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDie(6)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(6)
    }
  })

  it('returns 1 for a 1-sided die', () => {
    expect(rollDie(1)).toBe(1)
  })
})

// ── rollDiceNotation ─────────────────────────────────────────────────────────

describe('rollDiceNotation', () => {
  it('returns correct structure for valid notation', () => {
    const result = rollDiceNotation('2d6')
    expect(result.die).toBe(6)
    expect(result.rolls).toHaveLength(2)
    result.rolls.forEach(r => {
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(6)
    })
    expect(result.modifier).toBe(0)
    expect(result.total).toBe(result.rolls[0] + result.rolls[1])
  })

  it('includes modifier in total', () => {
    // Mock Math.random to get deterministic results
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const result = rollDiceNotation('1d10', 3)
    expect(result.modifier).toBe(3)
    // Math.floor(0.5 * 10) + 1 = 6
    expect(result.rolls).toEqual([6])
    expect(result.total).toBe(6 + 3)
    spy.mockRestore()
  })

  it('handles negative modifier', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0) // rolls 1
    const result = rollDiceNotation('1d8', -2)
    expect(result.total).toBe(1 - 2)
    spy.mockRestore()
  })

  it('returns fallback for invalid notation', () => {
    const result = rollDiceNotation('invalid', 5)
    expect(result).toEqual({ die: 0, rolls: [], modifier: 5, total: 5 })
  })

  it('defaults modifier to 0', () => {
    const result = rollDiceNotation('1d4')
    expect(result.modifier).toBe(0)
  })

  it('applies the inline modifier "2d6+3"', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5) // rolls 4
    const result = rollDiceNotation('2d6+3')
    expect(result.rolls).toEqual([4, 4])
    expect(result.modifier).toBe(3)
    expect(result.total).toBe(4 + 4 + 3)
    spy.mockRestore()
  })

  it('cumulates inline and extra modifiers "1d8-2" with +5', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0) // rolls 1
    const result = rollDiceNotation('1d8-2', 5)
    expect(result.modifier).toBe(3)
    expect(result.total).toBe(1 + 3)
    spy.mockRestore()
  })
})
