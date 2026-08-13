<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui'
import { cva } from 'class-variance-authority'
import { cn } from '@/utils/cn'
import type { HTMLAttributes } from 'vue'

interface Props extends PrimitiveProps {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'normal' | 'small'
  type?: 'button' | 'submit'
  disabled?: boolean
  block?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), { as: 'button' })

// Valeurs arbitraires volontaires : elles reprennent a l'identique l'ancien
// `.btn` de style.css, pour que rien ne bouge visuellement.
// `border-solid` obligatoire : sans preflight, border-style vaut `none`.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 cursor-pointer font-[inherit] font-semibold ' +
    'border border-solid border-transparent rounded-lg ' +
    'transition-[transform,box-shadow,background-color,border-color,color] duration-150 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-[var(--shadow-soft)] ' +
          'border-[color-mix(in_srgb,var(--brand-strong)_65%,black)] ' +
          'disabled:opacity-60 disabled:cursor-not-allowed',
        ghost:
          'bg-card text-foreground border-border ' +
          'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]',
        danger:
          'bg-card text-destructive ' +
          'border-[color-mix(in_srgb,var(--danger)_55%,var(--border))] ' +
          'hover:border-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_16%,transparent)]',
      },
      size: {
        normal: 'min-h-10 px-[0.85rem] py-[0.5rem] text-[0.95rem]',
        small: 'px-[0.7rem] py-[0.3rem] text-[0.82rem] rounded-sm',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'ghost', size: 'normal', block: false },
  },
)
</script>

<template>
  <!--
    Les classes `btn` / `primary` / `ghost` / `small` restent : les 3 themes
    ciblent `html[data-style=...] .btn.primary`. Les regles de base ont ete
    retirees de style.css, donc plus de conflit avec Tailwind.
  -->
  <Primitive
    :as="as"
    :as-child="asChild"
    :type="as === 'button' ? (type ?? 'button') : undefined"
    :disabled="disabled"
    :class="
      cn(
        buttonVariants({ variant: variant ?? 'ghost', size: size ?? 'normal', block }),
        'btn',
        variant ?? 'ghost',
        variant === 'danger' && 'ghost',
        size === 'small' && 'small',
        props.class,
      )
    "
  >
    <slot />
  </Primitive>
</template>

<style scoped>
/* Tailwind n'a pas de variante fiable pour `:hover:not(:disabled)` ici :
   on garde ces deux lignes en CSS. */
.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled {
  transform: none;
}
</style>
