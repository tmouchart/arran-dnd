<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { findEnvironment, rngFor, type BattleEnvironment } from './environments'

export interface BattleToken {
  id: string
  name: string
  /** Couleur du pion (hex CSS). */
  color: string
  kind: 'hero' | 'monster'
  /** Position libre sur le sol, en cases. Le centre de la grille est (0, 0). */
  x: number
  z: number
  /** PV courants et max. Sans eux, aucune barre n'est affichée. */
  hp?: number
  hpMax?: number
}

const props = defineProps<{
  tokens: BattleToken[]
  /** Pion dont c'est le tour : il pulse en doré. */
  activeId?: string | null
  /** Côté de la grille, en cases. */
  size?: number
  /** Le MJ bouge tout le monde ; les autres, seulement les héros. */
  isGm?: boolean
  /** Id du décor (voir `environments.ts`). */
  environment?: string
  /** Damier bien visible par-dessus le sol. Éteint par défaut. */
  showGrid?: boolean
}>()

const emit = defineEmits<{
  (e: 'move', id: string, x: number, z: number): void
  (e: 'select', id: string | null): void
  /** Un pion qu'on n'a pas le droit de bouger a été touché. */
  (e: 'denied', id: string): void
}>()

/** Seul le MJ déplace les monstres. Les héros, tout le monde. */
function canMove(token: BattleToken): boolean {
  return token.kind === 'hero' || !!props.isGm
}

/** Les PV d'un monstre ne regardent que le MJ. */
function showsHp(token: BattleToken): boolean {
  return token.hp != null && token.hpMax != null && (token.kind === 'hero' || !!props.isGm)
}

const gridSize = () => props.size ?? 12
const half = () => gridSize() / 2

const container = ref<HTMLDivElement | null>(null)
const selectedId = ref<string | null>(null)

/* ------------------------------------------------------------------ */
/* Textures dessinées au canvas (pas un seul fichier à télécharger).   */
/* ------------------------------------------------------------------ */

/** Luminance moyenne du sol peint, pour savoir si le damier doit être noir ou blanc. */
function averageLuminance(ctx: CanvasRenderingContext2D, w: number): number {
  const step = 16
  const data = ctx.getImageData(0, 0, w, w).data
  let sum = 0
  let n = 0
  for (let y = 0; y < w; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      n++
    }
  }
  return sum / n / 255
}

/** Le sol : le décor peint sa texture, et le damier vient par-dessus si demandé. */
function makeGroundTexture(
  env: BattleEnvironment,
  cells: number,
  showGrid: boolean,
): THREE.CanvasTexture {
  const px = 96
  const w = cells * px
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = w
  const ctx = canvas.getContext('2d')!

  env.paint(ctx, px, w, rngFor(env.id))

  if (showGrid) {
    // Noir sur sol clair, blanc sur sol foncé : le damier ressort toujours.
    const dark = averageLuminance(ctx, w) > 0.5
    ctx.save()
    ctx.globalAlpha = 0.42
    ctx.fillStyle = dark ? '#000000' : '#ffffff'
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        if ((cx + cy) % 2 === 0) continue
        ctx.fillRect(cx * px, cy * px, px, px)
      }
    }
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = dark ? '#000000' : '#ffffff'
    ctx.lineWidth = 2
    for (let i = 0; i <= cells; i++) {
      const p = i * px + 0.5
      ctx.beginPath()
      ctx.moveTo(p, 0)
      ctx.lineTo(p, w)
      ctx.moveTo(0, p)
      ctx.lineTo(w, p)
      ctx.stroke()
    }
    ctx.restore()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Tache sombre floue posée sous chaque pion : l'ombre du pauvre, mais jolie. */
function makeShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.45)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.18)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

/** Étiquette de nom : un sprite, donc toujours face à la caméra, gratuitement. */
function makeLabelSprite(name: string, color: string): THREE.Sprite {
  const font = 'bold 44px system-ui, sans-serif'
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  const w = Math.ceil(measure.measureText(name).width) + 40
  const h = 72

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 24)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.fillText(name, w / 2, h / 2 + 2)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  )
  sprite.scale.set((w / h) * 0.34, 0.34, 1)
  sprite.renderOrder = 10
  return sprite
}

