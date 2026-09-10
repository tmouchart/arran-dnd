<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { fetchMemberCharacter } from '../api/campaigns'
import { toCharacter } from '../composables/useCharacter'
import { inferProfileFamily } from '../utils/inferProfileFamily'
import { abilityModifier } from '../utils/attackBonus'
import {
  FAMILY_DIE_MAX,
  computeDef,
  computeMp,
  computeHpBase,
  computeHpConMod,
  computeHpGrowth,
  computeHp,
  computeInitiative,
  computePcMax,
  computeAttackContact,
  computeAttackDistance,
  computeAttackMagique,
} from '../utils/characterStats'
import type { Character } from '../types/character'
import type { VoieFamily } from '../data/voies'
import { PR_MAX } from '../composables/useCharacter'

import AppPageLayout from '../components/ui/AppPageLayout.vue'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppIconBtn from '../components/ui/AppIconBtn.vue'
import AppEmptyState from '../components/ui/AppEmptyState.vue'
import AppTabs from '../components/ui/AppTabs.vue'

import IdentityCard from '../components/character-sheet/IdentityCard.vue'
import AbilitiesCard from '../components/character-sheet/AbilitiesCard.vue'
import ResourcesCard from '../components/character-sheet/ResourcesCard.vue'
import CombatCard from '../components/character-sheet/CombatCard.vue'
import VoiesCard from '../components/character-sheet/VoiesCard.vue'
import PassifsCard from '../components/character-sheet/PassifsCard.vue'
import MartialFormationsCard from '../components/character-sheet/MartialFormationsCard.vue'
import WeaponsCard from '../components/character-sheet/WeaponsCard.vue'
import EquipmentCard from '../components/character-sheet/EquipmentCard.vue'
import CompetencesCard from '../components/character-sheet/CompetencesCard.vue'

/** Libellé du dé de vie par famille (le personnage peut être absent : on garde un défaut). */
const DV_LABELS: Record<VoieFamily, string> = {
  combattants: 'd10',
  aventuriers: 'd8',
  mystiques: 'd6',
  prestige: 'd8',
}

const route = useRoute()
const router = useRouter()

const character = ref<Character | null>(null)
const portraitDataUrl = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const campaignId = Number(route.params.campaignId)
const targetUserId = Number(route.params.userId)

onMounted(async () => {
  loading.value = true
  try {
    const raw = await fetchMemberCharacter(campaignId, targetUserId)
    character.value = toCharacter(raw)
    portraitDataUrl.value = (raw as unknown as Record<string, unknown>).portraitDataUrl as string | null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  } finally {
    loading.value = false
  }
})

const family = computed(() =>
  character.value ? inferProfileFamily(character.value.paths) : ('combattants' as VoieFamily),
)

const computedDef = computed(() => (character.value ? computeDef(character.value) : 0))
const computedMp = computed(() => (character.value ? computeMp(character.value) : 0))
const computedHpBase = computed(() => (character.value ? computeHpBase(character.value) : 0))
const computedHpDv = computed(() => FAMILY_DIE_MAX[family.value])
const computedHpConMod = computed(() => (character.value ? computeHpConMod(character.value) : 0))
const computedHpGrowth = computed(() => (character.value ? computeHpGrowth(character.value) : 0))
const computedHp = computed(() => (character.value ? computeHp(character.value) : 0))
const computedDv = computed((): string => DV_LABELS[family.value])
const computedInitiative = computed(() => (character.value ? computeInitiative(character.value) : 0))
const computedPcMax = computed(() => (character.value ? computePcMax(character.value) : 0))
const computedAttackContact = computed(() =>
  character.value ? computeAttackContact(character.value) : 0,
)
const computedAttackDistance = computed(() =>
  character.value ? computeAttackDistance(character.value) : 0,
)
const computedAttackMagique = computed(() =>
  character.value ? computeAttackMagique(character.value) : 0,
)

// Tab navigation
type TabId = 'identite' | 'voies' | 'combat'
const activeTab = ref<TabId>('identite')
const TABS: { value: TabId; label: string; icon: string }[] = [
  { value: 'identite', label: 'Identité', icon: '⚔️' },
  { value: 'voies', label: 'Voies', icon: '✨' },
  { value: 'combat', label: 'Combat', icon: '🗡️' },
]
</script>

<template>
  <AppPageLayout>
    <template #top-bar>
      <AppPageHead>
        <template #actions>
          <AppIconBtn title="Retour à la campagne" @click="router.push(`/campagnes/${campaignId}`)">
            <ArrowLeft :size="18" />
          </AppIconBtn>
        </template>
        Fiche de {{ character?.name ?? 'personnage' }}
      </AppPageHead>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <template v-else-if="character">
      <AppTabs
        class="sheet-tabs"
        :model-value="activeTab"
        :tabs="TABS"
        @update:model-value="activeTab = $event as TabId"
      />

      <div class="readonly-wrapper">
        <!-- Onglet 1 : Identité + Carac + PV & Ressources -->
        <template v-if="activeTab === 'identite'">
          <IdentityCard :character="character" :portrait-override-url="portraitDataUrl" />
          <AbilitiesCard :character="character" :ability-modifier="abilityModifier" />
          <ResourcesCard
            :character="character"
            :computed-mp="computedMp"
            :computed-hp="computedHp"
            :computed-hp-base="computedHpBase"
            :computed-hp-dv="computedHpDv"
            :computed-hp-con-mod="computedHpConMod"
            :computed-hp-growth="computedHpGrowth"
            :family="family"
            :ability-modifier="abilityModifier"
            :computed-dv="computedDv"
            :computed-pc-max="computedPcMax"
            :pr-max="PR_MAX"
          />
        </template>

        <!-- Onglet 2 : Voies + Compétences -->
        <template v-if="activeTab === 'voies'">
          <VoiesCard :character="character" />
          <PassifsCard :character="character" />
          <CompetencesCard :character="character" />
        </template>

        <!-- Onglet 3 : Combat + Formations martiales + Armes -->
        <template v-if="activeTab === 'combat'">
          <CombatCard
            :character="character"
            :computed-attack-contact="computedAttackContact"
            :computed-attack-distance="computedAttackDistance"
            :computed-attack-magique="computedAttackMagique"
            :computed-def="computedDef"
            :computed-initiative="computedInitiative"
            :ability-modifier="abilityModifier"
            :family="family"
          />
          <EquipmentCard :character="character" />
          <MartialFormationsCard :character="character" />
          <WeaponsCard :character="character" />
        </template>
      </div>
    </template>
  </AppPageLayout>
</template>

<style scoped>
.readonly-wrapper {
  pointer-events: none;
  user-select: text;
}

/* Hide interactive elements inside the readonly wrapper */
.readonly-wrapper :deep(button),
.readonly-wrapper :deep(.btn),
.readonly-wrapper :deep(.icon-btn),
.readonly-wrapper :deep([contenteditable]),
.readonly-wrapper :deep(.card-head-actions) {
  display: none !important;
}

/* Allow expanding/collapsing voie cards */
.readonly-wrapper :deep(.voie-header) {
  cursor: pointer;
  pointer-events: auto;
}

/* Hide voie edit controls (rank +/-, remove) even when expanded */
.readonly-wrapper :deep(.voie-controls) {
  display: none !important;
}

.readonly-wrapper :deep(input),
.readonly-wrapper :deep(select),
.readonly-wrapper :deep(textarea) {
  opacity: 0.85;
  background: var(--surface-2) !important;
  border-color: transparent !important;
  cursor: default;
}

.sheet-tabs {
  margin-bottom: 0.85rem;
}
</style>
