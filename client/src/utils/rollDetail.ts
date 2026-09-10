/**
 * Le détail chiffré d'un jet, en parties structurées.
 *
 * Trois surfaces l'affichent (les deux panneaux de log et les cartes de
 * `/actions`) avec des mises en page différentes : on renvoie donc les morceaux,
 * pas une chaîne toute faite. À chacun de barrer les dés écartés comme il veut.
 */
export interface RollDetailParts {
  /** "d20" pour un jet simple, "3d6" quand plusieurs dés s'additionnent. */
  label: string
  /** Les dés qui comptent — ils s'additionnent. */
  kept: number[]
  /** Les dés lancés puis jetés (avantage, relance). Jamais dans le total. */
  dropped: number[]
  /** 0 = à ne pas afficher. */
  bonus: number
}

/** Ce qu'il faut d'un jet pour en écrire le détail. */
export interface RollDetailInput {
  die: number
  sides: number
  bonus: number
  rolls?: number[] | null
  dropped?: number[] | null
}

/**
 * Attention à ne pas confondre les deux listes : `rolls` ce sont des dés qui
 * s'additionnent tous (le 3d6 du bac à sable), `dropped` des dés écartés.
 */
export function rollDetailParts(r: RollDetailInput): RollDetailParts {
  const multiple = !!r.rolls && r.rolls.length > 1
  return {
    label: multiple ? `${r.rolls!.length}d${r.sides}` : `d${r.sides}`,
    kept: multiple ? [...r.rolls!] : [r.die],
    dropped: r.dropped ? [...r.dropped] : [],
    bonus: r.bonus,
  }
}
