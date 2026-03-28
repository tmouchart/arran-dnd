export interface DiceRoll {
  die: number
  rolls: number[]
  modifier: number
  total: number
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

/** Parse "2d6" → { count: 2, sides: 6 }. Returns null if unrecognised. */
export function parseDiceNotation(notation: string): { count: number; sides: number } | null {
  const m = notation.trim().replace(/^\(|\)$/g, '').match(/^(\d+)d(\d+)$/i)
  if (!m) return null
  return { count: parseInt(m[1], 10), sides: parseInt(m[2], 10) }
}

/** Roll a dice notation string (e.g. "1d8", "2d6") with an optional flat modifier. */
export function rollDiceNotation(notation: string, modifier = 0): DiceRoll {
  const parsed = parseDiceNotation(notation)
  if (!parsed) return { die: 0, rolls: [], modifier, total: modifier }
  const rolls = Array.from({ length: parsed.count }, () => rollDie(parsed.sides))
  const total = rolls.reduce((a, b) => a + b, 0) + modifier
  return { die: parsed.sides, rolls, modifier, total }
}
