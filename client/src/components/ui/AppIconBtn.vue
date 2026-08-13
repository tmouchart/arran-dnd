<script setup lang="ts">
import AppButton from './AppButton.vue'

defineProps<{
  variant?: 'ghost' | 'primary' | 'danger'
  size?: number
  title?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}>()
</script>

<template>
  <!-- `icon-btn` reste : les 3 themes ciblent `.icon-btn.primary`. -->
  <AppButton
    :variant="variant ?? 'ghost'"
    :type="type"
    :disabled="disabled"
    :title="title"
    class="icon-btn shrink-0 p-0 w-10 h-10 min-h-10"
    :style="size ? { width: `${size}px`, height: `${size}px`, minHeight: `${size}px` } : undefined"
  >
    <slot />
  </AppButton>
</template>
