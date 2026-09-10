export interface DiceRoll {
  die: number
  rolls: number[]
  modifier: number
  total: number
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

/**
 * Parse "2d6" → { count: 2, sides: 6, modifier: 0 }.
 * Supports an inline modifier: "2d6+3" / "1d8-2".
 * Returns null if unrecognised.
 */
export function parseDiceNotation(
  notation: string,
): { count: number; sides: number; modifier: number } | null {
  const m = notation
    .trim()
    .replace(/^\(|\)$/g, '')
    .match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
  if (!m) return null
  const modifier = m[3] ? (m[3] === '-' ? -1 : 1) * parseInt(m[4], 10) : 0
  return { count: parseInt(m[1], 10), sides: parseInt(m[2], 10), modifier }
}

/** Roll a dice notation string (e.g. "1d8", "2d6", "2d6+3") with an optional extra flat modifier. */
export function rollDiceNotation(notation: string, modifier = 0): DiceRoll {
  const parsed = parseDiceNotation(notation)
  if (!parsed) return { die: 0, rolls: [], modifier, total: modifier }
  const totalModifier = modifier + parsed.modifier
  const rolls = Array.from({ length: parsed.count }, () => rollDie(parsed.sides))
  const total = rolls.reduce((a, b) => a + b, 0) + totalModifier
  return { die: parsed.sides, rolls, modifier: totalModifier, total }
}

/** Un jet où l'on garde un seul dé : avantage, désavantage ou relance. */
export interface KeptRoll {
  /** Le dé qui compte : c'est lui qui porte le critique et le total. */
  kept: number
  /** Les dés lancés puis écartés. Vide sur un jet à un seul dé. */
  dropped: number[]
}

/**
 * Lance `count` dés et n'en garde qu'un : le meilleur (avantage) ou le pire
 * (désavantage). Les autres restent visibles mais ne comptent plus.
 *
 * En cas d'égalité, c'est le premier dé lancé qui est gardé.
 */
export function rollKeep(sides: number, count = 1, keep: 'high' | 'low' = 'high'): KeptRoll {
  const rolls = Array.from({ length: Math.max(1, count) }, () => rollDie(sides))
  let keptIndex = 0
  for (let i = 1; i < rolls.length; i++) {
    const better = keep === 'high' ? rolls[i] > rolls[keptIndex] : rolls[i] < rolls[keptIndex]
    if (better) keptIndex = i
  }
  return { kept: rolls[keptIndex], dropped: rolls.filter((_, i) => i !== keptIndex) }
}
