import type { VoieFamily } from '../data/voies'

/**
 * Concentration (CO, magie.md) : le sort passe en action limitée et gagne
 * un bonus au choix.
 * - econome : −2 PM (minimum 0)
 * - etendue : durée ou portée ×2 (choix du joueur à la table)
 * - puissante : chaque dé monte d'une catégorie (d4 → d6 → … → d12)
 */
export type ConcentrationMode = 'aucune' | 'econome' | 'etendue' | 'puissante'

export const CONCENTRATION_MODES: ConcentrationMode[] = ['econome', 'etendue', 'puissante']

export const CONCENTRATION_LABELS: Record<ConcentrationMode, string> = {
  aucune: 'Sort normal',
  econome: 'Économe : −2 PM',
  etendue: 'Étendue : portée ou durée ×2',
  puissante: 'Puissante : dés +1 catégorie',
}

/** Coût en PM d'un sort de ce rang selon le mode de concentration. */
export function concentratedPmCost(rank: number, mode: ConcentrationMode): number {
  if (mode === 'econome') return Math.max(0, rank - 2)
  return rank
}

/** d4 → d6 → d8 → d10 → d12. Le d12 plafonne, le d20 (dé de test) n'est jamais touché. */
export function upgradeDie(sides: number): number {
  if (sides >= 12) return sides
  if (sides < 4) return sides
  return sides + 2
}

/** Monte tous les dés d4..d10 d'un texte : "[2d6+Mod.INT] DM" → "[2d8+Mod.INT] DM". */
export function upgradeDiceInText(text: string): string {
  return text.replace(/(\d*)d(4|6|8|10)\b/gi, (_m, count: string, sides: string) => {
    return `${count}d${upgradeDie(parseInt(sides, 10))}`
  })
}

interface ConcentrableAction {
  name: string
  /** null = pas un sort (talent magique, capacité martiale…) */
  pmCost: number | null
  voieFamily?: VoieFamily
}

/** Sous tension (magie élémentaliste) refuse toute concentration (voies-de-profil.md). */
const NEVER_CONCENTRATE = new Set(['Sous tension'])

/** Les modes de concentration permis pour cette action. Vide = pas de sélecteur. */
export function allowedModes(action: ConcentrableAction): ConcentrationMode[] {
  if (action.pmCost == null) return []
  if (NEVER_CONCENTRATE.has(action.name)) return []
  // Les sorts des voies de prestige n'ont pas droit à la magie économe.
  if (action.voieFamily === 'prestige') return CONCENTRATION_MODES.filter((m) => m !== 'econome')
  return [...CONCENTRATION_MODES]
}
