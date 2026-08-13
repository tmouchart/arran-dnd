<script setup lang="ts">
defineProps<{
  modelValue: string | null | undefined
  placeholder?: string
  rows?: number
  disabled?: boolean
  required?: boolean
  id?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <textarea
    class="app-textarea"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    :required="required"
    :id="id"
    @input="onInput"
  />
</template>

<style scoped>
.app-textarea {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  font-size: 0.92rem;
  line-height: 1.45;
  resize: vertical;
}
</style>
