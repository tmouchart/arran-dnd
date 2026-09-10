import { clampToBoard } from './placement.js'

/**
 * Les murs tracés par le MJ sur le champ de bataille (plan 23).
 *
 * Le client envoie la liste entière à chaque geste. Ici on ne fait que la
 * vérifier : elle arrive d'un navigateur, donc elle peut dire n'importe quoi.
 */

export interface ObstaclePoint {
  x: number
  z: number
}

export interface Obstacle {
  id: string
  points: ObstaclePoint[]
  /** De quoi le mur est fait. Absent = pierre. */
  material?: string
}

/**
 * On valide la **forme** de l'id, pas la liste des matériaux.
 *
 * Comme pour `environment`, la liste vit côté client (`wallMaterials.ts`) et
 * bouge à chaque matériau ajouté. La dupliquer ici, c'est se garantir d'oublier
 * de la mettre à jour. Un id inconnu retombe sur la pierre à l'affichage.
 */
const MATERIAL_RE = /^[a-z-]{1,40}$/

/** Un MJ qui a besoin de plus de 40 murs a un autre problème. */
const MAX_WALLS = 40

/** Un tracé plein écran rééchantillonné tient largement dedans. */
const MAX_POINTS = 200

function isPoint(v: unknown): v is ObstaclePoint {
  const p = v as ObstaclePoint
  return (
    typeof p?.x === 'number' &&
    typeof p?.z === 'number' &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.z)
  )
}

/**
 * Nettoie la liste envoyée par le client, ou `null` si elle est inexploitable.
 *
 * On refuse en bloc plutôt que de rafistoler : une liste mal formée est un bug
 * client, et l'accepter à moitié le rendrait invisible.
 */
export function sanitizeObstacles(input: unknown): Obstacle[] | null {
  if (!Array.isArray(input) || input.length > MAX_WALLS) return null

  const out: Obstacle[] = []
  for (const raw of input) {
    const wall = raw as Obstacle
    if (typeof wall?.id !== 'string' || wall.id.length === 0 || wall.id.length > 64) return null
    if (!Array.isArray(wall.points) || wall.points.length < 2 || wall.points.length > MAX_POINTS) {
      return null
    }
    if (!wall.points.every(isPoint)) return null
    if (wall.material !== undefined) {
      if (typeof wall.material !== 'string' || !MATERIAL_RE.test(wall.material)) return null
    }
    out.push({
      id: wall.id,
      // Le doigt déborde souvent de l'écran : on ramène dans la grille.
      points: wall.points.map((p) => ({ x: clampToBoard(p.x), z: clampToBoard(p.z) })),
      ...(wall.material ? { material: wall.material } : {}),
    })
  }
  return out
}
