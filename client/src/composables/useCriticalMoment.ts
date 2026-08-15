import { ref, shallowRef } from 'vue'
import { criticalTones, fumbleTones, playTones } from '../utils/sfx'
import type { RollOutcome } from '../utils/rollOutcome'

/**
 * Le moment critique partagé : un 20 ou un 1 naturel fait réagir tous les
 * téléphones de la campagne en même temps — halo, son, vibration.
 *
 * Singleton : un seul moment peut jouer à la fois, où qu'il soit déclenché.
 */

export interface CriticalMoment {
  id: number
  outcome: Exclude<RollOutcome, null>
  actorName: string
}

/** Durée de l'overlay. Le son du critique traîne un peu plus longtemps. */
export const MOMENT_MS = 1400

/** Deux critiques coup sur coup ne doivent pas faire un stroboscope. */
const COOLDOWN_MS = 2000

const ENABLED_KEY = 'arran-critique'
const SOUND_KEY = 'arran-critique-son'
const VIBRATE_KEY = 'arran-critique-vibration'

function loadPreference(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}

function savePreference(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? 'on' : 'off')
  } catch { /* quota */ }
}

export const criticalEnabled = ref(loadPreference(ENABLED_KEY))
export const criticalSoundEnabled = ref(loadPreference(SOUND_KEY))
export const criticalVibrationEnabled = ref(loadPreference(VIBRATE_KEY))

export function setCriticalEnabled(on: boolean): void {
  criticalEnabled.value = on
  savePreference(ENABLED_KEY, on)
}

export function setCriticalSoundEnabled(on: boolean): void {
  criticalSoundEnabled.value = on
  savePreference(SOUND_KEY, on)
}

export function setCriticalVibrationEnabled(on: boolean): void {
  criticalVibrationEnabled.value = on
  savePreference(VIBRATE_KEY, on)
}

/** Le moment en cours. L'overlay le surveille. */
export const activeMoment = shallowRef<CriticalMoment | null>(null)

let sequence = 0
// -Infinity et pas 0 : `performance.now()` part de 0 au chargement de la page,
// un cooldown à 0 avalerait le tout premier critique des 2 premières secondes.
let lastAt = -Infinity
let timer: ReturnType<typeof setTimeout> | null = null

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Motifs de vibration : la réussite pétille, l'échec est un coup sourd.
 * Absent de Safari iOS — on le laisse tomber sans bruit.
 */
function vibrate(outcome: Exclude<RollOutcome, null>): void {
  if (!criticalVibrationEnabled.value) return
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  navigator.vibrate(outcome === 'critical' ? [40, 60, 40, 60, 140] : [320])
}

/**
 * Déclenche la fanfare. Sans effet si la préférence est coupée ou si un moment
 * vient de jouer.
 */
export function celebrate(outcome: Exclude<RollOutcome, null>, actorName: string): void {
  if (!criticalEnabled.value) return

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastAt < COOLDOWN_MS) return
  lastAt = now

  vibrate(outcome)
  if (criticalSoundEnabled.value) {
    playTones(outcome === 'critical' ? criticalTones() : fumbleTones())
  }

  // Le halo pulse : on le saute si le joueur a demandé moins d'animation, mais
  // il garde le son et la vibration.
  if (prefersReducedMotion()) return

  activeMoment.value = { id: ++sequence, outcome, actorName }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { activeMoment.value = null }, MOMENT_MS)
}

/** Remet le cooldown à zéro — pour les tests et le banc d'essai. */
export function resetCriticalCooldown(): void {
  lastAt = -Infinity
}

export function useCriticalMoment() {
  return { activeMoment, celebrate, criticalEnabled, criticalSoundEnabled, criticalVibrationEnabled }
}
