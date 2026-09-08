<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import {
  diceRequest,
  remoteDiceRequest,
  settleDiceRoll,
  type DiceRequest,
  type RemoteDiceRequest,
} from '../../composables/useDice3D'
import {
  landingLayout,
  planDice,
  remoteSlotLayout,
  REMOTE_SLOTS,
  type DieInstance,
} from '../../utils/dice3d/plan'
import { inkFor } from '../../data/diceColors'
import type { RollOutcome } from '../../utils/rollOutcome'

/**
 * Les dés 3D, montés une seule fois pour toute l'app.
 *
 * Le résultat est déjà connu quand on arrive ici : cette animation ne fait que
 * le montrer. Elle amène le dé sur une orientation calculée d'avance, donc elle
 * peut être coupée ou relancée à tout moment sans jamais mentir sur le chiffre.
 *
 * Deux sortes de « shows » cohabitent dans la même scène :
 * - le mien, plein centre, un seul à la fois ;
 * - ceux des autres joueurs, plus petits, dans 4 emplacements en haut, avec le
 *   nom du perso sous le dé. Plusieurs peuvent rouler en même temps.
 *
 * Coût : three.js n'est chargé qu'au premier jet, le contexte WebGL est créé une
 * fois et gardé, et la boucle d'animation ne tourne que tant qu'un dé est là.
 */

type Three = typeof import('three')
type Mesh = import('three').Mesh
type Motion = import('../../utils/dice3d/motion').RollMotion

interface Effect {
  update: (t: number) => void
  dispose: () => void
}

interface Show {
  id: number
  remote: boolean
  /** Emplacement dans la bande du haut (dés distants seulement). */
  slot: number
  /** Couleur du corps, pour que le flash d'un critique reste dans le ton. */
  color?: string
  dice: { mesh: Mesh; motion: Motion; scale: number; outcome: RollOutcome }[]
  startedAt: number
  landed: boolean
  landedAt: number
  /** Étoiles d'un critique et onde d'un échec, montées le temps de l'effet. */
  effects: Effect[]
  /** Temps d'affichage du dé posé, puis durée du fondu. */
  holdMs: number
  fadeMs: number
  fadingSince: number | null
  fadeTimer: number | null
}

/** Le nom du joueur distant, en HTML au-dessus du canvas. */
interface Label {
  id: number
  name: string
  color: string
  x: number
  y: number
  fading: boolean
}

const canvas = ref<HTMLCanvasElement | null>(null)
const visible = ref(false)
const labels = ref<Label[]>([])

/**
 * Mon dé : le temps de lire le chiffre sur la face. Le dé d'un autre est un
 * aperçu, un peu plus vif. `EFFECT_MS` (étoiles, onde) doit rester sous les deux.
 */
const OWN = { holdMs: 1100, fadeMs: 400, speed: 1 }
const REMOTE = { holdMs: 900, fadeMs: 300, speed: 0.7 }
const EFFECT_MS = 900
/** Jets distants en attente d'un emplacement libre. Au-delà, on oublie. */
const MAX_QUEUE = 8

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
let sparkTexture: import('three').Texture | null = null

let shows: Show[] = []
/**
 * Emplacements pris, réservés dès qu'un jet distant est accepté — avant les
 * `await` de chargement, sinon deux jets simultanés se poseraient au même endroit.
 */
const busySlots = new Set<number>()
let queue: RemoteDiceRequest[] = []
let frame = 0

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
    // Sans ça, projeter un point avant le tout premier rendu donne NaN : les
    // matrices de la caméra ne sont calculées qu'au rendu.
    camera.updateMatrixWorld()

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

/** Un point de la scène, en pixels sur l'écran. */
function toScreen(point: import('three').Vector3): { x: number; y: number } {
  const projected = point.clone().project(camera!)
  return {
    x: ((projected.x + 1) / 2) * window.innerWidth,
    y: ((1 - projected.y) / 2) * window.innerHeight,
  }
}

