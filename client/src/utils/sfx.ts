/**
 * Sons du moment critique, synthétisés à la volée.
 *
 * Pas de fichier à télécharger : deux petites partitions décrites en données
 * pures (testables), jouées par des oscillateurs Web Audio.
 */

export interface Tone {
  /** Départ en secondes, relatif au début du son. */
  at: number
  duration: number
  freq: number
  /** Glissando : fréquence d'arrivée. Absent = note tenue. */
  toFreq?: number
  type: OscillatorType
  /** Volume crête, 0..1. */
  gain: number
  /** Coupure passe-bas en Hz. Absent = pas de filtre. */
  lowpass?: number
}

/** Arpège majeur montant + une cloche qui traîne. */
export function criticalTones(): Tone[] {
  const arpeggio = [523.25, 659.25, 783.99, 1046.5]
  const notes: Tone[] = arpeggio.map((freq, i) => ({
    at: i * 0.07,
    duration: 0.2,
    freq,
    type: 'triangle',
    gain: 0.22,
  }))
  notes.push({ at: 0.21, duration: 0.9, freq: 1046.5, type: 'sine', gain: 0.16 })
  return notes
}

/** Glissando descendant + un coup sourd. */
export function fumbleTones(): Tone[] {
  return [
    { at: 0, duration: 0.5, freq: 220, toFreq: 55, type: 'sawtooth', gain: 0.18, lowpass: 900 },
    { at: 0.12, duration: 0.6, freq: 90, toFreq: 40, type: 'sine', gain: 0.3 },
  ]
}

/** Durée totale d'une partition, pour les tests et le calage de l'animation. */
export function tonesDuration(tones: Tone[]): number {
  return tones.reduce((max, t) => Math.max(max, t.at + t.duration), 0)
}

let context: AudioContext | null = null

/**
 * Le contexte démarre suspendu tant que l'utilisateur n'a rien tapé. On le
 * réveille au premier geste, pas au premier son : sinon le tout premier
 * critique de la séance serait muet.
 */
export function primeAudio(): void {
  if (typeof window === 'undefined') return
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  context ??= new Ctor()
  if (context.state === 'suspended') void context.resume()
}

export function playTones(tones: Tone[]): void {
  primeAudio()
  if (!context) return

  const start = context.currentTime + 0.02
  for (const tone of tones) {
    const osc = context.createOscillator()
    const amp = context.createGain()
    osc.type = tone.type

    const at = start + tone.at
    const end = at + tone.duration
    osc.frequency.setValueAtTime(tone.freq, at)
    if (tone.toFreq) osc.frequency.exponentialRampToValueAtTime(tone.toFreq, end)

    // Attaque courte puis extinction exponentielle : sans ça chaque note claque.
    amp.gain.setValueAtTime(0.0001, at)
    amp.gain.exponentialRampToValueAtTime(tone.gain, at + 0.015)
    amp.gain.exponentialRampToValueAtTime(0.0001, end)

    let node: AudioNode = osc
    if (tone.lowpass) {
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = tone.lowpass
      osc.connect(filter)
      node = filter
    }
    node.connect(amp)
    amp.connect(context.destination)

    osc.start(at)
    osc.stop(end + 0.02)
  }
}
