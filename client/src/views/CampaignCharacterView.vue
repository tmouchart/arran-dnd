<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { fetchMemberCharacter } from '../api/campaigns'
import { toCharacter } from '../composables/useCharacter'
import { inferProfileFamily } from '../utils/inferProfileFamily'
import { ARMORS_BY_ID, SHIELDS_BY_ID } from '../data/armorsCatalog'
import type { Character } from '../types/character'
import type { VoieFamily } from '../data/voies'
import { FAMILY_DIE_MAX, PR_MAX } from '../composables/useCharacter'

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

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

const family = computed(() =>
  character.value ? inferProfileFamily(character.value.paths) : ('combattants' as VoieFamily),
)

const computedDef = computed(() => {
  const c = character.value
  if (!c) return 0
  const dexMod = Math.floor((c.abilities.dexterity - 10) / 2)
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  const dexContrib = armor?.encombrant ? 0 : dexMod
  return 10 + dexContrib + (armor?.defBonus ?? 0) + (shield?.defBonus ?? 0) + c.defenseBonus
})

const computedMp = computed(() => {
  const c = character.value
  if (!c) return 0
  const wisMod = Math.floor((c.abilities.wisdom - 10) / 2)
  const base = c.level + wisMod
  return family.value === 'mystiques' ? 2 * base : base
})

const computedHpBase = computed(() => {
  const c = character.value
  if (!c) return 0
  const dieMax = FAMILY_DIE_MAX[family.value]
  const conMod = Math.floor((c.abilities.constitution - 10) / 2)
  return dieMax + conMod
})

const computedHpDv = computed(() => FAMILY_DIE_MAX[family.value])
const computedHpConMod = computed(() =>
  character.value ? Math.floor((character.value.abilities.constitution - 10) / 2) : 0,
)

const computedHpGrowth = computed(() => {
  const c = character.value
  if (!c) return 0
  const conMod = Math.floor((c.abilities.constitution - 10) / 2)
  return c.hpLevelGains.reduce((sum, roll) => sum + roll + conMod, 0)
})

const computedHp = computed(() => Math.max(1, computedHpBase.value + computedHpGrowth.value))

const computedDv = computed((): string => {
  const faces: Record<VoieFamily, string> = {
    combattants: 'd10',
    aventuriers: 'd8',
    mystiques: 'd6',
    prestige: 'd8',
  }
  return faces[family.value]
})

const computedInitiative = computed(() => {
  const c = character.value
  if (!c) return 0
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  return c.abilities.dexterity - (armor?.defBonus ?? 0) - (shield?.defBonus ?? 0) + (c.initiativeBonus ?? 0)
})

const computedPcMax = computed(() => {
  const c = character.value
  if (!c) return 0
  const chaMod = Math.floor((c.abilities.charisma - 10) / 2)
  return 2 + chaMod + (family.value === 'aventuriers' ? 2 : 0)
})

function familyAttackBonus(f: VoieFamily) {
  if (f === 'combattants') return { contact: 2, distance: 2, magique: 0 }
  if (f === 'aventuriers') return { contact: 1, distance: 1, magique: 0 }
  if (f === 'mystiques') return { contact: 0, distance: 0, magique: 2 }
  return { contact: 1, distance: 1, magique: 0 }
}

const computedAttackContact = computed(() => {
  const c = character.value
  if (!c) return 0
  const forMod = Math.floor((c.abilities.strength - 10) / 2)
  const bonus = familyAttackBonus(family.value)
  return c.level + forMod + bonus.contact + (c.attackContactBonus ?? 0)
})

const computedAttackDistance = computed(() => {
  const c = character.value
  if (!c) return 0
  const dexMod = Math.floor((c.abilities.dexterity - 10) / 2)
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  const equipPenalty = Math.floor(((armor?.defBonus ?? 0) + (shield?.defBonus ?? 0)) / 2)
  const bonus = familyAttackBonus(family.value)
  return c.level + dexMod + bonus.distance - equipPenalty + (c.attackDistanceBonus ?? 0)
})

const computedAttackMagique = computed(() => {
  const c = character.value
  if (!c) return 0
  const intMod = Math.floor((c.abilities.intelligence - 10) / 2)
  const armor = c.armorId ? ARMORS_BY_ID[c.armorId] : null
  const shield = c.shieldId ? SHIELDS_BY_ID[c.shieldId] : null
  const equipPenalty = (armor?.defBonus ?? 0) + (shield?.defBonus ?? 0)
  const bonus = familyAttackBonus(family.value)
  return c.level + intMod + bonus.magique - equipPenalty + (c.attackMagiqueBonus ?? 0)
})

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
