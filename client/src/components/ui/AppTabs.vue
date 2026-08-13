<script setup lang="ts">
import type { Component } from 'vue'

export interface AppTab {
  value: string
  label: string
  /** Emoji string or Lucide component */
  icon?: string | Component
}

defineProps<{
  modelValue: string
  tabs: AppTab[]
  /** Hide labels on narrow screens, keep icons only */
  iconOnlyMobile?: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <nav class="tab-bar" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      role="tab"
      class="tab-btn"
      :class="{ active: modelValue === tab.value }"
      :aria-selected="modelValue === tab.value"
      @click="$emit('update:modelValue', tab.value)"
    >
      <span v-if="typeof tab.icon === 'string'" class="tab-icon" aria-hidden="true">{{ tab.icon }}</span>
      <component :is="tab.icon" v-else-if="tab.icon" class="tab-icon" :size="16" aria-hidden="true" />
      <span class="tab-label" :class="{ 'tab-label--hide-mobile': iconOnlyMobile }">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  gap: 0.35rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: var(--space-xs);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: 0.42rem 0.5rem;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  transition: background 150ms ease, color 150ms ease;
}

.tab-btn:hover {
  background: color-mix(in srgb, var(--accent-soft) 60%, transparent);
  color: var(--accent-strong);
}

.tab-btn.active {
  background: var(--surface);
  color: var(--accent-strong);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.tab-icon {
  font-size: 1rem;
  line-height: 1;
  flex-shrink: 0;
}

.tab-label {
  white-space: nowrap;
}

@media (max-width: 520px) {
  .tab-label--hide-mobile {
    display: none;
  }
}
</style>
