import { ref } from 'vue'
import { fetchCampaignRolls, type RollEvent } from '../api/campaigns'

/** Filtre du panneau de log. */
export type RollFilter = 'all' | 'combat' | 'player' | 'monster'

const MAX_ROLLS = 200
const FILTER_KEY = 'arran-roll-filter'
const PANEL_KEY = 'arran-roll-panel'

// Le flux est relâché après cette durée sans activité : une connexion SSE
// ouverte en permanence empêcherait la machine Fly de s'endormir.
const IDLE_MS = 25 * 60 * 1000

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const rolls = ref<RollEvent[]>([])
const unread = ref(0)
const panelOpen = ref(stored(PANEL_KEY) === '1')
const filter = ref<RollFilter>((stored(FILTER_KEY) as RollFilter | null) ?? 'all')

let eventSource: EventSource | null = null
let connectedCampaignId: number | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

function closeStream(): void {
  eventSource?.close()
  eventSource = null
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
}

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(closeStream, IDLE_MS)
}

function appendRoll(roll: RollEvent): void {
  if (rolls.value.some((r) => r.id === roll.id)) return
  rolls.value.push(roll)
  if (rolls.value.length > MAX_ROLLS) rolls.value = rolls.value.slice(-MAX_ROLLS)
  if (!panelOpen.value) unread.value += 1
}

/** Recharge l'historique et le fusionne avec ce qui est déjà affiché. */
async function syncHistory(campaignId: number): Promise<void> {
  try {
    const history = await fetchCampaignRolls(campaignId)
    const known = new Set(rolls.value.map((r) => r.id))
    const missing = history.filter((r) => !known.has(r.id))
    if (missing.length === 0) return
    rolls.value = [...rolls.value, ...missing]
      .sort((a, b) => a.id - b.id)
      .slice(-MAX_ROLLS)
  } catch { /* silencieux */ }
}

function connect(campaignId: number): void {
  if (connectedCampaignId === campaignId && eventSource) return
  disconnect()
  connectedCampaignId = campaignId

  eventSource = new EventSource(`/api/campaigns/${campaignId}/events`, { withCredentials: true })
  resetIdleTimer()
  eventSource.addEventListener('roll', (e: MessageEvent) => {
    try {
      appendRoll(JSON.parse(e.data as string) as RollEvent)
      resetIdleTimer()
    } catch { /* ignore */ }
  })

  // Le SSE ne porte que le flux live — l'historique vient du GET. On le rejoue
  // à CHAQUE ouverture, y compris les reconnexions automatiques d'EventSource :
  // sinon les jets émis pendant une coupure réseau manquent pour toujours.
  eventSource.onopen = () => { void syncHistory(campaignId) }
  void syncHistory(campaignId)
}

function disconnect(): void {
  closeStream()
  connectedCampaignId = null
  rolls.value = []
  unread.value = 0
}

/** Rouvre le flux s'il a été relâché pour inactivité (retour au premier plan, jet lancé…). */
function wake(): void {
  if (connectedCampaignId != null && !eventSource) connect(connectedCampaignId)
  else resetIdleTimer()
}

function togglePanel(open?: boolean): void {
  panelOpen.value = open ?? !panelOpen.value
  localStorage.setItem(PANEL_KEY, panelOpen.value ? '1' : '0')
  if (panelOpen.value) {
    unread.value = 0
    wake()
  }
}

function setFilter(value: RollFilter): void {
  filter.value = value
  localStorage.setItem(FILTER_KEY, value)
}

/** Applique le filtre du panneau à une liste de jets. */
export function filterRolls(list: RollEvent[], value: RollFilter): RollEvent[] {
  switch (value) {
    case 'combat': return list.filter((r) => r.combatId != null)
    case 'player': return list.filter((r) => r.actorKind === 'player')
    case 'monster': return list.filter((r) => r.actorKind === 'monster')
    default: return list
  }
}

export function useCampaignRolls() {
  return { rolls, unread, panelOpen, filter, connect, disconnect, wake, togglePanel, setFilter }
}
