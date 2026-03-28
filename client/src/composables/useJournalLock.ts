import { ref, computed, onBeforeUnmount } from 'vue'
import { user } from './useAuth'
import type { LockInfo } from '../api/journal'

export function useJournalLock(eventsUrl: string, lockUrl: string, unlockUrl: string) {
  const lock = ref<LockInfo | null>(null)
  const content = ref('')
  const sseConnected = ref(false)

  const isLockedByMe = computed(() => lock.value !== null && lock.value.userId === user.value?.id)
  const isLockedByOther = computed(() => lock.value !== null && lock.value.userId !== user.value?.id)
  const lockedByName = computed(() => (isLockedByOther.value ? lock.value!.characterName : null))

  let eventSource: EventSource | null = null

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

  async function acquire(): Promise<boolean> {
    try {
      const res = await fetch(lockUrl, { method: 'POST', credentials: 'include' })
      if (res.ok) {
        lock.value = { userId: user.value!.id, characterName: '' }
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
    if (!isLockedByMe.value) return
    try {
      await fetch(unlockUrl, { method: 'DELETE', credentials: 'include' })
    } catch { /* best effort */ }
    lock.value = null
  }

  function releaseSync() {
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
    isLockedByMe,
    isLockedByOther,
    lockedByName,
    connectSSE,
    disconnectSSE,
    acquire,
    release,
  }
}
