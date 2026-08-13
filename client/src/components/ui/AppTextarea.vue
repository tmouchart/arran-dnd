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
    class="input leading-[1.45] resize-y"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    :required="required"
    :id="id"
    @input="onInput"
  />
</template>
