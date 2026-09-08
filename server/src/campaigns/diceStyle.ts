/**
 * Le style de dé d'un joueur : un fond (aplat ou dégradé à deux arrêts) et la
 * couleur des chiffres. `ink: null` = encre automatique, calculée côté client
 * d'après la luminance du fond — c'est le comportement historique.
 *
 * Copie côté client dans `client/src/data/diceStyle.ts` — les deux doivent
 * rester identiques.
 */

import { DICE_COLORS, isDiceColor } from './diceColors.js'

export type DiceBg =
  | { type: 'solid'; from: string }
  // `angle` en degrés, convention CSS : 0 = vers le haut, 180 = vers le bas.
  | { type: 'gradient'; from: string; to: string; angle: number }

export interface DiceStyle {
  bg: DiceBg
  ink: string | null
  /** Slug de la police des chiffres. `null` = celle du thème. */
  font: string | null
}

/**
 * Les polices proposées. Copie de `client/src/data/diceFonts.ts` : le serveur
 * ne connaît que les slugs, il n'a pas à savoir à quoi ils ressemblent.
 */
const FONT_SLUGS = ['metamorphous', 'uncial', 'cinzel', 'pirata', 'cormorant', 'lora', 'moderne']

/** Un hex valide, normalisé en minuscules. `null` si la valeur ne convient pas. */
function hex(value: unknown): string | null {
  return isDiceColor(value) ? value.toLowerCase() : null
}

/** L'angle du dégradé, en degrés. 0 = haut vers bas. */
function angle(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded >= 0 && rounded < 360 ? rounded : null
}

/**
 * Valide un style venu du client ou de la base. Strict : tout ce qui n'est pas
 * exactement la forme attendue renvoie `null`, et l'appelant répond 400.
 */
export function parseDiceStyle(value: unknown): DiceStyle | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as { bg?: unknown; ink?: unknown; font?: unknown }

  if (!raw.bg || typeof raw.bg !== 'object') return null
  const rawBg = raw.bg as { type?: unknown; from?: unknown; to?: unknown; angle?: unknown }

  const from = hex(rawBg.from)
  if (!from) return null

  let bg: DiceBg
  if (rawBg.type === 'solid') {
    bg = { type: 'solid', from }
  } else if (rawBg.type === 'gradient') {
    const to = hex(rawBg.to)
    const deg = angle(rawBg.angle)
    if (!to || deg === null) return null
    bg = { type: 'gradient', from, to, angle: deg }
  } else {
    return null
  }

  let font: string | null = null
  if (raw.font !== undefined && raw.font !== null) {
    if (typeof raw.font !== 'string' || !FONT_SLUGS.includes(raw.font)) return null
    font = raw.font
  }

  // `ink` absent et `ink: null` veulent dire la même chose : encre automatique.
  if (raw.ink === undefined || raw.ink === null) return { bg, ink: null, font }
  const ink = hex(raw.ink)
  return ink ? { bg, ink, font } : null
}

/** Style par défaut d'un membre, d'après sa place dans la liste des membres. */
export function defaultDiceStyle(memberIndex: number): DiceStyle {
  const index = memberIndex < 0 ? 0 : memberIndex
  return { bg: { type: 'solid', from: DICE_COLORS[index % DICE_COLORS.length] }, ink: null, font: null }
}

/** Le style effectif : celui choisi par le joueur, sinon celui de son rang. */
export function resolveDiceStyle(stored: unknown, memberIndex: number): DiceStyle {
  return parseDiceStyle(stored) ?? defaultDiceStyle(memberIndex)
}

/**
 * La couleur qui représente le dé en un seul ton : celle du fond uni, le
 * mélange des deux arrêts pour un dégradé. Sert au flash d'un critique, à
 * l'étiquette du jet, et au champ `diceColor` gardé pour les clients anciens.
 */
export function dominantColor(style: DiceStyle): string {
  const { bg } = style
  if (bg.type === 'solid') return bg.from
  const mix = (i: number) => {
    const a = parseInt(bg.from.slice(i, i + 2), 16)
    const b = parseInt(bg.to.slice(i, i + 2), 16)
    return Math.round((a + b) / 2).toString(16).padStart(2, '0')
  }
  return `#${mix(1)}${mix(3)}${mix(5)}`
}
