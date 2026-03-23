<script setup lang="ts">
defineProps<{
  variant?: 'ghost' | 'primary' | 'danger'
  size?: number
  title?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}>()
</script>

<template>
  <button
    :type="type ?? 'button'"
    class="icon-btn btn"
    :class="[`${variant ?? 'ghost'}`, variant === 'danger' ? 'danger ghost' : '']"
    :style="size ? { width: `${size}px`, height: `${size}px`, minHeight: `${size}px` } : undefined"
    :title="title"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.icon-btn {
  width: 40px;
  height: 40px;
  min-height: 40px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
