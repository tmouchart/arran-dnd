import type * as THREE from 'three'
import type { DieInstance } from './plan'
import { ensureDiceFont } from '../../data/diceFonts'
import { styleKey, type DiceStyle } from '../../data/diceStyle'

/**
 * Construit la mesh d'un dé : géométrie + atlas de chiffres + liseré sombre.
 *
 * Partagé entre l'overlay des jets et l'aperçu des options — les deux montent
 * les mêmes dés, avec chacun son propre cache.
 */

export interface MeshCache {
  geometries: Map<string, THREE.BufferGeometry>
  materials: Map<string, THREE.Material>
  outline: THREE.MeshBasicMaterial | null
}

export function createMeshCache(): MeshCache {
  return { geometries: new Map(), materials: new Map(), outline: null }
}

/** Une texture par forme ET par style : deux styles = deux atlas, jamais une teinte posée. */
function cacheKey(die: DieInstance, style: DiceStyle | undefined): string {
  return `${die.sides}:${die.kind}:${style ? styleKey(style) : 'theme'}`
}

export async function buildDieMesh(
  three: typeof THREE,
  cache: MeshCache,
  die: DieInstance,
  style?: DiceStyle,
): Promise<THREE.Mesh> {
  const key = cacheKey(die, style)

  if (!cache.geometries.has(key)) {
    const [{ buildFaces, buildDieGeometry, faceFitRatio }, { buildAtlas, labelsFor, themeDiceStyle }] =
      await Promise.all([import('./polyhedra'), import('./atlas')])
    // Une police que le thème courant n'affiche nulle part n'est pas encore
    // téléchargée : la peindre sans attendre donne un atlas en serif.
    await ensureDiceFont(style?.font)
    const faces = buildFaces(die.sides)
    const atlas = buildAtlas(labelsFor(die.sides, die.kind), faceFitRatio(faces), style ?? themeDiceStyle())
    cache.geometries.set(key, buildDieGeometry(faces, atlas.columns, atlas.rows))
    cache.materials.set(
      key,
      new three.MeshStandardMaterial({ map: atlas.texture, roughness: 0.34, metalness: 0.28 }),
    )
  }

  // Réinsertion : la clé réutilisée repasse en fin de Map, donc `trimMeshCache`
  // évince bien la plus ancienne *utilisation*, pas la plus ancienne création.
  const geometry = cache.geometries.get(key)!
  const material = cache.materials.get(key)!
  cache.geometries.delete(key)
  cache.geometries.set(key, geometry)
  cache.materials.delete(key)
  cache.materials.set(key, material)
  const mesh = new three.Mesh(geometry, material)
  // Liseré sombre : le dé doit rester lisible sur n'importe quel fond, puisque
  // rien n'est assombri derrière lui. Un seul matériau pour tous les dés.
  cache.outline ??= new three.MeshBasicMaterial({ color: 0x21160e, side: three.BackSide })
  const outline = new three.Mesh(geometry, cache.outline)
  outline.scale.setScalar(1.07)
  mesh.add(outline)
  return mesh
}

/**
 * Un joueur qui bricole son style crée un atlas par variante essayée. On garde
 * les `limit` clés les plus récentes et on libère les autres.
 */
export function trimMeshCache(cache: MeshCache, limit: number) {
  while (cache.geometries.size > limit) {
    const oldest = cache.geometries.keys().next().value as string
    cache.geometries.get(oldest)?.dispose()
    const material = cache.materials.get(oldest)
    if (material) {
      const map = (material as THREE.MeshStandardMaterial).map
      map?.dispose()
      material.dispose()
    }
    cache.geometries.delete(oldest)
    cache.materials.delete(oldest)
  }
}

/** Libère tout : appelé quand l'aperçu est démonté. */
export function disposeMeshCache(cache: MeshCache) {
  trimMeshCache(cache, 0)
  cache.outline?.dispose()
  cache.outline = null
}
