import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildFaces, buildDieGeometry, faceFitRatio, SUPPORTED_SIDES } from './polyhedra'
import { fontSizeFor, gradientLine } from './atlas'
import { landingLayout, planDice, remoteSlotLayout, viewerLayout, MAX_REMOTE_DICE, REMOTE_SCALE, REMOTE_SLOTS, VIEWER_SCALE } from './plan'
import { burstOpacity, createSparks, flashIntensity, sampleSpark, shockwave } from './burst'
import { createMotion, faceTargetQuaternion, sampleMotion } from './motion'

describe('buildFaces', () => {
  it.each(SUPPORTED_SIDES)('le d%i a autant de faces que de valeurs', (sides) => {
    const faces = buildFaces(sides)
    expect(faces).toHaveLength(sides)

    const values = faces.map((f) => f.faceIndex).sort((a, b) => a - b)
    expect(values).toEqual(Array.from({ length: sides }, (_, i) => i))
  })

  it.each(SUPPORTED_SIDES)('les sommets du d%i tiennent sur un rayon de 1', (sides) => {
    for (const face of buildFaces(sides)) {
      for (const corner of face.corners) {
        expect(corner.length()).toBeLessThanOrEqual(1 + 1e-6)
      }
    }
  })

  it.each(SUPPORTED_SIDES)('les normales du d%i sortent bien du solide', (sides) => {
    for (const face of buildFaces(sides)) {
      const centroid = face.corners
        .reduce((acc, v) => acc.add(v), new THREE.Vector3())
        .divideScalar(face.corners.length)
      expect(face.normal.dot(centroid)).toBeGreaterThan(0)
    }
  })

  // Un vrai dé a 1 en face de 6, 2 en face de 5… Le d4 n'a pas de faces
  // opposées, il est exclu.
  it.each([6, 8, 10, 12, 20])('les faces opposées du d%i totalisent N+1', (sides) => {
    const faces = buildFaces(sides)
    for (const face of faces) {
      const opposite = faces.find((f) => f.normal.dot(face.normal) < -0.999)
      expect(opposite).toBeDefined()
      expect(face.faceIndex + 1 + (opposite!.faceIndex + 1)).toBe(sides + 1)
    }
  })

  it('le d10 est un trapézoèdre : 10 cerfs-volants à 4 sommets', () => {
    const faces = buildFaces(10)
    expect(faces).toHaveLength(10)
    for (const face of faces) expect(face.corners).toHaveLength(4)
  })

  it('le d12 est fait de pentagones', () => {
    for (const face of buildFaces(12)) expect(face.corners).toHaveLength(5)
  })
})

describe('faceFitRatio', () => {
  // Le rapport rayon inscrit / rayon circonscrit d'un polygone régulier vaut
  // cos(π/n). C'est lui qui empêche le chiffre de déborder sur la face voisine.
  it.each([
    [4, 0.5],
    [8, 0.5],
    [20, 0.5],
    [6, Math.cos(Math.PI / 4)],
    [12, Math.cos(Math.PI / 5)],
  ])('le d%i laisse %f de sa face au chiffre', (sides, expected) => {
    expect(faceFitRatio(buildFaces(sides))).toBeCloseTo(expected, 3)
  })

  it('le cerf-volant du d10 est plus étroit qu’un polygone régulier', () => {
    const ratio = faceFitRatio(buildFaces(10))
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThan(0.5)
  })
})

describe('fontSizeFor', () => {
  it('rétrécit le chiffre quand la face est étroite', () => {
    expect(fontSizeFor('7', 0.25)).toBeLessThan(fontSizeFor('7', 0.8))
  })

  it('rétrécit les libellés longs à face égale', () => {
    expect(fontSizeFor('20', 0.5)).toBeLessThan(fontSizeFor('7', 0.5))
    expect(fontSizeFor('100', 0.5)).toBeLessThan(fontSizeFor('20', 0.5))
  })
})

describe('buildDieGeometry', () => {
  it.each(SUPPORTED_SIDES)('le d%i produit une géométrie complète', (sides) => {
    const faces = buildFaces(sides)
    const geometry = buildDieGeometry(faces, 5, 4)
    const position = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')

    expect(position.count).toBeGreaterThan(0)
    expect(position.count % 3).toBe(0)
    expect(uv.count).toBe(position.count)
    // Les UV pointent dans l'atlas, donc restent dans [0, 1]
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getX(i)).toBeLessThanOrEqual(1)
      expect(uv.getY(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getY(i)).toBeLessThanOrEqual(1)
    }
  })
})

