<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { User, MapPin, FileText, AtSign, ArrowUpRight } from 'lucide-vue-next'
import AppBottomSheet from '../ui/AppBottomSheet.vue'
import AppButton from '../ui/AppButton.vue'
import AppEmptyState from '../ui/AppEmptyState.vue'
import MentionDigestSheet from './MentionDigestSheet.vue'
import { fetchCodexEntries, type CodexEntry, type CodexType } from '../../api/codex'
import { fetchCampaign, type CampaignMember } from '../../api/campaigns'
import { user } from '../../composables/useAuth'
import type { MentionKind } from '../../utils/mentions'
import { relativeTime } from '../../utils/relativeTime'

const props = defineProps<{
  modelValue: boolean
  kind: MentionKind | null
  id: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const router = useRouter()
const campaignId = computed(() => user.value?.activeCampaignId ?? null)

const typeLabels: Record<CodexType, string> = {
  personnage: 'Personnage',
  lieu: 'Lieu',
  autre: 'Autre',
}

const loading = ref(false)
const notFound = ref(false)
const entry = ref<CodexEntry | null>(null)
const member = ref<CampaignMember | null>(null)

watch(
  () => props.modelValue,
  async (open) => {
    if (!open || !campaignId.value || props.kind === null || props.id === null) return
    loading.value = true
    notFound.value = false
    entry.value = null
    member.value = null
    try {
      if (props.kind === 'codex') {
        const entries = await fetchCodexEntries(campaignId.value)
        entry.value = entries.find((e) => e.id === props.id) ?? null
        notFound.value = !entry.value
      } else {
        const campaign = await fetchCampaign(campaignId.value)
        member.value = campaign.members.find((m) => m.userId === props.id) ?? null
        notFound.value = !member.value
      }
    } catch {
      notFound.value = true
    } finally {
      loading.value = false
    }
  },
)

const title = computed(() => entry.value?.name ?? member.value?.characterName ?? member.value?.username ?? 'Mention')

// ── Digest ───────────────────────────────────────────────────────────────────

const showDigest = ref(false)

function openDigest() {
  emit('update:modelValue', false)
  showDigest.value = true
}

// ── Membre : fiche de personnage ─────────────────────────────────────────────

function openCharacter() {
  const m = member.value
  if (!m || !campaignId.value) return
  emit('update:modelValue', false)
  router.push({
    name: 'campaign-character',
    params: { campaignId: campaignId.value, userId: m.userId },
  })
}
</script>

<template>
  <AppBottomSheet
    :model-value="modelValue"
    :title="title"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="notFound">
      Introuvable — la fiche a peut-être été supprimée.
    </AppEmptyState>

    <!-- Fiche codex -->
    <div v-else-if="entry" class="mention-detail">
      <span class="detail-type">
        <User v-if="entry.type === 'personnage'" :size="14" />
        <MapPin v-else-if="entry.type === 'lieu'" :size="14" />
        <FileText v-else :size="14" />
        {{ typeLabels[entry.type] }}
      </span>
      <p v-if="entry.description" class="detail-description">{{ entry.description }}</p>
      <p v-else class="detail-empty">Pas encore de description.</p>
      <p class="detail-meta">Mise à jour {{ relativeTime(entry.updatedAt) }}</p>
      <AppButton @click="openDigest">
        <AtSign :size="15" />
        Voir toutes les mentions
      </AppButton>
    </div>

    <!-- Membre de la campagne -->
    <div v-else-if="member" class="mention-detail">
      <span class="detail-type">
        <User :size="14" />
        Membre de la campagne
      </span>
      <p class="detail-description">
        {{ member.characterName ?? member.username }}
        <template v-if="member.characterName"> ({{ member.username }})</template>
      </p>
      <AppButton v-if="member.characterId" @click="openCharacter">
        <ArrowUpRight :size="15" />
        Voir sa fiche de personnage
      </AppButton>
    </div>
  </AppBottomSheet>

  <MentionDigestSheet
    v-if="entry"
    v-model="showDigest"
    :entry-id="entry.id"
    :entry-name="entry.name"
  />
</template>

<style scoped>
.mention-detail {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  align-items: flex-start;
}

.detail-type {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.detail-description {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.6;
  white-space: pre-wrap;
}

.detail-empty {
  margin: 0;
  font-size: 0.88rem;
  color: var(--muted);
  font-style: italic;
}

.detail-meta {
  margin: 0;
  font-size: 0.76rem;
  color: var(--muted);
}
</style>
