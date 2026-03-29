<template>
  <svg xmlns="http://www.w3.org/2000/svg" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="10.5" r="7.5"/>
    <path d="M9 7.5c1.2-1.5 3-2.2 4.5-1.5" opacity="0.5"/>
    <path d="M7.5 20h9"/>
    <path d="M9 18c-.8 0-1.5.9-1.5 2"/>
    <path d="M15 18c.8 0 1.5.9 1.5 2"/>
    <path d="M9.5 17.5c1.5.7 3.5.7 5 0"/>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 });
</script>