describe('planDice', () => {
  it('un dé par valeur', () => {
    expect(planDice([{ sides: 20, value: 14 }])).toEqual([
      { sides: 20, kind: 'normal', faceIndex: 13, outcome: null, dropped: false },
    ])
  })

  it('accepte des dés de tailles différentes (combat à deux armes)', () => {
    const dice = planDice([
      { sides: 20, value: 7 },
      { sides: 12, value: 3 },
    ])
    expect(dice.map((d) => d.sides)).toEqual([20, 12])
  })

  // Le d100 se joue comme à table : un dé de dizaines et un dé d'unités
  it.each([
    [1, 0, 0],
    [57, 5, 6],
    [100, 9, 9],
    [10, 0, 9],
  ])('le d100 sur %i donne les dizaines %i et les unités %i', (value, tens, units) => {
    expect(planDice([{ sides: 100, value }])).toEqual([
      { sides: 10, kind: 'tens', faceIndex: tens, outcome: null, dropped: false },
      { sides: 10, kind: 'normal', faceIndex: units, outcome: null, dropped: false },
    ])
  })

  it('ignore les dés qu’on ne sait pas dessiner', () => {
    expect(planDice([{ sides: 7, value: 3 }])).toEqual([])
  })

  it('plafonne le nombre de dés à l’écran', () => {
    const many = Array.from({ length: 30 }, () => ({ sides: 6, value: 3 }))
    expect(planDice(many)).toHaveLength(10)
  })
})

describe('planDice — critiques et échecs', () => {
  it('marque un 20 et un 1 sur le d20', () => {
    expect(planDice([{ sides: 20, value: 20 }])[0].outcome).toBe('critical')
    expect(planDice([{ sides: 20, value: 1 }])[0].outcome).toBe('fumble')
  })

  it('marque aussi un d20 lancé librement', () => {
    expect(planDice([{ sides: 20, value: 20, kind: 'libre' }])[0].outcome).toBe('critical')
    expect(planDice([{ sides: 20, value: 1, kind: 'libre' }])[0].outcome).toBe('fumble')
  })

  it('ne marque jamais les petits dés, même au max', () => {
    for (const sides of [4, 6, 8, 10]) {
      expect(planDice([{ sides, value: sides }])[0].outcome).toBeNull()
      expect(planDice([{ sides, value: 1 }])[0].outcome).toBeNull()
    }
  })

  it('le d12 ne compte qu’en jet d’attaque (affaibli)', () => {
    expect(planDice([{ sides: 12, value: 12 }])[0].outcome).toBe('critical')
    expect(planDice([{ sides: 12, value: 12, kind: 'libre' }])[0].outcome).toBeNull()
  })

  it('le d100 ne critique pas', () => {
    expect(planDice([{ sides: 100, value: 100 }]).every((d) => d.outcome === null)).toBe(true)
  })

  it('un dé écarté ne marque rien, ni son 20 ni son 1', () => {
    expect(planDice([{ sides: 20, value: 20, dropped: true }])[0].outcome).toBeNull()
    expect(planDice([{ sides: 20, value: 1, dropped: true }])[0].outcome).toBeNull()
  })

  it('le drapeau « écarté » suit le dé jusqu’à l’écran', () => {
    const dice = planDice([
      { sides: 20, value: 17 },
      { sides: 20, value: 4, dropped: true },
    ])
    expect(dice.map((d) => d.dropped)).toEqual([false, true])
  })

  it('les deux dés d’un d100 écarté le sont tous les deux', () => {
    expect(planDice([{ sides: 100, value: 42, dropped: true }]).map((d) => d.dropped)).toEqual([true, true])
  })

  it('le dé gardé du même jet marque toujours', () => {
    const dice = planDice([
      { sides: 20, value: 20 },
      { sides: 20, value: 1, dropped: true },
    ])
    expect(dice[0].outcome).toBe('critical')
    expect(dice[1].outcome).toBeNull()
  })
})

describe('effets de critique et d’échec', () => {
  it('les étincelles partent du dé et retombent', () => {
    const sparks = createSparks(20)
    expect(sparks).toHaveLength(20)
    for (const spark of sparks) {
      const start = sampleSpark(spark, 0)
      expect(start.x).toBeCloseTo(0, 6)
      expect(start.y).toBeCloseTo(0, 6)
      // La gerbe monte d'abord…
      expect(sampleSpark(spark, 0.15).y).toBeGreaterThan(0)
      // …puis la gravité l'emporte
      expect(sampleSpark(spark, 1).y).toBeLessThan(sampleSpark(spark, 0.5).y)
    }
  })

  it('la gerbe s’éteint complètement', () => {
    expect(burstOpacity(0)).toBe(1)
    expect(burstOpacity(1)).toBe(0)
    expect(burstOpacity(0.5)).toBeLessThan(burstOpacity(0.2))
  })

  it('l’onde s’écarte et s’efface', () => {
    expect(shockwave(1).scale).toBeGreaterThan(shockwave(0).scale)
    expect(shockwave(1).opacity).toBe(0)
    expect(shockwave(0).opacity).toBeGreaterThan(0)
  })

  it('l’éclat monte d’un coup puis retombe', () => {
    expect(flashIntensity(0)).toBe(0)
    expect(flashIntensity(1)).toBe(0)
    // Le pic est atteint très tôt : c'est un impact, pas une lueur
    expect(flashIntensity(0.14)).toBeCloseTo(1, 5)
    expect(flashIntensity(0.07)).toBeGreaterThan(flashIntensity(0.6))
  })

  it('borne le temps en dehors de [0, 1]', () => {
    expect(burstOpacity(2)).toBe(0)
    expect(flashIntensity(-1)).toBe(0)
    expect(shockwave(2).opacity).toBe(0)
  })
})

