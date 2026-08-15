<script setup lang="ts">
import { ref } from 'vue'
import { Sword, Scroll, Heart, Trash2, Plus, Pencil } from 'lucide-vue-next'
import AppPageLayout from '../components/ui/AppPageLayout.vue'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppCard from '../components/ui/AppCard.vue'
import AppButton from '../components/ui/AppButton.vue'
import AppIconBtn from '../components/ui/AppIconBtn.vue'
import AppInput from '../components/ui/AppInput.vue'
import AppSelect from '../components/ui/AppSelect.vue'
import AppTextarea from '../components/ui/AppTextarea.vue'
import AppBadge from '../components/ui/AppBadge.vue'
import AppTabs from '../components/ui/AppTabs.vue'
import AppEmptyState from '../components/ui/AppEmptyState.vue'
import AppModal from '../components/ui/AppModal.vue'
import AppBottomSheet from '../components/ui/AppBottomSheet.vue'
import { showToast } from '../composables/useToast'
import { dice, revealAfterDice } from '../composables/useDice3D'
import {
  celebrate,
  resetCriticalCooldown,
  criticalSoundEnabled,
  criticalVibrationEnabled,
  setCriticalSoundEnabled,
  setCriticalVibrationEnabled,
} from '../composables/useCriticalMoment'

const inputText = ref('Gimli')
const inputNumber = ref(12)
const selectValue = ref('guerrier')
const textareaValue = ref('Une note griffonnée dans la marge du grimoire…')
const tabValue = ref('emoji')
const lucideTab = ref('sword')
const modalOpen = ref(false)
const wideModalOpen = ref(false)
const sheetOpen = ref(false)

const radiusTokens = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'pill']
const spaceTokens = ['xs', 'sm', 'md', 'lg']
const colorTokens = [
  'bg', 'bg-alt', 'surface', 'surface-2', 'surface-3',
  'text', 'muted', 'border', 'border-strong',
  'accent', 'accent-strong', 'accent-soft',
  'brand', 'brand-strong', 'danger',
]
const badgeVariants = ['attaque', 'limitée', 'gratuite', 'info', 'pm', 'active'] as const

// Banc d'essai du moment critique. Le cooldown est remis à zéro à chaque clic :
// ici on veut pouvoir réessayer trois fois de suite pour régler l'animation.
function fireMoment(outcome: 'critical' | 'fumble') {
  resetCriticalCooldown()
  celebrate(outcome, 'Théos')
}

function forceRoll(value: number) {
  resetCriticalCooldown()
  revealAfterDice(dice(20, [value], 'weapon'), () => {
    resetCriticalCooldown()
    celebrate(value === 20 ? 'critical' : 'fumble', 'Théos')
  })
}
</script>

