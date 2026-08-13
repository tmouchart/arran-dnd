<script setup lang="ts">
import { cva } from 'class-variance-authority'
import { cn } from '@/utils/cn'

defineProps<{
  variant: 'attaque' | 'limitée' | 'gratuite' | 'info' | 'pm' | 'active'
}>()

// Les classes `badge` / `badge-*` restent : les 3 themes les ciblent,
// et les couleurs custom vivent dans le <style> plus bas.
const badgeVariants = cva(
  'inline-block whitespace-nowrap shrink-0 rounded-full px-[0.65em] py-[0.18em] text-[0.7rem] font-bold',
  {
    variants: {
      variant: {
        attaque: 'uppercase tracking-[0.04em]',
        limitée: 'uppercase tracking-[0.04em]',
        gratuite: 'uppercase tracking-[0.04em]',
        active: 'uppercase tracking-[0.04em]',
        info: 'tracking-[0.02em]',
        pm: 'tracking-[0.02em] tabular-nums',
      },
    },
  },
)
</script>

<template>
  <span :class="cn(badgeVariants({ variant }), 'badge', `badge-${variant}`)">
    <slot />
  </span>
</template>

<style scoped>
/* Couleurs uniquement. Le color-mix reste plus lisible ici qu'en
   valeurs arbitraires Tailwind. */
.badge-limitée {
  background: color-mix(in srgb, #8e44ad 18%, transparent);
  color: #8e44ad;
  border: 1px solid color-mix(in srgb, #8e44ad 35%, transparent);
}

.badge-attaque {
  background: color-mix(in srgb, #e67e22 18%, transparent);
  color: #e67e22;
  border: 1px solid color-mix(in srgb, #e67e22 35%, transparent);
}

.badge-gratuite {
  background: color-mix(in srgb, #27ae60 18%, transparent);
  color: #27ae60;
  border: 1px solid color-mix(in srgb, #27ae60 35%, transparent);
}

.badge-info {
  background: color-mix(in srgb, var(--muted) 14%, transparent);
  color: var(--muted);
  border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
}

.badge-pm {
  background: color-mix(in srgb, #2980b9 20%, transparent);
  color: #2471a3;
  border: 1px solid color-mix(in srgb, #2980b9 38%, transparent);
}

.badge-active {
  background: #1a7a3c22;
  color: #1a7a3c;
  border: 1px solid #1a7a3c55;
}

:root[data-theme='dark'] .badge-active {
  background: #1db95422;
  color: #4ade80;
  border-color: #4ade8055;
}
</style>
