import { describe, expect, it } from 'vitest'
import {
  createEmbers,
  createFlame,
  fireEnvelope,
  firePulse,
  sampleEmber,
  sampleFlame,
} from './flame'

/** Générateur déterministe : les tests ne doivent jamais dépendre de Math.random. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('createFlame', () => {
  it('fait naître les particules dans le lit de braises', () => {
    for (const p of createFlame(60, seeded(7))) {
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(0.42)
      expect(p.life).toBeGreaterThan(0)
    }
  })

  it('décale les particules dans le cycle, sinon le feu clignote en bloc', () => {
    const phases = createFlame(40, seeded(3)).map((p) => p.phase)
    expect(new Set(phases).size).toBeGreaterThan(30)
  })
})

/** Instant où une particule décalée de `phase` atteint l'âge voulu (0 → 1). */
function atAge(p: { life: number; phase: number }, age: number): number {
  return ((age - p.phase + 1) % 1) * p.life
}

describe('sampleFlame', () => {
  const [particle] = createFlame(1, seeded(11))

  it('monte, rétrécit et refroidit au fil de la vie', () => {
    const bas = sampleFlame(particle, atAge(particle, 0.15))
    const haut = sampleFlame(particle, atAge(particle, 0.85))
    expect(haut.y).toBeGreaterThan(bas.y)
    expect(haut.size).toBeLessThan(bas.size)
    expect(haut.heat).toBeGreaterThan(bas.heat)
  })

  it('boucle : le feu brûle sans jamais se rejouer', () => {
    const debut = sampleFlame(particle, 0)
    const cycle = sampleFlame(particle, particle.life)
    expect(cycle.y).toBeCloseTo(debut.y, 5)
  })

  it("s'allume et s'éteint à chaque cycle", () => {
    expect(sampleFlame(particle, atAge(particle, 0)).opacity).toBeCloseTo(0, 5)
    expect(sampleFlame(particle, atAge(particle, 0.999)).opacity).toBeLessThan(0.05)
    expect(sampleFlame(particle, atAge(particle, 0.3)).opacity).toBeGreaterThan(0.4)
  })

  it('reste dans des bornes affichables quel que soit le temps', () => {
    for (let t = 0; t < 30; t += 0.37) {
      const s = sampleFlame(particle, t)
      expect(s.opacity).toBeGreaterThanOrEqual(0)
      expect(s.opacity).toBeLessThanOrEqual(1)
      expect(s.size).toBeGreaterThan(0)
      expect(Math.abs(s.x)).toBeLessThan(1)
    }
  })
})

describe('sampleEmber', () => {
  const [ember] = createEmbers(1, seeded(5))

  it('part des braises et monte bien plus haut que les flammes', () => {
    expect(sampleEmber(ember, atAge(ember, 0)).y).toBeCloseTo(0.35, 5)
    expect(sampleEmber(ember, atAge(ember, 0.9)).y).toBeGreaterThan(2)
  })

  it("s'éteint avant de sortir du cadre", () => {
    expect(sampleEmber(ember, atAge(ember, 0.98)).opacity).toBeLessThan(0.05)
  })
})

describe('firePulse', () => {
  it('reste autour de 1 sans jamais s\'éteindre', () => {
    for (let t = 0; t < 60; t += 0.13) {
      const value = firePulse(t)
      expect(value).toBeGreaterThan(0.6)
      expect(value).toBeLessThan(1.4)
    }
  })

  it('ne se répète pas sur la durée d\'une animation', () => {
    expect(firePulse(1)).not.toBeCloseTo(firePulse(4), 3)
  })
})

describe('fireEnvelope', () => {
  it('part de zéro, tient au milieu, revient à zéro', () => {
    expect(fireEnvelope(0)).toBe(0)
    expect(fireEnvelope(0.5)).toBe(1)
    expect(fireEnvelope(1)).toBe(0)
  })

  it("s'éteint plus lentement qu'il ne s'allume", () => {
    expect(fireEnvelope(0.08)).toBeCloseTo(0.5, 2)
    expect(fireEnvelope(0.91)).toBeCloseTo(0.5, 2)
    // 0,08 s pour prendre contre 0,09 s pour mourir : l'extinction traîne
    expect(1 - 0.91).toBeGreaterThan(0.08)
  })

  it('borne les valeurs hors intervalle', () => {
    expect(fireEnvelope(-1)).toBe(0)
    expect(fireEnvelope(2)).toBe(0)
  })
})
