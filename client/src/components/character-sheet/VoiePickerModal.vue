<script setup lang="ts">
import { Lock } from "lucide-vue-next";
import type { Voie } from "../../data/voies";

defineProps<{
  show: boolean;
  groups: { family: string; label: string; voies: Voie[]; locked?: boolean; lockReason?: string }[];
}>();

const emit = defineEmits<{
  close: [];
  pick: [voie: Voie];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="picker-overlay" @click.self="emit('close')">
      <div class="picker-panel">
        <div class="picker-head">
          <h3>Choisir une voie</h3>
          <button type="button" class="btn ghost small" @click="emit('close')">✕</button>
        </div>
        <div class="picker-body">
          <div v-for="group in groups" :key="group.family" class="picker-group">
            <h4 class="picker-family" :class="'family-' + group.family">{{ group.label }}</h4>
            <p v-if="group.locked" class="lock-reason">
              <Lock :size="11" class="lock-icon" />
              {{ group.lockReason }}
            </p>
            <ul class="picker-voies">
              <li
                v-for="v in group.voies"
                :key="v.id"
                class="picker-voie"
                :class="{ 'picker-voie--locked': group.locked }"
                :title="group.locked ? group.lockReason : undefined"
                @click="!group.locked && emit('pick', v)"
              >
                {{ v.name }}
              </li>
            </ul>
          </div>
          <p v-if="groups.length === 0" class="muted picker-empty">
            Toutes les voies sont déjà ajoutées.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}

@media (min-width: 540px) {
  .picker-overlay { align-items: center; padding: 1.5rem; }
}

.picker-panel {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 82svh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

@media (min-width: 540px) {
  .picker-panel {
    border-radius: 20px;
    max-height: 80vh;
    box-shadow: var(--shadow-card);
  }
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.1rem 0.7rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.picker-head h3 {
  margin: 0;
  font-family: var(--title-font);
  font-size: 1.1rem;
  color: var(--brand-strong);
}

.picker-body {
  overflow-y: auto;
  padding: 0.7rem 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.picker-group { display: flex; flex-direction: column; gap: 0.35rem; }

.picker-family {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0 0 0.35rem;
  padding: 0.22rem 0.6rem;
  border-radius: 6px;
  display: inline-block;
}

.picker-voies { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }

.picker-voie {
  padding: 0.58rem 0.6rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.93rem;
  color: var(--text);
  transition: background 100ms ease;
}

.picker-voie:hover:not(.picker-voie--locked) { background: var(--accent-soft); color: var(--accent-strong); }

.picker-voie--locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.lock-reason {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-style: italic;
  color: var(--muted);
  margin: 0 0 0.25rem;
}

.lock-icon { flex-shrink: 0; }

.picker-empty { text-align: center; padding: 1rem 0; }

.muted { color: var(--muted); font-size: 0.9rem; margin: 0; }

.family-combattants { background: color-mix(in srgb, var(--brand) 16%, transparent); color: var(--brand-strong); }
.family-aventuriers { background: color-mix(in srgb, #3a8a4a 14%, transparent); color: #2a6a38; }
.family-mystiques { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent-strong); }
.family-prestige { background: color-mix(in srgb, #8a6a20 14%, transparent); color: #5c4510; }

:root[data-theme="dark"] .family-aventuriers { color: #7bcf8a; }
:root[data-theme="dark"] .family-prestige { color: #d4a843; }

.btn.small { min-height: 38px; padding: 0.3rem 0.58rem; font-size: 0.82rem; }
</style>
