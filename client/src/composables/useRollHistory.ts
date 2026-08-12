import { ref } from 'vue'
import { postCombatRoll } from '../api/combats'
import { useActiveCombat } from './useActiveCombat'

/** D'où vient un jet — contexte affiché dans le log de combat partagé. */
export type RollContext = 'actions' | 'combat' | 'fiche' | 'agonie' | 'sandbox'

export type RollKind = 'weapon' | 'action' | 'ability' | 'manoeuvre' | 'competence' | 'libre'

export interface RollEntry {
  id: string
  timestamp: number
  characterName: string
  kind: RollKind
  label: string
  /** Face value of the (first) die rolled */
  die: number
  /** Number of faces of the die (12 quand affaibli, 20 sinon, libre = au choix) */
  sides: number
  bonus: number
  total: number
  /** Individual die results when several dice were rolled (sandbox 'libre'). */
  rolls?: number[]
  /** Extra damage info (weapons only) */
  damage?: { total: number; critical: boolean; fumble: boolean }
}

/**
 * Highlight critique/fumble d'une entrée d'historique.
 * Les jets libres (sandbox) n'ont JAMAIS de critique ni de fumble :
 * le crit ne garde son sens que pour les jets d'attaque/carac (d20, ou d12 en affaibli).
 */
export function rollHighlight(
  entry: Pick<RollEntry, 'kind' | 'die' | 'sides' | 'damage'>,
): 'critical' | 'fumble' | null {
  if (entry.kind === 'libre') return null
  if (entry.damage?.critical || entry.die === entry.sides) return 'critical'
  if (entry.damage?.fumble || entry.die === 1) return 'fumble'
  return null
}

const STORAGE_KEY = 'arran-roll-history'
const MAX_ENTRIES = 200

function load(): RollEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    // Fallback : les vieilles entrées n'ont pas de champ `sides` (toujours d20 à l'époque)
    return (JSON.parse(raw) as RollEntry[]).map((e) => ({ ...e, sides: e.sides ?? 20 }))
  } catch {
    return []
  }
}

function save(entries: RollEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch { /* quota */ }
}

const history = ref<RollEntry[]>(load())

export function useRollHistory() {
  const { activeCombat } = useActiveCombat()

  function addRoll(entry: Omit<RollEntry, 'id' | 'timestamp'>, context: RollContext = 'actions') {
    const full: RollEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    history.value.unshift(full)
    if (history.value.length > MAX_ENTRIES) history.value = history.value.slice(0, MAX_ENTRIES)
    save(history.value)

    // Relais vers le log de combat partagé : tout jet fait pendant qu'un combat
    // est actif est loggé, peu importe la page. Fire-and-forget — le jet local
    // reste la vérité pour le joueur si le réseau échoue.
    const combat = activeCombat.value
    if (combat) {
      postCombatRoll(combat.campaignId, combat.combatId, {
        kind: entry.kind,
        label: entry.label,
        context,
        die: entry.die,
        sides: entry.sides,
        bonus: entry.bonus,
        total: entry.total,
        rolls: entry.rolls,
        damage: entry.damage,
      }).catch(() => { /* silencieux */ })
    }
  }

  function clearHistory() {
    history.value = []
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* quota */ }
  }

  return { history, addRoll, clearHistory }
}
