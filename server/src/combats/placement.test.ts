import { describe, it, expect } from 'vitest'
import { startingPosition, clampToBoard, BATTLE_HALF } from './placement.js'

describe('startingPosition', () => {
  it('met les héros au sud et les monstres au nord', () => {
    expect(startingPosition('player', 0).posY).toBeGreaterThan(0)
    expect(startingPosition('monster', 0).posY).toBeLessThan(0)
  })

  it('centre la première rangée sur x = 0', () => {
    const xs = [0, 1, 2, 3, 4].map((s) => startingPosition('player', s).posX)
    expect(xs[2]).toBe(0)
    expect(xs[0]).toBe(-xs[4])
    expect(new Set(xs).size).toBe(5)
  })

  it('passe à la rangée suivante au sixième pion', () => {
    const first = startingPosition('monster', 0)
    const sixth = startingPosition('monster', 5)
    expect(sixth.posX).toBe(first.posX)
    expect(Math.abs(sixth.posY)).toBeGreaterThan(Math.abs(first.posY))
  })

  it('ne pose jamais un pion hors du plateau, même à 40 monstres', () => {
    for (let slot = 0; slot < 40; slot++) {
      for (const kind of ['player', 'monster']) {
        const { posX, posY } = startingPosition(kind, slot)
        expect(Math.abs(posX)).toBeLessThanOrEqual(BATTLE_HALF)
        expect(Math.abs(posY)).toBeLessThanOrEqual(BATTLE_HALF)
      }
    }
  })

  it('est stable : le même slot donne toujours la même case', () => {
    expect(startingPosition('player', 3)).toEqual(startingPosition('player', 3))
  })
})

describe('clampToBoard', () => {
  it('ramène dans la grille et laisse passer le reste', () => {
    expect(clampToBoard(99)).toBe(BATTLE_HALF)
    expect(clampToBoard(-99)).toBe(-BATTLE_HALF)
    expect(clampToBoard(2.5)).toBe(2.5)
  })
})