describe('landingLayout', () => {
  it('centre un dé seul', () => {
    const { positions } = landingLayout(1)
    expect(positions).toHaveLength(1)
    expect(positions[0].x).toBeCloseTo(0, 6)
    expect(positions[0].y).toBeCloseTo(0, 6)
  })

  it('centre la rangée et rétrécit les dés quand il y en a beaucoup', () => {
    const few = landingLayout(3)
    const many = landingLayout(9)
    expect(many.scale).toBeLessThan(few.scale)

    const sumX = few.positions.reduce((acc, p) => acc + p.x, 0)
    expect(sumX).toBeCloseTo(0, 6)
  })

  it('passe à la ligne au-delà de 5 dés', () => {
    const rows = new Set(landingLayout(8).positions.map((p) => p.y.toFixed(4)))
    expect(rows.size).toBe(2)
  })
})

describe('sampleMotion', () => {
  const options = {
    halfWidth: 4,
    halfHeight: 6,
    landing: new THREE.Vector3(0, 0, 0),
    target: new THREE.Quaternion(),
  }

  // L'invariant qui porte toute la feature : le code décide, le dé obéit.
  it.each(SUPPORTED_SIDES)('le d%i se pose exactement sur la face voulue', (sides) => {
    const faces = buildFaces(sides)
    for (const face of faces) {
      const target = faceTargetQuaternion(face.normal)
      const motion = createMotion({ ...options, target })
      const { quaternion } = sampleMotion(motion, 1)

      const shown = face.normal.clone().applyQuaternion(quaternion)
      expect(shown.x).toBeCloseTo(0, 5)
      expect(shown.y).toBeCloseTo(0, 5)
      expect(shown.z).toBeCloseTo(1, 5)
    }
  })

  it('part du bord et arrive au point d’atterrissage', () => {
    const motion = createMotion(options)
    expect(sampleMotion(motion, 0).position.distanceTo(motion.from)).toBeCloseTo(0, 5)
    expect(sampleMotion(motion, 1).position.distanceTo(motion.to)).toBeCloseTo(0, 5)
  })

  it('ne montre pas déjà le résultat au départ', () => {
    const motion = createMotion(options)
    const start = sampleMotion(motion, 0).quaternion
    expect(Math.abs(start.dot(motion.target))).toBeLessThan(0.999)
  })

  // Deux lancers du même résultat doivent être visuellement différents
  it('tire une trajectoire différente à chaque lancer', () => {
    const a = createMotion(options)
    const b = createMotion(options)
    expect(a.spinAngle).not.toBe(b.spinAngle)
    expect(a.duration).not.toBe(b.duration)
  })

  it('borne le temps en dehors de [0, 1]', () => {
    const motion = createMotion(options)
    expect(sampleMotion(motion, 2).position.distanceTo(motion.to)).toBeCloseTo(0, 5)
    expect(sampleMotion(motion, -1).position.distanceTo(motion.from)).toBeCloseTo(0, 5)
  })
})

describe('remoteSlotLayout', () => {
  const halfWidth = 4
  const halfHeight = 8

  it('les 4 emplacements se répartissent sur la largeur, en haut', () => {
    const xs = Array.from({ length: 4 }, (_, slot) => remoteSlotLayout(slot, 1, halfWidth, halfHeight).positions[0].x)
    expect(xs).toEqual([-3, -1, 1, 3])
    for (const slot of [0, 1, 2, 3]) {
      expect(remoteSlotLayout(slot, 1, halfWidth, halfHeight).positions[0].y).toBeGreaterThan(halfHeight * 0.5)
    }
  })

  it('un dé seul fait 40 % d’un dé à moi', () => {
    expect(remoteSlotLayout(0, 1, halfWidth, halfHeight).scale).toBe(REMOTE_SCALE)
    expect(landingLayout(1).scale).toBeCloseTo(REMOTE_SCALE / 0.8)
  })

  it('plusieurs dés se serrent sans sortir de leur emplacement', () => {
    const slotWidth = (halfWidth * 2) / REMOTE_SLOTS
    const { positions, scale } = remoteSlotLayout(1, 5, halfWidth, halfHeight)
    expect(positions).toHaveLength(5)
    expect(scale).toBeLessThan(REMOTE_SCALE)
    const left = -halfWidth + slotWidth
    const right = left + slotWidth
    for (const p of positions) {
      expect(p.x - scale).toBeGreaterThanOrEqual(left)
      expect(p.x + scale).toBeLessThanOrEqual(right)
    }
  })

  it('plafonne à 5 dés par emplacement', () => {
    expect(remoteSlotLayout(0, 12, halfWidth, halfHeight).positions).toHaveLength(MAX_REMOTE_DICE)
  })
})

