<script setup lang="ts">
import { ref } from 'vue'
import { RotateCcw, RotateCw, Crosshair, SkipForward, Swords, Crown, Zap, Grid3x3 } from 'lucide-vue-next'
import AppPageLayout from '../components/ui/AppPageLayout.vue'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppIconBtn from '../components/ui/AppIconBtn.vue'
import AppSelect from '../components/ui/AppSelect.vue'
import BattleGrid3D, { type BattleToken } from '../components/battle/BattleGrid3D.vue'
import { ENVIRONMENTS, DEFAULT_ENVIRONMENT } from '../components/battle/environments'
import { showToast } from '../composables/useToast'

/** POC : les pions sont en dur, rien n'est sauvegardé. */
const tokens = ref<BattleToken[]>([
  { id: 'h1', name: 'Thomas', color: '#4f8ef7', kind: 'hero', x: -2, z: 2, hp: 24, hpMax: 24 },
  { id: 'h2', name: 'Elyra', color: '#3fbf7f', kind: 'hero', x: -1, z: 3, hp: 9, hpMax: 18 },
  { id: 'h3', name: 'Barghest', color: '#c264d9', kind: 'hero', x: -3, z: 3.5, hp: 5, hpMax: 30 },
  { id: 'h4', name: 'Nym', color: '#f0a63c', kind: 'hero', x: -2.4, z: 1, hp: 16, hpMax: 20 },
  { id: 'm1', name: 'Gobelin', color: '#b03030', kind: 'monster', x: 2, z: -2, hp: 7, hpMax: 8 },
  { id: 'm2', name: 'Gobelin', color: '#b03030', kind: 'monster', x: 3.2, z: -1, hp: 3, hpMax: 8 },
  { id: 'm3', name: 'Ogre', color: '#3a3a3a', kind: 'monster', x: 2.6, z: -3.4, hp: 40, hpMax: 45 },
])

const activeIndex = ref(0)
const activeId = ref<string | null>(tokens.value[0].id)
const grid = ref<InstanceType<typeof BattleGrid3D> | null>(null)
const selectedId = ref<string | null>(null)
const environment = ref(DEFAULT_ENVIRONMENT)
/** POC : on bascule à la main. En vrai, ça viendra de la campagne. */
const isGm = ref(false)
const showGrid = ref(false)

function onMove(id: string, x: number, z: number) {
  const token = tokens.value.find((t) => t.id === id)
  if (token) {
    token.x = x
    token.z = z
  }
}

function onDenied() {
  showToast('Seul le MJ déplace les monstres.')
}

/** POC : de quoi voir la jauge bouger. */
function hitActive() {
  const token = tokens.value.find((t) => t.id === activeId.value)
  if (!token || token.hpMax == null) return
  token.hp = Math.max(0, (token.hp ?? 0) - 4)
}

function nextTurn() {
  activeIndex.value = (activeIndex.value + 1) % tokens.value.length
  activeId.value = tokens.value[activeIndex.value].id
}

const selectedName = () => tokens.value.find((t) => t.id === selectedId.value)?.name
</script>

<template>
  <AppPageLayout mode="full" width="wide">
    <template #top-bar>
      <AppPageHead>
        <Swords :size="20" /> Champ de bataille
        <template #actions>
          <AppIconBtn
            :variant="isGm ? 'primary' : 'ghost'"
            :title="isGm ? 'Mode MJ actif' : 'Passer en mode MJ'"
            @click="isGm = !isGm"
          >
            <Crown :size="18" />
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
          <AppIconBtn title="Infliger 4 dégâts au pion actif" @click="hitActive">
            <Zap :size="18" />
          </AppIconBtn>
          <AppIconBtn variant="primary" title="Tour suivant" @click="nextTurn">
            <SkipForward :size="18" />
          </AppIconBtn>
        </template>
      </AppPageHead>
    </template>

    <div class="board">
      <BattleGrid3D
        ref="grid"
        :tokens="tokens"
        :active-id="activeId"
        :is-gm="isGm"
        :environment="environment"
        :show-grid="showGrid"
        @move="onMove"
        @denied="onDenied"
        @select="selectedId = $event"
      />
    </div>

    <template #bottom-bar>
      <div class="bar">
        <AppSelect v-model="environment" class="env">
          <option v-for="env in ENVIRONMENTS" :key="env.id" :value="env.id">
            {{ env.emoji }} {{ env.name }}
          </option>
        </AppSelect>
      </div>
      <p class="hint">
        <template v-if="selectedId">
          <strong>{{ selectedName() }}</strong> sélectionné — tape le sol pour le déplacer.
        </template>
        <template v-else-if="isGm"> Mode MJ : tu peux bouger tout le monde. </template>
        <template v-else> Tape un héros pour le déplacer. Les monstres sont au MJ. </template>
      </p>
    </template>
  </AppPageLayout>
</template>

<style scoped>
.board {
  flex: 1;
  min-height: 0;
}

.bar {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.env {
  flex: 1;
}

.hint {
  margin: var(--space-sm) 0 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--muted);
}
</style>
