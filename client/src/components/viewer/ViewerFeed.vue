<script setup lang="ts">
import { Sparkles, Skull, EyeOff, Dices } from 'lucide-vue-next'
import { feed } from '../../composables/useViewerFeed'

/**
 * Le fil « qui fait quoi » : une ligne par jet, la plus récente en haut.
 * Elle glisse depuis le haut ; les vieilles descendent puis sortent.
 */
</script>

<template>
  <section class="feed" data-testid="viewer-feed">
    <TransitionGroup name="line" tag="ol" class="lines">
      <li
        v-for="line in feed"
        :key="line.id"
        class="line"
        :class="{
          critical: line.outcome === 'critical',
          fumble: line.outcome === 'fumble',
          secret: line.secret,
        }"
      >
        <span class="mark">
          <Sparkles v-if="line.outcome === 'critical'" :size="20" />
          <Skull v-else-if="line.outcome === 'fumble'" :size="20" />
          <EyeOff v-else-if="line.secret" :size="20" />
          <span v-else class="die">d{{ line.sides }}</span>
        </span>
        <span class="text">
          <span class="actor" :style="line.color ? { color: line.color } : undefined">{{ line.actorName }}</span>
          <span class="sep"> · </span>
          <span class="label">{{ line.label }}</span>
          <span v-if="line.damage != null" class="damage"> → {{ line.damage }} dégâts</span>
        </span>
        <span v-if="line.total != null" class="total">
          <!-- Avantage : une marque, pas le détail des dés — ce fil se lit à un mètre -->
          <Dices v-if="line.advantage" class="advantage" :size="18" />{{ line.total }}
        </span>
        <span v-else class="total total-secret">?</span>
      </li>
    </TransitionGroup>
    <p v-if="feed.length === 0" class="empty">Les jets s'afficheront ici.</p>
  </section>
</template>

<style scoped>
.feed {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  position: relative;
}

.line {
  display: grid;
  grid-template-columns: 34px 1fr auto;
  align-items: center;
  gap: var(--space-sm);
  min-height: 44px;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 1.3rem;
}

.line.critical {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.line.fumble {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 14%, var(--surface));
}

.line.secret {
  font-style: italic;
  color: var(--muted);
}

.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
}

.line.critical .mark { color: var(--accent-strong); }
.line.fumble .mark { color: var(--danger); }

.die {
  font-family: var(--title-font);
  font-size: 0.85rem;
  font-weight: 700;
}

.text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actor {
  font-family: var(--title-font);
  font-weight: 700;
}

.sep {
  color: var(--muted);
}

.damage {
  color: var(--muted);
  font-size: 1.05rem;
}

.total {
  font-family: var(--title-font);
  font-size: 1.7rem;
  font-weight: 700;
  color: var(--brand-strong);
  font-variant-numeric: tabular-nums;
}

.line.critical .total { color: var(--accent-strong); }
.line.fumble .total { color: var(--danger); }

.advantage {
  color: var(--muted);
  margin-right: var(--space-xs);
  vertical-align: middle;
}

.total-secret {
  color: var(--muted);
}

.empty {
  margin: var(--space-md) 0;
  color: var(--muted);
  font-style: italic;
  font-size: 1.1rem;
}

.line-enter-active,
.line-move {
  transition: all 320ms ease-out;
}

.line-leave-active {
  transition: all 240ms ease-in;
  position: absolute;
  width: 100%;
}

.line-enter-from {
  opacity: 0;
  transform: translateY(-16px);
}

.line-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (prefers-reduced-motion: reduce) {
  .line-enter-active,
  .line-move,
  .line-leave-active {
    transition: none;
  }
}
</style>
