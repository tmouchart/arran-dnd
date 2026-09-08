import type { Ref } from 'vue'
import type { Character } from '../types/character'
import type { VoieFamily } from '../data/voies'

export interface SpellPayment {
  /** PM réellement retirés. */
  pm: number
  /** PV brûlés (brûlure de magie) quand les PM ne suffisaient pas. */
  hpBurned: number
}

/**
 * Paiement d'un sort : débite les PM, et si le personnage n'en a pas assez,
 * brûle des PV à la place (1 PV par PM manquant, 2 pour les combattants).
 */
export function useSpellCast(character: Ref<Character>, profileFamily: Ref<VoieFamily>) {
  function payPm(cost: number): SpellPayment {
    if (cost <= 0) return { pm: 0, hpBurned: 0 }
    const c = character.value
    const available = c.mpCurrent
    if (available >= cost) {
      c.mpCurrent = available - cost
      return { pm: cost, hpBurned: 0 }
    }
    const deficit = cost - available
    const hpBurned = profileFamily.value === 'combattants' ? deficit * 2 : deficit
    c.mpCurrent = 0
    c.hpCurrent = Math.max(0, c.hpCurrent - hpBurned)
    return { pm: available, hpBurned }
  }

  return { payPm }
}
