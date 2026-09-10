import type { AbilityKey, Capacite, Voie } from '../data/voies'
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
      if (p.rank > ci) out.push({ capacite, pathName: p.name, rank: ci + 1, voie })
    })
  }
  return out
}

export interface PathEffects {
  abilityBonus: Partial<Record<AbilityKey, number>>
  advantage: Set<AbilityKey>
  /** Qui donne quoi, pour l'infobulle de la fiche. */
  sources: { ability: AbilityKey; bonus: number; from: string }[]
}

/**
 * Cumule les effets passifs des capacités débloquées. Deux capacités qui
 * donnent +2 SAG s'additionnent à +4 : c'est la règle.
 */
export function pathEffects(paths: PathRow[]): PathEffects {
  const abilityBonus: Partial<Record<AbilityKey, number>> = {}
  const advantage = new Set<AbilityKey>()
  const sources: PathEffects['sources'] = []

  for (const { capacite } of unlockedCapacites(paths)) {
    for (const effect of capacite.effects ?? []) {
      if (effect.kind === 'ability') {
        abilityBonus[effect.ability] = (abilityBonus[effect.ability] ?? 0) + effect.bonus
        sources.push({ ability: effect.ability, bonus: effect.bonus, from: capacite.name })
      } else if (effect.kind === 'advantage') {
        advantage.add(effect.on)
      }
    }
  }

  return { abilityBonus, advantage, sources }
}
