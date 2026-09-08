<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, Skull, Zap } from 'lucide-vue-next'
import type { CombatState, CombatParticipant } from '../../api/combats'
import { hpGradientColor } from '../../utils/hpGradientColor'
import { HERO_COLORS } from '../battle/tokens'

/**
 * L'ordre du tour, lu à un mètre : nom, initiative, PV.
 * Les joueurs ont leurs PV en chiffres ; les monstres, ce que le serveur laisse
 * voir à un joueur, c'est-à-dire un état en mots.
 */
const props = defineProps<{ combat: CombatState }>()

const HP_STATUS_LABELS: Record<string, string> = {
  intact: 'intact',
  blesse: 'blessé',
  mal_en_point: 'mal en point',
  agonisant: 'agonisant',
  mort: 'mort',
}

function isDead(p: CombatParticipant): boolean {
  return p.hpStatus === 'mort' || (p.kind === 'monster' && p.hpCurrent != null && p.hpCurrent <= 0)
}

/** Même couleur que le pion sur la carte : rang parmi les joueurs, par id. */
const heroColor = computed(() => {
  const players = props.combat.participants.filter((p) => p.kind === 'player').sort((a, b) => a.id - b.id)
  return new Map(players.map((p, i) => [p.id, HERO_COLORS[i % HERO_COLORS.length]]))
})

function hpPercent(p: CombatParticipant): number {
  if (p.hpCurrent == null || !p.hpMax) return 0
  return Math.max(0, Math.min(100, (p.hpCurrent / p.hpMax) * 100))
}
</script>

<template>
  <section class="initiative" data-testid="viewer-initiative">
    <header class="initiative-head">
      <span class="round">Round {{ combat.roundNumber }}</span>
      <span class="head-title"><Zap :size="18" /> Initiative</span>
    </header>
    <ol class="list">
      <li
        v-for="(p, idx) in combat.participants"
        :key="p.id"
        class="row"
        :class="{
          active: idx === combat.currentTurnIndex,
          monster: p.kind === 'monster',
          dead: isDead(p),
        }"
        :data-testid="idx === combat.currentTurnIndex ? 'viewer-active-participant' : 'viewer-participant'"
      >
        <span class="turn-mark">
          <ChevronRight v-if="idx === combat.currentTurnIndex" :size="22" />
        </span>
        <span
          class="dot"
          :style="{ background: p.kind === 'player' ? heroColor.get(p.id) : 'var(--danger)' }"
        />
        <span class="name">{{ p.name }}</span>
        <span class="init">{{ p.initiative }}</span>
        <span v-if="isDead(p)" class="hp hp-dead"><Skull :size="18" /></span>
        <span v-else-if="p.hpCurrent != null && p.hpMax != null" class="hp">
          <span class="bar"><span class="bar-fill" :style="{ width: `${hpPercent(p)}%`, background: hpGradientColor(p.hpCurrent, p.hpMax) }" /></span>
          <span class="hp-value" :style="{ color: hpGradientColor(p.hpCurrent, p.hpMax) }">{{ p.hpCurrent }}/{{ p.hpMax }}</span>
        </span>
        <span v-else-if="p.hpStatus" class="hp hp-status" :class="`hp-status--${p.hpStatus}`">
          {{ HP_STATUS_LABELS[p.hpStatus] ?? p.hpStatus }}
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.initiative {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 0;
}

.initiative-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--title-font);
  font-size: 1.15rem;
  color: var(--muted);
}

.head-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.round {
  color: var(--brand-strong);
  font-weight: 700;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.row {
  display: grid;
  grid-template-columns: 22px 12px 1fr auto minmax(110px, auto);
  align-items: center;
  gap: var(--space-sm);
  min-height: 44px;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-size: 1.35rem;
  transition: background 200ms ease, border-color 200ms ease;
}

.row.active {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.row.dead {
  opacity: 0.45;
}

.turn-mark {
  display: inline-flex;
  color: var(--accent-strong);
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.name {
  font-family: var(--title-font);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row.active .name {
  color: var(--accent-strong);
}

.init {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  font-size: 1.1rem;
}

.hp {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.bar {
  width: 54px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-3);
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width 400ms ease;
}

.hp-status {
  font-size: 1.05rem;
  font-style: italic;
  color: var(--muted);
}

.hp-status--blesse { color: #e67e22; }
.hp-status--mal_en_point { color: #c0392b; }
.hp-status--agonisant { color: #7b241c; }

.hp-dead {
  color: var(--muted);
}
</style>
