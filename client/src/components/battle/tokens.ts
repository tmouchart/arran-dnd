import type { CombatParticipant } from '../../api/combats'
import type { BattleToken } from './BattleGrid3D.vue'

/** Couleurs des héros : stable, prise dans l'ordre d'arrivée au combat. */
export const HERO_COLORS = ['#4f8ef7', '#3fbf7f', '#c264d9', '#f0a63c', '#4fc7d9', '#e0648a']
export const MONSTER_COLORS = ['#b03030', '#3a3a3a']

/**
 * Un monstre mort quitte la carte. Un joueur à 0 PV y reste : il agonise,
 * il n'est pas sorti du combat.
 *
 * Le MJ lit les PV exacts ; un joueur n'a que le statut qualitatif.
 */
export function isDeadMonster(p: CombatParticipant): boolean {
  if (p.kind !== 'monster') return false
  return p.hpStatus === 'mort' || (p.hpCurrent != null && p.hpCurrent <= 0)
}

/**
 * Un PNJ en réserve n'est pas encore entré en scène. Le serveur ne l'envoie
 * déjà pas dans `participants` — on le revérifie ici pour que la carte ne
 * puisse jamais trahir une embuscade.
 */
export function isOnMap(p: CombatParticipant): boolean {
  return !p.hidden && !isDeadMonster(p)
}

/**
 * Repli pour les combats créés avant que le serveur ne place les pions.
 * Volontairement grossier : dès qu'un pion bouge une fois, il n'y revient plus.
 */
function fallbackPosition(kind: string, slot: number): [number, number] {
  const x = ((slot % 5) - 2) * 1.4
  const depth = 3 + Math.floor(slot / 5) * 1.5
  return [x, kind === 'player' ? Math.min(depth, 6) : -Math.min(depth, 6)]
}

/**
 * Les pions à afficher.
 *
 * Le rang (couleur, place de repli) se prend dans l'ordre des **id**, pas dans
 * la liste affichée : celle-ci est triée par initiative et se réduit quand un
 * monstre meurt ou reste en réserve. S'y fier faisait changer de couleur et de
 * case tous les pions suivants dès qu'un voisin entrait en scène ou tombait.
 */
export function buildTokens(participants: CombatParticipant[]): BattleToken[] {
  const slots = new Map<number, number>()
  for (const kind of ['player', 'monster']) {
    participants
      .filter((p) => p.kind === kind)
      .sort((a, b) => a.id - b.id)
      .forEach((p, i) => slots.set(p.id, i))
  }

  return participants.filter(isOnMap).map((p) => {
    const slot = slots.get(p.id) ?? 0
    const hero = p.kind === 'player'
    const palette = hero ? HERO_COLORS : MONSTER_COLORS
    const [dx, dz] = fallbackPosition(p.kind, slot)
    return {
      id: String(p.id),
      name: p.name,
      color: palette[slot % palette.length],
      kind: hero ? 'hero' : 'monster',
      x: p.posX ?? dx,
      z: p.posY ?? dz,
      // hpCurrent est null quand le serveur cache les PV d'un monstre à un
      // joueur : aucune barre ne s'affiche, exactement ce qu'on veut.
      hp: p.hpCurrent ?? undefined,
      hpMax: p.hpMax ?? undefined,
    }
  })
}
