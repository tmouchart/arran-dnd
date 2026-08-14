<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { diceRequest, settleDiceRoll, type DiceRequest } from '../../composables/useDice3D'
import { landingLayout, planDice, type DieInstance } from '../../utils/dice3d/plan'

/**
 * Le dé 3D, monté une seule fois pour toute l'app.
 *
 * Le résultat est déjà connu quand on arrive ici : cette animation ne fait que
 * le montrer. Elle amène le dé sur une orientation calculée d'avance, donc elle
 * peut être coupée ou relancée à tout moment sans jamais mentir sur le chiffre.
 *
 * Coût : three.js n'est chargé qu'au premier jet, le contexte WebGL est créé une
 * fois et gardé, et la boucle d'animation ne tourne que pendant le lancer.
 */

type Three = typeof import('three')
type Mesh = import('three').Mesh
type Motion = import('../../utils/dice3d/motion').RollMotion

const canvas = ref<HTMLCanvasElement | null>(null)
const visible = ref(false)
const fading = ref(false)

/** Temps d'affichage du résultat avant de rendre l'écran. */
const HOLD_MS = 420
const FADE_MS = 260

let three: Three | null = null
let motionApi: typeof import('../../utils/dice3d/motion') | null = null
let renderer: import('three').WebGLRenderer | null = null
let scene: import('three').Scene | null = null
let camera: import('three').PerspectiveCamera | null = null
let broken = false

/** Géométries et textures réutilisées d'un lancer à l'autre. */
const geometries = new Map<string, import('three').BufferGeometry>()
const materials = new Map<string, import('three').Material>()
let outlineMaterial: import('three').MeshBasicMaterial | null = null
const pool: Mesh[] = []

let running: { mesh: Mesh; motion: Motion; scale: number }[] = []
let frame = 0
let startedAt = 0
let currentId = 0
let timers: number[] = []

function clearTimers() {
  timers.forEach((t) => window.clearTimeout(t))
  timers = []
}

