/**
 * Les murs tracés au doigt sur le champ de bataille (plan 23).
 *
 * Ici, que du calcul : nettoyer un tracé de doigt et le découper en petites
 * boîtes orientées. La 3D est dans `BattleGrid3D.vue`, l'état dans
 * `BattleMapTab.vue`.
 */

export interface WallPoint {
  x: number
  z: number
}

export interface BattleWall {
  /** Généré côté client, sert à l'effacer et à l'annuler. */
  id: string
  /** Le tracé, en cases. Centre de la grille = (0, 0). */
  points: WallPoint[]
  /** De quoi il est fait (voir `wallMaterials.ts`). Absent = pierre. */
  material?: string
}

/** Épaisseur du mur, en cases. Assez épais pour se lire, assez fin pour ne pas manger la grille. */
export const WALL_THICKNESS = 0.28

/**
 * Hauteur du mur, en cases.
 *
 * À hauteur d'homme (les pions font 0,85 et 1,05) : en dessous, ça ne se lit
 * pas comme un mur. Un pion posé juste derrière est donc masqué jusqu'aux
 * épaules — mais son étiquette et sa jauge de PV flottent plus haut, donc on
 * sait toujours qui est là.
 */
export const WALL_HEIGHT = 1

/** Distance minimale entre deux points retenus. */
const MIN_SPACING = 0.3

/**
 * Ne garde que les points assez espacés.
 *
 * Un doigt qui avance lentement crache des dizaines de points quasi superposés,
 * et ce sont eux qui font trembler le mur. Le dernier point du tracé est
 * toujours gardé : c'est là où le doigt s'est arrêté.
 */
export function resample(points: WallPoint[], minSpacing = MIN_SPACING): WallPoint[] {
  if (points.length === 0) return []
  const out: WallPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const last = out[out.length - 1]
    if (Math.hypot(points[i].x - last.x, points[i].z - last.z) >= minSpacing) out.push(points[i])
  }
  const end = points[points.length - 1]
  const last = out[out.length - 1]
  if (out.length > 1 && (end.x !== last.x || end.z !== last.z)) out.push(end)
  return out
}

/**
 * Moyenne glissante sur trois points : enlève la tremblote résiduelle.
 *
 * Les deux extrémités ne bougent pas — le mur doit commencer et finir là où le
 * doigt s'est posé et levé.
 */
export function smooth(points: WallPoint[]): WallPoint[] {
  if (points.length < 3) return points.map((p) => ({ ...p }))
  const out: WallPoint[] = [{ ...points[0] }]
  for (let i = 1; i < points.length - 1; i++) {
    out.push({
      x: (points[i - 1].x + points[i].x + points[i + 1].x) / 3,
      z: (points[i - 1].z + points[i].z + points[i + 1].z) / 3,
    })
  }
  out.push({ ...points[points.length - 1] })
  return out
}

/** Ramène le tracé dans la grille : le doigt déborde souvent de l'écran. */
export function clampPoints(points: WallPoint[], half: number): WallPoint[] {
  const clamp = (v: number) => Math.min(half, Math.max(-half, v))
  return points.map((p) => ({ x: clamp(p.x), z: clamp(p.z) }))
}

/**
 * Nombre de points maximal d'un mur. Doit rester aligné sur la limite du
 * serveur (`server/src/combats/obstacles.ts`), sinon un tracé interminable
 * partirait pour se faire refuser.
 */
export const MAX_WALL_POINTS = 200

/**
 * Le tracé brut du doigt, prêt à être posé : rééchantillonné, lissé, dans les
 * bornes, et tronqué à la limite. On tronque ici et pas au moment d'envoyer :
 * comme ça le mur qu'on voit pousser est exactement celui qu'on sauvegarde.
 */
export function cleanPath(raw: WallPoint[], half: number): WallPoint[] {
  return smooth(resample(clampPoints(raw, half)).slice(0, MAX_WALL_POINTS))
}

/** Une boîte à poser : son centre, son angle autour de Y, sa longueur. */
export interface WallSegment {
  x: number
  z: number
  /** Rotation autour de Y, en radians. */
  angle: number
  length: number
}

/**
 * Découpe le tracé en boîtes orientées.
 *
 * Chaque boîte est allongée d'une demi-épaisseur à chaque bout : au virage,
 * deux boîtes se chevauchent au lieu de laisser un trou en V sur le bord
 * extérieur. Ça marche à n'importe quel angle, même un demi-tour.
 */
export function buildSegments(points: WallPoint[], thickness = WALL_THICKNESS): WallSegment[] {
  const out: WallSegment[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const dist = Math.hypot(dx, dz)
    if (dist === 0) continue
    out.push({
      x: (a.x + b.x) / 2,
      z: (a.z + b.z) / 2,
      // Une rotation de θ autour de Y envoie l'axe X sur (cos θ, 0, −sin θ).
      angle: Math.atan2(-dz, dx),
      length: dist + thickness,
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Annuler                                                            */
/* ------------------------------------------------------------------ */

/** Un geste de mur, tel qu'on peut le défaire. */
export type WallAction = { type: 'add' | 'erase'; wall: BattleWall }

/**
 * Défait un geste.
 *
 * On annule le dernier *geste*, pas le dernier mur posé : effacer s'annule
 * aussi, sinon le tap-pour-effacer serait irréversible.
 */
export function applyUndo(walls: BattleWall[], action: WallAction): BattleWall[] {
  if (action.type === 'add') return walls.filter((w) => w.id !== action.wall.id)
  if (walls.some((w) => w.id === action.wall.id)) return walls
  return [...walls, action.wall]
}

export function newWallId(): string {
  return crypto.randomUUID()
}
