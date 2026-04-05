<script setup lang="ts">
import AppPageLayout from '../components/ui/AppPageLayout.vue'
import AppPageHead from '../components/ui/AppPageHead.vue'
import RollHistoryPanel from '../components/RollHistoryPanel.vue'
</script>

<template>
  <AppPageLayout>
    <template #top-bar>
      <AppPageHead>🎲 Historique des jets</AppPageHead>
    </template>
    <RollHistoryPanel :always-open="true" />
  </AppPageLayout>
</template>
