import { describe, expect, it } from 'vitest'
import { applyRest, isRestKind, restDelta, PR_MAX, type RestState } from './rest.js'

function state(over: Partial<RestState> = {}): RestState {
  return {
    hpCurrent: 7,
    hpMax: 24,
    mpCurrent: 2,
    mpMax: 12,
    prCurrent: 3,
    affaibli: false,
    ...over,
  }
}

describe('applyRest — repos long', () => {
  it('rend tous les PM et un seul PR, sans toucher aux PV', () => {
    const after = applyRest(state(), 'long')
    expect(after.hpCurrent).toBe(7)
    expect(after.mpCurrent).toBe(12)
    expect(after.prCurrent).toBe(4)
  })

  it('ne dépasse jamais le plafond de PR', () => {
    expect(applyRest(state({ prCurrent: PR_MAX }), 'long').prCurrent).toBe(PR_MAX)
  })

  it('laisse un personnage à 0 PV à 0 PV', () => {
    expect(applyRest(state({ hpCurrent: 0 }), 'long').hpCurrent).toBe(0)
  })

  it('lève affaibli', () => {
    expect(applyRest(state({ affaibli: true }), 'long').affaibli).toBe(false)
  })
})

describe('applyRest — repos complet', () => {
  it('remet PV, PM et PR au maximum', () => {
    const after = applyRest(state({ affaibli: true }), 'complet')
    expect(after).toMatchObject({
      hpCurrent: 24,
      mpCurrent: 12,
      prCurrent: PR_MAX,
      affaibli: false,
    })
  })

  it('ne fait rien à un personnage déjà au maximum', () => {
    const full = state({ hpCurrent: 24, mpCurrent: 12, prCurrent: PR_MAX })
    expect(applyRest(full, 'complet')).toEqual(full)
  })
})

describe('restDelta', () => {
  it("n'écrit que les ressources qui ont bougé", () => {
    const before = state()
    expect(restDelta(before, applyRest(before, 'long'))).toEqual({
      mp: { before: 2, after: 12 },
      pr: { before: 3, after: 4 },
    })
  })

  it('rend un delta vide quand rien ne change', () => {
    const full = state({ hpCurrent: 24, mpCurrent: 12, prCurrent: PR_MAX })
    expect(restDelta(full, applyRest(full, 'complet'))).toEqual({})
  })
})

describe('isRestKind', () => {
  it('refuse tout ce qui ne vient pas du MJ', () => {
    expect(isRestKind('long')).toBe(true)
    expect(isRestKind('complet')).toBe(true)
    expect(isRestKind('court')).toBe(false)
    expect(isRestKind(undefined)).toBe(false)
  })
})
