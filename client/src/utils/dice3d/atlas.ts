import * as THREE from 'three'

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
function token(name: string, fallback: string): string {
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

export function buildAtlas(labels: string[], fitRatio: number): DiceAtlas {
  const columns = Math.ceil(Math.sqrt(labels.length))
  const rows = Math.ceil(labels.length / columns)

  const canvas = document.createElement('canvas')
  canvas.width = columns * CELL
  canvas.height = rows * CELL
  const ctx = canvas.getContext('2d')!

  // Corps doré, chiffres sombres : c'est le seul couple qui tient sur les 4
  // thèmes, et `--on-brand` est fait pour ça.
  const face = token('--brand', '#d9a544')
  const ink = token('--on-brand', '#241c10')

  ctx.fillStyle = face
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = ink
  ctx.strokeStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  labels.forEach((label, i) => {
    const cx = (i % columns) * CELL + CELL / 2
    const cy = Math.floor(i / columns) * CELL + CELL / 2

    const size = fontSizeFor(label, fitRatio)
    ctx.font = `700 ${size}px ${token('--title-font', 'Georgia, serif')}`
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

/** Les chiffres portés par chaque type de dé. */
export function labelsFor(sides: number, kind: 'normal' | 'tens' = 'normal'): string[] {
  if (kind === 'tens') {
    // Dé des dizaines du d100 : 00, 10, 20 … 90
    return Array.from({ length: 10 }, (_, i) => String(i * 10).padStart(2, '0'))
  }
  return Array.from({ length: sides }, (_, i) => String(i + 1))
}
