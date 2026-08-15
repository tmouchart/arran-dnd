import { ref } from 'vue'
import { postCampaignRoll } from '../api/campaigns'
import { user } from './useAuth'
import { useCampaignRolls } from './useCampaignRolls'
import { celebrate } from './useCriticalMoment'
import { rollOutcome } from '../utils/rollOutcome'

/** D'où vient un jet — contexte affiché dans le log partagé. */
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
  const { wake } = useCampaignRolls()

  function addRoll(entry: Omit<RollEntry, 'id' | 'timestamp'>, context: RollContext = 'actions') {
    const full: RollEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    history.value.unshift(full)
    if (history.value.length > MAX_ENTRIES) history.value = history.value.slice(0, MAX_ENTRIES)
    save(history.value)

    // Le moment critique part d'ici : addRoll est appelé une fois le dé posé,
    // donc le halo tombe pile avec les étincelles. Les autres joueurs le
    // reçoivent par SSE au même instant, puisque le POST part juste après.
    const outcome = rollOutcome(full)
    if (outcome) celebrate(outcome, full.characterName)

    // Relais vers le log partagé de la campagne : tout jet part, en combat ou
    // non. C'est le serveur qui décide s'il le tague avec un combat.
    // Fire-and-forget — le jet local reste la vérité si le réseau échoue.
    const campaignId = user.value?.activeCampaignId
    if (campaignId) {
      wake()
      postCampaignRoll(campaignId, {
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
