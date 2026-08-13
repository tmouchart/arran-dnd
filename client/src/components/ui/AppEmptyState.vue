<script setup lang="ts">
import { cva } from 'class-variance-authority'
import { cn } from '@/utils/cn'

defineProps<{
  variant?: 'empty' | 'loading' | 'error'
}>()

const stateVariants = cva('', {
  variants: {
    variant: {
      empty: 'text-center text-muted-foreground px-4 py-6 text-[0.95rem]',
      loading: 'text-center text-muted-foreground px-4 py-6 text-[0.95rem]',
      error: 'text-left p-[var(--space-lg)] rounded-lg text-foreground text-[0.92rem] leading-[1.45]',
    },
  },
  defaultVariants: { variant: 'empty' },
})
</script>

<template>
  <div :class="cn(stateVariants({ variant: variant ?? 'empty' }), 'state-block', variant ?? 'empty')">
    <slot />
    <div
      v-if="$slots.actions"
      :class="cn('mt-[0.85rem] flex gap-2', variant === 'error' ? 'justify-start' : 'justify-center')"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
/* color-mix : plus lisible ici qu'en valeur arbitraire Tailwind */
.state-block.error {
  border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border));
  background: color-mix(in srgb, var(--danger) 8%, var(--surface-2));
}

.state-block.error :slotted(p) {
  margin: 0 0 0.75rem;
}
</style>
