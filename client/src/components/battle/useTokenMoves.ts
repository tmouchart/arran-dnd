import { computed, ref, watch } from 'vue'
import type { BattleToken } from './BattleGrid3D.vue'
import { buildTokens } from './tokens'
import { startMove, confirmMove, releaseMove, settleMoves, isCurrent, type PendingMove } from './pendingMoves'
import { useCombat } from '../../composables/useCombat'
import { showToast } from '../../composables/useToast'
import type { CombatState } from '../../api/combats'

/** Après confirmation, délai maximal d'attente du prochain état diffusé. */
const SETTLE_GRACE_MS = 600

/**
 * Les pions à afficher, et le geste qui les déplace.
 *
 * Partagé par la carte du combat et le mode table : les deux montrent la même
 * scène et laissent poser les pions, avec le même affichage optimiste.
 */
export function useTokenMoves(combat: () => CombatState | null) {
  const { moveParticipant } = useCombat()

  /** Déplacements en vol : voir `pendingMoves.ts`, toute la logique y est. */
  const pending = ref<Map<string, PendingMove>>(new Map())

  /** Numéro du geste courant, pour qu'une réponse ne confirme que SON déplacement. */
  let nextSeq = 0

  const tokens = computed<BattleToken[]>(() =>
    // Notre geste passe devant ce que dit le serveur, jusqu'à confirmation.
    buildTokens(combat()?.participants ?? []).map((t) => {
      const p = pending.value.get(t.id)
      return p ? { ...t, x: p.x, z: p.z } : t
    }),
  )

  /** Le serveur a confirmé (ou quelqu'un d'autre a bougé le pion) : on lâche. */
  watch(
    () => combat()?.participants,
    (participants) => {
      const positions = new Map(
        (participants ?? []).map((p) => [String(p.id), { x: p.posX ?? 0, z: p.posY ?? 0 }]),
      )
      pending.value = settleMoves(pending.value, positions, Date.now())
    },
    { deep: true },
  )

  async function onMove(id: string, x: number, z: number): Promise<void> {
    const seq = ++nextSeq
    pending.value = startMove(pending.value, id, { seq, x, z, at: Date.now() })
    try {
      const confirmed = await moveParticipant(Number(id), x, z)
      if (confirmed) pending.value = confirmMove(pending.value, id, seq, confirmed.x, confirmed.y)
      // Le serveur diffuse AVANT de répondre : notre état est déjà en route.
      // On garde l'affichage optimiste juste le temps qu'il arrive, pas plus.
      if (isCurrent(pending.value, id, seq)) {
        setTimeout(() => { pending.value = releaseMove(pending.value, id, seq) }, SETTLE_GRACE_MS)
      }
    } catch {
      // Refusé : le pion revient là où le serveur le croit.
      pending.value = releaseMove(pending.value, id, seq)
      showToast('Déplacement refusé.')
    }
  }

  return { tokens, onMove }
}
