import { describe, it, expect } from 'vitest'
import { pickUpdatable } from './updatable.js'

describe('pickUpdatable', () => {
  it('garde les jets de croissance des PV (régression : perdus à chaque montée de niveau)', () => {
    const body = pickUpdatable({ hpLevelGains: [5, 5, 4, 3] })
    expect(body.hpLevelGains).toEqual([5, 5, 4, 3])
  })

  it('garde les champs classiques de la fiche', () => {
    const body = pickUpdatable({ name: 'Minizou', level: 5, hpCurrent: 24, con: 13 })
    expect(body).toEqual({ name: 'Minizou', level: 5, hpCurrent: 24, con: 13 })
  })

  it('bloque le mass-assignment (userId, isActive, createdAt, clés inconnues)', () => {
    const body = pickUpdatable({ userId: 99, isActive: true, createdAt: 'x', foo: 1, name: 'ok' })
    expect(body).toEqual({ name: 'ok' })
  })

  it('ne fabrique pas de clé absente du corps', () => {
    expect(pickUpdatable({})).toEqual({})
  })
})
