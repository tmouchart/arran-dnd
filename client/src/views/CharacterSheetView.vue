<script setup lang="ts">
import { useRoute } from "vue-router";
import AppPageLayout from "../components/ui/AppPageLayout.vue";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import AppButton from "../components/ui/AppButton.vue";
import AppTabs from "../components/ui/AppTabs.vue";
import { useCharacter, loadCharacter } from "../composables/useCharacter";
import { useSheetEffects } from "../composables/useSheetEffects";
import { inferProfileFamily } from "../utils/inferProfileFamily";
import { Skull } from "lucide-vue-next";
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
const { sheetClasses } = useSheetEffects(character, computedHp, computedMp, loading);
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

const TABS: { value: TabId; label: string; icon: string }[] = [
  { value: 'identite', label: 'Identité', icon: '⚔️' },
  { value: 'voies', label: 'Voies', icon: '✨' },
  { value: 'combat', label: 'Combat', icon: '🗡️' },
]
</script>

<template>
  <AppPageLayout :class="sheetClasses">
    <template #top-bar>
      <div class="gv-vignette" aria-hidden="true" />
      <div class="gv-a-terre-banner" aria-live="polite">
        <Skull :size="14" /> A terre <Skull :size="14" />
      </div>
      <AppPageHead>
        Fiche {{ character.name || "personnage" }}
      </AppPageHead>
      <p v-if="saveStatus === 'error'" class="save-status error">Erreur de sauvegarde</p>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>

    <AppEmptyState v-else-if="loadError" variant="error">
      <p>{{ loadError }}</p>
      <template #actions>
        <AppButton size="small" @click="retryLoadSheet">Réessayer</AppButton>
      </template>
    </AppEmptyState>

    <template v-else-if="!loading && !loadError">
      <AppTabs
        class="sheet-tabs"
        :model-value="activeTab"
        :tabs="TABS"
        @update:model-value="activeTab = $event as TabId"
      />

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
  </AppPageLayout>
</template>

<style scoped>

.save-status {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
}

.save-status.error {
  color: var(--danger);
}

.sheet-tabs {
  margin-bottom: 0.85rem;
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
