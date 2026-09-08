/**
 * Les polices proposées pour les chiffres du dé.
 *
 * Toutes sont déjà chargées par `index.html` — on n'en ajoute aucune. `family`
 * est le nom exact à donner à `document.fonts.load()` : une police que le thème
 * courant n'utilise nulle part n'est pas téléchargée tant qu'on ne la demande
 * pas, et le canvas retomberait alors silencieusement sur du serif.
 *
 * La liste des slugs est copiée dans `server/src/campaigns/diceStyle.ts` — les
 * deux doivent rester identiques.
 */
export interface DiceFont {
  slug: string
  label: string
  family: string
  stack: string
}

export const DICE_FONTS: DiceFont[] = [
  { slug: 'metamorphous', label: 'Grimoire', family: 'Metamorphous', stack: "'Metamorphous', Georgia, serif" },
  { slug: 'uncial', label: 'Onciale', family: 'Uncial Antiqua', stack: "'Uncial Antiqua', Georgia, serif" },
  { slug: 'cinzel', label: 'Gravé', family: 'Cinzel Decorative', stack: "'Cinzel Decorative', Georgia, serif" },
  { slug: 'pirata', label: 'Gothique', family: 'Pirata One', stack: "'Pirata One', Georgia, serif" },
  { slug: 'cormorant', label: 'Élégante', family: 'Cormorant Garamond', stack: "'Cormorant Garamond', Georgia, serif" },
  { slug: 'lora', label: 'Classique', family: 'Lora', stack: "'Lora', Georgia, serif" },
  { slug: 'moderne', label: 'Moderne', family: 'system-ui', stack: 'system-ui, -apple-system, sans-serif' },
]

export const DICE_FONT_SLUGS = DICE_FONTS.map((f) => f.slug)

export function diceFont(slug: string | null | undefined): DiceFont | null {
  return DICE_FONTS.find((f) => f.slug === slug) ?? null
}

/**
 * S'assure que la police est prête avant de peindre l'atlas. Sans ça, le
 * premier rendu sort en serif et rien ne le recalcule.
 */
export async function ensureDiceFont(slug: string | null | undefined): Promise<void> {
  const font = diceFont(slug)
  if (!font || font.slug === 'moderne' || typeof document === 'undefined' || !document.fonts) return
  try {
    await document.fonts.load(`700 128px "${font.family}"`)
  } catch { /* police indisponible : le canvas retombe sur le serif */ }
}
