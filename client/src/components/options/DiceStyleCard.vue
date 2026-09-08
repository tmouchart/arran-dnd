<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dices } from 'lucide-vue-next'
import { user } from '../../composables/useAuth'
import { updateMe } from '../../api/auth'
import { showToast } from '../../composables/useToast'
import { DICE_PRESETS } from '../../data/dicePresets'
import { inkFor } from '../../data/diceColors'
import { DICE_FONTS, diceFont } from '../../data/diceFonts'
import {
  backgroundCss,
  defaultDiceStyle,
  inkIsRisky,
  resolvedInk,
  styleKey,
  type DiceStyle,
} from '../../data/diceStyle'
import DicePreview from '../dice3d/DicePreview.vue'
import DiceColorSheet from './DiceColorSheet.vue'
import AppTabs from '../ui/AppTabs.vue'
import AppSelect from '../ui/AppSelect.vue'

/**
 * Le réglage du dé du joueur : fond (aplat ou dégradé), couleur des chiffres,
 * presets, et le dé qui tourne au-dessus pour montrer le résultat tout de suite.
 *
 * L'écriture est optimiste et débouncée : on manipule un curseur d'angle sans
 * envoyer une requête par degré.
 */

const SAVE_DELAY = 500

const style = ref<DiceStyle>(user.value?.diceStyle ?? defaultDiceStyle(0))

// L'identité peut arriver après le montage (première charge, changement de compte).
watch(() => user.value?.diceStyle, (next) => {
  if (next && styleKey(next) !== styleKey(style.value)) style.value = next
})

const bgMode = computed({
  get: () => style.value.bg.type,
  set: (mode: string) => {
    const { bg } = style.value
    if (mode === bg.type) return
    apply(
      mode === 'gradient'
        ? { ...style.value, bg: { type: 'gradient', from: bg.from, to: darken(bg.from), angle: 160 } }
        : { ...style.value, bg: { type: 'solid', from: bg.from } },
    )
  },
})

const inkMode = computed({
  get: () => (style.value.ink === null ? 'auto' : 'custom'),
  set: (mode: string) => {
    if (mode === 'auto') apply({ ...style.value, ink: null })
    else if (style.value.ink === null) apply({ ...style.value, ink: resolvedInk(style.value) })
  },
})

const activePreset = computed(() =>
  DICE_PRESETS.find((p) => styleKey(p.style) === styleKey(style.value))?.slug ?? null,
)

const risky = computed(() => inkIsRisky(style.value))

const font = computed({
  get: () => style.value.font ?? '',
  set: (slug: string) => apply({ ...style.value, font: slug || null }),
})

/** Le second arrêt proposé quand on passe en dégradé : le même ton, assombri. */
function darken(hex: string): string {
  const shade = (i: number) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.45)
      .toString(16)
      .padStart(2, '0')
  return `#${shade(1)}${shade(3)}${shade(5)}`
}

// ── Le picker ───────────────────────────────────────────────────────────────

type Target = 'from' | 'to' | 'ink'
const picking = ref<Target | null>(null)

const pickerTitle = computed(() =>
  picking.value === 'ink' ? 'Couleur des chiffres' : picking.value === 'to' ? 'Second ton' : 'Fond',
)

const pickerColor = computed(() => {
  if (picking.value === 'ink') return resolvedInk(style.value)
  if (picking.value === 'to' && style.value.bg.type === 'gradient') return style.value.bg.to
  return style.value.bg.from
})

function onPicked(hex: string) {
  const target = picking.value
  if (!target) return
  if (target === 'ink') apply({ ...style.value, ink: hex })
  else apply({ ...style.value, bg: { ...style.value.bg, [target]: hex } as DiceStyle['bg'] })
}

function setAngle(value: number) {
  if (style.value.bg.type !== 'gradient') return
  apply({ ...style.value, bg: { ...style.value.bg, angle: value } })
}

// ── Sauvegarde ──────────────────────────────────────────────────────────────

let timer: number | null = null

/** Le style d'avant, pour revenir en arrière si le serveur refuse. */
let lastSaved: DiceStyle = style.value

function apply(next: DiceStyle) {
  style.value = next
  if (timer) clearTimeout(timer)
  timer = window.setTimeout(save, SAVE_DELAY)
}

async function save() {
  timer = null
  const sending = style.value
  try {
    const updated = await updateMe({ diceStyle: sending })
    lastSaved = updated.diceStyle ?? sending
    if (user.value) user.value = { ...user.value, diceStyle: lastSaved }
  } catch {
    style.value = lastSaved
    showToast('Le style du dé n’a pas pu être enregistré.')
  }
}

