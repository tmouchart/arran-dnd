import * as THREE from 'three'

/**
 * Les décors du champ de bataille.
 *
 * Chaque décor tient en trois morceaux : la peinture du sol (dessinée au canvas,
 * donc aucun fichier à télécharger), la lumière, et quelques objets 3D posés
 * *autour* de la grille — jamais dessus, pour ne pas gêner les pions.
 */
export interface BattleEnvironment {
  id: string
  name: string
  emoji: string
  /** Couleur du ciel / fond de scène. */
  sky: string
  light: {
    key: number
    keyIntensity: number
    ambient: number
    ambientIntensity: number
  }
  /** Peint le sol. `px` = pixels par case, `w` = largeur totale du canvas. */
  paint: (ctx: CanvasRenderingContext2D, px: number, w: number, rng: () => number) => void
  /** Objets posés autour de la grille. `half` = demi-côté de la grille, en cases. */
  decor?: (half: number, rng: () => number) => THREE.Object3D[]
}

/* ------------------------------------------------------------------ */
/* Aléatoire reproductible : le décor doit être identique pour tous.   */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rngFor(id: string): () => number {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return mulberry32(h)
}

/* ------------------------------------------------------------------ */
/* Pinceaux : de quoi peindre un sol crédible en quelques lignes.      */
/* ------------------------------------------------------------------ */

function fill(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, w)
}

/** Taches douces : c'est ce qui évite l'aplat de couleur mort. */
function splatter(
  ctx: CanvasRenderingContext2D,
  w: number,
  rng: () => number,
  colors: string[],
  count: number,
  rMin: number,
  rMax: number,
  alpha = 0.25,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  for (let i = 0; i < count; i++) {
    const r = rMin + rng() * (rMax - rMin)
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)]
    ctx.beginPath()
    ctx.ellipse(rng() * w, rng() * w, r, r * (0.6 + rng() * 0.8), rng() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Lattes de parquet ou planches de pont, avec joints décalés. */
function planks(
  ctx: CanvasRenderingContext2D,
  w: number,
  px: number,
  rng: () => number,
  tones: string[],
  seam: string,
) {
  const h = px * 0.55
  for (let y = 0; y < w; y += h) {
    let x = -rng() * px * 2
    while (x < w) {
      const len = px * (1.5 + rng() * 2.5)
      ctx.fillStyle = tones[Math.floor(rng() * tones.length)]
      ctx.fillRect(x, y, len, h)
      ctx.strokeStyle = seam
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, len, h)
      x += len
    }
  }
}

/** Dallage : des pierres irrégulières séparées par un joint. */
function flagstones(
  ctx: CanvasRenderingContext2D,
  w: number,
  px: number,
  rng: () => number,
  tones: string[],
  joint: string,
) {
  const s = px * 0.75
  fill(ctx, w, joint)
  for (let y = 0; y < w; y += s) {
    const offset = (y / s) % 2 === 0 ? 0 : s / 2
    for (let x = -s; x < w; x += s) {
      const m = 3 + rng() * 3
      ctx.fillStyle = tones[Math.floor(rng() * tones.length)]
      ctx.fillRect(x + offset + m, y + m, s - m * 2, s - m * 2)
    }
  }
}

/** Fissures / racines / rides de sable : des traits fins qui cassent la régularité. */
function scratches(
  ctx: CanvasRenderingContext2D,
  w: number,
  rng: () => number,
  color: string,
  count: number,
  width = 2,
  curve = 0.4,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  for (let i = 0; i < count; i++) {
    let x = rng() * w
    let y = rng() * w
    let a = rng() * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let s = 0; s < 6; s++) {
      a += (rng() - 0.5) * curve
      x += Math.cos(a) * w * 0.03
      y += Math.sin(a) * w * 0.03
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* Objets de décor. Que des primitives : rien à charger.               */
/* ------------------------------------------------------------------ */

function mat(color: number, flat = false, emissive = 0) {
  return new THREE.MeshLambertMaterial({ color, flatShading: flat, emissive })
}

/** Les objets hauts se cachent quand ils passent devant la caméra. */
function tall(o: THREE.Object3D): THREE.Object3D {
  o.userData.cullNear = true
  return o
}

function tree(x: number, z: number, s: number, trunk: number, leaf: number, rng: () => number) {
  const g = new THREE.Group()
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.15 * s, 1 * s, 7), mat(trunk))
  t.position.y = 0.5 * s
  const a = new THREE.Mesh(new THREE.ConeGeometry(0.62 * s, 1.3 * s, 8), mat(leaf, true))
  a.position.y = 1.35 * s
  const b = new THREE.Mesh(new THREE.ConeGeometry(0.45 * s, 1 * s, 8), mat(leaf, true))
  b.position.y = 2 * s
  g.add(t, a, b)
  g.position.set(x, 0, z)
  g.rotation.y = rng() * Math.PI
  return tall(g)
}

