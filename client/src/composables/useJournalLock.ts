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
  /**
   * Vrai tant que du texte tapé n'a pas été confirmé par le serveur.
   * C'est le garde-fou central : tant qu'il est vrai, aucun contenu distant
   * n'écrase l'écran et le verrou est renouvelé même onglet caché.
   * La vue le pilote (elle seule sait ce qui est en attente).
   */
  const hasLocalEdits = ref(false)
  /** Le verrou nous a échappé alors qu'on écrivait encore. */
  const lockLost = ref(false)

  const isLockedByMe = computed(() => lock.value !== null && lock.value.userId === user.value?.id)
  const isLockedByOther = computed(() => lock.value !== null && lock.value.userId !== user.value?.id)
  const lockedByName = computed(() => (isLockedByOther.value ? lock.value!.characterName : null))

  /** Un contenu distant ne remplace jamais ce que l'utilisateur est en train
   *  d'écrire — c'est comme ça qu'on effaçait du texte à l'écran. */
  const canAcceptRemote = () => !hasLocalEdits.value && !isLockedByMe.value

  let eventSource: EventSource | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  function connectSSE() {
    if (eventSource) return
    eventSource = new EventSource(eventsUrl, { withCredentials: true })

    eventSource.addEventListener('journal-locked', (e: MessageEvent) => {
      const info: LockInfo = JSON.parse(e.data)
      lock.value = info
      if (info.userId !== user.value?.id && hasLocalEdits.value) lockLost.value = true
    })

    eventSource.addEventListener('journal-unlocked', () => {
      const wasMine = isLockedByMe.value
      lock.value = null
      // Verrou expiré (veille du téléphone) alors qu'on tape encore : on le
      // reprend tout de suite, sinon les frappes suivantes partent en 423.
      if (wasMine && hasLocalEdits.value) void reacquire()
    })

    eventSource.addEventListener('journal-updated', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      if (typeof data.version === 'number') version.value = data.version
      if (canAcceptRemote()) content.value = data.content
    })

    // État complet envoyé à chaque (re)connexion. Sans ça, un client qui se
    // reconnecte après une veille garde un contenu périmé sans le savoir — et
    // l'écrase à la frappe suivante.
    eventSource.addEventListener('journal-snapshot', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      if (typeof data.version === 'number') version.value = data.version
      if (canAcceptRemote()) content.value = data.content
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
   * Renouvelle le verrou tant qu'on édite. On continue même onglet caché s'il
   * reste du texte non sauvegardé : le laisser expirer, c'est laisser quelqu'un
   * écrire par-dessus.
   */
  function startHeartbeat() {
    if (heartbeatTimer) return
    heartbeatTimer = setInterval(() => {
      if (!isLockedByMe.value && !hasLocalEdits.value) return
      if (document.visibilityState !== 'visible' && !hasLocalEdits.value) return
      void reacquire()
    }, LOCK_HEARTBEAT_MS)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  /** POST du verrou : sert aussi bien à le prendre qu'à le renouveler. */
  async function reacquire(): Promise<boolean> {
    try {
      const res = await fetch(lockUrl, { method: 'POST', credentials: 'include' })
      if (res.ok) {
        lock.value = { userId: user.value!.id, characterName: '' }
        lockLost.value = false
        startHeartbeat()
        return true
      }
      const body = await res.json().catch(() => ({}))
      if (body.lockedBy) lock.value = { userId: 0, characterName: body.lockedBy }
      if (hasLocalEdits.value) lockLost.value = true
      return false
    } catch {
      return false
    }
  }

  async function acquire(): Promise<boolean> {
    return reacquire()
  }

  /** Garantit le verrou juste avant d'écrire. Une sauvegarde ne doit jamais
   *  échouer simplement parce que le verrou a expiré entre deux frappes. */
  async function ensureLock(): Promise<boolean> {
    if (isLockedByMe.value) return true
    return reacquire()
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

  // Retour d'un onglet endormi : le verrou a pu expirer pendant la veille.
  function onVisibility() {
    if (document.visibilityState !== 'visible') return
    if (isLockedByMe.value || hasLocalEdits.value) void reacquire()
  }

  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('visibilitychange', onVisibility)

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    document.removeEventListener('visibilitychange', onVisibility)
    releaseSync()
    disconnectSSE()
  })

  return {
    lock,
    content,
    version,
    sseConnected,
    hasLocalEdits,
    lockLost,
    isLockedByMe,
    isLockedByOther,
    lockedByName,
    connectSSE,
    disconnectSSE,
    acquire,
    ensureLock,
    release,
  }
}
