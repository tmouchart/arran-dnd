<script setup lang="ts">
import { ref, watch } from 'vue'
import { DICE_COLORS } from '../../data/diceColors'
import { isHexColor } from '../../data/diceStyle'
import AppBottomSheet from '../ui/AppBottomSheet.vue'
import AppInput from '../ui/AppInput.vue'

/**
 * Le choix d'une couleur, en profondeur : le picker de l'OS, un champ hexa
 * pour coller une valeur exacte, et les huit tons historiques en raccourci.
 *
 * `<input type="color">` reste natif à dessein — c'est le même arbitrage que
 * pour `AppSelect` : sur un téléphone, le picker du système bat tout ce qu'on
 * dessinerait à la main.
 */

const props = defineProps<{ modelValue: boolean; color: string; title: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:color', value: string): void
}>()

/** Le champ hexa suit sa propre vie : on n'émet que quand il devient valide. */
const draft = ref(props.color)

watch(() => props.color, (next) => { draft.value = next })

function pick(hex: string) {
  emit('update:color', hex.toLowerCase())
}

function onDraft(value: string) {
  draft.value = value
  const hex = value.startsWith('#') ? value : `#${value}`
  if (isHexColor(hex)) pick(hex)
}
</script>

<template>
  <AppBottomSheet
    :model-value="modelValue"
    :title="title"
    description="Choisis une couleur avec le sélecteur, un code hexadécimal, ou la palette."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <label class="picker-native">
      <input
        type="color"
        :value="color"
        data-testid="dice-picker-native"
        @input="pick(($event.target as HTMLInputElement).value)"
      />
      <span>Nuancier complet</span>
    </label>

    <AppInput
      :model-value="draft"
      placeholder="#d64545"
      autocomplete="off"
      data-testid="dice-picker-hex"
      @update:model-value="onDraft(String($event))"
    />

    <span class="picker-label">Palette</span>
    <div class="picker-palette">
      <button
        v-for="c in DICE_COLORS"
        :key="c.hex"
        type="button"
        class="picker-swatch"
        :class="{ active: color === c.hex }"
        :style="{ background: c.hex }"
        :title="c.label"
        :aria-label="c.label"
        :data-testid="`dice-palette-${c.hex.slice(1)}`"
        @click="pick(c.hex)"
      />
    </div>
  </AppBottomSheet>
</template>

<style scoped>
.picker-native {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  min-height: 40px;
  margin-bottom: var(--space-md);
  cursor: pointer;
}

.picker-native input {
  width: 56px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
}

.picker-label {
  display: block;
  margin: var(--space-lg) 0 var(--space-sm);
  color: var(--muted);
  font-size: 0.82rem;
}

.picker-palette {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.picker-swatch {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 2px solid var(--surface);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border-strong);
  cursor: pointer;
}

.picker-swatch.active {
  box-shadow: 0 0 0 3px var(--accent);
}
</style>