function deadTree(x: number, z: number, s: number, color: number, rng: () => number) {
  const g = new THREE.Group()
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.14 * s, 1.6 * s, 6), mat(color))
  t.position.y = 0.8 * s
  g.add(t)
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.05 * s, 0.8 * s, 5), mat(color))
    b.position.set(0, 1.3 * s, 0)
    b.rotation.z = (rng() - 0.5) * 1.6
    b.rotation.x = (rng() - 0.5) * 1.6
    g.add(b)
  }
  g.position.set(x, 0, z)
  return tall(g)
}

function rock(x: number, z: number, s: number, color: number, rng: () => number) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat(color, true))
  m.position.set(x, s * 0.45, z)
  m.rotation.set(rng() * 3, rng() * 3, rng() * 3)
  m.scale.y = 0.7
  return m
}

function pillar(x: number, z: number, h: number, color: number) {
  const g = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, h, 12), mat(color))
  shaft.position.y = h / 2
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), mat(color))
  base.position.y = 0.11
  g.add(shaft, base)
  g.position.set(x, 0, z)
  return tall(g)
}

/** Un muret bas : ça dessine une pièce sans cacher les pions. */
function wall(half: number, side: number, h: number, color: number) {
  const len = half * 2 + 1.4
  const g = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.35), mat(color))
  const d = half + 0.5
  const angle = (side * Math.PI) / 2
  g.position.set(Math.sin(angle) * d, h / 2, Math.cos(angle) * d)
  g.rotation.y = angle
  return g
}

function barrel(x: number, z: number, color: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.62, 12), mat(color))
  m.position.set(x, 0.31, z)
  return m
}

function crystal(x: number, z: number, s: number, color: number) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 1.2 * s, 5), mat(color, true, color))
  m.position.set(x, 0.6 * s, z)
  m.rotation.z = (Math.random() - 0.5) * 0.3
  return tall(m)
}

/** Feu : une flamme lumineuse plus une vraie lumière ponctuelle. */
function fire(x: number, z: number, s: number, color = 0xff8a30) {
  const g = new THREE.Group()
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 0.6 * s, 7), mat(color, true, color))
  flame.position.y = 0.45 * s
  const light = new THREE.PointLight(color, 8 * s, 9 * s)
  light.position.y = 0.7 * s
  g.add(flame, light)
  g.position.set(x, 0, z)
  return g
}

function slab(x: number, z: number, w: number, h: number, d: number, color: number, rot = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
  m.position.set(x, h / 2, z)
  m.rotation.y = rot
  return m
}

/** Grand plan posé sous la grille : mer, sable à perte de vue, brume… */
function surround(color: number, y = -0.06) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat(color))
  m.rotation.x = -Math.PI / 2
  m.position.y = y
  return m
}

/** Sème des objets dans l'anneau autour de la grille, jamais dedans. */
function around(
  count: number,
  half: number,
  rng: () => number,
  make: (x: number, z: number, rng: () => number) => THREE.Object3D,
): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng() * 0.5
    const d = half + 1 + rng() * 3.5
    out.push(make(Math.cos(a) * d, Math.sin(a) * d, rng))
  }
  return out
}

/** Les 4 murets d'une pièce fermée. */
function room(half: number, h: number, color: number): THREE.Object3D[] {
  return [0, 1, 2, 3].map((s) => wall(half, s, h, color))
}

/* ------------------------------------------------------------------ */
/* Les décors                                                          */
/* ------------------------------------------------------------------ */

