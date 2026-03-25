<script setup lang="ts">
import AppPageHead from '../components/ui/AppPageHead.vue'
import RollHistoryPanel from '../components/RollHistoryPanel.vue'
</script>

<template>
  <div class="jets-page">
    <AppPageHead>🎲 Historique des jets</AppPageHead>
    <RollHistoryPanel :always-open="true" />
  </div>
</template>

<style scoped>
.jets-page {
  max-width: 680px;
  margin: 0 auto;
}
</style>
