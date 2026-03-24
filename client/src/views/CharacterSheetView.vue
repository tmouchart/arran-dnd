<script setup lang="ts">
import { useRoute, RouterLink } from "vue-router";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import { useCharacter, loadCharacter } from "../composables/useCharacter";
import { inferProfileFamily } from "../utils/inferProfileFamily";
import { computed, ref, watch } from "vue";
import AgonieModal from "../components/AgonieModal.vue";

import IdentityCard from "../components/character-sheet/IdentityCard.vue";
import AbilitiesCard from "../components/character-sheet/AbilitiesCard.vue";
import ResourcesCard from "../components/character-sheet/ResourcesCard.vue";
import CombatCard from "../components/character-sheet/CombatCard.vue";
import VoiesCard from "../components/character-sheet/VoiesCard.vue";
import PassifsCard from "../components/character-sheet/PassifsCard.vue";
import MartialFormationsCard from "../components/character-sheet/MartialFormationsCard.vue";
import WeaponsCard from "../components/character-sheet/WeaponsCard.vue";
import CompetencesCard from "../components/character-sheet/CompetencesCard.vue";
import { PR_MAX } from "../composables/useCharacter";

const { character, loading, loadError, saveStatus, abilityModifier, computedDef, computedMp, computedHp, computedHpBase, computedHpGrowth, computedDv, computedInitiative, computedPcMax, computedAttackContact, computedAttackDistance, computedAttackMagique } = useCharacter();
const family = computed(() => inferProfileFamily(character.value.paths));
const route = useRoute();

const id = route.query.id ? Number(route.query.id) : undefined;
loadCharacter(id);

function retryLoadSheet() {
  loadCharacter(id);
}

const showAgonie = ref(false)
const isStabilised = ref(false)

// Only start watching HP changes after the character has finished loading,
// so the initial load (0 HP from server) never triggers the modal.
const stopLoadingWatch = watch(loading, (isLoading) => {
  if (isLoading) return
  // Character is now loaded — start tracking HP changes from here
  watch(
    () => character.value.hpCurrent,
    (hp, prev) => {
      if (hp === 0 && prev !== undefined && prev > 0 && !isStabilised.value) {
        showAgonie.value = true
      }
      if (hp > 0) {
        isStabilised.value = false
      }
    },
  )
  stopLoadingWatch()
})

function onStabilise() {
  showAgonie.value = false
  isStabilised.value = true
}

function onDeath() {
  showAgonie.value = false
}
</script>

<template>
  <div class="page sheet-page">
    <AppPageHead>
      Fiche personnage
      <template #actions>
        <RouterLink to="/personnages" class="btn ghost small">← Liste</RouterLink>
      </template>
    </AppPageHead>

    <p v-if="saveStatus === 'error'" class="save-status error">Erreur de sauvegarde</p>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>

    <AppEmptyState v-else-if="loadError" variant="error">
      <p>{{ loadError }}</p>
      <template #actions>
        <button type="button" class="btn ghost small" @click="retryLoadSheet">Réessayer</button>
      </template>
    </AppEmptyState>

    <AgonieModal
      v-if="showAgonie"
      :character-name="character.name"
      @stabilise="onStabilise"
      @death="onDeath"
      @close="showAgonie = false"
    />

    <template v-else>
      <IdentityCard :character="character" />
      <AbilitiesCard :character="character" :ability-modifier="abilityModifier" />
      <ResourcesCard :character="character" :computed-def="computedDef" :computed-mp="computedMp" :computed-hp="computedHp" :computed-hp-base="computedHpBase" :computed-hp-growth="computedHpGrowth" :family="family" :ability-modifier="abilityModifier" :computed-dv="computedDv" :computed-initiative="computedInitiative" :computed-pc-max="computedPcMax" :pr-max="PR_MAX" />
      <CombatCard :character="character" :computed-attack-contact="computedAttackContact" :computed-attack-distance="computedAttackDistance" :computed-attack-magique="computedAttackMagique" :ability-modifier="abilityModifier" :family="family" />
      <VoiesCard :character="character" />
      <PassifsCard :character="character" />
      <MartialFormationsCard :character="character" />
      <WeaponsCard :character="character" />
      <CompetencesCard :character="character" />
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

.btn.small {
  min-height: 38px;
  padding: 0.3rem 0.58rem;
  font-size: 0.82rem;
}

.sheet-page :deep(a.btn) {
  text-decoration: none;
}

@media (min-width: 760px) {
  .card {
    padding: 1.1rem 1.2rem;
    margin-bottom: 1rem;
  }
}
</style>