export const ENVIRONMENTS: BattleEnvironment[] = [
  {
    id: 'foret',
    name: 'Forêt profonde',
    emoji: '🌲',
    sky: '#16221a',
    light: { key: 0xdff0c0, keyIntensity: 1.0, ambient: 0x4a7a55, ambientIntensity: 0.8 },
    paint: (ctx, px, w, rng) => {
      fill(ctx, w, '#3d5535')
      splatter(ctx, w, rng, ['#4a6640', '#33472d', '#5b7a48'], 220, px * 0.2, px * 0.9, 0.35)
      splatter(ctx, w, rng, ['#6b8c4a', '#2b3a24'], 400, 3, px * 0.12, 0.5)
      scratches(ctx, w, rng, '#2a3a22', 60, 3)
    },
    decor: (half, rng) => [
      surround(0x2f4a2c),
      ...around(16, half, rng, (x, z, r) => tree(x, z, 0.9 + r() * 0.6, 0x4a3524, 0x3f6b34, r)),
      ...around(10, half, rng, (x, z, r) => rock(x, z, 0.3 + r() * 0.3, 0x5a5a4e, r)),
    ],
  },
  {
    id: 'taverne',
    name: 'Salle de taverne',
    emoji: '🍺',
    sky: '#1c150e',
    light: { key: 0xffd9a0, keyIntensity: 0.9, ambient: 0x6b4527, ambientIntensity: 0.9 },
    paint: (ctx, px, w, rng) => {
      fill(ctx, w, '#7a5330')
      planks(ctx, w, px, rng, ['#8a5f38', '#7a5330', '#6d492c', '#946a3e'], '#4e3320')
      splatter(ctx, w, rng, ['#5c3d22', '#a07a4a'], 120, 4, px * 0.25, 0.18)
    },
    decor: (half, rng) => [
      ...room(half, 1.1, 0x6b4a2c),
      ...around(7, half, rng, (x, z) => barrel(x, z, 0x7a5330)),
      fire(-half - 1.6, -half - 1.6, 1.2),
      fire(half + 1.6, half + 1.6, 0.8),
    ],
  },
  {
    id: 'chateau',
    name: 'Grande salle',
    emoji: '🏰',
    sky: '#1a1a22',
    light: { key: 0xfff0d8, keyIntensity: 1.0, ambient: 0x6470a0, ambientIntensity: 0.7 },
    paint: (ctx, px, w, rng) => {
      flagstones(ctx, w, px, rng, ['#9a968e', '#8e8a82', '#a5a199', '#847f78'], '#5f5b55')
      // Le tapis rouge : deux bandes croisées au centre de la salle.
      ctx.fillStyle = '#8c2f34'
      ctx.fillRect(w * 0.38, 0, w * 0.24, w)
      ctx.fillStyle = '#a03a40'
      ctx.fillRect(w * 0.4, 0, w * 0.2, w)
      splatter(ctx, w, rng, ['#ffffff', '#000000'], 90, 4, px * 0.3, 0.06)
    },
    decor: (half, rng) => [
      ...room(half, 1.3, 0x77737c),
      ...around(8, half, rng, (x, z) => pillar(x, z, 2.6, 0x8e8a82)),
      fire(-half - 2, 0, 1),
      fire(half + 2, 0, 1),
    ],
  },
  {
    id: 'donjon',
    name: 'Donjon souterrain',
    emoji: '🕯️',
    sky: '#0d0d10',
    light: { key: 0xffb870, keyIntensity: 0.55, ambient: 0x3a4058, ambientIntensity: 0.6 },
    paint: (ctx, px, w, rng) => {
      flagstones(ctx, w, px, rng, ['#4e4c50', '#464448', '#565459', '#3e3c40'], '#292830')
      splatter(ctx, w, rng, ['#2a3a2a', '#1e2028'], 140, 5, px * 0.35, 0.3)
      scratches(ctx, w, rng, '#26252c', 70, 2)
    },
    decor: (half, rng) => [
      ...room(half, 1.5, 0x45434a),
      ...around(6, half, rng, (x, z, r) => rock(x, z, 0.3 + r() * 0.25, 0x3c3a40, r)),
      fire(-half - 1.2, -half - 1.2, 0.9),
      fire(half + 1.2, half + 1.2, 0.9),
      fire(-half - 1.2, half + 1.2, 0.9),
    ],
  },
  {
    id: 'grotte',
    name: 'Grotte de crystaux',
    emoji: '💎',
    sky: '#0e0a18',
    light: { key: 0xc9b8ff, keyIntensity: 0.5, ambient: 0x6a4fb0, ambientIntensity: 0.9 },
    paint: (ctx, px, w, rng) => {
      fill(ctx, w, '#2b2338')
      splatter(ctx, w, rng, ['#372c48', '#241d30', '#453a5c'], 180, px * 0.2, px * 0.8, 0.4)
      splatter(ctx, w, rng, ['#7a5fc9', '#4a3a70'], 120, 3, px * 0.12, 0.35)
      scratches(ctx, w, rng, '#8f6ee0', 40, 2)
    },
    decor: (half, rng) => [
      surround(0x1d1728),
      ...around(18, half, rng, (x, z, r) => crystal(x, z, 0.6 + r() * 1.1, 0x9a6cff)),
      ...around(9, half, rng, (x, z, r) => rock(x, z, 0.4 + r() * 0.5, 0x332a44, r)),
    ],
  },
  {
    id: 'desert',
    name: 'Dunes brûlantes',
    emoji: '🏜️',
    sky: '#e8c98a',
    light: { key: 0xfff4d0, keyIntensity: 1.35, ambient: 0xd9b070, ambientIntensity: 0.7 },
    paint: (ctx, px, w, rng) => {
      fill(ctx, w, '#dcc188')
      splatter(ctx, w, rng, ['#e6cd96', '#cfb178', '#f0dba8'], 200, px * 0.3, px * 1.2, 0.3)
      scratches(ctx, w, rng, '#c8ac74', 90, 4, 0.15)
    },
    decor: (half, rng) => [
      surround(0xd6bb84),
      ...around(12, half, rng, (x, z, r) => rock(x, z, 0.3 + r() * 0.6, 0xb59a68, r)),
      ...around(4, half, rng, (x, z, r) => deadTree(x, z, 0.8, 0xa8895c, r)),
    ],
  },
  {
    id: 'marais',
    name: 'Marais de brume',
    emoji: '🐸',
    sky: '#1e2a24',
    light: { key: 0xc8e0c0, keyIntensity: 0.7, ambient: 0x4f7a68, ambientIntensity: 0.9 },
    paint: (ctx, px, w, rng) => {
      fill(ctx, w, '#4a4a38')
      splatter(ctx, w, rng, ['#3e4630', '#585240', '#2f3a2c'], 200, px * 0.25, px * 1, 0.4)
      // Flaques : plus claires, avec un liseré.
      ctx.save()
      for (let i = 0; i < 18; i++) {
        const r = px * (0.3 + rng() * 0.7)
        const x = rng() * w
        const y = rng() * w
        ctx.globalAlpha = 0.6
        ctx.fillStyle = '#3c5a52'
        ctx.beginPath()
        ctx.ellipse(x, y, r, r * 0.7, rng() * 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 0.35
        ctx.strokeStyle = '#6f9a8c'
        ctx.lineWidth = 3
        ctx.stroke()
      }
      ctx.restore()
    },
    decor: (half, rng) => [
      surround(0x3b4a40),
      ...around(12, half, rng, (x, z, r) => deadTree(x, z, 1 + r() * 0.6, 0x4a4232, r)),
      ...around(8, half, rng, (x, z, r) => rock(x, z, 0.25 + r() * 0.3, 0x4a5248, r)),
    ],
  },
  {
    id: 'toundra',
    name: 'Neiges du Nord',
    emoji: '❄️',
    sky: '#c6d6e4',
    light: { key: 0xf0f6ff, keyIntensity: 1.2, ambient: 0x8aa8d0, ambientIntensity: 0.85 },
    paint: (ctx, px, w, rng) => {
      fill(ctx, w, '#e8eef5')
      splatter(ctx, w, rng, ['#ffffff', '#d6e0ea', '#c4d2e0'], 180, px * 0.3, px * 1.1, 0.4)
      scratches(ctx, w, rng, '#b9c8d8', 50, 3)
    },
    decor: (half, rng) => [
      surround(0xdde6ef),
      ...around(14, half, rng, (x, z, r) => tree(x, z, 0.9 + r() * 0.5, 0x5a4a3a, 0xa8c4cc, r)),
      ...around(8, half, rng, (x, z, r) => rock(x, z, 0.3 + r() * 0.4, 0xc2ccd6, r)),
    ],
  },
  {
    id: 'navire',
    name: 'Pont du navire',
    emoji: '⚓',
    sky: '#2a4a68',
    light: { key: 0xfff0d0, keyIntensity: 1.15, ambient: 0x5a8ab0, ambientIntensity: 0.8 },
    paint: (ctx, px, w, rng) => {
      fill(ctx, w, '#8a6238')
      planks(ctx, w, px, rng, ['#9a7044', '#8a6238', '#7d5730'], '#5a3d22')
      splatter(ctx, w, rng, ['#6a4a2a', '#b08a58'], 100, 4, px * 0.2, 0.15)
    },
    decor: (half, rng) => [
      surround(0x2a5a80, -0.5),
      ...room(half, 0.75, 0x7d5730),
      ...around(6, half, rng, (x, z) => barrel(x, z, 0x6d4a28)),
    ],
  },
  {
    id: 'ruines',
    name: 'Temple en ruines',
    emoji: '🏛️',
    sky: '#2a2e28',
    light: { key: 0xfff0cc, keyIntensity: 1.05, ambient: 0x6a8070, ambientIntensity: 0.8 },
    paint: (ctx, px, w, rng) => {
      flagstones(ctx, w, px, rng, ['#a8a294', '#9a9486', '#b0aa9c', '#8e887a'], '#5f5a4e')
      splatter(ctx, w, rng, ['#4a6a3a', '#3f5c30'], 160, 4, px * 0.3, 0.35)
      scratches(ctx, w, rng, '#6a6456', 80, 3)
    },
    decor: (half, rng) => [
      surround(0x4a5a44),
      ...around(7, half, rng, (x, z, r) => pillar(x, z, 1.2 + r() * 2, 0xa8a294)),
      ...around(10, half, rng, (x, z, r) => rock(x, z, 0.3 + r() * 0.4, 0x9a9486, r)),
      ...around(6, half, rng, (x, z, r) => tree(x, z, 0.7 + r() * 0.4, 0x4a3a28, 0x4a6a38, r)),
    ],
  },
  {
    id: 'campement',
    name: 'Campement sur la route',
    emoji: '🔥',
    sky: '#1c1c26',
    light: { key: 0x9ab0d8, keyIntensity: 0.45, ambient: 0x4a4a68, ambientIntensity: 0.7 },
    paint: (ctx, px, w, rng) => {
      fill(ctx, w, '#6a5a42')
      splatter(ctx, w, rng, ['#7a6a4e', '#5c4e38', '#8a7a5a'], 200, px * 0.25, px * 1, 0.35)
      scratches(ctx, w, rng, '#4e4230', 70, 3)
    },
    decor: (half, rng) => [
      surround(0x4a4230),
      fire(0, 0, 1.4),
      ...around(5, half, rng, (x, z, r) => slab(x, z, 1.6, 1.1, 1.6, 0xb0a088, r() * 3)),
      ...around(9, half, rng, (x, z, r) => rock(x, z, 0.25 + r() * 0.3, 0x6a6252, r)),
    ],
  },
  {
    id: 'cimetiere',
    name: 'Cimetière brumeux',
    emoji: '🪦',
    sky: '#16181f',
    light: { key: 0xb0c0e8, keyIntensity: 0.6, ambient: 0x50607a, ambientIntensity: 0.85 },
    paint: (ctx, px, w, rng) => {
      fill(ctx, w, '#3e4238')
      splatter(ctx, w, rng, ['#4a4e42', '#33372e', '#585c4c'], 200, px * 0.25, px * 1, 0.4)
      splatter(ctx, w, rng, ['#8a9a8a'], 80, 3, px * 0.1, 0.15)
    },
    decor: (half, rng) => [
      surround(0x33372e),
      ...around(14, half, rng, (x, z, r) => slab(x, z, 0.5, 0.9, 0.16, 0x8a8e88, (r() - 0.5) * 0.6)),
      ...around(5, half, rng, (x, z, r) => deadTree(x, z, 1.1, 0x3a3630, r)),
    ],
  },
]

export const DEFAULT_ENVIRONMENT = ENVIRONMENTS[0].id

export function findEnvironment(id: string | undefined): BattleEnvironment {
  return ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0]
}
