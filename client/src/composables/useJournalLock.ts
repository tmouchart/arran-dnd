import { ref, computed, onBeforeUnmount } from 'vue'
import { user } from './useAuth'
import type { LockInfo } from '../api/journal'

/** Le verrou serveur expire à 60 s : on le renouvelle bien avant. */
const LOCK_HEARTBEAT_MS = 20_000

export function useJournalLock(eventsUrl: string, lockUrl: string, unlockUrl: string) {
  const lock = ref<LockInfo | null>(null)
  const content = ref('')
  /** Version connue du serveur — envoyée à chaque sauvegarde pour détecter
   *  qu'on travaille sur un contenu périmé au lieu de l'écraser. */
  const version = ref<number | null>(null)
  const sseConnected = ref(false)

  const isLockedByMe = computed(() => lock.value !== null && lock.value.userId === user.value?.id)
  const isLockedByOther = computed(() => lock.value !== null && lock.value.userId !== user.value?.id)
  const lockedByName = computed(() => (isLockedByOther.value ? lock.value!.characterName : null))

  let eventSource: EventSource | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  function connectSSE() {
    if (eventSource) return
    eventSource = new EventSource(eventsUrl, { withCredentials: true })

    eventSource.addEventListener('journal-locked', (e: MessageEvent) => {
      lock.value = JSON.parse(e.data)
    })

    eventSource.addEventListener('journal-unlocked', () => {
      lock.value = null
    })

    eventSource.addEventListener('journal-updated', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      content.value = data.content
      if (typeof data.version === 'number') version.value = data.version
    })

    // État complet envoyé à chaque (re)connexion. Sans ça, un client qui se
    // reconnecte après une veille garde un contenu périmé sans le savoir — et
    // l'écrase à la frappe suivante.
    eventSource.addEventListener('journal-snapshot', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      if (typeof data.version === 'number') version.value = data.version
      // On n'écrase jamais ce que l'utilisateur est en train d'écrire.
      if (!isLockedByMe.value) content.value = data.content
    })

    eventSource.onopen = () => { sseConnected.value = true }
    eventSource.onerror = () => { sseConnected.value = false }
  }

  function disconnectSSE() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
      sseConnected.value = false
    }
  }

  /**
   * Renouvelle le verrou tant que l'onglet est actif. Sans ça il expire au bout
   * d'une minute de réflexion, et les sauvegardes suivantes sont rejetées.
   */
  function startHeartbeat() {
    if (heartbeatTimer) return
    heartbeatTimer = setInterval(() => {
      if (!isLockedByMe.value) return
      if (document.visibilityState !== 'visible') return
      fetch(lockUrl, { method: 'POST', credentials: 'include' }).catch(() => {})
    }, LOCK_HEARTBEAT_MS)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  async function acquire(): Promise<boolean> {
    try {
      const res = await fetch(lockUrl, { method: 'POST', credentials: 'include' })
      if (res.ok) {
        lock.value = { userId: user.value!.id, characterName: '' }
        startHeartbeat()
        return true
      }
      const body = await res.json().catch(() => ({}))
      lock.value = body.lockedBy ? { userId: 0, characterName: body.lockedBy } : lock.value
      return false
    } catch {
      return false
    }
  }

  async function release(): Promise<void> {
    stopHeartbeat()
    if (!isLockedByMe.value) return
    try {
      await fetch(unlockUrl, { method: 'DELETE', credentials: 'include' })
    } catch { /* best effort */ }
    lock.value = null
  }

  function releaseSync() {
    stopHeartbeat()
    if (!isLockedByMe.value) return
    // keepalive allows the request to outlive the page
    fetch(unlockUrl, { method: 'DELETE', credentials: 'include', keepalive: true }).catch(() => {})
    lock.value = null
  }

  function onBeforeUnload() {
    releaseSync()
  }

  window.addEventListener('beforeunload', onBeforeUnload)

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    releaseSync()
    disconnectSSE()
  })

  return {
    lock,
    content,
    version,
    sseConnected,
    isLockedByMe,
    isLockedByOther,
    lockedByName,
    connectSSE,
    disconnectSSE,
    acquire,
    release,
  }
}
