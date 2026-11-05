<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { BattleToken } from './BattleGrid3D.vue'
import { isDeadMonster } from './tokens'
import type { CombatParticipant, CombatState } from '../../api/combats'

/**
 * L'ordre du tour, en une ligne au-dessus de la carte : on suit le combat sans
 * quitter le champ de bataille. Seuls le nom et la couleur du pion y figurent,
 * rien de plus que ce que la carte montre déjà.
 */
const props = defineProps<{
  combat: CombatState
  tokens: BattleToken[]
}>()

const list = ref<HTMLElement | null>(null)

/** La pastille prend la couleur du pion. Un monstre mort n'a plus de pion. */
const colors = computed(() => new Map(props.tokens.map((t) => [t.id, t.color])))

function isDead(p: CombatParticipant): boolean {
  return isDeadMonster(p) || p.hpStatus === 'mort'
}

/** Amène le perso actif au milieu du bandeau, sans toucher au défilement de la page. */
function centerActive(): void {
  const chip = list.value?.querySelector<HTMLElement>('.chip.active')
  if (!list.value || !chip) return
  const box = list.value.getBoundingClientRect()
  const rect = chip.getBoundingClientRect()
  list.value.scrollBy({
    left: rect.left - box.left - (box.width - rect.width) / 2,
    behavior: 'smooth',
  })
}

watch(
  () => props.combat.participants[props.combat.currentTurnIndex]?.id,
  async () => {
    await nextTick()
    centerActive()
  },
)

// L'onglet carte est caché par `v-show` : tant qu'il est masqué, rien ne peut
// défiler. L'observateur rattrape le tour au retour sur l'onglet.
const observer = new ResizeObserver(() => centerActive())
onMounted(() => {
  if (list.value) observer.observe(list.value)
})
onBeforeUnmount(() => observer.disconnect())
</script>

<template>
  <div class="strip" data-testid="initiative-strip">
    <span class="round">Round {{ combat.roundNumber }}</span>
    <ol ref="list" class="list">
      <li
        v-for="(p, idx) in combat.participants"
        :key="p.id"
        class="chip"
        :class="{
          active: idx === combat.currentTurnIndex,
          played: idx < combat.currentTurnIndex,
          dead: isDead(p),
        }"
        :data-testid="idx === combat.currentTurnIndex ? 'strip-active' : 'strip-chip'"
        :data-participant-id="p.id"
      >
        <span class="dot" :style="{ background: colors.get(String(p.id)) ?? 'var(--muted)' }" />
        <span class="name">{{ p.name }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.round {
  flex-shrink: 0;
  font-family: var(--title-font);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--brand-strong);
  white-space: nowrap;
}

.list {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
  scrollbar-width: none;
}

.list::-webkit-scrollbar {
  display: none;
}

.chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: 32px;
  max-width: 6.5rem;
  padding: 0 var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  transition: background 150ms ease, border-color 150ms ease, opacity 150ms ease;
}

/* Le nom du perso actif s'affiche en entier : c'est celui qu'on cherche. */
.chip.active {
  max-width: none;
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}

.chip.played {
  opacity: 0.55;
}

.chip.dead {
  opacity: 0.35;
  text-decoration: line-through;
}

.dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
