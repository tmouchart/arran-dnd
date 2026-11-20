<script setup lang="ts">
import AppTooltip from "../ui/AppTooltip.vue";
import type { BonusSource } from "../../composables/usePathEffects";

/**
 * La pastille « Voies » d'une formule de la fiche (DEF, initiative, PV, RD) :
 * le total calculé depuis les passifs, et au tap le détail par capacité.
 */
withDefaults(
  defineProps<{
    sources: BonusSource[];
    total: number;
    label?: string;
    testid?: string;
  }>(),
  { label: "Voies", testid: undefined },
);

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
</script>

<template>
  <AppTooltip :label="`Détail : ${label}`">
    <template #trigger>
      <span class="path-chip" :data-testid="testid">
        <span class="path-chip-label">{{ label }}</span>
        <span class="path-chip-value">{{ signed(total) }}</span>
      </span>
    </template>

    <div class="tip-head">Passifs des voies</div>
    <div v-for="(s, i) in sources" :key="i" class="tip-line">
      <span class="tip-bonus">{{ signed(s.bonus) }}</span> {{ s.from }}
    </div>
    <div class="tip-foot">Calculé tout seul : pas besoin de le recopier dans « Bonus ».</div>
  </AppTooltip>
</template>

<style scoped>
.path-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.35rem 0.6rem;
  border-radius: var(--radius-md);
  border: 1px solid #c89c3a;
  background: color-mix(in srgb, #c89c3a 12%, var(--surface-2));
  min-width: 2.8rem;
}

.path-chip-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.path-chip-value {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #a07828;
}

:root[data-theme="dark"] .path-chip-value { color: #d4a843; }

.tip-head {
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-size: 0.7rem;
  margin-bottom: var(--space-xs);
}

.tip-line {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.tip-bonus {
  font-weight: 700;
  color: var(--accent-strong);
}

.tip-foot {
  margin-top: var(--space-xs);
  padding-top: var(--space-xs);
  border-top: 1px solid var(--border);
  font-size: 0.7rem;
  color: var(--muted);
}
</style>
