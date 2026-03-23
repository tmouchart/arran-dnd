<script setup lang="ts">
defineProps<{
  variant: 'attaque' | 'limitée' | 'gratuite' | 'info' | 'pm' | 'active'
}>()
</script>

<template>
  <span class="badge" :class="`badge-${variant}`">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.18em 0.65em;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

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
  text-transform: none;
  letter-spacing: 0.02em;
}

.badge-pm {
  background: color-mix(in srgb, #2980b9 20%, transparent);
  color: #2471a3;
  border: 1px solid color-mix(in srgb, #2980b9 38%, transparent);
  text-transform: none;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
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
