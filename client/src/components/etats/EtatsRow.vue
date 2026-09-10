<script setup lang="ts">
import { computed } from 'vue'
import EtatBadge from './EtatBadge.vue'
import { sortEtats } from '../../data/etats'

const props = withDefaults(
  defineProps<{
    states: readonly string[]
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const etats = computed(() => sortEtats(props.states))

// Liste vide = rien du tout. Une zone toujours presente devient une zone que
// l'oeil ignore, et le jour ou un etat arrive personne ne le voit.
</script>

<template>
  <div v-if="etats.length > 0" class="etats-row">
    <EtatBadge v-for="e in etats" :key="e.id" :etat="e" :size="size" />
  </div>
</template>

<style scoped>
.etats-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
}
</style>
