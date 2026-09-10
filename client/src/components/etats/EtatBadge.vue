<script setup lang="ts">
import AppTooltip from '../ui/AppTooltip.vue'
import type { Etat } from '../../data/etats'

withDefaults(
  defineProps<{
    etat: Etat
    /** `sm` pour une rangee dense (ligne d'initiative), normal pour la fiche. */
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

// Lecture seule : le tap ouvre l'infobulle et rien d'autre. Poser ou retirer un
// etat passe toujours par EtatsSheet, la cible tactile y est assez grande.
</script>

<template>
  <AppTooltip :label="etat.label">
    <template #trigger>
      <span
        class="etat-badge"
        :class="[`etat-badge--${size}`, `etat-badge--${etat.id}`]"
        :data-testid="`etat-badge-${etat.id}`"
      >
        <component :is="etat.icon" v-if="etat.icon" :size="size === 'sm' ? 12 : 15" />
        <span v-else class="etat-badge-emoji">{{ etat.emoji }}</span>
      </span>
    </template>
    <strong class="etat-tip-label">{{ etat.label }}</strong>
    <span class="etat-tip-effect">{{ etat.effect }}</span>
  </AppTooltip>
</template>

<style scoped>
.etat-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--etat) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--etat) 45%, transparent);
  border-style: solid;
  color: var(--etat);
}

.etat-badge--sm {
  width: 20px;
  height: 20px;
}

.etat-badge--md {
  width: 26px;
  height: 26px;
}

/* Affaibli garde son violet : c'est le seul etat qui change vraiment une regle
   de jet (d12 au lieu du d20). */
.etat-badge--affaibli {
  --etat: var(--etat-affaibli);
}

/* Un bonhomme debout couche sur le flanc : c'est ca, Renverse. */
.etat-badge--renverse :deep(svg) {
  transform: rotate(90deg);
}

.etat-badge-emoji {
  font-size: 0.72rem;
}

.etat-badge--md .etat-badge-emoji {
  font-size: 0.9rem;
}
</style>

<style>
/* Non scope : le contenu de l'infobulle est teleporte dans <body>. */
.etat-tip-label {
  display: block;
  font-weight: 700;
}

.etat-tip-effect {
  display: block;
  color: var(--muted);
}
</style>
