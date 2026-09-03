import { combatParticipants, combats } from '../db/schema.js'
import { turnOrder, turnIndexOf } from './turnOrder.js'

type CombatRow = typeof combats.$inferSelect
type ParticipantRow = typeof combatParticipants.$inferSelect

/** État qualitatif des PV d'un monstre — ce qu'un joueur a le droit de savoir. */
export function hpStatus(hpCurrent: number, hpMax: number): string {
  if (hpCurrent <= 0) return 'mort'
  const pct = (hpCurrent / hpMax) * 100
  if (pct > 75) return 'intact'
  if (pct > 50) return 'blesse'
  if (pct > 25) return 'mal_en_point'
  return 'agonisant'
}

/**
 * Un joueur ne voit d'un monstre que son nom, son initiative, sa défense et sa
 * position. Les PV deviennent qualitatifs, le reste disparaît.
 */
function maskMonster(p: ParticipantRow) {
  return {
    id: p.id,
    combatId: p.combatId,
    kind: p.kind,
    userId: p.userId,
    name: p.name,
    initiative: p.initiative,
    def: p.def,
    hpMax: null,
    hpCurrent: null,
    hpStatus: hpStatus(p.hpCurrent ?? 0, p.hpMax ?? 1),
    nc: null,
    statFor: null,
    statDex: null,
    statCon: null,
    statInt: null,
    statSag: null,
    statCha: null,
    attacks: null,
    abilities: null,
    monsterDescription: null,
    // La position n'est pas un secret : sans elle, les joueurs ne verraient
    // pas les monstres sur le champ de bataille.
    posX: p.posX,
    posY: p.posY,
  }
}

/**
 * L'état du combat tel qu'un utilisateur donné a le droit de le voir.
 *
 * Seul endroit où l'on décide quoi montrer à qui : le GET et le flux SSE
 * appellent tous les deux cette fonction, donc ils ne peuvent pas diverger.
 *
 * `participants` arrive brut (non trié, PV des joueurs déjà enrichis).
 */
export function serializeCombat(
  combat: CombatRow,
  participants: ParticipantRow[],
  isGm: boolean,
) {
  // `turnOrder` écarte les cachés : ils ne sont dans l'ordre de personne.
  const sorted = turnOrder(participants)

  return {
    ...combat,
    // Index dérivé de l'id stocké : le client continue de raisonner en position.
    currentTurnIndex: turnIndexOf(sorted, combat.currentParticipantId),
    participants: sorted.map((p) => (isGm || p.kind === 'player' ? p : maskMonster(p))),
    // La réserve du MJ. Pour un joueur, elle n'existe pas : pas de nom, pas
    // d'initiative, pas de case grisée qui trahirait l'embuscade.
    reserve: isGm ? participants.filter((p) => p.hidden) : [],
  }
}