describe('faceTargetQuaternion vers la caméra', () => {
  it('une face posée hors centre vise la caméra, pas l’avant', () => {
    const normal = new THREE.Vector3(0, 0, 1)
    const landing = new THREE.Vector3(-3, 5, 0)
    const cameraPos = new THREE.Vector3(0, 0, 9)
    const toward = cameraPos.clone().sub(landing)
    const q = faceTargetQuaternion(normal, toward)
    const facing = normal.clone().applyQuaternion(q)
    expect(facing.dot(toward.clone().normalize())).toBeCloseTo(1, 5)
    expect(facing.z).toBeLessThan(1)
  })
})

describe('gradientLine', () => {
  // `+ 0` : Math.round(-0.0001) donne -0, que toEqual distingue de 0.
  const round = (line: number[]) => line.map((n) => Math.round(n * 1000) / 1000 + 0)

  it('0° va du bas vers le haut, comme en CSS', () => {
    expect(round(gradientLine(0, 100))).toEqual([50, 100, 50, 0])
  })

  it('180° va du haut vers le bas', () => {
    expect(round(gradientLine(180, 100))).toEqual([50, 0, 50, 100])
  })

  it('90° va de la gauche vers la droite', () => {
    expect(round(gradientLine(90, 100))).toEqual([0, 50, 100, 50])
  })

  it('45° touche deux coins opposés de la case', () => {
    expect(round(gradientLine(45, 100))).toEqual([0, 100, 100, 0])
  })

  it('reste centré sur la case quel que soit l’angle', () => {
    for (const angle of [0, 15, 73, 160, 300]) {
      const [x0, y0, x1, y1] = gradientLine(angle, 100)
      expect((x0 + x1) / 2).toBeCloseTo(50)
      expect((y0 + y1) / 2).toBeCloseTo(50)
    }
  })
})

describe('viewerLayout', () => {
  const area = { left: 0, top: 0, width: 800, height: 600 }
  const screen = { width: 1200, height: 600 }
  const halfW = 12
  const halfH = 6

  it('pose chaque emplacement dans son quart de la carte', () => {
    const mid = () => 0.5
    const a = viewerLayout(0, 1, area, screen, halfW, halfH, mid)
    const b = viewerLayout(1, 1, area, screen, halfW, halfH, mid)
    const c = viewerLayout(2, 1, area, screen, halfW, halfH, mid)
    // Haut gauche / haut droite / bas gauche
    expect(a.positions[0].x).toBeLessThan(b.positions[0].x)
    expect(a.positions[0].y).toBeCloseTo(b.positions[0].y)
    expect(c.positions[0].y).toBeLessThan(a.positions[0].y)
    // Tous à gauche de l'écran : la carte n'en couvre que les deux tiers
    for (const l of [a, b, c]) expect(l.positions[0].x).toBeLessThan(halfW * (800 / 1200 * 2 - 1) + 0.01)
  })

  it('reste dans la cellule quel que soit le tirage', () => {
    for (const r of [0, 0.999]) {
      const { positions } = viewerLayout(0, 1, area, screen, halfW, halfH, () => r)
      const px = ((positions[0].x / halfW) + 1) / 2 * screen.width
      const py = (1 - positions[0].y / halfH) / 2 * screen.height
      expect(px).toBeGreaterThanOrEqual(0)
      expect(px).toBeLessThanOrEqual(400)
      expect(py).toBeGreaterThanOrEqual(0)
      expect(py).toBeLessThanOrEqual(300)
    }
  })

  it('est plus gros qu\'un dé distant classique et serre les dés multiples', () => {
    const one = viewerLayout(0, 1, area, screen, halfW, halfH, () => 0.5)
    // Sur une carte étroite, cinq dés doivent se serrer pour tenir dans leur quart
    const narrow = { ...area, width: 300 }
    const five = viewerLayout(0, 5, narrow, screen, halfW, halfH, () => 0.5)
    expect(one.scale).toBe(VIEWER_SCALE)
    expect(one.scale).toBeGreaterThan(REMOTE_SCALE)
    expect(five.scale).toBeLessThan(one.scale)
    expect(five.positions).toHaveLength(5)
  })
})
