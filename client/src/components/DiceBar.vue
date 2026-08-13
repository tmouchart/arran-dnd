<script setup lang="ts">
import { History } from 'lucide-vue-next'
import DiceSandbox from './DiceSandbox.vue'
import { useDiceBar } from '../composables/useDiceBar'
import { useCampaignRolls } from '../composables/useCampaignRolls'

// Dés génériques accessibles depuis n'importe quelle page. Sous la nav sur
// desktop, ancrée en bas sur mobile pour rester sous le pouce.
// Le log partage cette barre : une seule icône dans la nav pour les deux outils.
const { diceBarOpen } = useDiceBar()
const { panelOpen, unread, togglePanel } = useCampaignRolls()
</script>

<template>
  <div v-if="diceBarOpen" class="dice-bar">
    <DiceSandbox compact>
      <template #trailing>
        <button
          type="button"
          class="log-btn"
          :class="{ active: panelOpen }"
          @click="togglePanel()"
        >
          <History :size="16" />
          <span class="log-btn-text">Log</span>
          <span v-if="unread > 0 && !panelOpen" class="log-badge">{{ unread }}</span>
        </button>
      </template>
    </DiceSandbox>
  </div>
</template>

<style scoped>
.dice-bar {
  flex-shrink: 0;
  z-index: 9;
  padding: var(--space-sm) var(--space-md);
  background: var(--surface);
  border-bottom: 1px solid var(--border-strong);
  box-shadow: var(--shadow-soft);
  /* reka-ui n'est pas dans le circuit ici : keyframes à l'ouverture seulement */
  animation: dice-bar-in 0.18s ease;
}

@keyframes dice-bar-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

/* Bouton libellé, pas icône seule : c'est la seule porte d'entrée du log,
   en icône nue au bord de la barre personne ne le trouve. */
.log-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 40px;
  padding: 0 var(--space-md);
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--border-strong);
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--title-font);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.log-btn:hover,
.log-btn.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.log-badge {
  min-width: 1.15rem;
  padding: 0 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--accent-strong);
  color: var(--on-brand);
  font-size: 0.68rem;
  line-height: 1.15rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 400px) {
  .log-btn {
    padding: 0 0.5rem;
  }

  .log-btn-text {
    display: none;
  }
}

@media (max-width: 739px) {
  /* Sous le pouce : la barre passe en bas, l'ordre des enfants de .app-shell
     est réassigné dans App.vue. */
  .dice-bar {
    border-bottom: none;
    border-top: 1px solid var(--border-strong);
    animation-name: dice-bar-in-bottom;
    padding-bottom: max(var(--space-sm), env(safe-area-inset-bottom));
  }
}

@keyframes dice-bar-in-bottom {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
