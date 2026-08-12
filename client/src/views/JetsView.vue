<script setup lang="ts">
import AppPageLayout from '../components/ui/AppPageLayout.vue'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppCard from '../components/ui/AppCard.vue'
import DiceSandbox from '../components/DiceSandbox.vue'
import RollHistoryPanel from '../components/RollHistoryPanel.vue'
</script>

<template>
  <AppPageLayout>
    <template #top-bar>
      <AppPageHead>🎲 Jets de dés</AppPageHead>
    </template>

    <AppCard title="Lancer les dés" class="sandbox">
      <DiceSandbox />
    </AppCard>

    <RollHistoryPanel :always-open="true" />
  </AppPageLayout>
</template>

<style scoped>
.sandbox {
  margin-bottom: 0.9rem;
}
</style>
