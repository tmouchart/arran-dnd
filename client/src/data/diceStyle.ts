/**
 * Le style de dé d'un joueur : un fond (aplat ou dégradé à deux arrêts) et la
 * couleur des chiffres. `ink: null` = encre automatique, choisie d'après la
 * luminance du fond.
 *
 * Copie de `server/src/campaigns/diceStyle.ts` — les deux doivent rester
 * identiques, à l'exception des helpers de rendu en bas de ce fichier.
 */

import { DICE_COLORS, inkFor, relativeLuminance } from './diceColors'
import { DICE_FONT_SLUGS } from './diceFonts'

export type DiceBg =
  | { type: 'solid'; from: string }
  // `angle` en degrés, convention CSS : 0 = vers le haut, 180 = vers le bas.
  | { type: 'gradient'; from: string; to: string; angle: number }

export interface DiceStyle {
  bg: DiceBg
  ink: string | null
  /** Slug de la police des chiffres (voir `diceFonts.ts`). `null` = celle du thème. */
  font: string | null
}

const HEX = /^#[0-9a-f]{6}$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

function hex(value: unknown): string | null {
  return isHexColor(value) ? value.toLowerCase() : null
}

function angle(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded >= 0 && rounded < 360 ? rounded : null
}

/** Valide un style venu du serveur. Strict : la moindre anomalie renvoie `null`. */
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
    if (typeof raw.font !== 'string' || !DICE_FONT_SLUGS.includes(raw.font)) return null
    font = raw.font
  }

  if (raw.ink === undefined || raw.ink === null) return { bg, ink: null, font }
  const ink = hex(raw.ink)
  return ink ? { bg, ink, font } : null
}

/** Style par défaut d'un membre, d'après sa place dans la liste des membres. */
export function defaultDiceStyle(memberIndex: number): DiceStyle {
  const index = memberIndex < 0 ? 0 : memberIndex
  return { bg: { type: 'solid', from: DICE_COLORS[index % DICE_COLORS.length].hex }, ink: null, font: null }
}

/**
 * La couleur qui représente le dé en un seul ton : celle du fond uni, le
 * mélange des deux arrêts pour un dégradé. Sert au flash d'un critique et à
 * l'étiquette du jet.
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

// ── Rendu (client seulement) ────────────────────────────────────────────────

/** Un aplat de la couleur donnée, encre automatique. */
export function solidStyle(from: string): DiceStyle {
  return { bg: { type: 'solid', from }, ink: null, font: null }
}

/**
 * L'encre effective : celle choisie, sinon celle que la luminance du fond
 * impose. Pour un dégradé on juge sur la dominante — sinon un fond
 * clair vers sombre reçoit une encre illisible sur une de ses moitiés.
 */
export function resolvedInk(style: DiceStyle): string {
  return style.ink ?? inkFor(dominantColor(style))
}

/** Le fond du dé en CSS, pour les pastilles et l'aperçu de repli. */
export function backgroundCss(style: DiceStyle): string {
  const { bg } = style
  return bg.type === 'solid'
    ? bg.from
    : `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`
}

/** Clé de cache d'un style : deux styles identiques donnent la même texture. */
export function styleKey(style: DiceStyle): string {
  const { bg } = style
  const fond = bg.type === 'solid' ? bg.from : `${bg.from}>${bg.to}@${bg.angle}`
  return `${fond}/${style.ink ?? 'auto'}/${style.font ?? 'theme'}`
}

/**
 * Le contraste des chiffres est-il trop faible pour qu'on lise le dé ?
 *
 * On juge sur l'arrêt le plus proche de l'encre : sur un dégradé, c'est la
 * moitié la moins lisible qui décide. Seuil à 3:1 — en dessous, un chiffre de
 * 4 cm sur un téléphone disparaît.
 */
export function inkIsRisky(style: DiceStyle): boolean {
  const ink = relativeLuminance(resolvedInk(style))
  const stops = style.bg.type === 'solid' ? [style.bg.from] : [style.bg.from, style.bg.to]
  const worst = Math.max(
    ...stops.map((stop) => {
      const fond = relativeLuminance(stop)
      const [light, dark] = ink > fond ? [ink, fond] : [fond, ink]
      return (dark + 0.05) / (light + 0.05)
    }),
  )
  return 1 / worst < 3
}
