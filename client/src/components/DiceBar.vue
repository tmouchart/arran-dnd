<script setup lang="ts">
import DiceSandbox from './DiceSandbox.vue'
import { useDiceBar } from '../composables/useDiceBar'

// Dés génériques accessibles depuis n'importe quelle page. Ancrée juste
// au-dessus de la barre du bas, sous le pouce. Le log a son propre bouton
// dans cette barre du bas.
const { diceBarOpen } = useDiceBar()
</script>

<template>
  <div v-if="diceBarOpen" class="dice-bar">
    <DiceSandbox compact />
  </div>
</template>

<style scoped>
.dice-bar {
  padding: var(--space-sm) var(--space-md);
  background: var(--surface);
  border-top: 1px solid var(--border-strong);
  /* reka-ui n'est pas dans le circuit ici : keyframes à l'ouverture seulement */
  animation: dice-bar-in 0.18s ease;
}

@keyframes dice-bar-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
