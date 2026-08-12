import { ref } from 'vue'
import { fetchActiveCombat } from '../api/combats'

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

/**
 * Resynchronise le combat actif depuis le serveur (au chargement de l'app et
 * au retour au premier plan). Sert au relais global des jets : tout jet fait
 * pendant qu'un combat est actif est loggé, même hors de la page combat.
 */
export async function refreshActiveCombat(): Promise<void> {
  try {
    const active = await fetchActiveCombat()
    if (active) {
      setActiveCombat({
        url: `/campagnes/${active.campaignId}/combat/${active.combatId}`,
        name: active.name,
        campaignId: active.campaignId,
        combatId: active.combatId,
      })
    } else {
      clearActiveCombat()
    }
  } catch { /* offline : on garde l'état localStorage */ }
}

export function useActiveCombat() {
  return { activeCombat }
}
