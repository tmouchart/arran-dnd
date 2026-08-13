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
  /** Wider box (560px) for content-heavy modals */
  wide?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

// reka-ui s'occupe de : focus trap, Escape, clic dehors, scroll lock,
// aria-modal et restitution du focus a la fermeture.
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <Transition name="modal-overlay">
        <DialogOverlay class="modal-overlay" />
      </Transition>
      <Transition name="modal-box">
        <DialogContent class="modal-box" :class="{ 'modal-box--wide': wide }">
          <div class="modal-head">
            <DialogTitle v-if="title" class="modal-title">{{ title }}</DialogTitle>
            <!-- DialogTitle est requis pour l'accessibilite : si pas de titre
                 visible, on en met un lu par les lecteurs d'ecran seulement. -->
            <DialogTitle v-else class="sr-only">Boîte de dialogue</DialogTitle>
            <span v-if="!title" class="modal-title-spacer" />
            <DialogClose as-child>
              <AppIconBtn :size="34" title="Fermer">
                <X :size="18" />
              </AppIconBtn>
            </DialogClose>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </DialogContent>
      </Transition>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
/* Non scoped : DialogContent est teleporte dans <body>, hors du scope du composant. */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
}

.modal-box {
  position: fixed;
  z-index: 1001;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  width: calc(100% - 2 * var(--space-md));
  max-width: 420px;
  max-height: 88dvh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-card);
}

.modal-box--wide {
  max-width: 560px;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg) var(--space-sm);
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  font-family: var(--title-font);
  color: var(--accent-strong);
}

.modal-title-spacer {
  flex: 1;
}

.modal-body {
  padding: var(--space-sm) var(--space-lg) var(--space-lg);
  overflow-y: auto;
  min-height: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg) var(--space-lg);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-overlay-enter-active,
.modal-overlay-leave-active {
  transition: opacity 160ms ease;
}

.modal-overlay-enter-from,
.modal-overlay-leave-to {
  opacity: 0;
}

.modal-box-enter-active,
.modal-box-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.modal-box-enter-from,
.modal-box-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) translateY(10px) scale(0.98);
}
</style>
