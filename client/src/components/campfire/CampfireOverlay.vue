<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { restRequest, settleRest, type RestRequest } from '../../composables/useRest'
import {
  createEmbers,
  createFlame,
  fireEnvelope,
  firePulse,
  sampleEmber,
  sampleFlame,
  type Ember,
  type FlameParticle,
} from '../../utils/campfire/flame'
import type { RestKind } from '../../api/campaigns'

/**
 * Le feu de camp du repos partagé, monté une seule fois pour toute l'app.
 *
 * Même moule que `Dice3DOverlay` : three.js n'est chargé qu'au premier repos,
 * le contexte WebGL est créé une fois et gardé, la boucle ne tourne que pendant
 * l'animation. Une différence de fond : ici on assombrit l'écran et le canvas
 * capte les clics — le repos est un moment, pas une décoration.
 *
 * Les nouvelles valeurs sont DÉJÀ en base quand on arrive ici : couper le feu
 * ne perd jamais rien.
 */

type Three = typeof import('three')

/** Chaque repos a son feu. Le complet est plus long, plus large, plus sombre. */
const SETTINGS: Record<RestKind, { duration: number; scale: number; veil: number; light: number }> = {
  long: { duration: 4500, scale: 1, veil: 0.72, light: 1 },
  complet: { duration: 6000, scale: 1.3, veil: 0.82, light: 1.35 },
}

/** Doit rester aligné sur la transition CSS du voile. */
const FADE_MS = 420

const canvas = ref<HTMLCanvasElement | null>(null)
const visible = ref(false)
const fading = ref(false)
const veil = ref(0.72)

let three: Three | null = null
let renderer: import('three').WebGLRenderer | null = null
let scene: import('three').Scene | null = null
let camera: import('three').PerspectiveCamera | null = null
let broken = false

/** Monté une fois puis réutilisé d'un repos à l'autre. */
type Cloud = {
  points: import('three').Points
  position: import('three').BufferAttribute
  color: import('three').BufferAttribute
  material: import('three').PointsMaterial
}

let fire: {
  group: import('three').Group
  flame: Cloud
  embers: Cloud
  light: import('three').PointLight
  glowMaterial: import('three').MeshBasicMaterial
} | null = null

/** Cœur du feu → pointe froide. Relus au montage pour suivre le thème. */
let hotColor = { r: 1, g: 0.85, b: 0.42 }
const COLD_COLOR = { r: 0.78, g: 0.16, b: 0.05 }

let flameParticles: FlameParticle[] = []
let emberParticles: Ember[] = []
let sparkTexture: import('three').Texture | null = null

let frame = 0
let startedAt = 0
let current: RestRequest | null = null
let settings = SETTINGS.long
let timer = 0

const FLAME_COUNT = 90
const EMBER_COUNT = 16

function prefersReducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

