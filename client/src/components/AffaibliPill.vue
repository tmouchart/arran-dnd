<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    class="affaibli-pill"
    :class="{ active: model }"
    :title='model ? "Affaibli : tous les jets se font en d12. Cliquer pour désactiver." : "Cliquer si le personnage est affaibli : tous les jets passeront en d12."'
    :aria-pressed="model"
    @click="model = !model"
  >
    <span class="affaibli-emoji">🥀</span>
    Affaibli
    <span v-if="model" class="affaibli-die">d12</span>
  </button>
</template>

<style scoped>
.affaibli-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.28em 0.75em;
  border-radius: var(--radius-pill);
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  font-family: inherit;
  background: color-mix(in srgb, var(--muted) 10%, transparent);
  color: var(--muted);
  border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.affaibli-pill .affaibli-emoji {
  filter: grayscale(1);
  opacity: 0.7;
  transition: filter 0.15s, opacity 0.15s;
}

.affaibli-pill:hover {
  border-color: color-mix(in srgb, #8e44ad 45%, transparent);
  color: #8e44ad;
}

.affaibli-pill.active {
  background: color-mix(in srgb, #8e44ad 18%, transparent);
  color: #8e44ad;
  border: 1px solid color-mix(in srgb, #8e44ad 45%, transparent);
}

.affaibli-pill.active .affaibli-emoji {
  filter: none;
  opacity: 1;
}

.affaibli-die {
  background: color-mix(in srgb, #8e44ad 22%, transparent);
  border-radius: var(--radius-pill);
  padding: 0.05em 0.5em;
  font-variant-numeric: tabular-nums;
  text-transform: none;
}

:root[data-theme='dark'] .affaibli-pill:hover,
:root[data-theme='dark'] .affaibli-pill.active {
  color: #c58fe0;
}
</style>
