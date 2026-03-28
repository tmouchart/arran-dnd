import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'

// Set JWT_SECRET before importing the module (it reads at import time)
process.env.JWT_SECRET = 'test-secret-for-vitest'

const { signToken, verifyToken } = await import('./jwt')

describe('signToken / verifyToken', () => {
  it('roundtrip: sign then verify returns same claims', () => {
    const token = signToken(42, 'gandalf')
    const payload = verifyToken(token)
    expect(payload.sub).toBe(42)
    expect(payload.username).toBe('gandalf')
  })

  it('different userId produces different token', () => {
    const t1 = signToken(1, 'alice')
    const t2 = signToken(2, 'alice')
    expect(t1).not.toBe(t2)
  })
})

describe('verifyToken — error cases', () => {
  it('throws on tampered token', () => {
    const token = signToken(1, 'test')
    const tampered = token.slice(0, -5) + 'XXXXX'
    expect(() => verifyToken(tampered)).toThrow()
  })

  it('throws on completely invalid string', () => {
    expect(() => verifyToken('not-a-jwt')).toThrow()
  })

  it('throws on empty string', () => {
    expect(() => verifyToken('')).toThrow()
  })
})

describe('verifyToken — username fallback', () => {
  it('returns "unknown" when username claim is missing', () => {
    const token = jwt.sign({ sub: 99 }, process.env.JWT_SECRET!)
    const payload = verifyToken(token)
    expect(payload.sub).toBe(99)
    expect(payload.username).toBe('unknown')
  })
})
