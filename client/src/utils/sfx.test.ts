import { describe, it, expect } from 'vitest'
import { criticalTones, fumbleTones, tonesDuration } from './sfx'

describe('sfx', () => {
  const all = [...criticalTones(), ...fumbleTones()]

  it('ne produit que des valeurs finies et positives', () => {
    for (const tone of all) {
      expect(Number.isFinite(tone.at)).toBe(true)
      expect(tone.at).toBeGreaterThanOrEqual(0)
      expect(tone.duration).toBeGreaterThan(0)
      expect(tone.freq).toBeGreaterThan(0)
      expect(tone.gain).toBeGreaterThan(0)
      expect(tone.gain).toBeLessThanOrEqual(1)
    }
  })

  // Une rampe exponentielle vers 0 lève une erreur dans Web Audio : les
  // glissandos doivent viser une fréquence strictement positive.
  it('ne vise jamais une fréquence nulle en glissando', () => {
    for (const tone of all) {
      if (tone.toFreq !== undefined) expect(tone.toFreq).toBeGreaterThan(0)
    }
  })

  it('tient dans la durée de l’overlay (1,4 s)', () => {
    expect(tonesDuration(criticalTones())).toBeLessThanOrEqual(1.4)
    expect(tonesDuration(fumbleTones())).toBeLessThanOrEqual(1.4)
  })

  it('le critique monte, l’échec descend', () => {
    const arpeggio = criticalTones().filter((t) => t.type === 'triangle')
    const freqs = arpeggio.map((t) => t.freq)
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b))

    for (const tone of fumbleTones()) {
      expect(tone.toFreq!).toBeLessThan(tone.freq)
    }
  })
})
