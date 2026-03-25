<script setup lang="ts">
import { useRoute } from "vue-router";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import { useCharacter, loadCharacter } from "../composables/useCharacter";
import { inferProfileFamily } from "../utils/inferProfileFamily";
import { computed, ref } from "vue";

import IdentityCard from "../components/character-sheet/IdentityCard.vue";
import AbilitiesCard from "../components/character-sheet/AbilitiesCard.vue";
import ResourcesCard from "../components/character-sheet/ResourcesCard.vue";
import CombatCard from "../components/character-sheet/CombatCard.vue";
import VoiesCard from "../components/character-sheet/VoiesCard.vue";
import PassifsCard from "../components/character-sheet/PassifsCard.vue";
import MartialFormationsCard from "../components/character-sheet/MartialFormationsCard.vue";
import WeaponsCard from "../components/character-sheet/WeaponsCard.vue";
import EquipmentCard from "../components/character-sheet/EquipmentCard.vue";
import CompetencesCard from "../components/character-sheet/CompetencesCard.vue";
import { PR_MAX } from "../composables/useCharacter";

const { character, loading, loadError, saveStatus, abilityModifier, computedDef, computedMp, computedHp, computedHpBase, computedHpDv, computedHpConMod, computedHpGrowth, computedDv, computedInitiative, computedPcMax, computedAttackContact, computedAttackDistance, computedAttackMagique } = useCharacter();
const family = computed(() => inferProfileFamily(character.value.paths));
const route = useRoute();

const id = route.query.id ? Number(route.query.id) : undefined;
loadCharacter(id);

function retryLoadSheet() {
  loadCharacter(id);
}

// ── Onglets ───────────────────────────────────────────────────────────────────
type TabId = 'identite' | 'voies' | 'combat'
const activeTab = ref<TabId>('identite')

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'identite', label: 'Identité', icon: '⚔️' },
  { id: 'voies', label: 'Voies', icon: '✨' },
  { id: 'combat', label: 'Combat', icon: '🗡️' },
]
</script>

<template>
  <div class="page sheet-page">
    <AppPageHead>
      Fiche {{ character.name || "personnage" }}
    </AppPageHead>

    <p v-if="saveStatus === 'error'" class="save-status error">Erreur de sauvegarde</p>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>

    <AppEmptyState v-else-if="loadError" variant="error">
      <p>{{ loadError }}</p>
      <template #actions>
        <button type="button" class="btn ghost small" @click="retryLoadSheet">Réessayer</button>
      </template>
    </AppEmptyState>

    <template v-else-if="!loading && !loadError">
      <!-- Tab bar -->
      <nav class="tab-bar">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span class="tab-icon" aria-hidden="true">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Onglet 1 : Identité + Carac + PV & Ressources -->
      <template v-if="activeTab === 'identite'">
        <IdentityCard :character="character" />
        <AbilitiesCard :character="character" :ability-modifier="abilityModifier" />
        <ResourcesCard
          :character="character"
          :computed-mp="computedMp"
          :computed-hp="computedHp"
          :computed-hp-base="computedHpBase"
          :computed-hp-dv="computedHpDv"
          :computed-hp-con-mod="computedHpConMod"
          :computed-hp-growth="computedHpGrowth"
          :family="family"
          :ability-modifier="abilityModifier"
          :computed-dv="computedDv"
          :computed-pc-max="computedPcMax"
          :pr-max="PR_MAX"
        />
      </template>

      <!-- Onglet 2 : Voies + Compétences -->
      <template v-if="activeTab === 'voies'">
        <VoiesCard :character="character" />
        <PassifsCard :character="character" />
        <CompetencesCard :character="character" />
      </template>

      <!-- Onglet 3 : Combat + Formations martiales + Armes -->
      <template v-if="activeTab === 'combat'">
        <CombatCard
          :character="character"
          :computed-attack-contact="computedAttackContact"
          :computed-attack-distance="computedAttackDistance"
          :computed-attack-magique="computedAttackMagique"
          :computed-def="computedDef"
          :computed-initiative="computedInitiative"
          :ability-modifier="abilityModifier"
          :family="family"
        />
        <EquipmentCard :character="character" />
        <MartialFormationsCard :character="character" />
        <WeaponsCard :character="character" />
      </template>
    </template>
  </div>
</template>

<style scoped>
.sheet-page {
  max-width: 40rem;
  margin: 0 auto;
}

.save-status {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
}

.save-status.error {
  color: var(--danger);
}

/* ── Tab bar ─────────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.3rem;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.42rem 0.5rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  transition: background 150ms ease, color 150ms ease;
}

.tab-btn:hover {
  background: color-mix(in srgb, var(--accent-soft) 60%, transparent);
  color: var(--accent-strong);
}

.tab-btn.active {
  background: var(--surface);
  color: var(--accent-strong);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.tab-icon {
  font-size: 1rem;
  line-height: 1;
}

.tab-label {
  white-space: nowrap;
}

.btn.small {
  min-height: 38px;
  padding: 0.3rem 0.58rem;
  font-size: 0.82rem;
}

@media (min-width: 760px) {
  .card {
    padding: 1.1rem 1.2rem;
    margin-bottom: 1rem;
  }
}
</style>
