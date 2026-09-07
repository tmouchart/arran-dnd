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

/** Emplacements pour les dés des autres joueurs, dans la bande du haut. */
export const REMOTE_SLOTS = 4
/** Un dé distant dans un emplacement : 40 % d'un dé à moi, seul au centre. */
export const REMOTE_SCALE = 0.4
/** Un joueur qui lance 3d6 : on en anime au plus 5 dans son emplacement. */
export const MAX_REMOTE_DICE = 5

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
 * Place les dés d'un joueur distant dans son emplacement, en haut de l'écran.
 *
 * Les 4 emplacements se partagent la largeur visible. Plusieurs dés dans un
 * même emplacement se serrent en rangée, plus petits, sans déborder sur le
 * voisin. `halfWidth`/`halfHeight` sont les demi-dimensions visibles à la
 * profondeur des dés (voir `viewport()` dans l'overlay).
 */
export function remoteSlotLayout(
  slot: number,
  count: number,
  halfWidth: number,
  halfHeight: number,
): { positions: { x: number; y: number }[]; scale: number } {
  const n = Math.max(1, Math.min(count, MAX_REMOTE_DICE))
  const slotWidth = (halfWidth * 2) / REMOTE_SLOTS
  const centerX = -halfWidth + slotWidth * (slot + 0.5)
  // Sous la barre du haut : à 72 % de la demi-hauteur visible
  const y = halfHeight * 0.72

  // Un dé seul prend l'échelle distante ; plusieurs se partagent l'emplacement
  const scale = Math.min(REMOTE_SCALE, (slotWidth * 0.9) / (n * 2.3))
  const gap = scale * 2.3
  const positions = Array.from({ length: n }, (_, i) => ({
    x: centerX + (i - (n - 1) / 2) * gap,
    y,
  }))
  return { positions, scale }
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
