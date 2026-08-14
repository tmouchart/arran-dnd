import { ref, shallowRef } from 'vue'
import { planDice, type DieRoll } from '../utils/dice3d/plan'

export type { DieRoll }

/**
 * Pilotage du dé 3D.
 *
 * `playDiceRoll` ne tire rien : le résultat est déjà décidé par `rollDie()`.
 * Elle rend une promesse résolue quand le dé se pose, pour que l'appelant
 * n'affiche son résultat qu'à ce moment-là.
 */

export interface DiceRequest {
  id: number
  rolls: DieRoll[]
}

const STORAGE_KEY = 'arran-dice-3d'

function loadPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Réglage joueur : certains veulent juste le chiffre, tout de suite. */
export const dice3dEnabled = ref(loadPreference())

export function setDice3dEnabled(on: boolean) {
  dice3dEnabled.value = on
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch { /* quota */ }
}

/** La demande en cours. L'overlay la surveille. */
export const diceRequest = shallowRef<DiceRequest | null>(null)

let sequence = 0
let pending: (() => void) | null = null

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Lance l'animation et prévient quand le dé s'est stabilisé.
 *
 * Un nouveau lancer pendant l'animation libère le précédent immédiatement :
 * on peut cliquer cinq fois de suite, chaque résultat s'affiche sans attendre
 * une animation qui ne se terminera jamais.
 */
export function playDiceRoll(rolls: DieRoll[]): Promise<void> {
  if (!dice3dEnabled.value || prefersReducedMotion() || !planDice(rolls).length) {
    return Promise.resolve()
  }

  pending?.()
  return new Promise<void>((resolve) => {
    pending = resolve
    diceRequest.value = { id: ++sequence, rolls }
  })
}

/** Appelé par l'overlay quand le dé se pose — ou quand le joueur passe. */
export function settleDiceRoll(id: number) {
  if (diceRequest.value?.id !== id) return
  pending?.()
  pending = null
}

/**
 * Enchaîne le dé 3D puis la révélation du résultat.
 * Les mutations d'état de jeu (PM, PV) restent en dehors : elles sont immédiates.
 */
export function revealAfterDice(rolls: DieRoll[], reveal: () => void) {
  void playDiceRoll(rolls).then(reveal)
}

/** Raccourci pour le cas courant : plusieurs dés de la même taille. */
export function dice(sides: number, values: number[]): DieRoll[] {
  return values.map((value) => ({ sides, value }))
}