async function meshFor(die: DieInstance, color?: string): Promise<Mesh> {
  const T = three!
  // Une texture par forme ET par couleur : un dé rubis et un dé saphir sont deux
  // atlas différents, jamais une teinte posée sur le doré.
  const cacheKey = `${die.sides}:${die.kind}:${color ?? 'theme'}`

  if (!geometries.has(cacheKey)) {
    const [{ buildFaces, buildDieGeometry, faceFitRatio }, { buildAtlas, labelsFor, themeDiceColors }] =
      await Promise.all([
        import('../../utils/dice3d/polyhedra'),
        import('../../utils/dice3d/atlas'),
      ])
    const faces = buildFaces(die.sides)
    const colors = color ? { face: color, ink: inkFor(color) } : themeDiceColors()
    const atlas = buildAtlas(labelsFor(die.sides, die.kind), faceFitRatio(faces), colors)
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
async function spawnSparks(show: Show, origin: import('three').Vector3, scale: number) {
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

  show.effects.push({
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
async function spawnShockwave(show: Show, origin: import('three').Vector3, scale: number) {
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

  show.effects.push({
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
 *
 * Le critique brille dans la couleur du dé, pas en doré : une émission d'une
 * autre teinte délave la face et le 20 devient illisible. L'échec reste rouge.
 */
async function flashDie(show: Show, mesh: Mesh, outcome: Exclude<RollOutcome, null>) {
  const T = three!
  const [{ flashIntensity }, { token }] = await Promise.all([
    import('../../utils/dice3d/burst'),
    import('../../utils/dice3d/atlas'),
  ])

  const original = mesh.material as import('three').MeshStandardMaterial
  const flashing = original.clone()
  flashing.emissive = new T.Color(
    outcome === 'critical'
      ? (show.color ?? token('--brand', '#d9a544'))
      : token('--danger', '#e05252'),
  )
  mesh.material = flashing

  show.effects.push({
    update(t) {
      flashing.emissiveIntensity = flashIntensity(t) * (outcome === 'critical' ? 0.55 : 0.5)
    },
    dispose() {
      mesh.material = original
      flashing.dispose()
    },
  })
}

/** Monte les dés d'un show dans la scène et le met en route. */
async function launch(
  request: DiceRequest,
  dice: DieInstance[],
  remote: boolean,
  slot: number,
): Promise<void> {
  const timing = remote ? REMOTE : OWN
  const { halfWidth, halfHeight } = viewport()
  const { positions, scale } = remote
    ? remoteSlotLayout(slot, dice.length, halfWidth, halfHeight)
    : landingLayout(dice.length)

  const show: Show = {
    id: request.id,
    remote,
    slot,
    color: request.color,
    dice: [],
    startedAt: 0,
    landed: false,
    landedAt: 0,
    effects: [],
    holdMs: timing.holdMs,
    fadeMs: timing.fadeMs,
    fadingSince: null,
    fadeTimer: null,
  }

  for (let i = 0; i < dice.length; i++) {
    const die = dice[i]
    const mesh = await meshFor(die, request.color)
    const normals = await faceNormals(die)
    const target = motionApi!.faceTargetQuaternion(normals[die.faceIndex])
    const motion = motionApi!.createMotion({
      halfWidth,
      halfHeight,
      landing: new three!.Vector3(positions[i].x, positions[i].y, 0),
      target,
    })
    motion.duration *= timing.speed
    mesh.scale.setScalar(scale)
    show.dice.push({ mesh, motion, scale, outcome: die.outcome })
  }

  // Pendant le chargement des textures, un lancer à moi plus récent a pu
  // arriver : celui-ci ne monte pas, l'autre a déjà pris le centre.
  if (!remote && diceRequest.value?.id !== request.id) return

  for (const die of show.dice) scene!.add(die.mesh)
  show.startedAt = performance.now()
  shows.push(show)
  visible.value = true
  if (!frame) frame = requestAnimationFrame(tick)
}

async function startOwn(request: DiceRequest) {
  const dice = planDice(request.rolls)
  if (!dice.length || !(await ensureEngine())) {
    settleDiceRoll(request.id)
    return
  }
  // Une demande plus récente est arrivée pendant le chargement
  if (diceRequest.value?.id !== request.id) return

  // Un nouveau lancer à moi remplace le précédent, sans attendre son fondu
  for (const show of shows.filter((s) => !s.remote)) release(show)
  resize()
  await launch(request, dice, false, -1)
}

async function startRemote(request: RemoteDiceRequest) {
  const dice = planDice(request.rolls)
  if (!dice.length || !(await ensureEngine())) return

  const slot = queue.length ? -1 : freeSlot()
  if (slot === -1) {
    // Tout est occupé par des dés encore en vol : on attend un emplacement
    // plutôt que de couper un jet en cours ou d'oublier celui-ci.
    if (queue.length < MAX_QUEUE) queue.push(request)
    return
  }
  busySlots.add(slot)
  resize()

  // Le nom s'affiche dès le début du vol : c'est le premier repère quand
  // plusieurs dés déboulent en même temps.
  const { halfWidth, halfHeight } = viewport()
  const { positions, scale } = remoteSlotLayout(slot, dice.length, halfWidth, halfHeight)
  const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
  const at = toScreen(new three!.Vector3(centerX, positions[0].y - scale * 1.35, 0))
  labels.value.push({
    id: request.id,
    name: request.actorName,
    color: request.color,
    x: at.x,
    y: at.y,
    fading: false,
  })

  await launch(request, dice, true, slot)
}

/**
 * Un emplacement libre dans la bande du haut. S'ils sont tous pris, le plus
 * ancien déjà posé cède sa place ; un dé encore en vol, jamais.
 */
function freeSlot(): number {
  for (let slot = 0; slot < REMOTE_SLOTS; slot++) {
    if (!busySlots.has(slot)) return slot
  }
  const oldest = shows
    .filter((s) => s.remote && s.landed)
    .sort((a, b) => a.startedAt - b.startedAt)[0]
  if (!oldest) return -1
  const slot = oldest.slot
  release(oldest)
  return slot
}

function tick(now: number) {
  let alive = false

  for (const show of shows) {
    const elapsed = now - show.startedAt
    let flying = false

    // Fondu : le dé rétrécit jusqu'à disparaître, pas besoin de matériau à part
    const fade = show.fadingSince === null
      ? 1
      : Math.max(0, 1 - ((now - show.fadingSince) / show.fadeMs) ** 2)

    for (const die of show.dice) {
      const t = Math.min(1, elapsed / die.motion.duration)
      if (t < 1) flying = true
      const sample = motionApi!.sampleMotion(die.motion, t)
      die.mesh.position.copy(sample.position)
      die.mesh.quaternion.copy(sample.quaternion)
      die.mesh.scale.setScalar(die.scale * sample.scale * fade)
    }

    // Le dernier dé vient de se poser : on libère le résultat et on allume les
    // étoiles au même instant.
    if (!flying && !show.landed) {
      show.landed = true
      show.landedAt = now
      finish(show)
      void triggerEffects(show)
    }

    const effectAge = show.landed ? now - show.landedAt : 0
    for (const effect of show.effects) effect.update(Math.min(1, effectAge / EFFECT_MS))

    if (show.fadingSince !== null && fade === 0) release(show)
    else alive = true
  }

  renderer!.render(scene!, camera!)

  if (alive) frame = requestAnimationFrame(tick)
  else {
    frame = 0
    visible.value = false
  }
}

/** Allume les effets des dés qui ont fait un max ou un 1. */
async function triggerEffects(show: Show) {
  for (const die of show.dice) {
    if (!die.outcome) continue
    const origin = die.mesh.position.clone()
    await flashDie(show, die.mesh, die.outcome)
    if (die.outcome === 'critical') await spawnSparks(show, origin, die.scale)
    else await spawnShockwave(show, origin, die.scale)
  }
}

/** Le dé s'est posé : on libère le résultat, puis on le laisse lire. */
function finish(show: Show) {
  if (!show.remote) settleDiceRoll(show.id)
  show.fadeTimer = window.setTimeout(() => startFade(show), show.holdMs)
}

function startFade(show: Show) {
  if (show.fadingSince !== null) return
  show.fadingSince = performance.now()
  const label = labels.value.find((l) => l.id === show.id)
  if (label) label.fading = true
  if (!frame) frame = requestAnimationFrame(tick)
}

/**
 * Un tap pendant que des dés sont là : ils se posent sur leur résultat et
 * s'effacent aussitôt, sans le temps de pause. Les miens comme ceux des
 * autres — on ne vise pas un dé de 45 px pour le fermer.
 *
 * Le clic n'est pas consommé : le canvas ne capte jamais les pointeurs, donc il
 * atteint le bouton visé en dessous. Cliquer sur un dé relance donc un jet tout
 * en effaçant le précédent.
 */
function dismiss() {
  for (const show of shows) {
    if (show.fadingSince !== null) continue
    // On montre la bonne face pendant le fondu plutôt qu'un dé encore en vol
    for (const die of show.dice) {
      die.motion.duration = Math.max(1, Math.min(die.motion.duration, performance.now() - show.startedAt))
    }
    if (!show.landed) {
      show.landed = true
      show.landedAt = performance.now()
      if (!show.remote) settleDiceRoll(show.id)
    }
    if (show.fadeTimer) window.clearTimeout(show.fadeTimer)
    startFade(show)
  }
  queue = []
}

function onPointerDown() {
  if (!visible.value) return
  dismiss()
}

/** Retire un show de la scène et rend son emplacement au suivant qui attend. */
function release(show: Show) {
  if (show.fadeTimer) window.clearTimeout(show.fadeTimer)
  for (const effect of show.effects) effect.dispose()
  // Géométries, textures et liseré sont partagés : on ne détache que les objets
  for (const die of show.dice) scene?.remove(die.mesh)
  shows = shows.filter((s) => s !== show)
  labels.value = labels.value.filter((l) => l.id !== show.id)

  if (show.remote) {
    busySlots.delete(show.slot)
    const next = queue.shift()
    if (next) void startRemote(next)
  }
}

function releaseAll() {
  for (const show of [...shows]) release(show)
  queue = []
}

watch(diceRequest, (request) => {
  if (request) void startOwn(request)
})

watch(remoteDiceRequest, (request) => {
  if (request) void startRemote(request)
})

window.addEventListener('resize', resize)
// En capture : on efface le dé avant même que la cible ne traite le clic
window.addEventListener('pointerdown', onPointerDown, true)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointerdown', onPointerDown, true)
  cancelAnimationFrame(frame)
  frame = 0
  releaseAll()
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
    :class="{ 'is-visible': visible }"
    aria-hidden="true"
  />
  <!-- Les noms des joueurs distants, posés sous leur dé. Même statut : décor. -->
  <div class="dice-labels" aria-hidden="true">
    <span
      v-for="label in labels"
      :key="label.id"
      class="dice-label"
      data-testid="remote-die-label"
      :class="{ 'is-fading': label.fading }"
      :style="{ left: `${label.x}px`, top: `${label.y}px` }"
    >
      <span class="dice-label-dot" :style="{ background: label.color }" />
      {{ label.name }}
    </span>
  </div>
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
}

.dice-canvas.is-visible {
  opacity: 1;
}

.dice-labels {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}

/* Chaque étiquette est ancrée sur la projection de son dé : c'est l'overlay
   couvrant son parent, le cas admis de position: absolute. */
.dice-label {
  position: absolute;
  transform: translate(-50%, 0);
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  max-width: 22vw;
  padding: 1px var(--space-sm);
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  font-family: var(--title-font);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
  animation: dice-label-in 220ms ease-out;
  transition: opacity 300ms ease;
}

.dice-label.is-fading {
  opacity: 0;
}

.dice-label-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

@keyframes dice-label-in {
  from { opacity: 0; transform: translate(-50%, -6px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
</style>
