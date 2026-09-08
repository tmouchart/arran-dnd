import * as THREE from 'three'
import { diceFont } from '../../data/diceFonts'
import { resolvedInk, type DiceBg, type DiceStyle } from '../../data/diceStyle'

/**
 * Atlas de textures : un seul canvas qui porte tous les chiffres du dé, une
 * case par face. Une texture pour tout le dé = un seul appel de rendu.
 */

const CELL = 128

export interface DiceAtlas {
  texture: THREE.Texture
  columns: number
  rows: number
}

/** Lit un token de thème, avec repli si la variable n'existe pas. */
export function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name)
  return value.trim() || fallback
}

/**
 * 6 et 9 sont indiscernables une fois le dé tourné : les vrais dés les
 * soulignent, on fait pareil.
 */
function needsUnderline(label: string): boolean {
  return label === '6' || label === '9'
}

/**
 * Taille de police qui tient dans le disque inscrit de la face.
 *
 * `fitRatio` est la part utilisable de la face (voir `faceFitRatio`). Le
 * diviseur dépend de la largeur du libellé : un « 20 » déborde bien plus vite
 * qu'un « 7 ».
 */
export function fontSizeFor(label: string, fitRatio: number): number {
  const halfDiagonal = label.length >= 3 ? 0.92 : label.length === 2 ? 0.68 : 0.47
  // Rayon utile de la case, en pixels — cohérent avec le `fill` des UV
  const usable = CELL * 0.5 * 0.84 * fitRatio
  return (usable / halfDiagonal) * 0.94
}

/** Le doré du thème : ce que porte un dé sans style de joueur. */
export function themeDiceStyle(): DiceStyle {
  return { bg: { type: 'solid', from: token('--brand', '#d9a544') }, ink: token('--on-brand', '#241c10'), font: null }
}

/**
 * Peint le fond d'une case. Un dégradé est appliqué **par face**, pas sur le
 * volume : l'atlas est un damier de faces dépliées, un dégradé étalé sur tout
 * le canvas donnerait des sauts de teinte d'une face à l'autre. Chaque face
 * porte donc le même dégradé.
 */
function paintCell(ctx: CanvasRenderingContext2D, x: number, y: number, bg: DiceBg) {
  if (bg.type === 'solid') {
    ctx.fillStyle = bg.from
    ctx.fillRect(x, y, CELL, CELL)
    return
  }

  const [x0, y0, x1, y1] = gradientLine(bg.angle, CELL)
  const gradient = ctx.createLinearGradient(x + x0, y + y0, x + x1, y + y1)
  gradient.addColorStop(0, bg.from)
  gradient.addColorStop(1, bg.to)
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, CELL, CELL)
}

/**
 * Les deux extrémités de la ligne d'un dégradé dans une case carrée, en
 * coordonnées locales à la case.
 *
 * Convention CSS : 0° pointe vers le haut, l'angle tourne dans le sens des
 * aiguilles. L'axe y du canvas descend, d'où le `-cos`. La longueur suit la
 * formule CSS, pour que les deux arrêts touchent bien les coins opposés.
 */
export function gradientLine(angle: number, size: number): [number, number, number, number] {
  const radians = (angle * Math.PI) / 180
  const dx = Math.sin(radians)
  const dy = -Math.cos(radians)
  const length = size * (Math.abs(dx) + Math.abs(dy))
  const mid = size / 2
  return [
    mid - (dx * length) / 2,
    mid - (dy * length) / 2,
    mid + (dx * length) / 2,
    mid + (dy * length) / 2,
  ]
}

export function buildAtlas(labels: string[], fitRatio: number, style: DiceStyle = themeDiceStyle()): DiceAtlas {
  const columns = Math.ceil(Math.sqrt(labels.length))
  const rows = Math.ceil(labels.length / columns)

  const canvas = document.createElement('canvas')
  canvas.width = columns * CELL
  canvas.height = rows * CELL
  const ctx = canvas.getContext('2d')!

  const ink = resolvedInk(style)

  // Toutes les cases, pas seulement celles qui portent un chiffre : les cases
  // en trop (un d10 tient dans une grille de 12) doivent rester opaques, sinon
  // le filtrage de texture fait baver du transparent sur les bords voisins.
  for (let i = 0; i < columns * rows; i++) {
    paintCell(ctx, (i % columns) * CELL, Math.floor(i / columns) * CELL, style.bg)
  }

  ctx.fillStyle = ink
  ctx.strokeStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const family = diceFont(style.font)?.stack ?? token('--title-font', 'Georgia, serif')

  labels.forEach((label, i) => {
    const cx = (i % columns) * CELL + CELL / 2
    const cy = Math.floor(i / columns) * CELL + CELL / 2

    const size = fontSizeFor(label, fitRatio)
    ctx.font = `700 ${size}px ${family}`
    ctx.fillText(label, cx, cy)

    if (needsUnderline(label)) {
      const width = ctx.measureText(label).width
      ctx.lineWidth = Math.max(3, size * 0.08)
      ctx.beginPath()
      ctx.moveTo(cx - width / 2, cy + size * 0.46)
      ctx.lineTo(cx + width / 2, cy + size * 0.46)
      ctx.stroke()
    }
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, columns, rows }
}

/**
 * L'étincelle d'un critique : une étoile à quatre branches, blanche au centre.
 * Dessinée en blanc — c'est le matériau des particules qui la teinte.
 */
export function buildSparkTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const mid = size / 2

  const glow = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)

  // Les quatre branches, en losanges effilés
  ctx.fillStyle = '#ffffff'
  for (const rotation of [0, Math.PI / 2]) {
    ctx.save()
    ctx.translate(mid, mid)
    ctx.rotate(rotation)
    ctx.beginPath()
    ctx.moveTo(0, -mid)
    ctx.lineTo(mid * 0.16, 0)
    ctx.lineTo(0, mid)
    ctx.lineTo(-mid * 0.16, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Les chiffres portés par chaque type de dé. */
export function labelsFor(sides: number, kind: 'normal' | 'tens' = 'normal'): string[] {
  if (kind === 'tens') {
    // Dé des dizaines du d100 : 00, 10, 20 … 90
    return Array.from({ length: 10 }, (_, i) => String(i * 10).padStart(2, '0'))
  }
  return Array.from({ length: sides }, (_, i) => String(i + 1))
}
