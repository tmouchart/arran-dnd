<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { diceRequest, settleDiceRoll, type DiceRequest } from '../../composables/useDice3D'
import { landingLayout, planDice, type DieInstance } from '../../utils/dice3d/plan'
import type { RollOutcome } from '../../utils/rollOutcome'

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

/**
 * Temps d'affichage du dé posé avant de rendre l'écran. Doit laisser le temps
 * de lire le chiffre sur la face. `FADE_MS` suit la transition CSS du canvas.
 */
const HOLD_MS = 1100
const FADE_MS = 400
/** Durée des étoiles / de l'onde. Doit rester sous HOLD_MS. */
const EFFECT_MS = 900

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

let running: { mesh: Mesh; motion: Motion; scale: number; outcome: RollOutcome }[] = []
let frame = 0
let startedAt = 0
let landedAt = 0
let landed = false
let currentId = 0
let timers: number[] = []

/** Étoiles d'un critique et onde d'un échec, montées le temps de l'effet. */
let effects: {
  update: (t: number) => void
  dispose: () => void
}[] = []
let sparkTexture: import('three').Texture | null = null

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

/**
 * Gerbe d'étoiles d'un critique. Un seul objet Points, mélange additif : un
 * appel de rendu quelle que soit la quantité d'étincelles.
 */
async function spawnSparks(origin: import('three').Vector3, scale: number) {
  const T = three!
  const [{ createSparks, sampleSpark, burstOpacity }, { buildSparkTexture, token }] =
    await Promise.all([
      import('../../utils/dice3d/burst'),
      import('../../utils/dice3d/atlas'),
    ])

  const sparks = createSparks(44)
  sparkTexture ??= buildSparkTexture()

  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(new Array(sparks.length * 3).fill(0), 3))
  const material = new T.PointsMaterial({
    map: sparkTexture,
    color: new T.Color(token('--brand', '#d9a544')),
    size: scale * 0.85,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  })

  const points = new T.Points(geometry, material)
  points.position.copy(origin)
  scene!.add(points)

  const attribute = geometry.getAttribute('position') as import('three').BufferAttribute

  effects.push({
    update(t) {
      for (let i = 0; i < sparks.length; i++) {
        const p = sampleSpark(sparks[i], t)
        attribute.setXYZ(i, p.x * scale * 4, p.y * scale * 4, p.z * scale * 4)
      }
      attribute.needsUpdate = true
      material.opacity = burstOpacity(t)
    },
    dispose() {
      scene?.remove(points)
      geometry.dispose()
      material.dispose()
    },
  })
}

/** Onde rouge d'un échec : un anneau qui s'écarte et s'efface. */
async function spawnShockwave(origin: import('three').Vector3, scale: number) {
  const T = three!
  const [{ shockwave }, { token }] = await Promise.all([
    import('../../utils/dice3d/burst'),
    import('../../utils/dice3d/atlas'),
  ])

  const geometry = new T.RingGeometry(0.82, 1, 44)
  const material = new T.MeshBasicMaterial({
    color: new T.Color(token('--danger', '#e05252')),
    transparent: true,
    side: T.DoubleSide,
    depthWrite: false,
  })
  const ring = new T.Mesh(geometry, material)
  ring.position.copy(origin)
  scene!.add(ring)

  effects.push({
    update(t) {
      const { scale: s, opacity } = shockwave(t)
      ring.scale.setScalar(s * scale * 4)
      material.opacity = opacity
    },
    dispose() {
      scene?.remove(ring)
      geometry.dispose()
      material.dispose()
    },
  })
}

/**
 * Éclat de la face touchée. Le matériau est partagé entre tous les dés d'une
 * même forme : on le clone, sinon les trois dés d'un jet flasheraient parce
 * qu'un seul a fait 20.
 */
async function flashDie(mesh: Mesh, outcome: Exclude<RollOutcome, null>) {
  const T = three!
  const [{ flashIntensity }, { token }] = await Promise.all([
    import('../../utils/dice3d/burst'),
    import('../../utils/dice3d/atlas'),
  ])

  const original = mesh.material as import('three').MeshStandardMaterial
  const flashing = original.clone()
  flashing.emissive = new T.Color(
    outcome === 'critical' ? token('--brand', '#d9a544') : token('--danger', '#e05252'),
  )
  mesh.material = flashing

  effects.push({
    update(t) {
      flashing.emissiveIntensity = flashIntensity(t) * (outcome === 'critical' ? 1.3 : 0.9)
    },
    dispose() {
      mesh.material = original
      flashing.dispose()
    },
  })
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
  frame = 0
  releaseMeshes()

  landed = false
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
    running.push({ mesh, motion, scale, outcome: die.outcome })
  }

  visible.value = true
  fading.value = false
  startedAt = performance.now()
  frame = requestAnimationFrame(tick)
}

