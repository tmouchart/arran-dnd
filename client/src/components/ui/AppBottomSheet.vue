<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import AppIconBtn from './AppIconBtn.vue'

defineProps<{
  modelValue: boolean
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

// Meme moteur que AppModal (reka-ui Dialog) : focus trap, Escape, clic
// dehors, scroll lock. Seul le positionnement change (ancre en bas).
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <Transition name="sheet-overlay">
        <DialogOverlay class="sheet-overlay" />
      </Transition>
      <Transition name="sheet">
        <DialogContent class="sheet">
          <div class="sheet-head">
            <DialogTitle v-if="title" class="sheet-title">{{ title }}</DialogTitle>
            <DialogTitle v-else class="sr-only">Panneau</DialogTitle>
            <span v-if="!title" class="sheet-title-spacer" />
            <DialogClose as-child>
              <AppIconBtn :size="34" title="Fermer">
                <X :size="18" />
              </AppIconBtn>
            </DialogClose>
          </div>
          <div class="sheet-body">
            <slot />
          </div>
        </DialogContent>
      </Transition>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
/* Non scoped : DialogContent est teleporte dans <body>. */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
}

.sheet {
  position: fixed;
  z-index: 1001;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-bottom: none;
  border-radius: var(--radius-xxl) var(--radius-xxl) 0 0;
  width: 100%;
  max-height: 85dvh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-card);
  padding-bottom: env(safe-area-inset-bottom);
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: var(--space-md) var(--space-lg) var(--space-sm);
  flex-shrink: 0;
}

.sheet-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  font-family: var(--title-font);
  color: var(--accent-strong);
}

.sheet-title-spacer {
  flex: 1;
}

.sheet-body {
  padding: var(--space-sm) var(--space-lg) var(--space-lg);
  overflow-y: auto;
  min-height: 0;
}

/* Desktop : dialogue centre */
@media (min-width: 700px) {
  .sheet {
    bottom: 50%;
    transform: translate(-50%, 50%);
    max-width: 440px;
    border-radius: var(--radius-xxl);
    border-bottom: 1px solid var(--border-strong);
    max-height: 80dvh;
  }
}

/* Transitions */
.sheet-overlay-enter-active,
.sheet-overlay-leave-active {
  transition: opacity 180ms ease;
}

.sheet-overlay-enter-from,
.sheet-overlay-leave-to {
  opacity: 0;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 220ms ease;
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translateX(-50%) translateY(100%);
}

@media (min-width: 700px) {
  .sheet-enter-active,
  .sheet-leave-active {
    transition: transform 220ms ease, opacity 180ms ease;
  }

  .sheet-enter-from,
  .sheet-leave-to {
    opacity: 0;
    transform: translate(-50%, 50%) translateY(24px);
  }
}
</style>
