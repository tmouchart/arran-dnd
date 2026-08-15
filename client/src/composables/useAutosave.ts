import { ref, onBeforeUnmount } from 'vue'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 800
const MAX_BACKOFF_MS = 15_000

/** Attente avant réessai : 1s, 2s, 4s, 8s, puis plafonnée. */
export function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS)
}

/**
 * Sauvegarde automatique débouncée qui **ne jette jamais** le contenu en cas
 * d'échec : elle le garde et réessaie. C'est ce qui manquait quand un verrou
 * expiré faisait perdre en silence tout ce qui était tapé ensuite.
 */
export function useAutosave<T>(save: (value: T) => Promise<void>) {
  const status = ref<SaveStatus>('idle')
  /** Vrai tant qu'un contenu tapé n'a pas atteint le serveur. */
  const hasPending = ref(false)

  let pending: { value: T } | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let attempt = 0

  function clearTimers() {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  }

  async function run(): Promise<void> {
    if (running || !pending) return
    running = true
    const inFlight = pending.value
    status.value = 'saving'
    try {
      await save(inFlight)
      attempt = 0
      // Du texte a pu être tapé pendant la requête : on ne le perd pas.
      if (pending && pending.value !== inFlight) {
        running = false
        void run()
        return
      }
      pending = null
      hasPending.value = false
      status.value = 'saved'
      setTimeout(() => { if (status.value === 'saved') status.value = 'idle' }, 2000)
    } catch {
      attempt += 1
      status.value = 'error'
      // Le contenu reste dans `pending` — c'est tout l'intérêt.
      retryTimer = setTimeout(() => { void run() }, backoffDelay(attempt))
    } finally {
      running = false
    }
  }

  function schedule(value: T): void {
    pending = { value }
    hasPending.value = true
    if (status.value !== 'error') status.value = 'saving'
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => { void run() }, DEBOUNCE_MS)
  }

  /** Force l'envoi immédiat (perte de focus, fermeture de l'éditeur). */
  async function flush(): Promise<void> {
    clearTimers()
    await run()
  }

  onBeforeUnmount(clearTimers)

  return { status, hasPending, schedule, flush }
}
