<script setup lang="ts">
import AppIconBtn from '../ui/AppIconBtn.vue'
import { WALL_MATERIALS, paintWallTile } from './wallMaterials'

defineProps<{ modelValue: string }>()
defineEmits<{ (e: 'update:modelValue', id: string): void }>()

/**
 * Les pastilles montrent la **vraie** texture du mur, pas une icône : ce que le
 * MJ choisit est exactement ce qu'il verra sur la carte. Peintes une fois au
 * montage, en petit — 96 px suffisent pour une pastille de 40.
 */
const swatches = WALL_MATERIALS.map((m) => ({
  id: m.id,
  name: m.name,
  image: paintWallTile(m.id, 96).toDataURL(),
}))
</script>

<template>
  <div class="palette">
    <AppIconBtn
      v-for="m in swatches"
      :key="m.id"
      class="swatch"
      :class="{ picked: m.id === modelValue }"
      :title="m.name"
      :data-testid="`wall-material-${m.id}`"
      @click="$emit('update:modelValue', m.id)"
    >
      <span class="tile" :style="{ backgroundImage: `url(${m.image})` }" />
    </AppIconBtn>
  </div>
</template>

<style scoped>
.palette {
  display: flex;
  justify-content: center;
  gap: var(--space-xs);
}

.swatch {
  overflow: hidden;
}

.tile {
  display: block;
  width: 100%;
  height: 100%;
  background-size: cover;
  border-radius: var(--radius-xs);
}

.picked {
  outline: 2px solid var(--brand);
  outline-offset: -2px;
}
</style>
