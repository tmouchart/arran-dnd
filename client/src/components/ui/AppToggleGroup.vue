<script setup lang="ts">
import type { Component } from 'vue'
import { ToggleGroupRoot, ToggleGroupItem } from 'reka-ui'

export interface AppToggleItem {
  value: string
  /** Lucide component */
  icon: Component
  /** Tooltip + accessible name */
  title: string
  testid?: string
}

defineProps<{
  /** '' = aucun bouton actif. Re-cliquer le bouton actif le désélectionne. */
  modelValue: string
  items: AppToggleItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// reka-ui apporte la navigation clavier (flèches) et aria-pressed.
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="modelValue"
    class="toggle-group"
    @update:model-value="emit('update:modelValue', String($event ?? ''))"
  >
    <ToggleGroupItem
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      :title="item.title"
      :aria-label="item.title"
      :data-testid="item.testid"
      class="toggle-item"
    >
      <component :is="item.icon" :size="18" aria-hidden="true" />
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>

<style scoped>
.toggle-group {
  display: inline-flex;
  gap: var(--space-xs);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-xs);
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}

.toggle-item:hover {
  background: color-mix(in srgb, var(--accent-soft) 60%, transparent);
  color: var(--accent-strong);
}

.toggle-item[data-state='on'] {
  background: var(--brand);
  color: var(--on-brand);
}
</style>
