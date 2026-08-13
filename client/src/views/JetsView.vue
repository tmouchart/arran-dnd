<script setup lang="ts">
import { computed } from 'vue'
import AppPageLayout from '../components/ui/AppPageLayout.vue'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppCard from '../components/ui/AppCard.vue'
import DiceSandbox from '../components/DiceSandbox.vue'
import RollHistoryPanel from '../components/RollHistoryPanel.vue'
import RollLogPanel from '../components/roll-log/RollLogPanel.vue'
import { user } from '../composables/useAuth'
import { useCampaignRolls } from '../composables/useCampaignRolls'

// Historique complet : le log partagé de la campagne, ou l'historique local
// pour un joueur sans campagne.
const { rolls } = useCampaignRolls()
const inCampaign = computed(() => Boolean(user.value?.activeCampaignId))
</script>

<template>
  <AppPageLayout>
    <template #top-bar>
      <AppPageHead>🎲 Jets de dés</AppPageHead>
    </template>

    <AppCard title="Lancer les dés" class="sandbox">
      <DiceSandbox />
    </AppCard>

    <AppCard v-if="inCampaign" title="Log de la campagne">
      <RollLogPanel :rolls="rolls" />
    </AppCard>
    <RollHistoryPanel v-else :always-open="true" />
  </AppPageLayout>
</template>

<style scoped>
.sandbox {
  margin-bottom: 0.9rem;
}
</style>
