<script setup lang="ts">
defineProps<{
  variant?: 'empty' | 'loading' | 'error'
}>()
</script>

<template>
  <div class="state-block" :class="variant ?? 'empty'">
    <slot />
    <div v-if="$slots.actions" class="state-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.state-block {
  text-align: center;
  color: var(--muted);
  padding: 2.5rem 1rem;
  font-size: 0.95rem;
}

.state-block.error {
  text-align: left;
  padding: 1.25rem 1.1rem;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border));
  background: color-mix(in srgb, var(--danger) 8%, var(--surface-2));
  color: var(--text);
  font-size: 0.92rem;
  line-height: 1.45;
}

.state-block.error :slotted(p) {
  margin: 0 0 0.75rem;
}

.state-actions {
  margin-top: 0.85rem;
  display: flex;
  justify-content: flex-start;
  gap: 0.5rem;
}

.state-block.empty .state-actions,
.state-block.loading .state-actions {
  justify-content: center;
}
</style>