async function ensureEngine(): Promise<boolean> {
  if (broken) return false
  if (renderer) return true

  try {
    const [threeModule, motionModule] = await Promise.all([
      import('three'),
      import('../../utils/dice3d/motion'),
    ])
    three = threeModule
    motionApi = motionModule

    // alpha: la page reste visible derrière, rien n'est assombri
    renderer = new three.WebGLRenderer({
      canvas: canvas.value!,
      alpha: true,
      antialias: true,
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    scene = new three.Scene()
    camera = new three.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 9)

    scene.add(new three.AmbientLight(0xffffff, 1.5))
    const keyLight = new three.DirectionalLight(0xffffff, 2.2)
    keyLight.position.set(3, 6, 7)
    scene.add(keyLight)
    const rimLight = new three.DirectionalLight(0xffd9a0, 1.1)
    rimLight.position.set(-5, -2, 3)
    scene.add(rimLight)

    resize()
    return true
  } catch {
    // Pas de WebGL : on renonce à l'animation, jamais au résultat
    broken = true
    return false
  }
}

function resize() {
  if (!renderer || !camera) return
  const width = window.innerWidth
  const height = window.innerHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

/** Demi-dimensions visibles à la profondeur où roulent les dés. */
function viewport() {
  const halfHeight = Math.tan(((camera!.fov / 2) * Math.PI) / 180) * camera!.position.z
  return { halfHeight, halfWidth: halfHeight * camera!.aspect }
}

async function meshFor(die: DieInstance): Promise<Mesh> {
  const T = three!
  const cacheKey = `${die.sides}:${die.kind}`

  if (!geometries.has(cacheKey)) {
    const [{ buildFaces, buildDieGeometry, faceFitRatio }, { buildAtlas, labelsFor }] =
      await Promise.all([
        import('../../utils/dice3d/polyhedra'),
        import('../../utils/dice3d/atlas'),
      ])
    const faces = buildFaces(die.sides)
    const atlas = buildAtlas(labelsFor(die.sides, die.kind), faceFitRatio(faces))
    geometries.set(cacheKey, buildDieGeometry(faces, atlas.columns, atlas.rows))
    materials.set(
      cacheKey,
      new T.MeshStandardMaterial({ map: atlas.texture, roughness: 0.34, metalness: 0.28 }),
    )
  }

  const mesh = new T.Mesh(geometries.get(cacheKey)!, materials.get(cacheKey)!)
  // Liseré sombre : le dé doit rester lisible sur n'importe quel fond, puisque
  // rien n'est assombri derrière lui. Un seul matériau pour tous les dés.
  outlineMaterial ??= new T.MeshBasicMaterial({ color: 0x21160e, side: T.BackSide })
  const outline = new T.Mesh(geometries.get(cacheKey)!, outlineMaterial)
  outline.scale.setScalar(1.07)
  mesh.add(outline)
  return mesh
}

/** Les normales des faces, pour savoir quelle orientation vise chaque dé. */
const normalCache = new Map<string, import('three').Vector3[]>()

async function faceNormals(die: DieInstance): Promise<import('three').Vector3[]> {
  const cacheKey = String(die.sides)
  if (!normalCache.has(cacheKey)) {
    const { buildFaces } = await import('../../utils/dice3d/polyhedra')
    const faces = buildFaces(die.sides)
    const byIndex: import('three').Vector3[] = []
    for (const face of faces) byIndex[face.faceIndex] = face.normal
    normalCache.set(cacheKey, byIndex)
  }
  return normalCache.get(cacheKey)!
}

async function start(request: DiceRequest) {
  const dice = planDice(request.rolls)
  if (!dice.length) {
    settleDiceRoll(request.id)
    return
  }
  if (!(await ensureEngine())) {
    settleDiceRoll(request.id)
    return
  }
  // Une demande plus récente est arrivée pendant le chargement
  if (diceRequest.value?.id !== request.id) return

  clearTimers()
  cancelAnimationFrame(frame)
  releaseMeshes()

  currentId = request.id
  resize()
  const { halfWidth, halfHeight } = viewport()
  const { positions, scale } = landingLayout(dice.length)

  running = []
  for (let i = 0; i < dice.length; i++) {
    const die = dice[i]
    const mesh = await meshFor(die)
    const normals = await faceNormals(die)
    const target = motionApi!.faceTargetQuaternion(normals[die.faceIndex])
    const motion = motionApi!.createMotion({
      halfWidth,
      halfHeight,
      landing: new three!.Vector3(positions[i].x, positions[i].y, 0),
      target,
    })
    mesh.scale.setScalar(scale)
    scene!.add(mesh)
    pool.push(mesh)
    running.push({ mesh, motion, scale })
  }

  visible.value = true
  fading.value = false
  startedAt = performance.now()
  frame = requestAnimationFrame(tick)
}

function tick(now: number) {
  const elapsed = now - startedAt
  let settled = true

  for (const die of running) {
    const t = Math.min(1, elapsed / die.motion.duration)
    if (t < 1) settled = false
    const sample = motionApi!.sampleMotion(die.motion, t)
    die.mesh.position.copy(sample.position)
    die.mesh.quaternion.copy(sample.quaternion)
    die.mesh.scale.setScalar(die.scale * sample.scale)
  }

  renderer!.render(scene!, camera!)

  if (settled) finish()
  else frame = requestAnimationFrame(tick)
}

/** Le dé s'est posé : on libère le résultat, puis on rend l'écran. */
function finish() {
  cancelAnimationFrame(frame)
  settleDiceRoll(currentId)
  clearTimers()
  timers.push(
    window.setTimeout(() => {
      fading.value = true
      timers.push(
        window.setTimeout(() => {
          visible.value = false
          releaseMeshes()
        }, FADE_MS),
      )
    }, HOLD_MS),
  )
}

/** Saute la fin de l'animation : le dé se pose tout de suite sur son résultat. */
function skip() {
  if (!running.length) return
  for (const die of running) {
    const sample = motionApi!.sampleMotion(die.motion, 1)
    die.mesh.position.copy(sample.position)
    die.mesh.quaternion.copy(sample.quaternion)
    die.mesh.scale.setScalar(die.scale)
  }
  renderer!.render(scene!, camera!)
  finish()
}

function releaseMeshes() {
  // Géométries, textures et liseré sont partagés : on ne détache que les objets
  for (const mesh of pool) scene?.remove(mesh)
  pool.length = 0
  running = []
}

watch(diceRequest, (request) => {
  if (request) void start(request)
})

window.addEventListener('resize', resize)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  clearTimers()
  cancelAnimationFrame(frame)
  releaseMeshes()
  geometries.forEach((g) => g.dispose())
  materials.forEach((m) => m.dispose())
  outlineMaterial?.dispose()
  renderer?.dispose()

  // Les caches vivent au niveau du module, pas de l'instance : sans ce ménage,
  // un remontage repartirait sur un renderer et des textures déjà détruits.
  geometries.clear()
  materials.clear()
  normalCache.clear()
  outlineMaterial = null
  renderer = null
  scene = null
  camera = null
})
</script>

<template>
  <!-- Overlay plein écran : cas admis de position fixe, il ne porte aucun layout -->
  <canvas
    ref="canvas"
    class="dice-canvas"
    :class="{ 'is-visible': visible, 'is-fading': fading }"
    aria-hidden="true"
    @pointerdown="skip"
  />
</template>

<style scoped>
.dice-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 60;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.26s ease;
}

.dice-canvas.is-visible {
  opacity: 1;
  /* Le tap doit atteindre le dé pour pouvoir passer l'animation */
  pointer-events: auto;
}

.dice-canvas.is-fading {
  opacity: 0;
  pointer-events: none;
}
</style>
