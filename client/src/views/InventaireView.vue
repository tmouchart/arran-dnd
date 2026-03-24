<script setup lang="ts">
import { onMounted } from "vue";
import { Handbag } from "lucide-vue-next";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import ItemsCard from "../components/character-sheet/ItemsCard.vue";
import { useCharacter, loadCharacter } from "../composables/useCharacter";

const { character, loading, loadError } = useCharacter();

onMounted(() => {
  if (!character.value.id) loadCharacter();
});
</script>

<template>
  <div class="inventaire-page">
    <AppPageHead><Handbag :size="22" /> Inventaire</AppPageHead>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>

    <AppEmptyState v-else-if="loadError" variant="error">
      <p>{{ loadError }}</p>
    </AppEmptyState>

    <template v-else-if="character.id">
      <ItemsCard :character="character" />
    </template>

    <AppEmptyState v-else>Aucun personnage actif.</AppEmptyState>
  </div>
</template>

<style scoped>
.inventaire-page {
  max-width: 40rem;
  margin: 0 auto;
}
</style>
