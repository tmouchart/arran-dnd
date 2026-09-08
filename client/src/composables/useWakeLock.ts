import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Garde l'écran allumé tant que le composant est monté (mode table : une
 * tablette qu'on ne touche pas s'éteint au bout d'une minute).
 *
 * Le verrou saute dès que l'onglet passe en arrière-plan : on le redemande au
 * retour. Sans l'API (vieux Safari), on ne fait rien et on ne se plaint pas.
 */
export function useWakeLock(): void {
  let lock: WakeLockSentinel | null = null

  async function acquire(): Promise<void> {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
    try {
      lock = await navigator.wakeLock.request('screen')
    } catch { /* refusé (batterie faible, onglet caché) : tant pis */ }
  }

  function onVisible(): void {
    if (document.visibilityState === 'visible') void acquire()
  }

  onMounted(() => {
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible)
    void lock?.release()
    lock = null
  })
}
