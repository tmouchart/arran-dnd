<script setup lang="ts">
import type { Component } from 'vue'
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui'

export interface AppTab {
  value: string
  label: string
  /** Emoji string or Lucide component */
  icon?: string | Component
  /** Unread indicator (e.g. new activity while the tab is inactive) */
  dot?: boolean
}

defineProps<{
  modelValue: string
  tabs: AppTab[]
  /** Hide labels on narrow screens, keep icons only */
  iconOnlyMobile?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// reka-ui apporte la navigation au clavier (fleches, Home/End) et le
// cablage aria-selected / roving tabindex.
</script>

<template>
  <TabsRoot :model-value="modelValue" @update:model-value="emit('update:modelValue', String($event))">
    <TabsList class="tab-bar">
      <TabsTrigger v-for="tab in tabs" :key="tab.value" :value="tab.value" class="tab-btn">
        <span v-if="typeof tab.icon === 'string'" class="tab-icon" aria-hidden="true">{{ tab.icon }}</span>
        <component :is="tab.icon" v-else-if="tab.icon" class="tab-icon" :size="16" aria-hidden="true" />
        <span class="tab-label" :class="{ 'tab-label--hide-mobile': iconOnlyMobile }">{{ tab.label }}</span>
        <span v-if="tab.dot" class="tab-dot" aria-hidden="true" />
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
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

/* reka-ui expose l'etat via data-state plutot qu'une classe */
.tab-btn[data-state='active'] {
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

.tab-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand);
  flex-shrink: 0;
}

@media (max-width: 520px) {
  .tab-label--hide-mobile {
    display: none;
  }
}
</style>
