<script setup lang="ts" generic="T">
// Generic + native v-model passthrough: preserves the bound type (string,
// number, null, union…) so callers keep their exact typing on @update.
const model = defineModel<T>({ required: true })

defineProps<{
  disabled?: boolean
  required?: boolean
  id?: string
}>()
</script>

<template>
  <select v-model="model" class="app-select" :disabled="disabled" :required="required" :id="id">
    <slot />
  </select>
</template>

<style scoped>
.app-select {
  min-height: 38px;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  font-size: 0.92rem;
}
</style>
