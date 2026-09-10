<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent, PopoverArrow } from 'reka-ui'

defineProps<{
  /** Nom accessible du declencheur. Sert aussi d'infobulle native au survol. */
  label: string
  /** Cote d'ouverture par defaut. */
  side?: 'top' | 'right' | 'bottom' | 'left'
}>()

// Popover et pas Tooltip : sur telephone il n'y a pas de survol, il faut un tap.
// reka-ui gere le clic dehors, Echap, le focus et le repositionnement.
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button type="button" class="tip-trigger" :title="label" :aria-label="label">
        <slot name="trigger" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="tip-content"
        :side="side ?? 'top'"
        :side-offset="6"
        :collision-padding="8"
      >
        <slot />
        <PopoverArrow class="tip-arrow" :width="10" :height="5" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.tip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xs);
  margin: calc(-1 * var(--space-xs));
  border: none;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
  border-radius: var(--radius-xs);
  line-height: 1;
}

.tip-trigger:hover,
.tip-trigger[data-state='open'] {
  color: var(--accent-strong);
  background: var(--accent-soft);
}
</style>

<style>
/* Non scope : PopoverContent est teleporte dans <body>, hors du scope. */
.tip-content {
  z-index: 1002;
  max-width: min(15rem, calc(100vw - 2 * var(--space-md)));
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: var(--space-sm) var(--space-md);
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--text);
}

.tip-arrow {
  fill: var(--surface-3);
}

/* Animation pilotee par [data-state], et seulement a l'ouverture :
   reka-ui ne reconnait pas une animation de sortie differente et laisserait
   l'element dans le DOM pour toujours. */
@keyframes tip-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.tip-content[data-state='open'] {
  animation: tip-in 120ms ease;
}
</style>