function tick(now: number) {
  const elapsed = now - startedAt
  let flying = false

  for (const die of running) {
    const t = Math.min(1, elapsed / die.motion.duration)
    if (t < 1) flying = true
    const sample = motionApi!.sampleMotion(die.motion, t)
    die.mesh.position.copy(sample.position)
    die.mesh.quaternion.copy(sample.quaternion)
    die.mesh.scale.setScalar(die.scale * sample.scale)
  }

  // Le dernier dé vient de se poser : on libère le résultat et on allume les
  // étoiles au même instant.
  if (!flying && !landed) {
    landed = true
    landedAt = now
    finish()
    void triggerEffects()
  }

  const effectAge = landed ? now - landedAt : 0
  for (const effect of effects) effect.update(effectAge / EFFECT_MS)

  renderer!.render(scene!, camera!)

  // On continue de rendre tant qu'un dé vole ou qu'un effet joue
  if (flying || (landed && effectAge < EFFECT_MS)) frame = requestAnimationFrame(tick)
  else frame = 0
}

/** Allume les effets des dés qui ont fait un max ou un 1. */
async function triggerEffects() {
  for (const die of running) {
    if (!die.outcome) continue
    const origin = die.mesh.position.clone()
    await flashDie(die.mesh, die.outcome)
    if (die.outcome === 'critical') await spawnSparks(origin, die.scale)
    else await spawnShockwave(origin, die.scale)
  }
  // Les effets sont montés après le début de la boucle : on la relance si elle
  // s'était arrêtée entre-temps.
  if (effects.length && !frame) frame = requestAnimationFrame(tick)
}

/** Le dé s'est posé : on libère le résultat, puis on rend l'écran. */
function finish() {
  cancelAnimationFrame(frame)
  settleDiceRoll(currentId)
  clearTimers()
  timers.push(window.setTimeout(fadeOut, HOLD_MS))
}

function fadeOut() {
  fading.value = true
  timers.push(
    window.setTimeout(() => {
      visible.value = false
      releaseMeshes()
    }, FADE_MS),
  )
}

/**
 * Un clic pendant que le dé est là : il se pose sur son résultat et s'efface
 * aussitôt, sans le temps de pause.
 *
 * Le clic n'est pas consommé : le canvas ne capte jamais les pointeurs, donc il
 * atteint le bouton visé en dessous. Cliquer sur un dé relance donc un jet tout
 * en effaçant le précédent.
 */
function dismiss() {
  if (!running.length) return
  cancelAnimationFrame(frame)

  // On montre la bonne face pendant le fondu plutôt qu'un dé encore en vol
  for (const die of running) {
    const sample = motionApi!.sampleMotion(die.motion, 1)
    die.mesh.position.copy(sample.position)
    die.mesh.quaternion.copy(sample.quaternion)
    die.mesh.scale.setScalar(die.scale)
  }
  renderer!.render(scene!, camera!)

  settleDiceRoll(currentId)
  clearTimers()
  fadeOut()
}

function onPointerDown() {
  if (!visible.value || fading.value) return
  dismiss()
}

function releaseMeshes() {
  for (const effect of effects) effect.dispose()
  effects = []
  // Géométries, textures et liseré sont partagés : on ne détache que les objets
  for (const mesh of pool) scene?.remove(mesh)
  pool.length = 0
  running = []
}

watch(diceRequest, (request) => {
  if (request) void start(request)
})

window.addEventListener('resize', resize)
// En capture : on efface le dé avant même que la cible ne traite le clic
window.addEventListener('pointerdown', onPointerDown, true)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointerdown', onPointerDown, true)
  clearTimers()
  cancelAnimationFrame(frame)
  releaseMeshes()
  geometries.forEach((g) => g.dispose())
  materials.forEach((m) => m.dispose())
  outlineMaterial?.dispose()
  sparkTexture?.dispose()
  renderer?.dispose()

  // Les caches vivent au niveau du module, pas de l'instance : sans ce ménage,
  // un remontage repartirait sur un renderer et des textures déjà détruits.
  geometries.clear()
  materials.clear()
  normalCache.clear()
  outlineMaterial = null
  sparkTexture = null
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
  /* Jamais cliquable : le dé est une décoration posée sur l'app, il ne doit
     jamais avaler un clic destiné à un bouton en dessous. C'est la fenêtre qui
     écoute le pointeur pour l'effacer. */
  pointer-events: none;
  /* Doit rester aligné sur FADE_MS */
  transition: opacity 0.4s ease;
}

.dice-canvas.is-visible {
  opacity: 1;
}

.dice-canvas.is-fading {
  opacity: 0;
}
</style>
