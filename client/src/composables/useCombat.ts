import { ref, computed } from 'vue'
import { user } from './useAuth'
import * as api from '../api/combats'
import type { CombatState, CombatParticipant } from '../api/combats'
import { setActiveCombat, clearActiveCombat } from './useActiveCombat'

const combat = ref<CombatState | null>(null)
const connecting = ref(false)
const error = ref<string | null>(null)
let eventSource: EventSource | null = null
let currentCampaignId: number | null = null

export function useCombat() {
  const isGm = computed(() => {
    // GM is determined by whether the user can see monster HP (hpCurrent !== null on monsters)
    // But we also need the campaignId context — so we check if current user's ID
    // matches the GM pattern (first participant check or separate field)
    // For now, we detect GM by checking if any monster has non-null hpCurrent
    if (!combat.value || !user.value) return false
    const monster = combat.value.participants.find((p) => p.kind === 'monster')
    if (!monster) return true // No monsters = could be GM
    return monster.hpCurrent !== null
  })

  const currentParticipant = computed<CombatParticipant | null>(() => {
    if (!combat.value) return null
    return combat.value.participants[combat.value.currentTurnIndex] ?? null
  })

  const isMyTurn = computed(() => {
    if (!currentParticipant.value || !user.value) return false
    return currentParticipant.value.userId === user.value.id
  })

  const myParticipant = computed<CombatParticipant | null>(() => {
    if (!combat.value || !user.value) return null
    return combat.value.participants.find(
      (p) => p.kind === 'player' && p.userId === user.value!.id,
    ) ?? null
  })

  function connect(campaignId: number, combatId: number): void {
    disconnect()
    currentCampaignId = campaignId
    connecting.value = true
    error.value = null
    eventSource = new EventSource(
      `/api/campaigns/${campaignId}/combats/${combatId}/events`,
      { withCredentials: true },
    )
    eventSource.addEventListener('combat-updated', (e: MessageEvent) => {
      try {
        const state = JSON.parse(e.data as string) as CombatState
        combat.value = state
        connecting.value = false
        if (state.status === 'active') {
          setActiveCombat({
            url: `/campagnes/${campaignId}/combat/${combatId}`,
            name: state.name,
            campaignId,
            combatId,
          })
        } else {
          clearActiveCombat()
        }
      } catch {
        error.value = 'Erreur de parsing SSE'
      }
    })
    eventSource.onerror = () => {
      error.value = 'Connexion perdue'
      connecting.value = false
    }
  }

  function disconnect(): void {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    combat.value = null
    connecting.value = false
    error.value = null
    currentCampaignId = null
    // Don't clear activeCombat here — the banner should persist when navigating away
  }

  async function doNextTurn(): Promise<void> {
    if (!combat.value || !currentCampaignId) return
    await api.nextTurn(currentCampaignId, combat.value.id)
  }

  async function doPrevTurn(): Promise<void> {
    if (!combat.value || !currentCampaignId) return
    await api.prevTurn(currentCampaignId, combat.value.id)
  }

  async function updateHp(participantId: number, hpCurrent: number): Promise<void> {
    if (!combat.value || !currentCampaignId) return
    await api.updateParticipantHp(currentCampaignId, combat.value.id, participantId, hpCurrent)
  }

  async function addMonster(data: Record<string, unknown>): Promise<void> {
    if (!combat.value || !currentCampaignId) return
    await api.addCombatMonster(currentCampaignId, combat.value.id, data)
  }

  async function finish(): Promise<void> {
    if (!combat.value || !currentCampaignId) return
    await api.finishCombat(currentCampaignId, combat.value.id)
  }

  return {
    combat,
    connecting,
    error,
    isGm,
    currentParticipant,
    isMyTurn,
    myParticipant,
    connect,
    disconnect,
    nextTurn: doNextTurn,
    prevTurn: doPrevTurn,
    updateHp,
    addMonster,
    finish,
  }
}