/**
 * La barre de PV : une jauge, rien d'autre. Pas de chiffre — un joueur voit
 * « ça va mal », pas « il reste 7 points ».
 */
const BAR_W = 120
const BAR_H = 26

function makeHpBar(): { sprite: THREE.Sprite; draw: (ratio: number) => void } {
  const canvas = document.createElement('canvas')
  canvas.width = BAR_W
  canvas.height = BAR_H
  const ctx = canvas.getContext('2d')!
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  )
  sprite.scale.set(0.9, (0.9 * BAR_H) / BAR_W, 1)
  sprite.renderOrder = 11

  const draw = (ratio: number) => {
    const r = THREE.MathUtils.clamp(ratio, 0, 1)
    ctx.clearRect(0, 0, BAR_W, BAR_H)

    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.beginPath()
    ctx.roundRect(0, 0, BAR_W, BAR_H, BAR_H / 2)
    ctx.fill()

    const pad = 4
    const inner = BAR_W - pad * 2
    ctx.fillStyle = r > 0.5 ? '#4ec46b' : r > 0.25 ? '#e0a233' : '#d24a3f'
    ctx.beginPath()
    ctx.roundRect(pad, pad, Math.max(inner * r, r > 0 ? 4 : 0), BAR_H - pad * 2, BAR_H / 2)
    ctx.fill()

    tex.needsUpdate = true
  }

  return { sprite, draw }
}

/* ------------------------------------------------------------------ */
/* Scène                                                              */
/* ------------------------------------------------------------------ */

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.OrthographicCamera
let keyLight: THREE.DirectionalLight
let ambientLight: THREE.AmbientLight
let raf = 0
let observer: ResizeObserver | null = null
const clock = new THREE.Clock()

/** Tout le décor vit ici : on le vide d'un coup au changement d'environnement. */
const decorGroup = new THREE.Group()

/** Caméra iso : on ne bouge que la cible, l'orbite reste bloquée à 4 angles. */
const camTarget = new THREE.Vector3(0, 0, 0)
let yaw = Math.PI / 4 // angle courant, animé
let yawGoal = Math.PI / 4 // angle visé (multiple de 90°)
let frustum = 12.5 // hauteur visible, en cases

const shadowTex = makeShadowTexture()
const ground = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial(),
)

interface TokenView {
  group: THREE.Group
  body: THREE.Mesh
  ring: THREE.Mesh
  bar: THREE.Sprite
  drawBar: (ratio: number) => void
  /** Dernier ratio dessiné : on ne repeint la jauge que si elle a bougé. */
  ratio: number
  /** Déplacement en cours : on glisse, on ne téléporte jamais. */
  from: THREE.Vector3
  to: THREE.Vector3
  t: number
}
const views = new Map<string, TokenView>()

function buildToken(t: BattleToken): TokenView {
  const hero = t.kind === 'hero'
  const radius = hero ? 0.3 : 0.4
  const height = hero ? 0.85 : 1.05
  const color = new THREE.Color(t.color)

  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.05, height, 28),
    new THREE.MeshLambertMaterial({ color }),
  )
  body.position.y = height / 2
  body.userData.tokenId = t.id
  group.add(body)

  // Chapeau plus clair : ça donne du volume sans seconde lumière.
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    new THREE.MeshBasicMaterial({ color: color.clone().offsetHSL(0, 0, 0.18) }),
  )
  cap.rotation.x = -Math.PI / 2
  cap.position.y = height + 0.001
  group.add(cap)

  // Socle : le disque coloré qui dit « ce pion est à moi ».
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.5, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
  )
  disc.rotation.x = -Math.PI / 2
  disc.position.y = 0.02
  group.add(disc)

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 4, radius * 4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.01
  group.add(shadow)

  // Anneau d'état : doré et pulsant au tour du pion, blanc à la sélection.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.6, radius * 1.95, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.03
  group.add(ring)

  const { sprite: bar, draw: drawBar } = makeHpBar()
  bar.position.y = height + 0.2
  group.add(bar)

  const label = makeLabelSprite(t.name, t.color)
  label.position.y = height + 0.62
  group.add(label)

  group.position.set(t.x, 0, t.z)
  scene.add(group)

  const p = group.position.clone()
  return { group, body, ring, bar, drawBar, ratio: -1, from: p, to: p.clone(), t: 1 }
}

