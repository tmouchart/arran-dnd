<script setup lang="ts">
defineProps<{
  title?: string
}>()

// `border-solid` est obligatoire : sans le preflight Tailwind, border-style
// vaut `none` par defaut et la bordure serait invisible.
const CARD =
  'block bg-card border border-solid border-[var(--border-strong)] rounded-xl ' +
  'p-[var(--space-md)] mb-[var(--space-md)] shadow-[var(--shadow-card)]'

const CARD_HEAD =
  'flex justify-between items-center mb-[var(--space-md)] gap-[var(--space-md)]'
</script>

<template>
  <!-- Les classes `card` / `card-head` restent : les 3 themes les ciblent. -->
  <section :class="[CARD, 'card']">
    <div v-if="title || $slots.titleActions" :class="[CARD_HEAD, 'card-head']">
      <h2 v-if="title">{{ title }}</h2>
      <slot name="titleActions" />
    </div>
    <slot v-else-if="$slots.title" name="title" />
    <slot />
  </section>
</template>

<style scoped>
/* Cible du contenu slotte -> doit rester en CSS */
.card-head h2,
:slotted(h2) {
  font-size: 1.02rem;
  margin: 0 0 0.8rem;
  font-weight: 600;
  font-family: var(--title-font);
  color: var(--accent-strong);
  letter-spacing: 0.01em;
}

.card-head h2 {
  margin: 0;
}
</style>
