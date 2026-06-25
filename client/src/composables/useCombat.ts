import { ref, computed } from 'vue'
import { user } from './useAuth'
import { character } from './useCharacter'
import * as api from '../api/combats'
import type { CombatState, CombatParticipant } from '../api/combats'
import { setActiveCombat, clearActiveCombat } from './useActiveCombat'

const combat = ref<CombatState | null>(null)
const connecting = ref(false)
const error = ref<string | null>(null)
const idle = ref(false)
let eventSource: EventSource | null = null
let currentCampaignId: number | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

// Combat paused after this much inactivity (no combat update nor user interaction)
// → release the SSE connection so Fly can auto-stop the machine.
const IDLE_MS = 25 * 60 * 1000

function closeStream(): void {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    closeStream()
    combat.value = null
    connecting.value = false
    idle.value = true
  }, IDLE_MS)
}

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
    idle.value = false
    eventSource = new EventSource(
      `/api/campaigns/${campaignId}/combats/${combatId}/events`,
      { withCredentials: true },
    )
    resetIdleTimer()
    eventSource.addEventListener('combat-updated', (e: MessageEvent) => {
      try {
        const state = JSON.parse(e.data as string) as CombatState
        combat.value = state
        connecting.value = false
        error.value = null
        resetIdleTimer()
        // Keep my own character sheet HP in sync with the live combat state
        // (combat is the moment my HP changes — reflect it in "Mes actions"/ma perso).
        if (user.value) {
          const mine = state.participants.find(
            (p) => p.kind === 'player' && p.userId === user.value!.id,
          )
          if (mine && mine.hpCurrent != null && character.value.hpCurrent !== mine.hpCurrent) {
            character.value.hpCurrent = mine.hpCurrent
          }
        }
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
      // EventSource reconnecte automatiquement tant qu'il n'est pas CLOSED.
      // On n'affiche l'erreur fatale qu'en cas de fermeture définitive ;
      // sur une coupure transitoire on garde l'état affiché pendant la reco.
      if (eventSource?.readyState === EventSource.CLOSED) {
        error.value = 'Connexion perdue'
        connecting.value = false
      }
    }
  }

  function disconnect(): void {
    closeStream()
    combat.value = null
    connecting.value = false
    error.value = null
    idle.value = false
    currentCampaignId = null
    // Don't clear activeCombat here — the banner should persist when navigating away
  }

  // Reset the inactivity timer on user interaction (only while connected).
  function markActivity(): void {
    if (eventSource) resetIdleTimer()
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

  async function removeMonster(participantId: number): Promise<void> {
    if (!combat.value || !currentCampaignId) return
    await api.removeCombatParticipant(currentCampaignId, combat.value.id, participantId)
  }

  async function finish(): Promise<void> {
    if (!combat.value || !currentCampaignId) return
    await api.finishCombat(currentCampaignId, combat.value.id)
  }

  return {
    combat,
    connecting,
    error,
    idle,
    isGm,
    currentParticipant,
    isMyTurn,
    myParticipant,
    connect,
    disconnect,
    markActivity,
    nextTurn: doNextTurn,
    prevTurn: doPrevTurn,
    updateHp,
    addMonster,
    removeMonster,
    finish,
  }
}
