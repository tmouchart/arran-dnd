import * as THREE from 'three'

/**
 * Construction des solides de dés.
 *
 * On ne tape aucune table d'indices à la main : on part des géométries natives
 * de three.js (qui sortent des triangles), puis on regroupe les triangles
 * coplanaires pour retrouver les vraies faces (les pentagones du d12, par
 * exemple). Seul le d10 n'existe pas dans three.js et est construit ici.
 */

/** Une face du dé : son polygone, sa normale et le chiffre qu'elle porte. */
export interface DieFace {
  /** Sommets du polygone, dans l'ordre, vus de l'extérieur. */
  corners: THREE.Vector3[]
  normal: THREE.Vector3
  /** Index de la case de l'atlas de textures (0 = première case). */
  faceIndex: number
}

/** Dés rendus en 3D. Le d100 est joué comme deux d10 (dizaines + unités). */
export const SUPPORTED_SIDES = [4, 6, 8, 10, 12, 20] as const

/** Tolérance de regroupement des normales (3 décimales). */
const NORMAL_PRECISION = 1000
/** Tolérance de dédoublonnage des sommets (5 décimales). */
const VERTEX_PRECISION = 100000

function key(v: THREE.Vector3, precision: number): string {
  // `+ 0` écrase le -0, qui casserait la comparaison de chaînes
  const r = (n: number) => Math.round(n * precision) + 0
  return `${r(v.x)},${r(v.y)},${r(v.z)}`
}

/**
 * Trapézoèdre pentagonal — la forme du d10, absente de three.js.
 *
 * Deux apex et un anneau de 10 sommets qui alternent en hauteur. La hauteur de
 * l'anneau n'est pas libre : c'est la seule valeur qui rend les cerfs-volants
 * plans. Elle sort de la condition d'alignement de l'apex, du sommet opposé et
 * du milieu de l'arête, soit h = 1 / (2 / (1 - cos 36°) - 1).
 */
function trapezohedronFaces(): THREE.Vector3[][] {
  const h = 1 / (2 / (1 - Math.cos(Math.PI / 5)) - 1)
  const ring = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5
    return new THREE.Vector3(Math.cos(a), Math.sin(a), i % 2 === 0 ? -h : h)
  })
  const top = new THREE.Vector3(0, 0, 1)
  const bottom = new THREE.Vector3(0, 0, -1)

  // Chaque cerf-volant part d'un apex et englobe un sommet de l'anneau opposé
  // encadré par ses deux voisins. Les pairs vont au sommet, les impairs au bas.
  return ring.map((_, i) => {
    const apex = i % 2 === 0 ? top : bottom
    return [apex, ring[(i + 9) % 10], ring[i], ring[(i + 1) % 10]]
  })
}

/** Extrait les faces polygonales d'une géométrie triangulée de three.js. */
function facesFromGeometry(geometry: THREE.BufferGeometry): THREE.Vector3[][] {
  // Les polyèdres de three.js sortent déjà dépliés, seule la boîte est indexée
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  const positions = flat.getAttribute('position')
  const groups = new Map<string, THREE.Vector3[]>()

  for (let i = 0; i < positions.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, i)
    const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1)
    const c = new THREE.Vector3().fromBufferAttribute(positions, i + 2)
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize()

    const k = key(normal, NORMAL_PRECISION)
    const bucket = groups.get(k)
    if (bucket) bucket.push(a, b, c)
    else groups.set(k, [a, b, c])
  }

  // Les triangles d'une même face partagent des sommets : on dédoublonne.
  return [...groups.values()].map((corners) => {
    const unique = new Map<string, THREE.Vector3>()
    for (const v of corners) unique.set(key(v, VERTEX_PRECISION), v)
    return [...unique.values()]
  })
}

/** Range les sommets d'une face dans l'ordre du polygone, vus de l'extérieur. */
function orderCorners(corners: THREE.Vector3[]): {
  ordered: THREE.Vector3[]
  normal: THREE.Vector3
} {
  const centroid = corners
    .reduce((acc, v) => acc.add(v), new THREE.Vector3())
    .divideScalar(corners.length)
  // Le solide est centré sur l'origine : la normale sortante pointe comme le
  // centre de la face.
  const normal = centroid.clone().normalize()

  const u = new THREE.Vector3().subVectors(corners[0], centroid).normalize()
  const v = new THREE.Vector3().crossVectors(normal, u)

  const ordered = [...corners].sort((p, q) => {
    const dp = new THREE.Vector3().subVectors(p, centroid)
    const dq = new THREE.Vector3().subVectors(q, centroid)
    return Math.atan2(dp.dot(v), dp.dot(u)) - Math.atan2(dq.dot(v), dq.dot(u))
  })

  return { ordered, normal }
}

/**
 * Numérote les faces comme un vrai dé : les faces opposées totalisent N+1
 * (1 en face de 6 sur un d6). Sans ça, les chiffres se suivent autour du solide
 * et le dé a l'air faux dès qu'il tourne.
 *
 * Le d4 n'a pas de faces opposées : il garde une numérotation séquentielle.
 */
