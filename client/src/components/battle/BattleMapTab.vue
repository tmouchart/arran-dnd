<script setup lang="ts">
import { computed, ref } from 'vue'
import { Grid3x3, RotateCcw, RotateCw, Crosshair } from 'lucide-vue-next'
import AppIconBtn from '../ui/AppIconBtn.vue'
import AppSelect from '../ui/AppSelect.vue'
import BattleGrid3D, { type BattleToken } from './BattleGrid3D.vue'
import { ENVIRONMENTS } from './environments'
import { useCombat } from '../../composables/useCombat'
import { showToast } from '../../composables/useToast'
import type { CombatParticipant, CombatState } from '../../api/combats'

const props = defineProps<{
  combat: CombatState
  isGm: boolean
}>()

const { moveParticipant, setEnvironment, currentParticipant } = useCombat()

const grid = ref<InstanceType<typeof BattleGrid3D> | null>(null)
const showGrid = ref(false)

/** Couleurs des héros : stable, prise dans l'ordre de la liste. */
const HERO_COLORS = ['#4f8ef7', '#3fbf7f', '#c264d9', '#f0a63c', '#4fc7d9', '#e0648a']
const MONSTER_COLORS = ['#b03030', '#3a3a3a']

/**
 * Un participant jamais placé se pose à son emplacement de départ : les héros
 * d'un côté, les monstres de l'autre. Personne n'a à placer la table à la main.
 */
function defaultPosition(p: CombatParticipant, index: number, count: number): [number, number] {
  const spread = Math.min(count, 5)
  const x = (index % spread) - (spread - 1) / 2
  const row = Math.floor(index / spread)
  const z = p.kind === 'player' ? 3 + row * 1.6 : -3 - row * 1.6
  // 2 cases d'écart : en dessous, les étiquettes de nom se chevauchent.
  return [x * 2, z]
}

/**
 * Un monstre mort quitte la carte. Un joueur à 0 PV y reste : il agonise,
 * il n'est pas sorti du combat.
 *
 * Le MJ lit les PV exacts ; un joueur n'a que le statut qualitatif.
 */
function isDeadMonster(p: CombatParticipant): boolean {
  if (p.kind !== 'monster') return false
  return p.hpStatus === 'mort' || (p.hpCurrent != null && p.hpCurrent <= 0)
}

/**
 * Un PNJ en réserve n'est pas encore entré en scène. Le serveur ne l'envoie
 * déjà pas dans `participants` — on le revérifie ici pour que la carte ne
 * puisse jamais trahir une embuscade.
 */
function isOnMap(p: CombatParticipant): boolean {
  return !p.hidden && !isDeadMonster(p)
}

const tokens = computed<BattleToken[]>(() => {
  const players = props.combat.participants.filter((p) => p.kind === 'player')
  const monsters = props.combat.participants.filter((p) => p.kind === 'monster')

  const build = (list: CombatParticipant[], hero: boolean): BattleToken[] =>
    list.map((p, i) => {
      const [dx, dz] = defaultPosition(p, i, list.length)
      return {
        id: String(p.id),
        name: p.name,
        color: hero ? HERO_COLORS[i % HERO_COLORS.length] : MONSTER_COLORS[i % MONSTER_COLORS.length],
        kind: hero ? 'hero' : 'monster',
        x: p.posX ?? dx,
        z: p.posY ?? dz,
        // hpCurrent est null quand le serveur cache les PV d'un monstre à un
        // joueur : aucune barre ne s'affiche, exactement ce qu'on veut.
        hp: p.hpCurrent ?? undefined,
        hpMax: p.hpMax ?? undefined,
      }
    })

  // On filtre APRÈS la construction : les index gardent leur couleur et leur
  // place de départ quand un voisin meurt ou reste caché.
  const shownIds = new Set(monsters.filter(isOnMap).map((p) => String(p.id)))
  return [
    ...build(players, true),
    ...build(monsters, false).filter((t) => shownIds.has(t.id)),
  ]
})

const activeId = computed(() =>
  currentParticipant.value ? String(currentParticipant.value.id) : null,
)

async function onMove(id: string, x: number, z: number) {
  try {
    await moveParticipant(Number(id), x, z)
  } catch {
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
