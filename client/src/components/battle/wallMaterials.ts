import { rngFor } from './environments'

/**
 * De quoi sont faits les murs (plan 23).
 *
 * Chaque matériau peint un carreau au canvas — aucun fichier à télécharger,
 * comme les sols de `environments.ts`. Le même carreau sert à la texture 3D et
 * à la pastille de la palette : ce que le MJ choisit est exactement ce qu'il
 * verra sur la carte.
 *
 * Pour en ajouter un : une entrée ici, et c'est tout. Le serveur ne connaît pas
 * la liste (il valide juste la forme de l'id), et un id inconnu retombe sur la
 * pierre.
 */

export interface WallMaterial {
  id: string
  name: string
  /** Peint un carreau de `w` × `w` pixels. `rng` est déterministe par matériau. */
  paint: (ctx: CanvasRenderingContext2D, w: number, rng: () => number) => void
}

/** Côté du carreau peint. Il se répète sur chaque face de boîte du mur. */
export const WALL_TEXTURE_SIZE = 256

export const DEFAULT_WALL_MATERIAL = 'pierre'

function rgb(r: number, g: number, b: number, tint: number): string {
  return `rgb(${Math.round(r * tint)}, ${Math.round(g * tint)}, ${Math.round(b * tint)})`
}

/**
 * Des blocs en rangs décalés sur un mortier.
 *
 * Le décalage d'un demi-bloc un rang sur deux, c'est ce qui fait la différence
 * entre un mur et du carrelage.
 */
function courses(
  ctx: CanvasRenderingContext2D,
  w: number,
  rng: () => number,
  o: { rows: number; cols: number; mortar: string; color: [number, number, number]; joint: number },
) {
  ctx.fillStyle = o.mortar
  ctx.fillRect(0, 0, w, w)

  const rowH = w / o.rows
  const blockW = w / o.cols

  for (let row = 0; row < o.rows; row++) {
    const offset = row % 2 === 0 ? 0 : blockW / 2
    for (let i = -1; i <= o.cols; i++) {
      const x = i * blockW + offset + o.joint / 2
      const y = row * rowH + o.joint / 2
      const bw = blockW - o.joint
      const bh = rowH - o.joint

      // Chaque bloc a sa teinte : un mur monochrome fait faux.
      ctx.fillStyle = rgb(...o.color, 0.86 + rng() * 0.26)
      ctx.fillRect(x, y, bw, bh)

      // Arête claire en haut, ombre en bas : du relief sans seconde lumière.
      const edge = Math.max(2, bh * 0.06)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(x, y, bw, edge)
      ctx.fillStyle = 'rgba(0,0,0,0.20)'
      ctx.fillRect(x, y + bh - edge, bw, edge)

      // Grain : sans lui la pierre a l'air d'être en plastique.
      for (let n = 0; n < 24; n++) {
        const gw = 2 + rng() * 4
        const gh = 2 + rng() * 2
        ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'
        ctx.fillRect(x + rng() * Math.max(bw - gw, 1), y + rng() * Math.max(bh - gh, 1), gw, gh)
      }
    }
  }
}

export const WALL_MATERIALS: WallMaterial[] = [
  {
    id: 'pierre',
    name: 'Pierre',
    paint: (ctx, w, rng) =>
      courses(ctx, w, rng, {
        rows: 4,
        cols: 2,
        mortar: '#4b453d',
        color: [178, 167, 150],
        joint: 6,
      }),
  },
  {
    id: 'brique',
    name: 'Brique',
    paint: (ctx, w, rng) =>
      // Des blocs plus petits et plus nombreux, sur un mortier pâle : c'est le
      // contraste clair du joint qui dit « brique » plutôt que « pierre ».
      courses(ctx, w, rng, {
        rows: 8,
        cols: 3,
        mortar: '#b9ab95',
        color: [166, 82, 60],
        joint: 5,
      }),
  },
  {
    id: 'bois',
    name: 'Bois',
    paint: (ctx, w, rng) => {
      // Une palissade : des planches verticales, pas des blocs empilés.
      ctx.fillStyle = '#3a2a1c'
      ctx.fillRect(0, 0, w, w)

      const count = 5
      const pw = w / count
      for (let i = 0; i < count; i++) {
        const x = i * pw + 2
        const bw = pw - 4
        ctx.fillStyle = rgb(150, 104, 62, 0.84 + rng() * 0.3)
        ctx.fillRect(x, 0, bw, w)

        // Les veines, dans le sens de la planche.
        for (let v = 0; v < 7; v++) {
          ctx.fillStyle = 'rgba(58,38,20,0.20)'
          ctx.fillRect(x + 2 + rng() * (bw - 4), rng() * w, 1.5, w * 0.25 + rng() * w * 0.5)
        }
        ctx.fillStyle = 'rgba(255,255,255,0.10)'
        ctx.fillRect(x, 0, 2, w)
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(x + bw - 2, 0, 2, w)
      }
    },
  },
  {
    id: 'haie',
    name: 'Haie',
    paint: (ctx, w, rng) => {
      // Pas de structure régulière : une haie, c'est du désordre dense.
      ctx.fillStyle = '#22401f'
      ctx.fillRect(0, 0, w, w)
      for (let i = 0; i < 420; i++) {
        const r = 3 + rng() * 7
        const t = 0.7 + rng() * 0.65
        ctx.fillStyle = rgb(80, 128, 56, t)
        ctx.beginPath()
        ctx.ellipse(rng() * w, rng() * w, r, r * 0.65, rng() * Math.PI, 0, Math.PI * 2)
        ctx.fill()
      }
    },
  },
]

/** Le matériau demandé, ou la pierre si l'id est inconnu (ou absent). */
export function findWallMaterial(id?: string | null): WallMaterial {
  return (
    WALL_MATERIALS.find((m) => m.id === id) ??
    WALL_MATERIALS.find((m) => m.id === DEFAULT_WALL_MATERIAL)!
  )
}

/** Peint le carreau d'un matériau dans un canvas neuf. */
export function paintWallTile(id: string | null | undefined, size = WALL_TEXTURE_SIZE): HTMLCanvasElement {
  const material = findWallMaterial(id)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  material.paint(canvas.getContext('2d')!, size, rngFor(`mur-${material.id}`))
  return canvas
}
