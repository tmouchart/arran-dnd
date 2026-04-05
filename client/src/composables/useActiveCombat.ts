import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const STORAGE_KEY = 'arran-active-combat'

interface ActiveCombatInfo {
  url: string
  name: string
  campaignId: number
  combatId: number
}

const activeCombat = ref<ActiveCombatInfo | null>(loadFromStorage())

function loadFromStorage(): ActiveCombatInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setActiveCombat(info: ActiveCombatInfo): void {
  activeCombat.value = info
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
}

export function clearActiveCombat(): void {
  activeCombat.value = null
  localStorage.removeItem(STORAGE_KEY)
}

export function useActiveCombat() {
  return { activeCombat }
}