async function ensureEngine(): Promise<boolean> {
  if (broken) return false
  if (renderer) return true

  try {
    three = await import('three')
    renderer = new three.WebGLRenderer({ canvas: canvas.value!, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    scene = new three.Scene()
    camera = new three.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 1.5, 6.4)
    camera.lookAt(0, 1.1, 0)

    // Nuit : juste assez de lumière ambiante pour deviner les bûches hors du feu
    scene.add(new three.AmbientLight(0x5b6a8a, 0.55))

    await buildFire()
    resize()
    return true
  } catch {
    broken = true
    return false
  }
}

function resize() {
  if (!renderer || !camera) return
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}

/**
 * Un buffer de points par nuage : un seul appel de rendu chacun.
 *
 * La couleur est portée par sommet. En mélange additif, assombrir la couleur
 * revient à effacer la particule : c'est ce qui permet d'avoir, dans un seul
 * nuage, un cœur jaune vif et des pointes rouges qui s'éteignent.
 */
function pointCloud(count: number, texture: import('three').Texture, size: number) {
  const T = three!
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(new Array(count * 3).fill(0), 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(new Array(count * 3).fill(0), 3))
  const material = new T.PointsMaterial({
    map: texture,
    size,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  })
  return {
    points: new T.Points(geometry, material),
    position: geometry.getAttribute('position') as import('three').BufferAttribute,
    color: geometry.getAttribute('color') as import('three').BufferAttribute,
    material,
  }
}

async function buildFire() {
  const T = three!
  const { buildSparkTexture, token } = await import('../../utils/dice3d/atlas')
  sparkTexture ??= buildSparkTexture()

  const group = new T.Group()

  // Les bûches : trois cylindres croisés posés sur le lit de braises
  const logGeometry = new T.CylinderGeometry(0.13, 0.16, 1.7, 8)
  const logMaterial = new T.MeshStandardMaterial({ color: 0x2c1d14, roughness: 0.95 })
  for (let i = 0; i < 3; i++) {
    const log = new T.Mesh(logGeometry, logMaterial)
    log.position.y = 0.15
    log.rotation.z = Math.PI / 2
    log.rotation.y = (i / 3) * Math.PI
    group.add(log)
  }

  // Le cœur du feu emprunte la couleur de marque : le feu appartient à l'app
  const brand = new T.Color(token('--brand', '#d9a544'))
  hotColor = { r: Math.min(1, brand.r * 1.35 + 0.2), g: brand.g * 1.1, b: brand.b * 0.75 }

  const flame = pointCloud(FLAME_COUNT, sparkTexture, 0.55)
  group.add(flame.points)

  const embers = pointCloud(EMBER_COUNT, sparkTexture, 0.16)
  group.add(embers.points)

  // C'est la lumière qui respire, plus que les particules, qui rend le feu vivant
  const light = new T.PointLight(0xffb257, 4.2, 14, 2)
  light.position.set(0, 0.9, 0)
  group.add(light)

  // Halo au sol : le feu doit poser sa lumière sur quelque chose
  const glowGeometry = new T.CircleGeometry(2.6, 48)
  const glowMaterial = new T.MeshBasicMaterial({
    color: new T.Color('#ff9d3c'),
    transparent: true,
    opacity: 0.18,
    blending: T.AdditiveBlending,
    depthWrite: false,
  })
  const glow = new T.Mesh(glowGeometry, glowMaterial)
  glow.rotation.x = -Math.PI / 2
  glow.position.y = 0.02
  group.add(glow)

  scene!.add(group)

  fire = { group, flame, embers, light, glowMaterial }

  flameParticles = createFlame(FLAME_COUNT)
  emberParticles = createEmbers(EMBER_COUNT)
}

async function start(request: RestRequest) {
  settings = SETTINGS[request.kind]
  veil.value = settings.veil

  if (prefersReducedMotion() || !(await ensureEngine())) {
    settleRest(request.id)
    return
  }
  // Un repos plus récent est arrivé pendant le chargement de three
  if (restRequest.value?.id !== request.id) return

  window.clearTimeout(timer)
  cancelAnimationFrame(frame)

  current = request
  fire!.group.scale.setScalar(settings.scale)
  resize()

  visible.value = true
  fading.value = false
  startedAt = performance.now()
  frame = requestAnimationFrame(tick)
}

function tick(now: number) {
  const elapsed = now - startedAt
  const t = elapsed / settings.duration
  const seconds = elapsed / 1000
  const envelope = fireEnvelope(t)
  const pulse = firePulse(seconds)

  const { flame, embers } = fire!

  for (let i = 0; i < flameParticles.length; i++) {
    const s = sampleFlame(flameParticles[i], seconds)
    flame.position.setXYZ(i, s.x, s.y, s.z)
    // La particule refroidit en montant : jaune au ras des braises, rouge en
    // haut. L'opacité passe par la couleur — mélange additif oblige.
    const fade = s.opacity * envelope
    flame.color.setXYZ(
      i,
      (hotColor.r + (COLD_COLOR.r - hotColor.r) * s.heat) * fade,
      (hotColor.g + (COLD_COLOR.g - hotColor.g) * s.heat) * fade,
      (hotColor.b + (COLD_COLOR.b - hotColor.b) * s.heat) * fade,
    )
  }
  flame.position.needsUpdate = true
  flame.color.needsUpdate = true
  flame.material.size = 0.55 * (0.85 + pulse * 0.2) * settings.scale

  for (let i = 0; i < emberParticles.length; i++) {
    const s = sampleEmber(emberParticles[i], seconds)
    embers.position.setXYZ(i, s.x, s.y, s.z)
    const fade = s.opacity * envelope
    embers.color.setXYZ(i, fade, fade * 0.52, fade * 0.2)
  }
  embers.position.needsUpdate = true
  embers.color.needsUpdate = true

  fire!.light.intensity = 4.2 * pulse * envelope * settings.light
  fire!.glowMaterial.opacity = 0.18 * pulse * envelope

  renderer!.render(scene!, camera!)

  if (t < 1) frame = requestAnimationFrame(tick)
  else finish()
}

/** Le feu s'est éteint tout seul : on rend l'écran et on montre le récap. */
function finish() {
  cancelAnimationFrame(frame)
  frame = 0
  fadeOut()
}

function fadeOut() {
  if (!current) return
  const id = current.id
  fading.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    visible.value = false
    current = null
    settleRest(id)
  }, FADE_MS)
}

/** Clic pendant le feu : on passe directement au récap. */
function dismiss() {
  if (!visible.value || fading.value) return
  cancelAnimationFrame(frame)
  frame = 0
  fadeOut()
}

watch(restRequest, (request) => {
  if (request) void start(request)
})

window.addEventListener('resize', resize)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  window.clearTimeout(timer)
  cancelAnimationFrame(frame)

  fire?.group.traverse((obj) => {
    const mesh = obj as import('three').Mesh
    if (mesh.geometry) mesh.geometry.dispose()
  })
  fire?.flame.material.dispose()
  fire?.embers.material.dispose()
  fire?.glowMaterial.dispose()
  sparkTexture?.dispose()
  renderer?.dispose()

  // Les caches vivent au niveau du module, pas de l'instance : sans ce ménage,
  // un remontage repartirait sur un renderer déjà détruit.
  fire = null
  sparkTexture = null
  renderer = null
  scene = null
  camera = null
  three = null
})

defineExpose({ start })
</script>

<template>
  <!-- Overlay plein écran : cas admis de position fixe, il ne porte aucun layout -->
  <div
    v-show="visible"
    class="campfire"
    :class="{ 'is-fading': fading }"
    :style="{ '--veil': veil }"
    role="presentation"
    @pointerdown="dismiss"
  >
    <canvas ref="canvas" class="campfire-canvas" aria-hidden="true" />
    <p class="campfire-hint">Le groupe se repose…</p>
  </div>
</template>

<style scoped>
.campfire {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(6 4 10 / var(--veil));
  opacity: 1;
  cursor: pointer;
  transition: opacity 0.42s ease;
}

.campfire.is-fading {
  opacity: 0;
}

/* Le canvas couvre son parent : cas admis (overlay sur parent positionné) */
.campfire-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.campfire-hint {
  position: relative;
  margin-bottom: max(2.5rem, env(safe-area-inset-bottom));
  font-family: var(--title-font);
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--brand) 78%, white);
  text-shadow: 0 2px 12px rgb(0 0 0 / 0.7);
  animation: campfire-hint-in 900ms ease both;
}

@keyframes campfire-hint-in {
  from { opacity: 0; }
  to { opacity: 0.85; }
}
</style>
