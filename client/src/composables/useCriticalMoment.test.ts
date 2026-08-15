import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  activeMoment,
  celebrate,
  resetCriticalCooldown,
  setCriticalEnabled,
  setCriticalSoundEnabled,
  setCriticalVibrationEnabled,
} from './useCriticalMoment'

// Le son passe par Web Audio, absent de jsdom : on ne teste que l'orchestration.
vi.mock('../utils/sfx', () => ({
  criticalTones: () => [],
  fumbleTones: () => [],
  playTones: vi.fn(),
  primeAudio: vi.fn(),
}))

describe('useCriticalMoment', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    activeMoment.value = null
    resetCriticalCooldown()
    setCriticalEnabled(true)
    setCriticalSoundEnabled(true)
    setCriticalVibrationEnabled(true)
  })

  it('publie le moment en cours et l’efface tout seul', () => {
    celebrate('critical', 'Théos')
    expect(activeMoment.value).toMatchObject({ outcome: 'critical', actorName: 'Théos' })

    vi.advanceTimersByTime(1500)
    expect(activeMoment.value).toBeNull()
  })

  // Deux 20 coup sur coup ne doivent pas faire clignoter l'écran.
  it('ignore un second moment pendant le cooldown', () => {
    celebrate('critical', 'Théos')
    const first = activeMoment.value!.id

    celebrate('fumble', 'Gimli')
    expect(activeMoment.value!.id).toBe(first)
    expect(activeMoment.value!.outcome).toBe('critical')
  })

  it('ne fait rien quand la préférence est coupée', () => {
    setCriticalEnabled(false)
    celebrate('critical', 'Théos')
    expect(activeMoment.value).toBeNull()
    setCriticalEnabled(true)
  })

  it('vibre selon l’issue', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })

    celebrate('fumble', 'Théos')
    expect(vibrate).toHaveBeenCalledWith([320])

    resetCriticalCooldown()
    celebrate('critical', 'Théos')
    expect(vibrate).toHaveBeenLastCalledWith([40, 60, 40, 60, 140])

    vi.unstubAllGlobals()
  })

  it('ne vibre pas quand la vibration est coupée', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    setCriticalVibrationEnabled(false)

    celebrate('critical', 'Théos')
    expect(vibrate).not.toHaveBeenCalled()

    setCriticalVibrationEnabled(true)
    vi.unstubAllGlobals()
  })
})
