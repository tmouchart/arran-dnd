import type { CampaignMember } from '../api/campaigns'
import type { CombatParticipant } from '../api/combats'

/**
 * Les membres de la campagne que le MJ peut encore faire entrer dans le combat.
 *
 * Un membre sans personnage n'a rien à y faire (pas d'initiative, pas de PV) et
 * celui qui combat déjà n'y entre pas deux fois. La réserve ne compte pas : un
 * PJ n'y va jamais.
 */
export function membresAbsents(
  members: CampaignMember[],
  participants: CombatParticipant[],
): CampaignMember[] {
  const dejaLa = new Set(
    participants.filter((p) => p.kind === 'player' && p.userId != null).map((p) => p.userId),
  )
  return members.filter((m) => m.characterId != null && !dejaLa.has(m.userId))
}