<template>
  <AppPageLayout>
    <template #top-bar>
      <AppPageHead>Bibliothèque de composants</AppPageHead>
    </template>

    <AppCard title="Tokens — couleurs">
      <div class="swatch-grid">
        <div v-for="token in colorTokens" :key="token" class="swatch">
          <span class="swatch-color" :style="{ background: `var(--${token})` }" />
          <code>--{{ token }}</code>
        </div>
      </div>
    </AppCard>

    <AppCard title="Tokens — radius & spacing">
      <div class="token-row">
        <div v-for="r in radiusTokens" :key="r" class="radius-demo" :style="{ borderRadius: `var(--radius-${r})` }">
          {{ r }}
        </div>
      </div>
      <div class="token-row">
        <div v-for="s in spaceTokens" :key="s" class="space-demo">
          <span class="space-bar" :style="{ width: `var(--space-${s})` }" /><code>--space-{{ s }}</code>
        </div>
      </div>
    </AppCard>

    <AppCard title="AppButton">
      <div class="demo-row">
        <AppButton variant="primary">Primary</AppButton>
        <AppButton>Ghost</AppButton>
        <AppButton variant="danger">Danger</AppButton>
        <AppButton variant="primary" disabled>Désactivé</AppButton>
      </div>
      <div class="demo-row">
        <AppButton variant="primary" size="small">Small primary</AppButton>
        <AppButton size="small">Small ghost</AppButton>
      </div>
      <AppButton block>Block (pleine largeur)</AppButton>
    </AppCard>

    <AppCard title="AppIconBtn">
      <div class="demo-row">
        <AppIconBtn title="Éditer"><Pencil :size="18" /></AppIconBtn>
        <AppIconBtn variant="primary" title="Ajouter"><Plus :size="18" /></AppIconBtn>
        <AppIconBtn variant="danger" title="Supprimer"><Trash2 :size="18" /></AppIconBtn>
        <AppIconBtn :size="34" title="Petit (34px)"><Heart :size="16" /></AppIconBtn>
      </div>
    </AppCard>

    <AppCard title="AppInput / AppSelect / AppTextarea">
      <div class="demo-col">
        <AppInput v-model="inputText" placeholder="Nom du personnage" />
        <AppInput v-model="inputNumber" type="number" :min="0" :max="20" text-align="center" class="input-narrow" />
        <AppInput model-value="Désactivé" disabled />
        <AppSelect v-model="selectValue">
          <option value="guerrier">Guerrier</option>
          <option value="mage">Mage</option>
          <option value="voleur">Voleur</option>
        </AppSelect>
        <AppTextarea v-model="textareaValue" :rows="3" placeholder="Notes…" />
      </div>
    </AppCard>

    <AppCard title="AppBadge">
      <div class="demo-row">
        <AppBadge v-for="v in badgeVariants" :key="v" :variant="v">{{ v }}</AppBadge>
      </div>
    </AppCard>

    <AppCard title="AppTabs">
      <div class="demo-col">
        <AppTabs
          v-model="tabValue"
          :tabs="[
            { value: 'emoji', label: 'Identité', icon: '🛡️' },
            { value: 'voies', label: 'Voies', icon: '✨' },
            { value: 'combat', label: 'Combat', icon: '⚔️' },
          ]"
        />
        <AppTabs
          v-model="lucideTab"
          icon-only-mobile
          :tabs="[
            { value: 'sword', label: 'Armes', icon: Sword },
            { value: 'scroll', label: 'Sorts', icon: Scroll },
          ]"
        />
      </div>
    </AppCard>

    <AppCard title="AppModal / AppBottomSheet / Toast">
      <div class="demo-row">
        <AppButton @click="modalOpen = true">Modal</AppButton>
        <AppButton @click="wideModalOpen = true">Modal wide</AppButton>
        <AppButton @click="sheetOpen = true">Bottom sheet</AppButton>
        <AppButton @click="showToast('Jet de dés réussi !')">Toast</AppButton>
      </div>
    </AppCard>

    <AppCard title="AppEmptyState">
      <AppEmptyState variant="loading">Chargement du grimoire…</AppEmptyState>
      <AppEmptyState>Aucun personnage pour l'instant.</AppEmptyState>
      <AppEmptyState variant="error">
        Impossible de contacter le serveur.
        <template #actions>
          <AppButton size="small">Réessayer</AppButton>
        </template>
      </AppEmptyState>
    </AppCard>

    <AppCard title="Moment critique">
      <p class="demo-note">
        Les deux premiers jouent l'effet seul. Les deux suivants lancent un vrai d20 3D
        avec la valeur forcée : dé → étincelles → effet, comme en séance.
      </p>
      <div class="demo-row">
        <AppButton @click="fireMoment('critical')">✨ Critique</AppButton>
        <AppButton @click="fireMoment('fumble')">💀 Échec critique</AppButton>
        <AppButton @click="forceRoll(20)">🎲 Jet forcé : 20</AppButton>
        <AppButton @click="forceRoll(1)">🎲 Jet forcé : 1</AppButton>
      </div>
      <div class="demo-row">
        <AppButton
          size="small"
          :variant="criticalSoundEnabled ? 'primary' : 'ghost'"
          @click="setCriticalSoundEnabled(!criticalSoundEnabled)"
        >
          Son : {{ criticalSoundEnabled ? 'on' : 'off' }}
        </AppButton>
        <AppButton
          size="small"
          :variant="criticalVibrationEnabled ? 'primary' : 'ghost'"
          @click="setCriticalVibrationEnabled(!criticalVibrationEnabled)"
        >
          Vibration : {{ criticalVibrationEnabled ? 'on' : 'off' }}
        </AppButton>
      </div>
    </AppCard>

    <AppModal v-model="modalOpen" title="Titre de la modal">
      <p>Contenu de la modal. Fermeture par Échap, clic dehors ou le bouton.</p>
      <template #footer>
        <AppButton @click="modalOpen = false">Annuler</AppButton>
        <AppButton variant="primary" @click="modalOpen = false">Valider</AppButton>
      </template>
    </AppModal>

    <AppModal v-model="wideModalOpen" title="Modal large" wide>
      <p>Variante `wide` (560px) pour les contenus denses.</p>
    </AppModal>

    <AppBottomSheet v-model="sheetOpen" title="Bottom sheet">
      <p>Feuille ancrée en bas sur mobile, dialogue centré sur desktop.</p>
    </AppBottomSheet>
  </AppPageLayout>
</template>

<style scoped>
.demo-note {
  margin: 0 0 var(--space-sm);
  color: var(--muted);
  font-size: 0.85rem;
}

.demo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.demo-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.input-narrow {
  max-width: 110px;
}

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-sm);
}

.swatch {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.78rem;
}

.swatch-color {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.token-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.radius-demo {
  width: 58px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  font-size: 0.72rem;
  color: var(--muted);
}

.space-demo {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.78rem;
}

.space-bar {
  height: 14px;
  background: var(--accent);
  border-radius: 2px;
}
</style>