function assignValues(normals: THREE.Vector3[]): number[] {
  const total = normals.length
  const values = new Array<number>(total).fill(0)
  let next = 1

  for (let i = 0; i < total; i++) {
    if (values[i] !== 0) continue
    values[i] = next
    const opposite = normals.findIndex(
      (n, j) => values[j] === 0 && j !== i && n.dot(normals[i]) < -0.999,
    )
    if (opposite !== -1) values[opposite] = total + 1 - next
    next++
  }

  return values
}

/** Les faces d'un dé, normalisées sur un rayon de 1, prêtes à être texturées. */
export function buildFaces(sides: number): DieFace[] {
  const raw =
    sides === 10
      ? trapezohedronFaces()
      : facesFromGeometry(baseGeometry(sides))

  const prepared = raw.map(orderCorners)
  const values = assignValues(prepared.map((f) => f.normal))

  // Toutes les formes doivent occuper la même place à l'écran : on ramène le
  // rayon de la sphère englobante à 1.
  const radius = Math.max(
    ...prepared.flatMap((f) => f.ordered.map((c) => c.length())),
  )

  return prepared.map((face, i) => ({
    corners: face.ordered.map((c) => c.clone().divideScalar(radius)),
    normal: face.normal,
    faceIndex: values[i] - 1,
  }))
}

/**
 * Quelle part d'une face est réellement utilisable pour écrire dedans.
 *
 * Un chiffre centré tient dans le disque inscrit, pas dans le disque
 * circonscrit : sur un triangle ce dernier est deux fois trop grand et le
 * chiffre déborde sur les faces voisines. On renvoie le rapport des deux, à
 * appliquer à la taille de police.
 */
export function faceFitRatio(faces: DieFace[]): number {
  let ratio = 1

  for (const face of faces) {
    const centroid = face.corners
      .reduce((acc, v) => acc.add(v), new THREE.Vector3())
      .divideScalar(face.corners.length)

    const outer = Math.max(...face.corners.map((c) => c.distanceTo(centroid)))
    let inner = Infinity
    for (let i = 0; i < face.corners.length; i++) {
      const edge = new THREE.Line3(face.corners[i], face.corners[(i + 1) % face.corners.length])
      const closest = edge.closestPointToPoint(centroid, true, new THREE.Vector3())
      inner = Math.min(inner, closest.distanceTo(centroid))
    }
    ratio = Math.min(ratio, inner / outer)
  }

  return ratio
}

function baseGeometry(sides: number): THREE.BufferGeometry {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(1)
    case 6:
      return new THREE.BoxGeometry(1.15, 1.15, 1.15)
    case 8:
      return new THREE.OctahedronGeometry(1)
    case 12:
      return new THREE.DodecahedronGeometry(1)
    case 20:
      return new THREE.IcosahedronGeometry(1)
    default:
      throw new Error(`Dé à ${sides} faces non supporté en 3D`)
  }
}

/**
 * Assemble la géométrie rendue : triangles + UV pointant chacun vers la case
 * d'atlas de sa face.
 *
 * Les UV sont calculées en projetant les sommets sur le plan de la face, dans
 * une base directe vue de l'extérieur — sinon les chiffres sortent en miroir.
 */
export function buildDieGeometry(
  faces: DieFace[],
  columns: number,
  rows: number,
): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  /** Marge autour du chiffre, en fraction de la case. */
  const fill = 0.84

  for (const face of faces) {
    const centroid = face.corners
      .reduce((acc, v) => acc.add(v), new THREE.Vector3())
      .divideScalar(face.corners.length)
    const u = new THREE.Vector3().subVectors(face.corners[0], centroid).normalize()
    const v = new THREE.Vector3().crossVectors(face.normal, u)

    const flat = face.corners.map((c) => {
      const d = new THREE.Vector3().subVectors(c, centroid)
      return new THREE.Vector2(d.dot(u), d.dot(v))
    })
    const extent = Math.max(...flat.map((p) => p.length()))

    const col = face.faceIndex % columns
    const row = Math.floor(face.faceIndex / columns)
    const cellUv = (p: THREE.Vector2) =>
      new THREE.Vector2(
        (col + 0.5 + (p.x / extent) * 0.5 * fill) / columns,
        // L'axe V des textures monte, l'axe des lignes descend
        (rows - row - 0.5 + (p.y / extent) * 0.5 * fill) / rows,
      )

    // Éventail depuis le premier sommet : suffisant, les faces sont convexes
    for (let i = 1; i < face.corners.length - 1; i++) {
      for (const idx of [0, i, i + 1]) {
        const c = face.corners[idx]
        positions.push(c.x, c.y, c.z)
        normals.push(face.normal.x, face.normal.y, face.normal.z)
        const uv = cellUv(flat[idx])
        uvs.push(uv.x, uv.y)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geometry
}
