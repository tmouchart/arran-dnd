import { describe, it, expect } from 'vitest'
import { devToolsEnabled } from './enabled.js'

describe('devToolsEnabled', () => {
  it('actif seulement avec un opt-in explicite hors prod', () => {
    expect(devToolsEnabled({ DEV_TOOLS: '1' })).toBe(true)
    expect(devToolsEnabled({ DEV_TOOLS: '1', NODE_ENV: 'development' })).toBe(true)
  })

  it('la prod gagne toujours, même avec l\'opt-in', () => {
    expect(devToolsEnabled({ DEV_TOOLS: '1', NODE_ENV: 'production' })).toBe(false)
  })

  it('fail-closed : absent, vide ou mal orthographié = éteint', () => {
    expect(devToolsEnabled({})).toBe(false)
    expect(devToolsEnabled({ DEV_TOOLS: '' })).toBe(false)
    expect(devToolsEnabled({ DEV_TOOLS: 'true' })).toBe(false)
    expect(devToolsEnabled({ DEV_TOOLS: '0' })).toBe(false)
    expect(devToolsEnabled({ DEVTOOLS: '1' })).toBe(false)
  })
})