function hpRatio(t: BattleToken): number {
  return t.hpMax ? (t.hp ?? 0) / t.hpMax : 0
}

function syncHpBar(view: TokenView, t: BattleToken) {
  view.bar.visible = showsHp(t)
  if (!view.bar.visible) return
  const ratio = hpRatio(t)
  if (ratio === view.ratio) return
  view.drawBar(ratio)
  view.ratio = ratio
}

function syncTokens() {
  const seen = new Set<string>()
  for (const t of props.tokens) {
    seen.add(t.id)
    let view = views.get(t.id)
    if (!view) {
      view = buildToken(t)
      views.set(t.id, view)
    }
    syncHpBar(view, t)
    if (Math.abs(view.to.x - t.x) > 1e-4 || Math.abs(view.to.z - t.z) > 1e-4) {
      view.from.copy(view.group.position)
      view.from.y = 0
      view.to.set(t.x, 0, t.z)
      view.t = 0
    }
  }
  for (const [id, view] of views) {
    if (seen.has(id)) continue
    scene.remove(view.group)
    disposeObject(view.group)
    views.delete(id)
  }
  requestRender()
}

/**
 * Libère un matériau ET ses textures.
 *
 * `material.dispose()` ne touche pas à `.map` : chaque pion porte trois canvas
 * (étiquette, jauge de PV, ombre) et le sol fait 1152×1152. Les oublier faisait
 * grossir la VRAM à chaque aller-retour sur l'onglet Carte.
 *
 * `shadowTex` est partagée par tous les pions et survit au composant : on ne la
 * libère qu'au démontage, une seule fois.
 */
function disposeMaterial(mat: THREE.Material) {
  for (const key of ['map', 'alphaMap', 'lightMap', 'emissiveMap'] as const) {
    const tex = (mat as unknown as Record<string, THREE.Texture | null>)[key]
    if (tex && tex !== shadowTex) tex.dispose()
  }
  mat.dispose()
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose?.()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach(disposeMaterial)
    else if (mat) disposeMaterial(mat)
  })
}

/** Repeint la texture du sol (décor courant + damier si demandé). */
function refreshGround() {
  const env = findEnvironment(props.environment)
  disposeMaterial(ground.material)
  ground.material = new THREE.MeshLambertMaterial({
    map: makeGroundTexture(env, gridSize(), !!props.showGrid),
  })
  requestRender()
}

/** Repeint le sol, refait le décor et règle les lumières. */
function applyEnvironment() {
  const env = findEnvironment(props.environment)

  scene.background = new THREE.Color(env.sky)

  refreshGround()

  keyLight.color.set(env.light.key)
  keyLight.intensity = env.light.keyIntensity
  ambientLight.color.set(env.light.ambient)
  ambientLight.intensity = env.light.ambientIntensity

  for (const child of [...decorGroup.children]) {
    decorGroup.remove(child)
    disposeObject(child)
  }
  for (const o of env.decor?.(half(), rngFor(env.id)) ?? []) decorGroup.add(o)
  requestRender()
}

/**
 * Le décor haut placé entre la caméra et la grille cacherait les pions.
 * On le masque : à chaque angle, on ne garde que ce qui est derrière.
 */
function cullNearDecor() {
  const toCamera = new THREE.Vector3().subVectors(camera.position, camTarget).setY(0).normalize()
  for (const o of decorGroup.children) {
    if (!o.userData.cullNear) continue
    o.visible = o.position.dot(toCamera) < half() * 0.9
  }
}

function updateCamera() {
  const el = container.value
  if (!el) return
  const aspect = el.clientWidth / Math.max(el.clientHeight, 1)
  const h = frustum / 2
  camera.left = -h * aspect
  camera.right = h * aspect
  camera.top = h
  camera.bottom = -h
  const tilt = Math.PI / 4
  camera.position.set(
    camTarget.x + Math.sin(yaw) * Math.cos(tilt) * 40,
    Math.sin(tilt) * 40,
    camTarget.z + Math.cos(yaw) * Math.cos(tilt) * 40,
  )
  camera.lookAt(camTarget)
  camera.updateProjectionMatrix()
  cullNearDecor()
}

function resize() {
  const el = container.value
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
  renderer.setSize(el.clientWidth, el.clientHeight, false)
  updateCamera()
  requestRender()
}

