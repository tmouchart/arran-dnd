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

// Base partagee avec AppTextarea. `border-solid` obligatoire : sans le
// preflight Tailwind, border-style vaut `none` et la bordure disparait.
const FIELD =
  'px-[var(--space-md)] py-[var(--space-sm)] rounded-md border border-solid ' +
  'border-border bg-[var(--surface-2)] text-foreground font-[inherit] text-[0.92rem]'

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
    :class="[FIELD, 'min-h-[38px]', textAlign === 'center' && 'text-center tabular-nums', 'app-input']"
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
