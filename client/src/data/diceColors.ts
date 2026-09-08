/**
 * Palette des couleurs de dé. Copie de `server/src/campaigns/diceColors.ts` :
 * les deux doivent rester identiques.
 */
export const DICE_COLORS: { hex: string; label: string }[] = [
  { hex: '#d64545', label: 'Rubis' },
  { hex: '#e08a35', label: 'Safran' },
  { hex: '#2f8f5c', label: 'Émeraude' },
  { hex: '#3d7bd9', label: 'Saphir' },
  { hex: '#7c52c9', label: 'Améthyste' },
  { hex: '#c93f82', label: 'Fuchsia' },
  { hex: '#1f9490', label: 'Turquoise' },
  { hex: '#64707d', label: 'Ardoise' },
]

const INK_DARK = '#241a0d'
const INK_LIGHT = '#fdf3e6'

/** Luminance relative (WCAG) d'un `#rrggbb`. 0 = noir, 1 = blanc. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '')
  if (value.length !== 6) return 0
  const channel = (i: number) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/**
 * Couleur des chiffres pour un fond donné : encre sombre sur un dé clair,
 * encre claire sur un dé sombre. Seuil à 0,3 : le safran passe en sombre, tous
 * les autres tons de la palette en clair.
 */
export function inkFor(hex: string): string {
  if (hex.replace('#', '').length !== 6) return INK_DARK
  return relativeLuminance(hex) > 0.3 ? INK_DARK : INK_LIGHT
}
