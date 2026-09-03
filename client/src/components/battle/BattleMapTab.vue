<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Grid3x3, RotateCcw, RotateCw, Crosshair } from 'lucide-vue-next'
import AppIconBtn from '../ui/AppIconBtn.vue'
import AppSelect from '../ui/AppSelect.vue'
import BattleGrid3D, { type BattleToken } from './BattleGrid3D.vue'
import { buildTokens } from './tokens'
import {
  startMove, confirmMove, releaseMove, settleMoves, isCurrent, type PendingMove,
} from './pendingMoves'
import { ENVIRONMENTS } from './environments'
import { useCombat } from '../../composables/useCombat'
import { showToast } from '../../composables/useToast'
import type { CombatState } from '../../api/combats'

const props = defineProps<{
  combat: CombatState
  isGm: boolean
}>()

const { moveParticipant, setEnvironment, currentParticipant } = useCombat()

const grid = ref<InstanceType<typeof BattleGrid3D> | null>(null)
const showGrid = ref(false)

/** Déplacements en vol : voir `pendingMoves.ts`, toute la logique y est. */
const pending = ref<Map<string, PendingMove>>(new Map())

/** Numéro du geste courant, pour qu'une réponse ne confirme que SON déplacement. */
let nextSeq = 0

/** Après confirmation, délai maximal d'attente du prochain état diffusé. */
const SETTLE_GRACE_MS = 600

const tokens = computed<BattleToken[]>(() =>
  // Notre geste passe devant ce que dit le serveur, jusqu'à confirmation.
  buildTokens(props.combat.participants).map((t) => {
    const p = pending.value.get(t.id)
    return p ? { ...t, x: p.x, z: p.z } : t
  }),
)

/** Le serveur a confirmé (ou quelqu'un d'autre a bougé le pion) : on lâche. */
watch(
  () => props.combat.participants,
  (participants) => {
    const positions = new Map(
      participants.map((p) => [String(p.id), { x: p.posX ?? 0, z: p.posY ?? 0 }]),
    )
    pending.value = settleMoves(pending.value, positions, Date.now())
  },
  { deep: true },
)

const activeId = computed(() =>
  currentParticipant.value ? String(currentParticipant.value.id) : null,
)

async function onMove(id: string, x: number, z: number) {
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

async function onEnvironmentChange(id: string) {
  try {
    await setEnvironment(id)
  } catch {
    showToast('Changement de décor refusé.')
  }
}
</script>

<template>
  <div class="map-tab">
    <div class="toolbar">
      <AppSelect
        v-if="isGm"
        :model-value="combat.environment"
        class="env"
        @update:model-value="onEnvironmentChange(String($event))"
      >
        <option v-for="env in ENVIRONMENTS" :key="env.id" :value="env.id">
          {{ env.emoji }} {{ env.name }}
        </option>
      </AppSelect>
      <div class="spacer" />
      <AppIconBtn
        :variant="showGrid ? 'primary' : 'ghost'"
        title="Afficher la grille"
        @click="showGrid = !showGrid"
      >
        <Grid3x3 :size="18" />
      </AppIconBtn>
      <AppIconBtn title="Tourner à gauche" @click="grid?.rotate(-1)">
        <RotateCcw :size="18" />
      </AppIconBtn>
      <AppIconBtn title="Tourner à droite" @click="grid?.rotate(1)">
        <RotateCw :size="18" />
      </AppIconBtn>
      <AppIconBtn title="Recentrer" @click="grid?.recenter()">
        <Crosshair :size="18" />
      </AppIconBtn>
    </div>

    <div class="board">
      <BattleGrid3D
        ref="grid"
        :tokens="tokens"
        :active-id="activeId"
        :is-gm="isGm"
        :environment="combat.environment"
        :show-grid="showGrid"
        @move="onMove"
        @denied="showToast('Seul le MJ déplace les monstres.')"
      />
    </div>
  </div>
</template>

<style scoped>
.map-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.env {
  flex: 1;
  min-width: 0;
}

.spacer {
  flex: 1;
}

.board {
  height: min(64vh, 560px);
}
</style>