/* ------------------------------------------------------------------ */
/* Gestes : 1 doigt = déplacer la carte, 2 doigts = zoom, bouton = 90°. */
/* ------------------------------------------------------------------ */

const pointers = new Map<number, { x: number; y: number }>()
let pinchStart = 0
let frustumStart = 0
let dragDistance = 0
let downAt = 0

function worldPerPixel(): number {
  return frustum / Math.max(container.value?.clientHeight ?? 1, 1)
}

function onPointerDown(e: PointerEvent) {
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 1) {
    dragDistance = 0
    downAt = performance.now()
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
    frustumStart = frustum
    dragDistance = 999
  }
}

function onPointerMove(e: PointerEvent) {
  const prev = pointers.get(e.pointerId)
  if (!prev) return
  const dx = e.clientX - prev.x
  const dy = e.clientY - prev.y
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()]
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinchStart > 0 && dist > 0) {
      frustum = THREE.MathUtils.clamp(frustumStart * (pinchStart / dist), 5, 26)
      updateCamera()
      requestRender()
    }
    return
  }

  dragDistance += Math.hypot(dx, dy)
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).setY(0).normalize()
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).setY(0).normalize()
  const wpp = worldPerPixel()
  camTarget.addScaledVector(right, -dx * wpp)
  camTarget.addScaledVector(up, dy * wpp)
  const limit = half() + 3
  camTarget.x = THREE.MathUtils.clamp(camTarget.x, -limit, limit)
  camTarget.z = THREE.MathUtils.clamp(camTarget.z, -limit, limit)
  updateCamera()
  requestRender()
}

function onPointerUp(e: PointerEvent) {
  const known = pointers.delete(e.pointerId)
  if (!known || pointers.size > 0) return
  // Un tap : court, et le doigt n'a quasi pas bougé.
  if (dragDistance < 10 && performance.now() - downAt < 600) handleTap(e)
}

const raycaster = new THREE.Raycaster()
const pointerNdc = new THREE.Vector2()

function handleTap(e: PointerEvent) {
  const el = container.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  pointerNdc.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  )
  raycaster.setFromCamera(pointerNdc, camera)

  const bodies = [...views.values()].map((v) => v.body)
  const hit = raycaster.intersectObjects(bodies, false)[0]
  if (hit) {
    const id = hit.object.userData.tokenId as string
    const token = props.tokens.find((t) => t.id === id)
    if (token && !canMove(token)) {
      emit('denied', id)
      return
    }
    selectedId.value = selectedId.value === id ? null : id
    emit('select', selectedId.value)
    requestRender()
    return
  }

  const onGround = raycaster.intersectObject(ground, false)[0]
  if (!onGround || !selectedId.value) return
  const selected = props.tokens.find((t) => t.id === selectedId.value)
  if (!selected || !canMove(selected)) return
  // Position libre : on pose exactement là où le doigt a touché.
  const x = THREE.MathUtils.clamp(onGround.point.x, -half(), half())
  const z = THREE.MathUtils.clamp(onGround.point.z, -half(), half())
  emit('move', selectedId.value, x, z)
}

/** Rotation par quarts de tour : impossible de se perdre. */
function rotate(dir: 1 | -1) {
  yawGoal += (dir * Math.PI) / 2
  requestRender()
}

function recenter() {
  camTarget.set(0, 0, 0)
  frustum = 12.5
  updateCamera()
  requestRender()
}

/**
 * Rendu à la demande.
 *
 * Une boucle 60 fps permanente fait chauffer six téléphones pendant deux heures,
 * et un téléphone qui chauffe finit par throttler — c'est là que TOUT devient
 * saccadé. On ne dessine donc que s'il se passe quelque chose, et la pulsation
 * de l'anneau, qui elle tourne en continu, se contente de 15 images/seconde.
 */
const PULSE_FPS = 15
let running = false
let dirty = true
let pulseAccumulator = 0

/** Réveille la boucle. À appeler dès qu'on change quoi que ce soit de visible. */
function requestRender() {
  dirty = true
  if (!running) {
    running = true
    clock.getDelta() // purge le temps écoulé pendant la sieste
    raf = requestAnimationFrame(frame)
  }
}

/** Y a-t-il un pion en train de glisser, ou la caméra en train de tourner ? */
function isAnimating(): boolean {
  if (Math.abs(yawGoal - yaw) > 1e-4) return true
  for (const v of views.values()) if (v.t < 1) return true
  return false
}

