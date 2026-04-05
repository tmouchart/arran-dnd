<script setup lang="ts">
import { computed, useSlots } from "vue";

const props = withDefaults(
  defineProps<{
    mode?: "scroll" | "full";
    width?: "default" | "wide";
  }>(),
  {
    mode: "scroll",
    width: "default",
  },
);

const slots = useSlots();
const hasTopBar = computed(() => !!slots["top-bar"]);
const hasBottomBar = computed(() => !!slots["bottom-bar"]);

const classes = computed(() => [
  "page-layout",
  `page-layout--${props.mode}`,
  `page-layout--w-${props.width}`,
]);
</script>

<template>
  <div :class="classes">
    <div v-if="hasTopBar" class="page-layout__top">
      <slot name="top-bar" />
    </div>
    <div class="page-layout__main">
      <slot />
    </div>
    <div v-if="hasBottomBar" class="page-layout__bottom">
      <slot name="bottom-bar" />
    </div>
  </div>
</template>

<style scoped>
.page-layout {
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
  padding: 1rem 0.78rem 1.5rem;
  display: flex;
  flex-direction: column;
}

.page-layout--w-wide {
  max-width: 800px;
}

/* ── Scroll mode (default) ── */
.page-layout--scroll .page-layout__main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Full mode ── */
.page-layout--full {
  height: calc(100dvh - var(--nav-height, 3.6rem));
  overflow: hidden;
}

.page-layout--full .page-layout__main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Slots ── */
.page-layout__top {
  flex-shrink: 0;
}

.page-layout__bottom {
  flex-shrink: 0;
}

/* ── Responsive ── */
@media (min-width: 740px) {
  .page-layout {
    padding: 1.25rem 1rem 2rem;
  }

  .page-layout--full {
    height: calc(100dvh - var(--nav-height, 3.85rem));
  }
}
</style>
