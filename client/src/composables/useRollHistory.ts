import { ref } from 'vue'

export type RollKind = 'weapon' | 'action' | 'ability' | 'manoeuvre' | 'competence'

export interface RollEntry {
  id: string
  timestamp: number
  characterName: string
  kind: RollKind
  label: string
  /** d20 face value */
  die: number
  bonus: number
  total: number
  /** Extra damage info (weapons only) */
  damage?: { total: number; critical: boolean; fumble: boolean }
}

const STORAGE_KEY = 'arran-roll-history'
const MAX_ENTRIES = 200

function load(): RollEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as RollEntry[]) : []
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
  function addRoll(entry: Omit<RollEntry, 'id' | 'timestamp'>) {
    const full: RollEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    history.value.unshift(full)
    if (history.value.length > MAX_ENTRIES) history.value = history.value.slice(0, MAX_ENTRIES)
    save(history.value)
  }

  function clearHistory() {
    history.value = []
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* quota */ }
  }

  return { history, addRoll, clearHistory }
}
