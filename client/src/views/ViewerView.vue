<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { X, Tv } from 'lucide-vue-next'
import BattleGrid3D from '../components/battle/BattleGrid3D.vue'
import { useTokenMoves } from '../components/battle/useTokenMoves'
import ViewerInitiative from '../components/viewer/ViewerInitiative.vue'
import ViewerFeed from '../components/viewer/ViewerFeed.vue'
import AppIconBtn from '../components/ui/AppIconBtn.vue'
import AppEmptyState from '../components/ui/AppEmptyState.vue'
import AppButton from '../components/ui/AppButton.vue'
import { user } from '../composables/useAuth'
import { useActiveCombat, refreshActiveCombat } from '../composables/useActiveCombat'
import { useCombat } from '../composables/useCombat'
import { useCampaignRolls } from '../composables/useCampaignRolls'
import { viewerArea } from '../composables/useDice3D'
import { useWakeLock } from '../composables/useWakeLock'
import { showToast } from '../composables/useToast'

/**
 * Mode table : la tablette posée au milieu, que personne ne touche.
 *
 * Carte à gauche, ordre du tour et fil d'actions à droite. Les dés de tout le
 * monde tombent sur la carte (voir `viewerArea`). Le serveur nous traite en
 * joueur (`as=viewer`), même avec le compte du MJ : rien de secret ne sort.
 *
 * On y bouge les pions des PJ au doigt, comme sur une vraie table. Les monstres
 * restent au MJ, sur son téléphone : la tablette n'est jamais MJ.
 *
 * Pas d'`AppPageLayout` : comme la page de login, cette page n'a ni barre ni
 * largeur maximale, elle occupe tout l'écran.
 */
const router = useRouter()
const campaignId = computed(() => user.value?.activeCampaignId ?? null)

const { activeCombat } = useActiveCombat()
const { combat, connect: connectCombat, disconnect: disconnectCombat, currentParticipant } = useCombat()
const { connect: connectRolls } = useCampaignRolls()

useWakeLock()

// ── Flux ─────────────────────────────────────────────────────────────────
watch(campaignId, (id) => {
  if (id) connectRolls(id, { viewer: true })
}, { immediate: true })

/** Le combat suivi : celui de la campagne active, tant qu'il est en cours. */
watch(
  () => activeCombat.value && activeCombat.value.campaignId === campaignId.value ? activeCombat.value.combatId : null,
  (combatId) => {
    if (combatId) connectCombat(campaignId.value!, combatId, { viewer: true })
    else disconnectCombat()
  },
  { immediate: true },
)

const inCombat = computed(() => !!combat.value && combat.value.status === 'active')
const { tokens, onMove } = useTokenMoves(() => combat.value)
const activeId = computed(() => (currentParticipant.value ? String(currentParticipant.value.id) : null))

// ── Zone de chute des dés = la carte (ou l'écran de veille) ─────────────
const stage = ref<HTMLElement | null>(null)
const observer = new ResizeObserver(() => publishArea())

function publishArea(): void {
  const rect = stage.value?.getBoundingClientRect()
  if (!rect) return
  viewerArea.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

watch(stage, (el, prev) => {
  if (prev) observer.unobserve(prev)
  if (el) {
    observer.observe(el)
    publishArea()
  }
})

// ── Sortie ───────────────────────────────────────────────────────────────
/** Le bouton « Quitter » n'apparaît qu'après un tap, et s'efface tout seul. */
const chromeVisible = ref(true)
let chromeTimer: ReturnType<typeof setTimeout> | null = null

function showChrome(): void {
  chromeVisible.value = true
  if (chromeTimer) clearTimeout(chromeTimer)
  chromeTimer = setTimeout(() => { chromeVisible.value = false }, 2500)
}

function onTap(): void {
  showChrome()
}

function leave(): void {
  router.push('/personnage')
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') leave()
}

onMounted(() => {
  void refreshActiveCombat()
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', publishArea)
  showChrome()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', publishArea)
  observer.disconnect()
  if (chromeTimer) clearTimeout(chromeTimer)
  viewerArea.value = null
  disconnectCombat()
  // On rend le flux des jets à l'app, en vue normale
  if (campaignId.value) connectRolls(campaignId.value)
})
</script>

<template>
  <div class="viewer" data-testid="viewer" @pointerdown="onTap">
    <AppEmptyState v-if="!campaignId" variant="empty" class="no-campaign">
      Choisis une campagne active pour ouvrir le mode table.
      <template #actions>
        <AppButton variant="primary" @click="leave">Retour</AppButton>
      </template>
    </AppEmptyState>

    <template v-else>
      <!-- La scène : la carte en combat, l'écran de veille sinon. Les dés y tombent. -->
      <div ref="stage" class="stage">
        <template v-if="inCombat && combat">
          <BattleGrid3D
            class="map"
            :tokens="tokens"
            :active-id="activeId"
            :environment="combat.environment"
            :walls="combat.obstacles"
            @move="onMove"
            @denied="showToast('Seul le MJ déplace les monstres.')"
          />
          <div class="turn-banner" aria-live="polite">
            <span class="turn-label">Tour de</span>
            <span class="turn-name">{{ currentParticipant?.name ?? '—' }}</span>
          </div>
        </template>
        <div v-else class="idle" data-testid="viewer-idle">
          <Tv :size="40" class="idle-icon" />
          <h1 class="idle-title">Terres d'Arran</h1>
          <p class="idle-hint">En attente d'un combat. Les dés tombent ici.</p>
        </div>
      </div>

      <aside class="side">
        <ViewerInitiative v-if="inCombat && combat" :combat="combat" />
        <ViewerFeed class="side-feed" />
      </aside>
    </template>

    <div class="chrome" :class="{ 'is-visible': chromeVisible }">
      <AppIconBtn title="Quitter le mode table" data-testid="viewer-leave" @click.stop="leave">
        <X :size="22" />
      </AppIconBtn>
    </div>
  </div>
</template>

<style scoped>
.viewer {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
  gap: var(--space-md);
  height: 100dvh;
  padding: var(--space-md);
  background: var(--bg);
  overflow: hidden;
}

.no-campaign {
  grid-column: 1 / -1;
  align-self: center;
}

.stage {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
}

.map {
  flex: 1;
  min-height: 0;
}

/* Surimpression en coin de carte : l'overlay sur son parent, cas admis */
.turn-banner {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 1px solid var(--border-strong);
  pointer-events: none;
}

.turn-label {
  color: var(--muted);
  font-size: 1.05rem;
}

.turn-name {
  font-family: var(--title-font);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent-strong);
}

.idle {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--muted);
  text-align: center;
}

.idle-icon {
  color: var(--brand);
}

.idle-title {
  margin: 0;
  font-family: var(--title-font);
  font-size: 2.4rem;
  color: var(--text);
}

.idle-hint {
  margin: 0;
  font-size: 1.2rem;
}

.side {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-height: 0;
}

.side-feed {
  flex: 1;
}

/* Le bouton « Quitter » : ancré au coin de la page, cas admis du popup */
.chrome {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  opacity: 0;
  pointer-events: none;
  transition: opacity 250ms ease;
}

.chrome.is-visible {
  opacity: 1;
  pointer-events: auto;
}

@media (max-width: 740px) and (orientation: portrait) {
  .viewer {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1.2fr) minmax(0, 1fr);
  }
}
</style>
