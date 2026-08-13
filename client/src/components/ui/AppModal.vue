<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import AppIconBtn from './AppIconBtn.vue'

const props = defineProps<{
  modelValue: boolean
  title?: string
  /** Wider box (560px) for content-heavy modals */
  wide?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function close(e?: Event) {
  // Stop propagation so the closing click never reaches elements behind the modal
  e?.stopPropagation()
  emit('update:modelValue', false)
}

// Close on Escape
watch(
  () => props.modelValue,
  (open) => {
    if (open) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self.stop="close">
        <div class="modal-box" :class="{ 'modal-box--wide': wide }" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h3 v-if="title" class="modal-title">{{ title }}</h3>
            <span v-else class="modal-title-spacer" />
            <AppIconBtn :size="34" title="Fermer" @click.stop="close">
              <X :size="18" />
            </AppIconBtn>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-md);
}

.modal-box {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  width: 100%;
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 160ms ease;
}

.modal-enter-active .modal-box,
.modal-leave-active .modal-box {
  transition: transform 160ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-box,
.modal-leave-to .modal-box {
  transform: translateY(10px) scale(0.98);
}
</style>
