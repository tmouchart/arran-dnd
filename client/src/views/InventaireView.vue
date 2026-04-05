<script setup lang="ts">
import { onMounted } from "vue";
import { Handbag } from "lucide-vue-next";
import AppPageLayout from "../components/ui/AppPageLayout.vue";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import AppInput from "../components/ui/AppInput.vue";
import ItemsCard from "../components/character-sheet/ItemsCard.vue";
import { useCharacter, loadCharacter } from "../composables/useCharacter";

const { character, loading, loadError } = useCharacter();

onMounted(() => {
  if (!character.value.id) loadCharacter();
});
</script>

<template>
  <AppPageLayout>
    <template #top-bar>
      <AppPageHead><Handbag :size="22" /> Inventaire</AppPageHead>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>

    <AppEmptyState v-else-if="loadError" variant="error">
      <p>{{ loadError }}</p>
    </AppEmptyState>

    <template v-else-if="character.id">
      <div class="money-row">
        <label class="money-field">
          <span class="money-label gold">po</span>
          <AppInput v-model="character.goldCoins" type="number" :min="0" class="money-input" text-align="center" />
        </label>
        <label class="money-field">
          <span class="money-label silver">pa</span>
          <AppInput v-model="character.silverCoins" type="number" :min="0" class="money-input" text-align="center" />
        </label>
        <label class="money-field">
          <span class="money-label copper">pc</span>
          <AppInput v-model="character.copperCoins" type="number" :min="0" class="money-input" text-align="center" />
        </label>
      </div>
      <ItemsCard :character="character" />
    </template>

    <AppEmptyState v-else>Aucun personnage actif.</AppEmptyState>
  </AppPageLayout>
</template>

<style scoped>
.money-row {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.money-field {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
}

.money-label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.money-label.gold   { color: #c9a227; }
.money-label.silver { color: #9aa0a6; }
.money-label.copper { color: #b56c2a; }

.money-input {
  text-align: center;
  font-weight: 600;
  padding: 0.38rem 0.3rem;
  min-width: 0;
  width: 100%;
}
</style>
