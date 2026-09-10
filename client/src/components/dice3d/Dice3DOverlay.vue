<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import {
  diceRequest,
  remoteDiceRequest,
  settleDiceRoll,
  viewerArea,
  type DiceRequest,
  type RemoteDiceRequest,
} from '../../composables/useDice3D'
import {
  landingLayout,
  planDice,
  remoteSlotLayout,
  viewerLayout,
  REMOTE_SLOTS,
  type DieInstance,
} from '../../utils/dice3d/plan'
import { dominantColor, type DiceStyle } from '../../data/diceStyle'
import { buildDieMesh, createMeshCache, disposeMeshCache, trimMeshCache } from '../../utils/dice3d/mesh'
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
 * En mode table (`viewerArea`), il n'y a pas de « moi » : les dés de tout le
 * monde tombent sur la carte, plus gros, et restent posés le temps d'être lus
 * à un mètre. Personne ne touche l'écran, donc rien ne les efface au tap.
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

/** Une face tirée, telle qu'elle s'écrit dans l'étiquette. Un dé écarté est barré. */
interface ResultPart {
  value: number
  dropped: boolean
}

interface Show {
  id: number
  remote: boolean
  /** Emplacement dans la bande du haut (dés distants seulement). */
  slot: number
  /** Couleur dominante du corps, pour que le flash d'un critique reste dans le ton. */
  color?: string
  /** Les faces tirées, affichées dans l'étiquette une fois le dé posé. */
  result: ResultPart[]
  dice: {
    mesh: Mesh
    motion: Motion
    scale: number
    outcome: RollOutcome
    /** Ce dé a été lancé puis jeté : il se rétracte et se ternit en se posant. */
    dropped: boolean
    /** Copie du matériau, pour ne ternir que ce dé-là. Null s'il est gardé. */
    material: import('three').MeshStandardMaterial | null
  }[]
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
  /** Vide tant que le dé vole : un petit dé de 45 px ne se lit pas, le chiffre si. */
  result: ResultPart[]
  outcome: RollOutcome
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
/** Mode table : le dé reste posé le temps que toute la table le lise. */
const VIEWER = { holdMs: 4500, fadeMs: 500, speed: 0.85 }
const EFFECT_MS = 900
/** Jets distants en attente d'un emplacement libre. Au-delà, on oublie. */
const MAX_QUEUE = 8
/**
 * Le dé écarté : une fois posé, il se rétracte à 65 % et se ternit vers le gris.
 * Il roule comme les autres — c'est à l'arrivée qu'on doit voir, sans lire,
 * lequel des deux compte.
 */
const DROPPED_SCALE = 0.65
const DROPPED_GREY = 0.55
const DROPPED_MS = 280

let three: Three | null = null
let motionApi: typeof import('../../utils/dice3d/motion') | null = null
let renderer: import('three').WebGLRenderer | null = null
let scene: import('three').Scene | null = null
let camera: import('three').PerspectiveCamera | null = null
let broken = false

/**
 * Géométries et textures réutilisées d'un lancer à l'autre. Plafonné : chaque
 * style de dé croisé en campagne ajoute une entrée, et un joueur qui règle le
 * sien en essaie des dizaines.
 */
const meshCache = createMeshCache()
const MESH_CACHE_MAX = 12
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

async function meshFor(die: DieInstance, style?: DiceStyle): Promise<Mesh> {
  return buildDieMesh(three!, meshCache, die, style)
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

/** Où et à quelle taille les dés d'un jet distant se posent. */
function remoteLayout(slot: number, count: number) {
  const { halfWidth, halfHeight } = viewport()
  const area = viewerArea.value
  if (area) {
    const screen = { width: window.innerWidth, height: window.innerHeight }
    return viewerLayout(slot, count, area, screen, halfWidth, halfHeight)
  }
  return remoteSlotLayout(slot, count, halfWidth, halfHeight)
}

/** Monte les dés d'un show dans la scène et le met en route. */
async function launch(
  request: DiceRequest,
  dice: DieInstance[],
  remote: boolean,
  slot: number,
  layout: { positions: { x: number; y: number }[]; scale: number },
): Promise<void> {
  const timing = !remote ? OWN : viewerArea.value ? VIEWER : REMOTE
  const { halfWidth, halfHeight } = viewport()
  const { positions, scale } = layout

  const show: Show = {
    id: request.id,
    remote,
    slot,
    color: request.style ? dominantColor(request.style) : undefined,
    result: request.rolls.map((r) => ({ value: r.value, dropped: !!r.dropped })),
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
    const mesh = await meshFor(die, request.style)
    const normals = await faceNormals(die)
    const landing = new three!.Vector3(positions[i].x, positions[i].y, 0)
    // La face vise la caméra depuis l'endroit où le dé se pose, pas « l'avant »
    const toward = camera!.position.clone().sub(landing)
    const target = motionApi!.faceTargetQuaternion(normals[die.faceIndex], toward)
    const motion = motionApi!.createMotion({
      halfWidth,
      halfHeight,
      landing,
      target,
    })
    motion.duration *= timing.speed
    mesh.scale.setScalar(scale)
    // Le matériau est partagé par tous les dés d'une même forme : sans copie,
    // ternir le dé écarté ternirait aussi celui qu'on garde.
    const material = die.dropped
      ? (mesh.material as import('three').MeshStandardMaterial).clone()
      : null
    if (material) mesh.material = material
    show.dice.push({ mesh, motion, scale, outcome: die.outcome, dropped: !!die.dropped, material })
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
  await launch(request, dice, false, -1, landingLayout(dice.length))
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
  // Le point de chute est tiré une fois : l'étiquette et les dés doivent tomber d'accord.
  const layout = remoteLayout(slot, dice.length)
  const { positions, scale } = layout
  const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
  const at = toScreen(new three!.Vector3(centerX, positions[0].y - scale * 1.35, 0))
  labels.value.push({
    id: request.id,
    name: request.actorName,
    color: dominantColor(request.style),
    x: at.x,
    y: at.y,
    result: [],
    outcome: null,
    fading: false,
  })

  await launch(request, dice, true, slot, layout)
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
      // Un dé écarté se rétracte et se ternit en se posant : on voit lequel
      // compte sans avoir à lire les chiffres.
      const drop = die.dropped && show.landed
        ? 1 - (1 - Math.min(1, (now - show.landedAt) / DROPPED_MS)) ** 2
        : 0
      die.mesh.scale.setScalar(die.scale * sample.scale * fade * (1 - drop * (1 - DROPPED_SCALE)))
      if (die.material) {
        die.material.color.setScalar(1 - drop * (1 - DROPPED_GREY))
        die.material.metalness = 0.28 * (1 - drop)
        die.material.roughness = 0.34 + drop * 0.5
      }
    }

    // Le dernier dé vient de se poser : on libère le résultat et on allume les
    // étoiles au même instant.
    if (!flying && !show.landed) {
      show.landed = true
      show.landedAt = now
      finish(show)
      void triggerEffects(show)
      const label = labels.value.find((l) => l.id === show.id)
      if (label) {
        label.result = show.result
        label.outcome = show.dice.find((d) => d.outcome)?.outcome ?? null
      }
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
    // Le ménage attend que la scène soit vide : évincer l'entrée d'un dé encore
    // en vol lui retirerait sa géométrie sous les pieds.
    trimMeshCache(meshCache, MESH_CACHE_MAX)
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
  // Mode table : personne ne vise l'écran, un tap ne doit rien effacer
  if (!visible.value || viewerArea.value) return
  dismiss()
}

/** Retire un show de la scène et rend son emplacement au suivant qui attend. */
function release(show: Show) {
  if (show.fadeTimer) window.clearTimeout(show.fadeTimer)
  for (const effect of show.effects) effect.dispose()
  // Géométries, textures et liseré sont partagés : on ne détache que les objets.
  // La copie de matériau d'un dé écarté, elle, n'appartient qu'à ce show.
  for (const die of show.dice) {
    scene?.remove(die.mesh)
    die.material?.dispose()
  }
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

// `sync` : quatre joueurs qui lancent dans la même milliseconde font quatre
// demandes d'affilée. Un watcher normal les regroupe et ne verrait que la
// dernière — trois dés perdus.
watch(remoteDiceRequest, (request) => {
  if (request) void startRemote(request)
}, { flush: 'sync' })

window.addEventListener('resize', resize)
// En capture : on efface le dé avant même que la cible ne traite le clic
window.addEventListener('pointerdown', onPointerDown, true)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointerdown', onPointerDown, true)
  cancelAnimationFrame(frame)
  frame = 0
  releaseAll()
  disposeMeshCache(meshCache)
  sparkTexture?.dispose()
  renderer?.dispose()

  // Les caches vivent au niveau du module, pas de l'instance : sans ce ménage,
  // un remontage repartirait sur un renderer et des textures déjà détruits.
  normalCache.clear()
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
      :class="{ 'is-fading': label.fading, 'is-viewer': !!viewerArea }"
      :style="{ left: `${label.x}px`, top: `${label.y}px` }"
    >
      <span class="dice-label-dot" :style="{ background: label.color }" />
      <span class="dice-label-name">{{ label.name }}</span>
      <span
        v-if="label.result.length"
        class="dice-label-result"
        :class="label.outcome && `dice-label-result--${label.outcome}`"
      ><template v-for="(part, i) in label.result" :key="i"><span
        v-if="i"
        class="dice-label-sep"
      >·</span><span :class="{ 'is-dropped': part.dropped }">{{ part.value }}</span></template></span>
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
  max-width: 24vw;
  padding: 1px var(--space-sm);
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  font-family: var(--title-font);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  color: var(--text);
  animation: dice-label-in 220ms ease-out;
  transition: opacity 300ms ease;
}

.dice-label-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Le chiffre : plus gros que le nom, c'est lui qu'on cherche des yeux */
.dice-label-result {
  flex-shrink: 0;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--brand-strong);
  animation: dice-result-in 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dice-label-result--critical { color: var(--accent-strong); }
.dice-label-result--fumble { color: var(--danger); }

/* Le dé écarté : barré, en retrait, plus petit. Le gardé reste seul en avant. */
.dice-label-result .is-dropped {
  color: var(--muted);
  text-decoration: line-through;
  font-size: 0.72em;
}

.dice-label-sep {
  margin: 0 0.18em;
  color: var(--muted);
  font-size: 0.6em;
}

/* Mode table : lu à un mètre, tout est plus grand */
.dice-label.is-viewer {
  max-width: 40vw;
  padding: var(--space-xs) var(--space-md);
  font-size: 1.15rem;
}

.dice-label.is-viewer .dice-label-result {
  font-size: 2rem;
}

.dice-label.is-viewer .dice-label-dot {
  width: 12px;
  height: 12px;
}

@keyframes dice-result-in {
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: scale(1); }
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
