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

// Meme base que AppInput
const FIELD =
  'px-[var(--space-md)] py-[var(--space-sm)] rounded-md border border-solid ' +
  'border-border bg-[var(--surface-2)] text-foreground font-[inherit] text-[0.92rem]'

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <textarea
    :class="[FIELD, 'leading-[1.45] resize-y', 'app-textarea']"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    :required="required"
    :id="id"
    @input="onInput"
  />
</template>
