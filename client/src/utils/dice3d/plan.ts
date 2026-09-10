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
  /**
   * Ce dé a été lancé puis écarté : il roule, mais il ne compte pas.
   * `planDice` le remplit toujours ; facultatif pour qui monte un dé à la main.
   */
  dropped?: boolean
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
  /**
   * Ce dé a été lancé puis écarté (avantage, désavantage, relance). Il roule
   * comme les autres mais ne compte pas : ni critique, ni échec.
   */
  dropped?: boolean
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

  for (const { sides, value, kind = 'weapon', dropped = false } of rolls) {
    if (!isAnimatable(sides)) continue
    if (sides === 100) {
      // Le d100 ne critique pas : ses deux dés ne portent aucune marque. Écarté,
      // il l'est des deux côtés : c'est un seul jet, pas deux.
      dice.push({ sides: 10, kind: 'tens', faceIndex: Math.floor((value - 1) / 10), outcome: null, dropped })
      dice.push({ sides: 10, kind: 'normal', faceIndex: (value - 1) % 10, outcome: null, dropped })
    } else {
      dice.push({
        sides,
        kind: 'normal',
        faceIndex: value - 1,
        // Un dé écarté ne porte aucune marque : pas de fanfare sur un 1 jeté,
        // pas d'étincelles sur un 20 qu'on ne garde pas.
        outcome: dropped ? null : rollOutcome({ kind, die: value, sides }),
        dropped,
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

/** Zone d'écran où les dés du mode table se posent (la carte), en pixels. */
export interface ScreenArea {
  left: number
  top: number
  width: number
  height: number
}

/** Un dé du mode table : aussi gros qu'un dé à moi. Lu à un mètre, pas à 30 cm. */
export const VIEWER_SCALE = 0.5
/** Les 4 emplacements du mode table : la carte coupée en 2 × 2. */
const VIEWER_COLUMNS = 2

/**
 * Place les dés d'un jet sur la carte, en mode table.
 *
 * Comme à une vraie table, les dés tombent sur le champ de bataille, à un
 * endroit un peu différent à chaque fois. Chaque emplacement est un quart de
 * la carte ; le point de chute est tiré dedans, avec une marge pour que le dé
 * n'en déborde pas. Deux jets simultanés tombent donc dans deux quarts
 * différents et ne se recouvrent jamais.
 *
 * `screen` est la taille de la fenêtre ; `halfWidth`/`halfHeight` les
 * demi-dimensions visibles à la profondeur des dés. `random` vaut dans [0, 1[.
 */
export function viewerLayout(
  slot: number,
  count: number,
  area: ScreenArea,
  screen: { width: number; height: number },
  halfWidth: number,
  halfHeight: number,
  random: () => number = Math.random,
): { positions: { x: number; y: number }[]; scale: number } {
  const n = Math.max(1, Math.min(count, MAX_REMOTE_DICE))
  const rows = Math.ceil(REMOTE_SLOTS / VIEWER_COLUMNS)
  const col = slot % VIEWER_COLUMNS
  const row = Math.floor(slot / VIEWER_COLUMNS)
  const cellWidth = area.width / VIEWER_COLUMNS
  const cellHeight = area.height / rows

  // Marge : la moitié de la cellule au plus, pour que le dé reste dedans
  const marginX = Math.min(cellWidth * 0.3, cellWidth / 2)
  const marginY = Math.min(cellHeight * 0.3, cellHeight / 2)
  const px = area.left + col * cellWidth + marginX + random() * Math.max(0, cellWidth - 2 * marginX)
  const py = area.top + row * cellHeight + marginY + random() * Math.max(0, cellHeight - 2 * marginY)

  // Pixels → coordonnées de scène à la profondeur des dés
  const centerX = ((px / screen.width) * 2 - 1) * halfWidth
  const y = (1 - (py / screen.height) * 2) * halfHeight

  const scale = Math.min(VIEWER_SCALE, (cellWidth / screen.width) * halfWidth * 2 * 0.9 / (n * 2.3))
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
