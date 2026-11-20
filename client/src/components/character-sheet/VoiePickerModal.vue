<script setup lang="ts">
import { ref, watch } from "vue";
import { ChevronDown, Lock } from "lucide-vue-next";
import AppModal from "../ui/AppModal.vue";
import type { Voie } from "../../data/voies";

const props = defineProps<{
  show: boolean;
  title?: string;
  groups: {
    key: string;
    /** Suffixe de la classe de couleur `family-*`. */
    cls: string;
    label: string;
    voies: Voie[];
    locked?: boolean;
    lockReason?: string;
    /** Verrou voie par voie : id → raison. */
    voieLocks?: Record<string, string>;
  }[];
}>();

type Group = (typeof props.groups)[number];

function lockReasonOf(group: Group, v: Voie): string | undefined {
  if (group.locked) return group.lockReason;
  return group.voieLocks?.[v.id];
}

const emit = defineEmits<{
  close: [];
  pick: [voie: Voie];
}>();

// Une voie verrouillée ne s'ajoute pas, mais on peut l'ouvrir pour lire ses capacités.
const expandedId = ref<string | null>(null);
watch(() => props.show, () => { expandedId.value = null; });

function onTap(group: Group, v: Voie) {
  if (!lockReasonOf(group, v)) emit("pick", v);
  else expandedId.value = expandedId.value === v.id ? null : v.id;
}
</script>

<template>
  <AppModal
    :model-value="show"
    :title="title ?? 'Choisir une voie'"
    @update:model-value="emit('close')"
  >
    <div class="picker-body">
          <div v-for="group in groups" :key="group.key" class="picker-group">
            <h4 class="picker-family" :class="'family-' + group.cls">{{ group.label }}</h4>
            <p v-if="group.locked" class="lock-reason">
              <Lock :size="11" class="lock-icon" />
              {{ group.lockReason }}
            </p>
            <ul class="picker-voies">
              <li
                v-for="v in group.voies"
                :key="v.id"
                class="picker-voie"
                :class="{ 'picker-voie--locked': !!lockReasonOf(group, v) }"
                :data-testid="`voie-pick-${v.id}`"
              >
                <div
                  class="picker-voie-row"
                  :aria-expanded="lockReasonOf(group, v) ? expandedId === v.id : undefined"
                  @click="onTap(group, v)"
                >
                  <span class="picker-voie-name">
                    {{ v.name }}
                    <span v-if="!group.locked && group.voieLocks?.[v.id]" class="voie-lock-reason">
                      <Lock :size="11" class="lock-icon" /> {{ group.voieLocks[v.id] }}
                    </span>
                  </span>
                  <ChevronDown
                    v-if="lockReasonOf(group, v)"
                    :size="16"
                    class="chevron"
                    :class="{ open: expandedId === v.id }"
                  />
                </div>
                <ol v-if="expandedId === v.id" class="picker-caps">
                  <li v-for="(cap, ci) in v.capacites" :key="ci" class="picker-cap">
                    <span class="cap-rank">{{ ci + 1 }}</span>
                    <span class="cap-body">
                      <span class="cap-name">{{ cap.name }}<template v-if="cap.spell"> *</template></span>
                      <span class="cap-desc">{{ cap.description }}</span>
                    </span>
                  </li>
                </ol>
              </li>
            </ul>
          </div>
          <p v-if="groups.length === 0" class="muted picker-empty">
            Toutes les voies sont déjà ajoutées.
          </p>
    </div>
  </AppModal>
</template>

<style scoped>
.picker-body {
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
  border-radius: var(--radius-xs);
  display: inline-block;
}

.picker-voies { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }

.picker-voie {
  border-radius: var(--radius-sm);
  font-size: 0.93rem;
  color: var(--text);
  transition: background 100ms ease;
}

.picker-voie-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 0.58rem 0.6rem;
  cursor: pointer;
}

.picker-voie-name { flex: 1; min-width: 0; }

.picker-voie:hover:not(.picker-voie--locked) { background: var(--accent-soft); color: var(--accent-strong); }

/* Verrouillée : nom grisé, mais le détail ouvert reste lisible. */
.picker-voie--locked .picker-voie-row { opacity: 0.55; }

.chevron { flex-shrink: 0; color: var(--muted); transition: transform 150ms ease; }
.chevron.open { transform: rotate(180deg); }

.picker-caps {
  list-style: none;
  margin: 0;
  padding: 0 0.6rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.picker-cap { display: flex; align-items: flex-start; gap: 0.55rem; }

.cap-rank {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  min-width: 1rem;
  text-align: center;
  flex-shrink: 0;
  padding-top: 0.12rem;
}

.cap-body { display: flex; flex-direction: column; gap: 0.1rem; }
.cap-name { font-size: 0.88rem; font-weight: 600; line-height: 1.3; }
.cap-desc { font-size: 0.78rem; color: var(--muted); line-height: 1.45; }

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

.voie-lock-reason {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-style: italic;
  color: var(--muted);
}

.picker-empty { text-align: center; padding: 1rem 0; }

.muted { color: var(--muted); font-size: 0.9rem; margin: 0; }

.family-combattants { background: color-mix(in srgb, var(--brand) 16%, transparent); color: var(--brand-strong); }
.family-aventuriers { background: color-mix(in srgb, #3a8a4a 14%, transparent); color: #2a6a38; }
.family-mystiques { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent-strong); }
.family-prestige { background: color-mix(in srgb, #8a6a20 14%, transparent); color: #5c4510; }

:root[data-theme="dark"] .family-aventuriers { color: #7bcf8a; }
:root[data-theme="dark"] .family-prestige { color: #d4a843; }
</style>
