import type { AbilityKey, Capacite, StatBonus, Voie } from '../data/voies'
import type { PathRow } from '../types/character'
import { VOIES_BY_ID } from '../data/voies'
import { PEUPLE_VOIES_BY_ID, type PeupleVoie } from '../data/peuples'

const ALL_VOIES_BY_ID: Record<string, Voie | PeupleVoie> = { ...VOIES_BY_ID, ...PEUPLE_VOIES_BY_ID }

export interface UnlockedCapacite {
  capacite: Capacite
  /** Nom de la voie tel qu'il figure sur la fiche du joueur. */
  pathName: string
  /** Rang de la capacité dans sa voie, de 1 à 5. */
  rank: number
  /** Rang atteint dans la voie (≥ rank). Sert aux bonus qui grandissent avec la voie. */
  pathRank: number
  /** La voie de données d'où vient la capacité (les voies de profil ont une `family`). */
  voie: Voie | PeupleVoie
}

/**
 * Toutes les capacités débloquées par les voies du personnage, voies de profil
 * comme voies de peuple. À chaque appelant de filtrer ensuite : les passifs
 * (`active === false`) ou les actions (`active`).
 */
export function unlockedCapacites(paths: PathRow[]): UnlockedCapacite[] {
  const out: UnlockedCapacite[] = []
  for (const p of paths) {
    const voie = p.id ? ALL_VOIES_BY_ID[p.id] : undefined
    if (!voie || p.rank <= 0) continue
    voie.capacites.forEach((capacite, ci) => {
      if (p.rank > ci) out.push({ capacite, pathName: p.name, rank: ci + 1, pathRank: p.rank, voie })
    })
  }
  return out
}

/** Un bonus et la capacité qui le donne, pour l'infobulle de la fiche. */
export interface BonusSource {
  bonus: number
  from: string
}

/** Un bonus pas encore chiffré : un Mod. de carac se lit sur les caracs finales. */
export interface StatSource {
  bonus: StatBonus
  from: string
}

export interface PathEffects {
  abilityBonus: Partial<Record<AbilityKey, number>>
  advantage: Set<AbilityKey>
  /** Qui donne quoi, pour l'infobulle de la fiche. */
  sources: { ability: AbilityKey; bonus: number; from: string }[]
  /** DEF, initiative, PV max : résolus par `characterStats` (un Mod. dépend des caracs). */
  def: StatSource[]
  init: StatSource[]
  hp: StatSource[]
  /** Réduction des DM subis, cumulable. */
  rd: BonusSource[]
  /** +X fixe à tous les tests d'une carac. */
  testBonus: Partial<Record<AbilityKey, BonusSource[]>>
  /** Plus petit résultat du d20 qui fait un critique (20 sans capacité). */
  critMin: number
  /** Le même seuil avec une rapière. */
  critMinRapiere: number
  /** Bonus avec l'arme de prédilection. */
  favoriteAttack: number
  favoriteDamage: number
  /** Mods de carac ajoutés aux DM à l'arc. */
  bowDamage: AbilityKey[]
  /** Capacités devenues des actions d'attaque. */
  fasterActions: Set<string>
}

/**
 * Cumule les effets passifs des capacités débloquées. Deux capacités qui
 * donnent +2 SAG s'additionnent à +4 : c'est la règle.
 */
export function pathEffects(paths: PathRow[]): PathEffects {
  const out: PathEffects = {
    abilityBonus: {},
    advantage: new Set(),
    sources: [],
    def: [],
    init: [],
    hp: [],
    rd: [],
    testBonus: {},
    critMin: 20,
    critMinRapiere: 20,
    favoriteAttack: 0,
    favoriteDamage: 0,
    bowDamage: [],
    fasterActions: new Set(),
  }

  for (const { capacite, pathRank } of unlockedCapacites(paths)) {
    const from = capacite.name
    for (const effect of capacite.effects ?? []) {
      switch (effect.kind) {
        case 'ability':
          out.abilityBonus[effect.ability] = (out.abilityBonus[effect.ability] ?? 0) + effect.bonus
          out.sources.push({ ability: effect.ability, bonus: effect.bonus, from })
          break
        case 'advantage':
          out.advantage.add(effect.on)
          break
        case 'def':
        case 'init':
        case 'hp':
          if (pathRank >= (effect.fromRank ?? 0)) out[effect.kind].push({ bonus: effect.bonus, from })
          break
        case 'rd':
          out.rd.push({ bonus: effect.bonus, from })
          break
        case 'test':
          ;(out.testBonus[effect.on] ??= []).push({ bonus: effect.bonus, from })
          break
        case 'critRange':
          out.critMin = Math.min(out.critMin, effect.min)
          out.critMinRapiere = Math.min(out.critMinRapiere, effect.rapiere ?? effect.min)
          break
        case 'favoriteWeapon':
          out.favoriteAttack += effect.attack ?? 0
          out.favoriteDamage += effect.damage ?? 0
          break
        case 'bowDamage':
          out.bowDamage.push(effect.mod)
          break
        case 'fasterAction':
          out.fasterActions.add(effect.capacite)
          break
        case 'attackAdvantage':
          break
      }
    }
  }

  return out
}

/** Somme de bonus déjà chiffrés. */
export function sumBonus(sources: BonusSource[] | undefined): number {
  return (sources ?? []).reduce((s, x) => s + x.bonus, 0)
}
