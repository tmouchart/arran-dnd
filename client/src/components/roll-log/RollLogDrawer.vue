<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import AppIconBtn from '../ui/AppIconBtn.vue'
import RollLogPanel from './RollLogPanel.vue'
import { useCampaignRolls, filterRolls, type RollFilter } from '../../composables/useCampaignRolls'

const { rolls, panelOpen, filter, togglePanel, setFilter } = useCampaignRolls()

// Le filtre PNJ n'apparaît que s'il y a des jets de monstres à voir — donc de
// fait pour le MJ seul, sans réintroduire de logique de rôle côté client.
const hasMonsterRolls = computed(() => rolls.value.some((r) => r.actorKind === 'monster'))

const FILTERS: { value: RollFilter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'combat', label: 'Combat' },
  { value: 'player', label: 'PJ' },
  { value: 'monster', label: 'PNJ' },
]

// Compteur par filtre : sans ça, un joueur dont tous les jets sont en combat
// voit trois listes identiques et croit que le filtre ne marche pas.
const visibleFilters = computed(() =>
  FILTERS
    .filter((f) => f.value !== 'monster' || hasMonsterRolls.value)
    .map((f) => ({ ...f, count: filterRolls(rolls.value, f.value).length })),
)

const shown = computed(() => filterRolls(rolls.value, filter.value))
</script>

<template>
  <div v-if="panelOpen" class="drawer-backdrop" @click="togglePanel(false)" />
  <aside v-if="panelOpen" class="drawer">
    <header class="drawer-head">
      <h2 class="drawer-title">Jets</h2>
      <AppIconBtn aria-label="Fermer le log" @click="togglePanel(false)">
        <X :size="18" />
      </AppIconBtn>
    </header>

    <div class="drawer-filters">
      <button
        v-for="f in visibleFilters"
        :key="f.value"
        type="button"
        class="filter-chip"
        :class="{ active: filter === f.value }"
        @click="setFilter(f.value)"
      >
        {{ f.label }} <span class="filter-count">{{ f.count }}</span>
      </button>
    </div>

    <div class="drawer-body">
      <RollLogPanel :rolls="shown" />
    </div>
  </aside>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 19;
  background: rgb(0 0 0 / 0.4);
  animation: fade-in 0.15s ease;
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  /* S'arrête au-dessus d'une barre fixe posée par la vue (footer de combat) */
  bottom: var(--bottom-dock, 0px);
  z-index: 20;
  width: min(400px, 90vw);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--border-strong);
  box-shadow: var(--shadow-card);
  /* Animation à l'ouverture seulement — pas de Transition Vue ici non plus */
  animation: drawer-in 0.18s ease;
}

@keyframes drawer-in {
  from {
    transform: translateX(100%);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

.drawer-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border);
}

.drawer-title {
  flex: 1;
  margin: 0;
  font-family: var(--title-font);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
}

.drawer-filters {
  flex-shrink: 0;
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border);
}

.filter-chip {
  flex: 1;
  padding: 0.3rem 0.2rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.filter-count {
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
}

.filter-chip.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-sm) var(--space-md) var(--space-lg);
}

/* Desktop : le tiroir est docké, il ne recouvre plus le contenu */
@media (min-width: 900px) {
  .drawer-backdrop {
    display: none;
  }
}
</style>
