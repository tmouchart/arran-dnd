<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import AppIconBtn from './AppIconBtn.vue'

const props = defineProps<{
  modelValue: boolean
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function close(e?: Event) {
  // Stop propagation so the closing click never reaches elements behind the sheet
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
    <Transition name="sheet">
      <div v-if="modelValue" class="sheet-overlay" @click.self.stop="close">
        <div class="sheet" role="dialog" aria-modal="true">
          <div class="sheet-head">
            <h3 v-if="title" class="sheet-title">{{ title }}</h3>
            <span v-else class="sheet-title-spacer" />
            <AppIconBtn :size="34" title="Fermer" @click.stop="close">
              <X :size="18" />
            </AppIconBtn>
          </div>
          <div class="sheet-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
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
  padding: 0.85rem 1rem 0.4rem;
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
  padding: 0.4rem 1rem 1.1rem;
  overflow-y: auto;
  min-height: 0;
}

/* Desktop: centered dialog */
@media (min-width: 700px) {
  .sheet-overlay {
    align-items: center;
    padding: 1rem;
  }

  .sheet {
    max-width: 440px;
    border-radius: 18px;
    border-bottom: 1px solid var(--border-strong);
    max-height: 80dvh;
  }
}

/* Transitions */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 180ms ease;
}

/* Keep capturing pointer events while the sheet fades out,
   so nothing behind can be clicked during the leave transition. */
.sheet-leave-active {
  pointer-events: auto;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 220ms ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}

@media (min-width: 700px) {
  .sheet-enter-from .sheet,
  .sheet-leave-to .sheet {
    transform: translateY(24px);
  }
}
</style>