/** Un anneau visible pulse, donc il faut continuer à dessiner — mais doucement. */
function hasPulse(): boolean {
  return !!props.activeId && views.has(props.activeId)
}

/**
 * Le composant reste monté quand on quitte l'onglet Carte (sinon la scène se
 * reconstruit à chaque passage). Mais un `display: none` ne suspend pas la
 * boucle : sans ce garde, l'anneau doré continuerait de pulser à 15 fps
 * derrière la timeline, pendant tout le combat.
 */
function isVisible(): boolean {
  const el = container.value
  return !!el && el.clientWidth > 0 && el.clientHeight > 0
}

function frame() {
  const dt = clock.getDelta()
  const time = clock.elapsedTime
  const animating = isAnimating()

  // Onglet caché, ou rien ne bouge et rien ne pulse : on s'arrête pour de bon.
  // Le ResizeObserver rallume la boucle au retour sur la carte.
  if (!isVisible() || (!animating && !dirty && !hasPulse())) {
    running = false
    return
  }

  raf = requestAnimationFrame(frame)

  // Pulsation seule : on lève le pied à 15 fps.
  if (!animating && !dirty) {
    pulseAccumulator += dt
    if (pulseAccumulator < 1 / PULSE_FPS) return
    pulseAccumulator = 0
  } else {
    pulseAccumulator = 0
  }

  if (Math.abs(yawGoal - yaw) > 1e-4) {
    yaw += (yawGoal - yaw) * Math.min(1, dt * 8)
    updateCamera()
  }

  for (const [id, v] of views) {
    if (v.t < 1) {
      v.t = Math.min(1, v.t + dt / 0.35)
      const e = 1 - Math.pow(1 - v.t, 3) // easeOutCubic
      v.group.position.lerpVectors(v.from, v.to, e)
      // Petit saut : le pion se soulève puis se repose.
      v.group.position.y = Math.sin(e * Math.PI) * 0.25
    }
    const mat = v.ring.material as THREE.MeshBasicMaterial
    if (props.activeId === id) {
      mat.color.set(0xf0c060)
      mat.opacity = 0.55 + Math.sin(time * 3) * 0.3
    } else if (selectedId.value === id) {
      mat.color.set(0xffffff)
      mat.opacity = 0.85
    } else {
      mat.opacity = 0
    }
  }

  dirty = false
  renderer.render(scene, camera)
}

onMounted(() => {
  const el = container.value
  if (!el) return
  scene = new THREE.Scene()

  const n = gridSize()
  ground.geometry.dispose()
  ground.geometry = new THREE.PlaneGeometry(n, n)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  scene.add(decorGroup)

  // Une chaude en haut, une froide ambiante. Deux lumières suffisent.
  keyLight = new THREE.DirectionalLight(0xffffff, 1)
  keyLight.position.set(4, 10, 6)
  ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(keyLight, ambientLight)

  applyEnvironment()

  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  el.appendChild(renderer.domElement)

  resize()
  syncTokens()

  observer = new ResizeObserver(resize)
  observer.observe(el)
  clock.start()
  requestRender()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  running = false
  observer?.disconnect()
  if (scene) disposeObject(scene)
  shadowTex.dispose()
  views.clear()
  renderer?.dispose()
})

watch(() => props.tokens, syncTokens, { deep: true })
watch(() => props.activeId, () => requestRender())
watch(() => props.environment, () => scene && applyEnvironment())
watch(() => props.showGrid, () => scene && refreshGround())

// Le MJ redevient joueur : les PV des monstres disparaissent, et il lâche
// le monstre qu'il tenait.
watch(
  () => props.isGm,
  () => {
    if (scene) syncTokens()
    const selected = props.tokens.find((t) => t.id === selectedId.value)
    if (selected && !canMove(selected)) {
      selectedId.value = null
      emit('select', null)
    }
  },
)

defineExpose({
  rotate,
  recenter,
  deselect: () => {
    selectedId.value = null
    requestRender()
  },
})
</script>

<template>
  <div
    ref="container"
    class="battle-grid"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  />
</template>

<style scoped>
.battle-grid {
  width: 100%;
  height: 100%;
  touch-action: none;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}
.battle-grid :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
