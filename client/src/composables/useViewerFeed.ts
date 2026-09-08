import { ref } from 'vue'
import type { RollEvent } from '../api/campaigns'
import { rollOutcome, type RollOutcome } from '../utils/rollOutcome'
import { dominantColor, parseDiceStyle } from '../data/diceStyle'

/**
 * Le fil d'actions du mode table : « Minizou · Boule de feu — 17 ».
 *
 * Une ligne par jet public, plus une ligne « jet secret » quand le MJ fait un
 * critique caché. Le fil ne garde que les dernières lignes : c'est un écran
 * qu'on regarde, pas un historique qu'on consulte.
 */
export interface FeedLine {
  id: string
  actorName: string
  /** Couleur du lanceur, pour le nom. Absente sur un jet secret. */
  color?: string
  label: string
  sides: number
  /** Null sur un jet secret : la table ne voit que l'issue. */
  total: number | null
  damage: number | null
  outcome: RollOutcome
  secret: boolean
}

export const MAX_FEED = 12

export const feed = ref<FeedLine[]>([])

/** Transforme un jet reçu en ligne du fil. Pure, testable. */
export function feedLineFor(roll: RollEvent): FeedLine {
  const style = parseDiceStyle(roll.diceStyle)
  return {
    id: `roll-${roll.id}`,
    actorName: roll.actorName,
    color: style ? dominantColor(style) : undefined,
    label: roll.label,
    sides: roll.sides,
    total: roll.total,
    damage: roll.damage?.total ?? null,
    outcome: rollOutcome(roll),
    secret: false,
  }
}

let secretSequence = 0

/** Le MJ a fait un critique caché : la table frissonne sans voir le chiffre. */
export function secretLineFor(moment: { outcome: RollOutcome; actorName: string }): FeedLine {
  return {
    id: `secret-${++secretSequence}`,
    actorName: moment.actorName,
    label: 'jet secret…',
    sides: 0,
    total: null,
    damage: null,
    outcome: moment.outcome,
    secret: true,
  }
}

/** Ajoute une ligne en tête, en oubliant les plus vieilles. Pure. */
export function pushLine(lines: FeedLine[], line: FeedLine): FeedLine[] {
  if (lines.some((l) => l.id === line.id)) return lines
  return [line, ...lines].slice(0, MAX_FEED)
}

export function appendFeed(line: FeedLine): void {
  feed.value = pushLine(feed.value, line)
}

export function clearFeed(): void {
  feed.value = []
}
