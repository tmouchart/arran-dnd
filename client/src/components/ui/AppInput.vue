<script setup lang="ts">
const props = defineProps<{
  modelValue?: string | number | null
  modelModifiers?: Record<string, boolean>
  type?: 'text' | 'number' | 'password'
  placeholder?: string
  min?: number
  max?: number
  step?: number
  required?: boolean
  autofocus?: boolean
  autocomplete?: string
  disabled?: boolean
  textAlign?: 'left' | 'center'
  id?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  if (props.type === 'number') {
    emit('update:modelValue', raw === '' ? '' : Number(raw))
  } else {
    emit('update:modelValue', raw)
  }
}
</script>

<template>
  <input
    :type="type ?? 'text'"
    :value="modelValue"
    class="app-input"
    :class="{ 'app-input--center': textAlign === 'center' }"
    :placeholder="placeholder"
    :min="min"
    :max="max"
    :step="step"
    :required="required"
    :autofocus="autofocus"
    :autocomplete="autocomplete"
    :disabled="disabled"
    :id="id"
    @input="onInput"
  />
</template>

<style scoped>
.app-input {
  min-height: 42px;
  padding: 0.5rem 0.64rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  font-size: 0.92rem;
}

.app-input--center {
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
