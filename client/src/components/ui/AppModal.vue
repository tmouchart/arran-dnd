<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import AppIconBtn from './AppIconBtn.vue'

defineProps<{
  modelValue: boolean
  title?: string
  /** Wider box (560px) for content-heavy modals */
  wide?: boolean
  /** Lu par les lecteurs d'ecran a l'ouverture. Jamais affiche. */
  description?: string
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
      <DialogOverlay class="modal-overlay" />
      <DialogContent class="modal-box" :class="{ 'modal-box--wide': wide }">
          <div class="modal-head">
            <DialogTitle v-if="title" class="modal-title">{{ title }}</DialogTitle>
            <!-- DialogTitle est requis pour l'accessibilite : si pas de titre
                 visible, on en met un lu par les lecteurs d'ecran seulement. -->
            <DialogTitle v-else class="sr-only">Boîte de dialogue</DialogTitle>
            <!-- reka-ui exige une description : sans elle il avertit en dev.
                 Elle n'est jamais visible, seulement lue a voix haute. -->
            <DialogDescription class="sr-only">
              {{ description ?? 'Appuyez sur Échap pour fermer.' }}
            </DialogDescription>
            <span v-if="!title" class="modal-title-spacer" />
            <DialogClose as-child>
              <AppIconBtn title="Fermer">
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
  font-size: 1rem;
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

/* Animations pilotees par [data-state], PAS par <Transition> de Vue.
   reka-ui gere lui-meme le montage/demontage : un <Transition> autour
   bloque la sortie (les deux s'attendent) et l'element reste dans le DOM. */
@keyframes modal-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modal-box-in {
  from { opacity: 0; transform: translate(-50%, -50%) translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translate(-50%, -50%); }
}

.modal-overlay[data-state='open'] {
  animation: modal-overlay-in 160ms ease;
}

.modal-box[data-state='open'] {
  animation: modal-box-in 160ms ease;
}

/* Pas d'animation de fermeture, volontairement.
   reka-ui memorise le nom de l'animation d'entree et ne reconnait pas celle
   de sortie : l'element reste alors dans le DOM pour toujours (verifie dans
   le navigateur). Sans animation sur [data-state='closed'], il se demonte
   immediatement. La fermeture est donc instantanee. */
</style>
