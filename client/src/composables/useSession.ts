import { ref, computed } from 'vue'
import { user } from './useAuth'
import * as api from '../api/sessions'
import type { SessionState, SessionParticipant, SessionMonster } from '../api/sessions'

// ── Module-level singleton (persiste entre navigations) ───────────────────────

const session = ref<SessionState | null>(null)
const connecting = ref(false)
const error = ref<string | null>(null)
let eventSource: EventSource | null = null

// ── Ordre d'initiative ────────────────────────────────────────────────────────

export type InitiativeEntry =
  | { kind: 'player'; data: SessionParticipant }
  | { kind: 'monster'; data: SessionMonster }

const initiativeOrder = computed<InitiativeEntry[]>(() => {
  if (!session.value) return []
  const entries: Array<InitiativeEntry & { _init: number | null }> = [
    ...session.value.participants.map((p) => ({
      kind: 'player' as const,
      data: p,
      _init: p.initiative,
    })),
    ...session.value.monsters.map((m) => ({
      kind: 'monster' as const,
      data: m,
      _init: m.initiative,
    })),
  ]
  return entries
    .sort((a, b) => {
      if (a._init == null && b._init == null) return 0
      if (a._init == null) return 1
      if (b._init == null) return -1
      return b._init - a._init
    })
    .map(({ kind, data }) => ({ kind, data }) as InitiativeEntry)
})

// ── Composable ────────────────────────────────────────────────────────────────

export function useSession() {
  const isGm = computed(
    () =>
      session.value != null &&
      user.value != null &&
      session.value.gmUserId === user.value.id,
  )

  function connect(sessionId: string): void {
    disconnect()
    connecting.value = true
    error.value = null
    eventSource = new EventSource(`/api/sessions/${sessionId}/events`, {
      withCredentials: true,
    })
    eventSource.addEventListener('session-updated', (e: MessageEvent) => {
      try {
        session.value = JSON.parse(e.data as string) as SessionState
        connecting.value = false
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
    session.value = null
    connecting.value = false
    error.value = null
  }

  async function leave(): Promise<void> {
    if (!session.value) return
    const id = session.value.id
    disconnect()
    await api.leaveSession(id)
  }

  async function addMonster(
    name: string,
    hpMax: number,
    initiative?: number,
  ): Promise<void> {
    if (!session.value) return
    await api.addMonster(session.value.id, { name, hpMax, initiative })
  }

  async function updateMonster(
    monsterId: string,
    data: { hpCurrent?: number; initiative?: number; name?: string },
  ): Promise<void> {
    if (!session.value) return
    await api.updateMonster(session.value.id, monsterId, data)
  }

  async function removeMonster(monsterId: string): Promise<void> {
    if (!session.value) return
    await api.removeMonster(session.value.id, monsterId)
  }

  async function setInitiative(initiative: number): Promise<void> {
    if (!session.value) return
    await api.setInitiative(session.value.id, initiative)
  }

  return {
    session,
    connecting,
    error,
    isGm,
    initiativeOrder,
    connect,
    disconnect,
    leave,
    addMonster,
    updateMonster,
    removeMonster,
    setInitiative,
  }
}
