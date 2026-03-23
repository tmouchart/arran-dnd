<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <section class="card">
    <div v-if="title || $slots.titleActions" class="card-head">
      <h2 v-if="title">{{ title }}</h2>
      <slot name="titleActions" />
    </div>
    <slot v-else-if="$slots.title" name="title" />
    <slot />
  </section>
</template>

<style scoped>
.card {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  padding: 0.95rem;
  margin-bottom: 0.85rem;
  box-shadow: var(--shadow-card);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  gap: 0.6rem;
}

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
