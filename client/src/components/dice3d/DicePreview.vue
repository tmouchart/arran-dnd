<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { backgroundCss, resolvedInk, styleKey, type DiceStyle } from '../../data/diceStyle'
import { buildDieMesh, createMeshCache, disposeMeshCache } from '../../utils/dice3d/mesh'

/**
 * Un d20 qui tourne lentement, aux couleurs du style en cours de réglage.
 *
 * Sa scène est indépendante de celle de `Dice3DOverlay` : l'aperçu vit dans les
 * options, l'overlay couvre toute l'app. Ils partagent seulement la fabrication
 * de la mesh (`utils/dice3d/mesh.ts`), et chacun garde son propre cache — celui
 * de l'aperçu est jeté à chaque changement de style, pas celui de l'overlay.
 *
 * La rotation s'arrête dès que l'aperçu sort de l'écran, et tout est libéré au
 * démontage.
 */

const props = defineProps<{ style: DiceStyle }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const broken = ref(false)

type Three = typeof import('three')

let three: Three | null = null
let renderer: import('three').WebGLRenderer | null = null
let scene: import('three').Scene | null = null
let camera: import('three').PerspectiveCamera | null = null
let mesh: import('three').Mesh | null = null
let frame = 0
let observer: IntersectionObserver | null = null
let rebuildTimer: number | null = null
/** Le style effectivement monté : évite de reconstruire pour rien. */
let mountedKey = ''

const cache = createMeshCache()
/** Un tour en 9 s : assez lent pour lire les chiffres, assez vif pour vivre. */
const SPIN = (Math.PI * 2) / 9000

async function ensureEngine(): Promise<boolean> {
  if (broken.value) return false
  if (renderer) return true

  try {
    three = await import('three')
    renderer = new three.WebGLRenderer({ canvas: canvas.value!, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    scene = new three.Scene()
    camera = new three.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 4.4)

    // Mêmes lumières que l'overlay : le dé de l'aperçu doit ressembler au vrai.
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
    // Pas de WebGL : on retombe sur la pastille CSS, l'écran de réglage tient.
    broken.value = true
    return false
  }
}

function resize() {
  if (!renderer || !camera || !canvas.value) return
  const size = canvas.value.clientWidth || 120
  renderer.setSize(size, size, false)
  camera.aspect = 1
  camera.updateProjectionMatrix()
}

async function build() {
  const key = styleKey(props.style)
  if (key === mountedKey) return
  if (!(await ensureEngine())) return

  if (mesh) scene!.remove(mesh)
  // Le cache de l'aperçu ne sert qu'au style courant : chaque teinte essayée
  // laisserait sinon un atlas derrière elle.
  disposeMeshCache(cache)

  mesh = await buildDieMesh(three!, cache, { sides: 20, kind: 'normal', faceIndex: 19, outcome: null }, props.style)
  mesh.scale.setScalar(1.35)
  scene!.add(mesh)
  mountedKey = key
  start()
}

function loop(now: number) {
  if (!renderer || !mesh) return
  mesh.rotation.y = now * SPIN
  mesh.rotation.x = Math.sin(now * SPIN * 0.6) * 0.3
  renderer.render(scene!, camera!)
  frame = requestAnimationFrame(loop)
}

function start() {
  if (!frame && mesh) frame = requestAnimationFrame(loop)
}

function stop() {
  cancelAnimationFrame(frame)
  frame = 0
}

onMounted(() => {
  void build()
  // Un dé qui tourne hors écran ne sert à rien et vide la batterie.
  observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()))
  observer.observe(canvas.value!)
  window.addEventListener('resize', resize)
})

// Débounce : un drag dans le color picker émet en continu, et chaque style
// reconstruit un canvas de texture.
watch(
  () => styleKey(props.style),
  () => {
    if (rebuildTimer) clearTimeout(rebuildTimer)
    rebuildTimer = window.setTimeout(() => void build(), 120)
  },
)

onBeforeUnmount(() => {
  stop()
  if (rebuildTimer) clearTimeout(rebuildTimer)
  observer?.disconnect()
  window.removeEventListener('resize', resize)
  disposeMeshCache(cache)
  renderer?.dispose()
  renderer = null
  scene = null
  camera = null
  mesh = null
})
</script>

<template>
  <div class="dice-preview" data-testid="dice-preview">
    <canvas v-show="!broken" ref="canvas" class="dice-preview-canvas" />
    <span
      v-if="broken"
      class="dice-preview-fallback"
      :style="{ background: backgroundCss(style), color: resolvedInk(style) }"
    >20</span>
  </div>
</template>

<style scoped>
.dice-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-sm) 0;
}

.dice-preview-canvas {
  width: 120px;
  height: 120px;
}

.dice-preview-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  font-family: var(--title-font);
  font-size: 1.7rem;
  font-weight: 700;
}
</style>
