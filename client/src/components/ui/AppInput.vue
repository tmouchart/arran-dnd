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
  readonly?: boolean
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
    :class="['input', textAlign === 'center' && 'text-center tabular-nums']"
    :placeholder="placeholder"
    :min="min"
    :max="max"
    :step="step"
    :required="required"
    :autofocus="autofocus"
    :autocomplete="autocomplete"
    :disabled="disabled"
    :readonly="readonly"
    :id="id"
    @input="onInput"
  />
</template>
