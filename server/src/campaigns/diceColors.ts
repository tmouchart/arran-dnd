/**
 * Couleurs de dé par défaut. Chaque membre reçoit celle de son rang d'entrée
 * dans la campagne : distinctes tant qu'ils sont 8 ou moins, sans réglage.
 *
 * Copie côté client dans `client/src/data/diceColors.ts` — les deux doivent
 * rester identiques.
 */
export const DICE_COLORS = [
  '#d64545', // rubis
  '#e08a35', // safran
  '#2f8f5c', // émeraude
  '#3d7bd9', // saphir
  '#7c52c9', // améthyste
  '#c93f82', // fuchsia
  '#1f9490', // turquoise
  '#64707d', // ardoise
] as const

const HEX = /^#[0-9a-f]{6}$/i

export function isDiceColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

/** Couleur par défaut d'un membre, d'après sa place dans la liste des membres. */
export function defaultDiceColor(memberIndex: number): string {
  const index = memberIndex < 0 ? 0 : memberIndex
  return DICE_COLORS[index % DICE_COLORS.length]
}

/** La couleur effective : celle choisie par le joueur, sinon celle de son rang. */
export function resolveDiceColor(chosen: string | null | undefined, memberIndex: number): string {
  return isDiceColor(chosen) ? chosen.toLowerCase() : defaultDiceColor(memberIndex)
}
