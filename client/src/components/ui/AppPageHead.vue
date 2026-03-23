<template>
  <header class="page-head">
    <h1 class="page-head-title">
      <slot />
    </h1>
    <div v-if="$slots.actions" class="page-head-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.page-head-title {
  margin: 0;
  font-size: clamp(1.35rem, 4.5vw, 1.95rem);
  font-family: var(--title-font);
  color: var(--brand-strong);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-head-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
</style>
