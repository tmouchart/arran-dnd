<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Grid3x3, RotateCcw, RotateCw, Crosshair, BrickWall, Undo2 } from 'lucide-vue-next'
import AppIconBtn from '../ui/AppIconBtn.vue'
import AppSelect from '../ui/AppSelect.vue'
import BattleGrid3D from './BattleGrid3D.vue'
import WallPalette from './WallPalette.vue'
import { useTokenMoves } from './useTokenMoves'
import { ENVIRONMENTS } from './environments'
import { applyUndo, newWallId, type BattleWall, type WallAction, type WallPoint } from './walls'
import { DEFAULT_WALL_MATERIAL } from './wallMaterials'
import { useCombat } from '../../composables/useCombat'
import { showToast } from '../../composables/useToast'
import type { CombatState } from '../../api/combats'

const props = defineProps<{
  combat: CombatState
  isGm: boolean
}>()

const { setEnvironment, setObstacles, currentParticipant } = useCombat()

const grid = ref<InstanceType<typeof BattleGrid3D> | null>(null)
const showGrid = ref(false)
const drawMode = ref(false)
/** De quoi seront faits les prochains murs. Retenu entre deux tracés. */
const wallMaterial = ref(DEFAULT_WALL_MATERIAL)

const { tokens, onMove } = useTokenMoves(() => props.combat)

const activeId = computed(() =>
  currentParticipant.value ? String(currentParticipant.value.id) : null,
)

/* ------------------------------------------------------------------ */
/* Les murs                                                            */
/* ------------------------------------------------------------------ */

/**
 * Les murs affichés. On les tient en local pour que le mur apparaisse au doigt
 * levé, sans attendre l'aller-retour serveur.
 */
const walls = ref<BattleWall[]>(props.combat.obstacles ?? [])

/** Les gestes annulables. En mémoire, et seulement les miens (§6 du plan 23). */
const undoStack = ref<WallAction[]>([])

/** Un PUT en vol : l'état diffusé est encore l'ancien, on ne l'écoute pas. */
let inFlight = 0

watch(
  () => props.combat.obstacles,
  (fromServer) => {
    if (inFlight === 0) walls.value = fromServer ?? []
  },
  { deep: true },
)

/** Envoie la liste entière. En cas de refus, on remet ce qui était affiché. */
async function send(next: BattleWall[]): Promise<boolean> {
  const before = walls.value
  walls.value = next
  inFlight++
  try {
    await setObstacles(next)
    return true
  } catch {
    walls.value = before
    showToast('Mur refusé.')
    return false
  } finally {
    inFlight--
  }
}

async function commit(next: BattleWall[], action: WallAction) {
  if (await send(next)) undoStack.value.push(action)
}

function onDrawWall(points: WallPoint[]) {
  const wall: BattleWall = { id: newWallId(), points, material: wallMaterial.value }
  commit([...walls.value, wall], { type: 'add', wall })
}

function onEraseWall(id: string) {
  const wall = walls.value.find((w) => w.id === id)
  if (!wall) return
  commit(
    walls.value.filter((w) => w.id !== id),
    { type: 'erase', wall },
  )
  showToast('Mur effacé.')
}

/** Annule le dernier geste : un mur tracé s'enlève, un mur effacé revient. */
function undo() {
  const action = undoStack.value.pop()
  if (action) send(applyUndo(walls.value, action))
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
      <!-- Annuler n'apparaît qu'en mode mur : ailleurs il n'a rien à annuler. -->
      <AppIconBtn
        v-if="isGm && drawMode"
        data-testid="wall-undo"
        title="Annuler le dernier mur"
        :disabled="undoStack.length === 0"
        @click="undo()"
      >
        <Undo2 :size="18" />
      </AppIconBtn>
      <AppIconBtn
        v-if="isGm"
        data-testid="wall-mode"
        :variant="drawMode ? 'primary' : 'ghost'"
        title="Tracer un mur"
        @click="drawMode = !drawMode"
      >
        <BrickWall :size="18" />
      </AppIconBtn>
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

    <template v-if="drawMode">
      <WallPalette v-model="wallMaterial" />
      <p class="hint">Trace au doigt. Touche un mur pour l'effacer.</p>
    </template>

    <div class="board">
      <BattleGrid3D
        ref="grid"
        :tokens="tokens"
        :active-id="activeId"
        :is-gm="isGm"
        :environment="combat.environment"
        :show-grid="showGrid"
        :walls="walls"
        :draw-mode="drawMode"
        :draw-material="wallMaterial"
        @move="onMove"
        @denied="showToast('Seul le MJ déplace les monstres.')"
        @draw-wall="onDrawWall"
        @erase-wall="onEraseWall"
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

.hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  text-align: center;
}

.board {
  height: min(64vh, 560px);
}
</style>
