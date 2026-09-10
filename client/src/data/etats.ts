/**
 * Les états préjudiciables — `knowledge/topics/combat.md`.
 *
 * Les 8 de la section « États préjudiciables », plus les 5 que produisent les
 * manœuvres du même fichier. Rien d'inventé : chaque `effect` est la règle
 * recopiée, c'est le texte qu'on affiche tel quel dans l'infobulle.
 *
 * L'emoji sert au pion du champ de bataille, qui est un canvas 3D : on ne peut
 * pas y poser un SVG Lucide sans le rastériser. Les icônes Lucide (rendu Vue)
 * viendront à côté, l'emoji reste la source pour le pion.
 */

import type { FunctionalComponent } from 'vue'
import {
  Anchor, Ban, Crosshair, EyeOff, Lock, PersonStanding, Sparkles, Sword, Turtle, Wind,
} from 'lucide-vue-next'

export const ETAT_IDS = [
  'aveugle', 'affaibli', 'etourdi', 'immobilise', 'paralyse', 'ralenti',
  'renverse', 'surpris', 'desarme', 'bloque', 'repousse', 'diversion', 'menace',
] as const

export type EtatId = (typeof ETAT_IDS)[number]

export interface Etat {
  id: EtatId
  label: string
  /** La ligne de règle, affichée telle quelle. */
  effect: string
  /**
   * L'icone Lucide du rendu Vue. Absente pour affaibli / surpris / diversion :
   * aucun pictogramme lisible, ces trois-la affichent leur emoji partout.
   */
  icon?: FunctionalComponent
  /** Ce que dessine le pion 3D. */
  emoji: string
  /** Empêche d'agir : passe en tête quand il faut couper la liste. */
  blocking?: boolean
}

export const ETATS: Etat[] = [
  { id: 'aveugle', icon: EyeOff, label: "Aveuglé", effect: "-5 initiative, -5 attaque, -5 DEF ; -10 en attaque à distance", emoji: '🙈' },
  { id: 'affaibli', label: "Affaibli", effect: "Tous les jets se font en d12 au lieu du d20", emoji: '🥀' },
  { id: 'etourdi', icon: Sparkles, label: "Étourdi", effect: "Aucune action possible, -5 DEF", emoji: '😵', blocking: true },
  { id: 'immobilise', icon: Anchor, label: "Immobilisé", effect: "Pas de déplacement ; d12 au lieu du d20 aux tests", emoji: '⚓' },
  { id: 'paralyse', icon: Lock, label: "Paralysé", effect: "Aucune action ; une attaque au contact touche automatiquement et inflige un critique", emoji: '🔒', blocking: true },
  { id: 'ralenti', icon: Turtle, label: "Ralenti", effect: "Une seule action par tour (attaque ou mouvement)", emoji: '🐢' },
  { id: 'renverse', icon: PersonStanding, label: "Renversé", effect: "-5 attaque et DEF ; une action de mouvement pour se relever", emoji: '⬇️' },
  { id: 'surpris', label: "Surpris", effect: "Pas d'action ; -5 DEF au premier tour de combat", emoji: '😲', blocking: true },
  { id: 'desarme', icon: Sword, label: "Désarmé", effect: "A lâché son arme ; une action de mouvement pour la ramasser", emoji: '🗡️' },
  { id: 'bloque', icon: Ban, label: "Bloqué", effect: "Ne peut pas se déplacer lors de son prochain tour", emoji: '🚫', blocking: true },
  { id: 'repousse', icon: Wind, label: "Repoussé", effect: "A reculé de 1d6 mètres", emoji: '💨' },
  { id: 'diversion', label: "Diversion", effect: "-5 à tous les tests de perception et en DEF jusqu'à son prochain tour", emoji: '🎭' },
  { id: 'menace', icon: Crosshair, label: "Menacé", effect: "S'il attaque celui qui l'a menacé : attaque au contact automatiquement réussie contre lui, DM +1d6", emoji: '🎯' },
]

export const ETAT_BY_ID = Object.fromEntries(ETATS.map((e) => [e.id, e])) as Record<EtatId, Etat>

export function isEtatId(value: unknown): value is EtatId {
  return typeof value === 'string' && value in ETAT_BY_ID
}

/** Trie (bloquants d'abord, puis ordre du catalogue) et dédoublonne. */
export function sortEtats(ids: readonly string[]): Etat[] {
  const seen = new Set<string>()
  const kept: Etat[] = []
  for (const id of ids) {
    if (!isEtatId(id) || seen.has(id)) continue
    seen.add(id)
    kept.push(ETAT_BY_ID[id])
  }
  const rank = (e: Etat) => (e.blocking ? 0 : 1)
  return kept.sort((a, b) => rank(a) - rank(b) || ETATS.indexOf(a) - ETATS.indexOf(b))
}

/** Ce que le pion affiche : `max` pastilles, et le reste compté. */
export function visibleEtats(ids: readonly string[], max = 3): { etats: Etat[]; overflow: number } {
  const all = sortEtats(ids)
  if (all.length <= max) return { etats: all, overflow: 0 }
  return { etats: all.slice(0, max), overflow: all.length - max }
}
