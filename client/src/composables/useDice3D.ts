import { ref, shallowRef } from 'vue'
import { planDice, type DieRoll, type ScreenArea } from '../utils/dice3d/plan'
import type { DiceStyle } from '../data/diceStyle'
import { user } from './useAuth'

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
  /** Style du corps du dé. Absent = doré du thème. */
  style?: DiceStyle
}

/** Le jet d'un autre membre de la campagne, à montrer en petit. */
export interface RemoteDiceRequest extends DiceRequest {
  actorName: string
  style: DiceStyle
}

const STORAGE_KEY = 'arran-dice-3d'
const REMOTE_KEY = 'arran-dice-remote'

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

/** Réglage joueur : voir rouler les dés des autres, ou pas. ON par défaut. */
export const remoteDiceEnabled = ref(loadRemotePreference())

function loadRemotePreference(): boolean {
  try {
    return localStorage.getItem(REMOTE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setRemoteDiceEnabled(on: boolean) {
  remoteDiceEnabled.value = on
  try {
    localStorage.setItem(REMOTE_KEY, on ? 'on' : 'off')
  } catch { /* quota */ }
}

/**
 * Mode table : la zone de l'écran (la carte) où les dés de tout le monde
 * tombent. Non nul tant que la page « table » est ouverte. L'overlay s'en sert
 * pour choisir le point de chute, la taille et la durée d'affichage.
 */
export const viewerArea = shallowRef<ScreenArea | null>(null)

/** La demande en cours. L'overlay la surveille. */
export const diceRequest = shallowRef<DiceRequest | null>(null)

/**
 * Le dernier jet distant reçu. Contrairement à `diceRequest`, plusieurs peuvent
 * se chevaucher : l'overlay les empile dans ses emplacements, il ne remplace pas.
 */
export const remoteDiceRequest = shallowRef<RemoteDiceRequest | null>(null)

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
    diceRequest.value = { id: ++sequence, rolls, style: user.value?.diceStyle }
  })
}

/**
 * Un autre joueur a lancé : son dé roule chez moi, en petit, à ses couleurs.
 * Rien à attendre — personne n'a de résultat à révéler de ce côté.
 */
export function playRemoteDiceRoll(roll: { actorName: string; style: DiceStyle; rolls: DieRoll[] }) {
  // En mode table il n'y a pas de « moi » : le réglage « dés des autres » ne s'applique pas
  if (!dice3dEnabled.value || (!remoteDiceEnabled.value && !viewerArea.value) || prefersReducedMotion()) return
  if (!planDice(roll.rolls).length) return
  remoteDiceRequest.value = { id: ++sequence, ...roll }
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
export function dice(sides: number, values: number[], kind = 'weapon'): DieRoll[] {
  return values.map((value) => ({ sides, value, kind }))
}
