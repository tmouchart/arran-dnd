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
  <!-- `input` porte la base commune (style.css) et sert de crochet aux 3 themes -->
  <select v-model="model" class="input" :disabled="disabled" :required="required" :id="id">
    <slot />
  </select>
</template>
