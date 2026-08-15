import { computed, shallowRef } from 'vue'
import type { RestDelta, RestEvent, RestKind } from '../api/campaigns'
import { user } from './useAuth'
import { applyServerRest, character, computedPcMax } from './useCharacter'

/**
 * Le repos partagé, côté joueur.
 *
 * Le MJ appuie, le serveur a déjà tout écrit en base : ce qui arrive ici ne
 * sert qu'à jouer le feu de camp et à rafraîchir la fiche ouverte. Couper
 * l'animation ne peut donc rien faire perdre.
 */

export interface RestRequest {
  id: number
  kind: RestKind
  /** Ce qui a changé sur MA fiche. Vide si je n'ai pas de personnage ici. */
  delta: RestDelta
  characterName: string | null
}

/** La demande en cours. Le feu de camp la surveille, comme `diceRequest`. */
export const restRequest = shallowRef<RestRequest | null>(null)

/** Le récap affiché une fois le feu éteint (ou passé). */
export const restSummary = shallowRef<RestRequest | null>(null)

let sequence = 0

/**
 * Reçoit l'évènement de la campagne : applique mes nouvelles valeurs, puis
 * déclenche l'animation.
 */
export function receiveRest(event: RestEvent): void {
  const userId = user.value?.id
  const mine = userId != null ? event.deltas.find((d) => d.userId === userId) : undefined

  if (mine) {
    applyServerRest(mine.after)
    // Les PC n'ont pas de maximum en base : il dépend de la famille de profil,
    // que seul le client sait déduire. Le repos complet les remet à neuf ici,
    // et l'autosave habituel l'écrit.
    if (event.kind === 'complet') character.value.pcCurrent = computedPcMax.value
  }

  restRequest.value = {
    id: ++sequence,
    kind: event.kind,
    delta: mine?.delta ?? {},
    characterName: mine?.characterName ?? null,
  }
}

/**
 * Banc d'essai de la bibliothèque de composants : joue le feu et le récap avec
 * des valeurs factices, sans jamais toucher à une fiche.
 */
export function previewRest(kind: RestKind): void {
  restRequest.value = {
    id: ++sequence,
    kind,
    delta:
      kind === 'complet'
        ? { hp: { before: 7, after: 24 }, mp: { before: 2, after: 12 }, pr: { before: 1, after: 5 } }
        : { mp: { before: 2, after: 12 }, pr: { before: 3, after: 4 } },
    characterName: 'Théos',
  }
}

/** Le feu est éteint (ou le joueur l'a passé) : place au récap. */
export function settleRest(id: number): void {
  if (restRequest.value?.id !== id) return
  restSummary.value = restRequest.value
  restRequest.value = null
}

export function closeRestSummary(): void {
  restSummary.value = null
}

export function useRest() {
  return {
    restRequest,
    restSummary,
    summaryOpen: computed({
      get: () => restSummary.value !== null,
      set: (open: boolean) => { if (!open) closeRestSummary() },
    }),
  }
}
