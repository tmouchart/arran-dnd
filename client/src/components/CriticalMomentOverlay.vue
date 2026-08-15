<script setup lang="ts">
import { activeMoment } from "../composables/useCriticalMoment";
</script>

<template>
  <!-- Overlay couvrant la fenêtre : jamais cliquable, il ne fait que décorer. -->
  <div
    v-if="activeMoment"
    :key="activeMoment.id"
    class="critical-moment"
    :class="`critical-moment--${activeMoment.outcome}`"
    aria-hidden="true"
  >
    <div class="critical-halo" />
    <div class="critical-text">
      <span class="critical-actor">{{ activeMoment.actorName }}</span>
      <span class="critical-label">
        {{ activeMoment.outcome === "critical" ? "COUP CRITIQUE" : "ÉCHEC CRITIQUE" }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.critical-moment {
  position: fixed;
  inset: 0;
  z-index: 61;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Halo sur les bords : le centre reste lisible, on continue de jouer. */
.critical-halo {
  position: absolute;
  inset: 0;
  animation: critical-pulse 1.4s ease-out forwards;
}

.critical-moment--critical .critical-halo {
  background: radial-gradient(
    circle at center,
    transparent 42%,
    color-mix(in srgb, var(--brand) 70%, transparent) 100%
  );
}

.critical-moment--fumble .critical-halo {
  background: radial-gradient(
    circle at center,
    transparent 42%,
    color-mix(in srgb, var(--danger) 70%, transparent) 100%
  );
}

.critical-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  text-align: center;
  animation: critical-rise 1.4s ease-out forwards;
}

.critical-actor {
  font-family: var(--title-font);
  font-size: clamp(1.4rem, 6vw, 2.1rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text);
}

.critical-label {
  font-family: var(--title-font);
  font-size: clamp(1.9rem, 9vw, 3.2rem);
  font-weight: 700;
  letter-spacing: 0.06em;
}

.critical-moment--critical .critical-label { color: var(--brand-strong); }
.critical-moment--fumble .critical-label { color: var(--danger); }

@keyframes critical-pulse {
  0% { opacity: 0; }
  18% { opacity: 1; }
  55% { opacity: 0.55; }
  75% { opacity: 0.9; }
  100% { opacity: 0; }
}

@keyframes critical-rise {
  0% { opacity: 0; transform: scale(0.7); }
  20% { opacity: 1; transform: scale(1.06); }
  32% { transform: scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.04); }
}

/* Le joueur a demandé moins d'animation : le composable ne monte même pas
   l'overlay, mais on reste prudent si la préférence change en cours de route. */
@media (prefers-reduced-motion: reduce) {
  .critical-halo,
  .critical-text {
    animation-duration: 0.01ms;
  }
}
</style>
