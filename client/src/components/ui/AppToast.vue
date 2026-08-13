<script setup lang="ts">
import { toasts, dismissToast, type Toast } from '../../composables/useToast'

function runAction(toast: Toast) {
  toast.onAction?.()
  dismissToast(toast.id)
}
</script>

<template>
  <Teleport to="body">
    <!-- aria-live : les lecteurs d'ecran annoncent le toast a son apparition -->
    <TransitionGroup
      name="toast"
      tag="div"
      class="toast-stack"
      role="status"
      aria-live="polite"
    >
      <div v-for="toast in toasts" :key="toast.id" class="toast">
        <span class="toast-message">{{ toast.message }}</span>
        <button
          v-if="toast.actionLabel"
          type="button"
          class="toast-action"
          @click="runAction(toast)"
        >
          {{ toast.actionLabel }}
        </button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: calc(1rem + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: min(92vw, 380px);
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  border-radius: var(--radius-lg);
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-card);
  color: var(--fg);
  font-size: 0.88rem;
}

.toast-message {
  flex: 1;
}

.toast-action {
  background: none;
  border: none;
  padding: 0.2rem 0.4rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--accent-strong);
  cursor: pointer;
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