/** Fermer le picker n'attend pas le débounce : le réglage est terminé. */
function closePicker() {
  picking.value = null
  if (timer) {
    clearTimeout(timer)
    void save()
  }
}
</script>

<template>
  <div class="style-section">
    <span class="option-label">
      <Dices :size="16" />
      Style de dé
    </span>
    <span class="profile-hint">Ton dé roule dans ce style, chez toi comme chez les autres.</span>

    <DicePreview :style="style" />

    <span class="dice-field-label">Modèles</span>
    <div class="dice-presets">
      <button
        v-for="preset in DICE_PRESETS"
        :key="preset.slug"
        type="button"
        class="dice-swatch"
        :class="{ active: activePreset === preset.slug }"
        :style="{ background: backgroundCss(preset.style), color: resolvedInk(preset.style) }"
        :title="preset.label"
        :aria-label="preset.label"
        :data-testid="`dice-preset-${preset.slug}`"
        @click="apply(preset.style)"
      >20</button>
    </div>

    <span class="dice-field-label">Fond</span>
    <AppTabs
      v-model="bgMode"
      :tabs="[
        { value: 'solid', label: 'Aplat' },
        { value: 'gradient', label: 'Dégradé' },
      ]"
    />
    <div class="dice-row">
      <button
        type="button"
        class="dice-swatch"
        :style="{ background: style.bg.from }"
        aria-label="Couleur du fond"
        data-testid="dice-bg-from"
        @click="picking = 'from'"
      />
      <button
        v-if="style.bg.type === 'gradient'"
        type="button"
        class="dice-swatch"
        :style="{ background: style.bg.to }"
        aria-label="Second ton du dégradé"
        data-testid="dice-bg-to"
        @click="picking = 'to'"
      />
      <input
        v-if="style.bg.type === 'gradient'"
        class="dice-angle"
        type="range"
        min="0"
        max="345"
        step="15"
        :value="style.bg.angle"
        aria-label="Orientation du dégradé"
        data-testid="dice-bg-angle"
        @input="setAngle(Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <span class="dice-field-label">Police des chiffres</span>
    <AppSelect v-model="font" data-testid="dice-font">
      <option value="">Celle du thème</option>
      <option v-for="f in DICE_FONTS" :key="f.slug" :value="f.slug">{{ f.label }}</option>
    </AppSelect>

    <span class="dice-field-label">Couleur des chiffres</span>
    <AppTabs
      v-model="inkMode"
      :tabs="[
        { value: 'auto', label: 'Automatique' },
        { value: 'custom', label: 'Au choix' },
      ]"
    />
    <div v-if="style.ink !== null" class="dice-row">
      <button
        type="button"
        class="dice-swatch"
        :style="{ background: style.ink, color: inkFor(style.ink), fontFamily: diceFont(style.font)?.stack }"
        aria-label="Couleur des chiffres"
        data-testid="dice-ink"
        @click="picking = 'ink'"
      >20</button>
    </div>

    <p v-if="risky" class="dice-warning" data-testid="dice-contrast-warning">
      Les chiffres risquent d’être illisibles sur ce fond.
    </p>

    <DiceColorSheet
      :model-value="picking !== null"
      :color="pickerColor"
      :title="pickerTitle"
      @update:model-value="!$event && closePicker()"
      @update:color="onPicked"
    />
  </div>
</template>

<style scoped>
/* Reprise des règles de section d'OptionsView : le CSS scopé du parent ne
   traverse pas jusqu'ici. */
.style-section {
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--border);
}

.option-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--fg);
}

.profile-hint {
  display: block;
  font-size: 0.78rem;
  color: var(--muted);
}

.dice-field-label {
  display: block;
  margin: var(--space-lg) 0 var(--space-sm);
  color: var(--muted);
  font-size: 0.82rem;
}

.dice-presets,
.dice-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
}

.dice-row {
  margin-top: var(--space-sm);
}

.dice-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 2px solid var(--surface);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border-strong);
  font-family: var(--title-font);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 160ms ease;
}

.dice-swatch:hover {
  transform: scale(1.08);
}

.dice-swatch.active {
  box-shadow: 0 0 0 3px var(--accent);
}

.dice-angle {
  flex: 1;
  min-width: 120px;
  accent-color: var(--brand);
}

.dice-warning {
  margin: var(--space-md) 0 0;
  color: var(--danger);
  font-size: 0.82rem;
}
</style>
