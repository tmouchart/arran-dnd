/**
 * Palette de base. Chaque membre reçoit la couleur de son rang d'entrée dans la
 * campagne : distinctes tant qu'ils sont 8 ou moins, sans réglage. Voir
 * `diceStyle.ts` pour le style complet construit par-dessus.
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
