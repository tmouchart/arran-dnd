<script setup lang="ts">
import { ref } from "vue";
import { ChevronDown, ChevronUp } from "lucide-vue-next";
import AppCard from "../ui/AppCard.vue";
import { ARMORS_CATALOG, SHIELDS_CATALOG } from "../../data/armorsCatalog";
import type { Character } from "../../types/character";

defineProps<{ character: Character }>();

const collapsed = ref(false);

const ARMOR_GROUPS = [
  { label: "Armures légères", type: "légère" as const },
  { label: "Armures lourdes", type: "lourde" as const },
];

function armorOptionLabel(a: (typeof ARMORS_CATALOG)[number]): string {
  return `${a.name} (+${a.defBonus} DEF${a.encombrant ? ", encombrante" : ""})`;
}

function shieldOptionLabel(s: (typeof SHIELDS_CATALOG)[number]): string {
  return `${s.name} (+${s.defBonus} DEF)`;
}
</script>

<template>
  <AppCard>
    <div class="equip-head">
      <h2>Équipement</h2>
      <button type="button" class="collapse-btn" :title="collapsed ? 'Afficher' : 'Réduire'" @click="collapsed = !collapsed">
        <ChevronUp v-if="!collapsed" :size="16" :stroke-width="2" />
        <ChevronDown v-else :size="16" :stroke-width="2" />
      </button>
    </div>

    <div v-if="!collapsed" class="armor-row">
      <div class="field">
        <span>Armure</span>
        <select v-model="character.armorId" class="input select">
          <option value="">— Aucune —</option>
          <optgroup v-for="group in ARMOR_GROUPS" :key="group.type" :label="group.label">
            <option
              v-for="a in ARMORS_CATALOG.filter((a) => a.type === group.type)"
              :key="a.id"
              :value="a.id"
            >{{ armorOptionLabel(a) }}</option>
          </optgroup>
        </select>
      </div>
      <div class="field">
        <span>Bouclier</span>
        <select v-model="character.shieldId" class="input select">
          <option value="">— Aucun —</option>
          <option v-for="s in SHIELDS_CATALOG" :key="s.id" :value="s.id">{{ shieldOptionLabel(s) }}</option>
        </select>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.equip-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.equip-head h2 {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 600;
  font-family: var(--title-font);
  color: var(--accent-strong);
  letter-spacing: 0.01em;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  transition: background 120ms ease, color 120ms ease;
}

.collapse-btn:hover {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.armor-row {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
}

.field {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
  font-size: 0.83rem;
  color: var(--muted);
}

.field > span:first-child { font-weight: 600; }

.input.select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  padding-right: 2rem;
  cursor: pointer;
}
</style>
