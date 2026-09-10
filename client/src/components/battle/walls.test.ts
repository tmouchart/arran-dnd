import { describe, it, expect } from 'vitest'
import {
  resample,
  smooth,
  clampPoints,
  cleanPath,
  buildSegments,
  applyUndo,
  MAX_WALL_POINTS,
  WALL_THICKNESS,
  type BattleWall,
  type WallPoint,
} from './walls'

describe('resample', () => {
  it('jette les points trop rapprochés', () => {
    // Un doigt lent : 60 points sur une seule case.
    const raw: WallPoint[] = Array.from({ length: 60 }, (_, i) => ({ x: i / 60, z: 0 }))
    const out = resample(raw)
    for (let i = 1; i < out.length; i++) {
      const d = Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z)
      // Le dernier point est gardé quoi qu'il arrive : il peut être plus près.
      if (i < out.length - 1) expect(d).toBeGreaterThanOrEqual(0.3)
    }
    expect(out.length).toBeLessThan(10)
  })

  it('garde le point de départ et celui où le doigt se lève', () => {
    const out = resample([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2.05, z: 0 },
    ])
    expect(out[0]).toEqual({ x: 0, z: 0 })
    expect(out[out.length - 1]).toEqual({ x: 2.05, z: 0 })
  })

  it('ne casse pas sur un tracé vide', () => {
    expect(resample([])).toEqual([])
  })
})

describe('smooth', () => {
  it('laisse une ligne droite droite', () => {
    const line = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
      { x: 3, z: 0 },
    ]
    expect(smooth(line)).toEqual(line)
  })

  it('ne bouge pas les extrémités', () => {
    const out = smooth([
      { x: 0, z: 0 },
      { x: 1, z: 5 },
      { x: 2, z: 0 },
    ])
    expect(out[0]).toEqual({ x: 0, z: 0 })
    expect(out[2]).toEqual({ x: 2, z: 0 })
    // Le pic est rabaissé.
    expect(out[1].z).toBeCloseTo(5 / 3)
  })

  it('laisse passer un tracé de moins de trois points', () => {
    const two = [
      { x: 0, z: 0 },
      { x: 1, z: 1 },
    ]
    expect(smooth(two)).toEqual(two)
  })
})

describe('clampPoints', () => {
  it('ramène le doigt qui déborde dans la grille', () => {
    expect(clampPoints([{ x: 99, z: -99 }], 6)).toEqual([{ x: 6, z: -6 }])
  })
})

describe('buildSegments', () => {
  it('ne produit aucun segment pour un tap', () => {
    expect(buildSegments([{ x: 1, z: 1 }])).toEqual([])
    expect(buildSegments([])).toEqual([])
  })

  it('place la boîte au milieu du segment, allongée d’une épaisseur', () => {
    const [seg] = buildSegments([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    ])
    expect(seg.x).toBeCloseTo(1)
    expect(seg.z).toBeCloseTo(0)
    expect(seg.length).toBeCloseTo(2 + WALL_THICKNESS)
  })

  it('oriente la boîte le long du segment', () => {
    // Vers +X : aucune rotation.
    const [east] = buildSegments([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ])
    expect(east.angle).toBeCloseTo(0)

    // Vers +Z : un quart de tour. Une rotation θ autour de Y envoie
    // l'axe X sur (cos θ, 0, −sin θ), donc θ = −π/2.
    const [south] = buildSegments([
      { x: 0, z: 0 },
      { x: 0, z: 1 },
    ])
    expect(south.angle).toBeCloseTo(-Math.PI / 2)
  })

  it('encaisse un demi-tour', () => {
    const segs = buildSegments([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 0, z: 0.01 },
    ])
    expect(segs).toHaveLength(2)
    for (const s of segs) {
      expect(Number.isFinite(s.angle)).toBe(true)
      expect(s.length).toBeGreaterThan(0)
    }
  })

  it('saute les points superposés', () => {
    const segs = buildSegments([
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ])
    expect(segs).toHaveLength(1)
  })
})

describe('cleanPath', () => {
  it('transforme un tracé tremblant en mur posable', () => {
    const raw: WallPoint[] = Array.from({ length: 80 }, (_, i) => ({
      x: i * 0.1,
      z: (i % 2 === 0 ? 0.02 : -0.02) + 20, // tremblote + déborde de la grille
    }))
    const out = cleanPath(raw, 6)
    expect(out.length).toBeGreaterThan(1)
    for (const p of out) expect(p.z).toBeLessThanOrEqual(6)
    expect(buildSegments(out).length).toBe(out.length - 1)
  })

  it('tronque un tracé interminable à la limite du serveur', () => {
    // Le MJ garde le doigt appuyé et fait des allers-retours pendant 30 s.
    const raw: WallPoint[] = Array.from({ length: 5000 }, (_, i) => ({
      x: Math.sin(i / 3) * 5,
      z: Math.cos(i / 3) * 5,
    }))
    expect(cleanPath(raw, 6).length).toBeLessThanOrEqual(MAX_WALL_POINTS)
  })
})

describe('applyUndo', () => {
  const a: BattleWall = { id: 'a', points: [{ x: 0, z: 0 }] }
  const b: BattleWall = { id: 'b', points: [{ x: 1, z: 1 }] }

  it('annuler un tracé enlève ce mur-là, pas un autre', () => {
    expect(applyUndo([a, b], { type: 'add', wall: b })).toEqual([a])
  })

  it('annuler un effacement remet le mur avec le même id', () => {
    const out = applyUndo([a], { type: 'erase', wall: b })
    expect(out).toHaveLength(2)
    expect(out[1]).toEqual(b)
  })

  it('ne remet pas deux fois le même mur', () => {
    expect(applyUndo([a, b], { type: 'erase', wall: b })).toEqual([a, b])
  })

  it('remonte les gestes dans le bon ordre', () => {
    // Le MJ trace `a`, trace `b`, puis efface `a`.
    const stack = [
      { type: 'add', wall: a },
      { type: 'add', wall: b },
      { type: 'erase', wall: a },
    ] as const
    let walls: BattleWall[] = [b]
    walls = applyUndo(walls, stack[2]) // l'effacement de `a`
    expect(walls.map((w) => w.id).sort()).toEqual(['a', 'b'])
    walls = applyUndo(walls, stack[1]) // le tracé de `b`
    expect(walls.map((w) => w.id)).toEqual(['a'])
    walls = applyUndo(walls, stack[0]) // le tracé de `a`
    expect(walls).toEqual([])
  })

  it('ne casse pas sur une liste vide', () => {
    expect(applyUndo([], { type: 'add', wall: a })).toEqual([])
  })
})
