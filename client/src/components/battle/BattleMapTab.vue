<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

/**
 * Déplacements déjà joués à l'écran mais pas encore confirmés par le serveur.
 *
 * Sans ça, taper un pion ne fait rien pendant l'aller-retour réseau — 150 à
 * 600 ms sur un téléphone en 4G — puis le pion saute. On le bouge donc tout de
 * suite, et cette table fait aussi office de garde anti-rebond : tant qu'un
 * déplacement est en vol, les positions qui arrivent pour ce pion sont ignorées
 * (elles datent d'avant notre geste).
 */
const pending = ref(new Map<string, { x: number; z: number; at: number; confirmed: boolean }>())

/** Au-delà, on considère que le serveur ne répondra jamais et on lâche prise. */
const PENDING_TIMEOUT_MS = 3000

/** Après confirmation, délai maximal d'attente du prochain état diffusé. */
const SETTLE_GRACE_MS = 600

function release(id: string) {
  if (!pending.value.delete(id)) return
  pending.value = new Map(pending.value)
}

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
  const all = [
    ...build(players, true),
    ...build(monsters, false).filter((t) => shownIds.has(t.id)),
  ]

  // Notre geste passe devant ce que dit le serveur, jusqu'à confirmation.
  return all.map((t) => {
    const p = pending.value.get(t.id)
    return p ? { ...t, x: p.x, z: p.z } : t
  })
})

/** Le serveur a confirmé (ou quelqu'un d'autre a bougé le pion) : on lâche. */
watch(
  () => props.combat.participants,
  (participants) => {
    if (pending.value.size === 0) return
    const now = Date.now()
    let changed = false
    for (const [id, move] of pending.value) {
      const p = participants.find((x) => String(x.id) === id)
      // Une fois notre écriture confirmée, le premier état reçu fait foi —
      // même s'il porte la position de quelqu'un qui a écrit juste après nous.
      // Sans ça, celui qui perd une collision reste bloqué sur sa position
      // fantôme pendant trois secondes.
      const settled =
        !p ||
        move.confirmed ||
        now - move.at > PENDING_TIMEOUT_MS ||
        (Math.abs((p.posX ?? 0) - move.x) < 1e-3 && Math.abs((p.posY ?? 0) - move.z) < 1e-3)
      if (settled) {
        pending.value.delete(id)
        changed = true
      }
    }
    if (changed) pending.value = new Map(pending.value)
  },
  { deep: true },
)

const activeId = computed(() =>
  currentParticipant.value ? String(currentParticipant.value.id) : null,
)

async function onMove(id: string, x: number, z: number) {
  pending.value.set(id, { x, z, at: Date.now(), confirmed: false })
  pending.value = new Map(pending.value)
  try {
    await moveParticipant(Number(id), x, z)
    // Le serveur diffuse AVANT de répondre : notre état est déjà en route.
    // On garde l'affichage optimiste juste le temps qu'il arrive, pas plus.
    const move = pending.value.get(id)
    if (move) move.confirmed = true
    setTimeout(() => release(id), SETTLE_GRACE_MS)
  } catch {
    // Refusé : le pion revient là où le serveur le croit.
    release(id)
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
