<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'normal' | 'small'
  type?: 'button' | 'submit'
  disabled?: boolean
  block?: boolean
}>()
</script>

<template>
  <button
    :type="type ?? 'button'"
    class="btn"
    :class="[
      variant ?? 'ghost',
      { small: size === 'small', 'btn--block': block },
      variant === 'danger' ? 'danger ghost' : ''
    ]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn--block {
  width: 100%;
}
</style>
