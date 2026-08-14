import { SUPPORTED_SIDES } from './polyhedra'
import { rollOutcome, type RollOutcome } from '../rollOutcome'

/** Un dé physique à afficher : sa forme et la face à présenter. */
export interface DieInstance {
  sides: number
  /** `tens` = le dé des dizaines du d100, qui porte 00 à 90. */
  kind: 'normal' | 'tens'
  /** Index de la face dans l'atlas (0 = premier libellé). */
  faceIndex: number
  /** Critique / échec, ou null si ce dé ne compte pas. */
  outcome: RollOutcome
}

/** Un dé lancé : sa taille et la valeur déjà tirée par le code. */
export interface DieRoll {
  sides: number
  value: number
  /**
   * Type de jet, qui décide si ce dé peut faire un critique. Un d12 ne compte
   * que quand il remplace le d20 (affaibli), jamais au bac à sable.
   * Par défaut un jet d'attaque, le cas de loin le plus courant.
   */
  kind?: string
}

/** Au-delà, l'écran est illisible et le rendu commence à coûter. */
const MAX_DICE = 10

export function isAnimatable(sides: number): boolean {
  return sides === 100 || (SUPPORTED_SIDES as readonly number[]).includes(sides)
}

/**
 * Traduit un jet en dés à faire rouler.
 *
 * La liste accepte des dés de tailles différentes : le combat à deux armes
 * lance un d20 et un d12 dans le même geste.
 *
 * Le d100 n'existe pas comme solide : on le joue comme les vrais joueurs, avec
 * un dé de dizaines (00-90) et un dé d'unités (1-10).
 */
export function planDice(rolls: DieRoll[]): DieInstance[] {
  const dice: DieInstance[] = []

  for (const { sides, value, kind = 'weapon' } of rolls) {
    if (!isAnimatable(sides)) continue
    if (sides === 100) {
      // Le d100 ne critique pas : ses deux dés ne portent aucune marque
      dice.push({ sides: 10, kind: 'tens', faceIndex: Math.floor((value - 1) / 10), outcome: null })
      dice.push({ sides: 10, kind: 'normal', faceIndex: (value - 1) % 10, outcome: null })
    } else {
      dice.push({
        sides,
        kind: 'normal',
        faceIndex: value - 1,
        outcome: rollOutcome({ kind, die: value, sides }),
      })
    }
  }

  return dice.slice(0, MAX_DICE)
}

/**
 * Place les dés à l'arrivée : une rangée centrée, qui passe à la ligne au-delà
 * de 5 dés. Renvoie aussi l'échelle, réduite quand il y en a beaucoup.
 */
export function landingLayout(count: number): { positions: { x: number; y: number }[]; scale: number } {
  const perRow = Math.min(count, 5)
  const rows = Math.ceil(count / perRow)
  const scale = count <= 1 ? 0.5 : count <= 4 ? 0.4 : 0.3
  const gap = scale * 2.6

  const positions = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const inRow = Math.min(perRow, count - row * perRow)
    return {
      x: (col - (inRow - 1) / 2) * gap,
      y: -(row - (rows - 1) / 2) * gap,
    }
  })

  return { positions, scale }
}
