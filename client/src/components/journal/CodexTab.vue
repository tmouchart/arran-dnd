<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, Plus, User, MapPin, FileText, Pencil, Trash2, AtSign } from 'lucide-vue-next'
import AppInput from '../ui/AppInput.vue'
import AppIconBtn from '../ui/AppIconBtn.vue'
import AppEmptyState from '../ui/AppEmptyState.vue'
import AppBottomSheet from '../ui/AppBottomSheet.vue'
import AppButton from '../ui/AppButton.vue'
import CodexFormSheet from './CodexFormSheet.vue'
import MentionDigestSheet from './MentionDigestSheet.vue'
import { fetchCodexEntries, deleteCodexEntry, type CodexEntry, type CodexType } from '../../api/codex'
import { fetchCampaign } from '../../api/campaigns'
import { user } from '../../composables/useAuth'
import { showToast } from '../../composables/useToast'
import { relativeTime } from '../../utils/relativeTime'

const campaignId = computed(() => user.value?.activeCampaignId ?? null)

const entries = ref<CodexEntry[]>([])
const gmUserId = ref<number | null>(null)
const loading = ref(true)
const search = ref('')

const typeLabels: Record<CodexType, string> = {
  personnage: 'Personnage',
  lieu: 'Lieu',
  autre: 'Autre',
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter(
    (e) => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
  )
})

async function load() {
  if (!campaignId.value) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const [list, campaign] = await Promise.all([
      fetchCodexEntries(campaignId.value),
      fetchCampaign(campaignId.value),
    ])
    entries.value = list
    gmUserId.value = campaign.gmUserId
  } catch { /* ignore */ }
  loading.value = false
}

// ── Détail ───────────────────────────────────────────────────────────────────

const detailEntry = ref<CodexEntry | null>(null)
const showDetail = ref(false)
const confirmingDelete = ref(false)

function openDetail(entry: CodexEntry) {
  detailEntry.value = entry
  confirmingDelete.value = false
  showDetail.value = true
}

const canDelete = computed(() => {
  const e = detailEntry.value
  const u = user.value
  if (!e || !u) return false
  return e.createdByUserId === u.id || gmUserId.value === u.id
})

async function handleDelete() {
  const entry = detailEntry.value
  if (!entry || !campaignId.value) return
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  confirmingDelete.value = false
  showDetail.value = false
  try {
    await deleteCodexEntry(campaignId.value, entry.id)
    entries.value = entries.value.filter((e) => e.id !== entry.id)
    showToast('Fiche supprimée')
  } catch {
    showToast('Erreur lors de la suppression.')
  }
}

// ── Digest des mentions ──────────────────────────────────────────────────────

const showDigest = ref(false)
const digestEntry = ref<CodexEntry | null>(null)

function openDigest() {
  digestEntry.value = detailEntry.value
  showDetail.value = false
  showDigest.value = true
}

// ── Création / édition ───────────────────────────────────────────────────────

const showForm = ref(false)
const editEntry = ref<CodexEntry | null>(null)

function openCreate() {
  editEntry.value = null
  showForm.value = true
}

function openEdit() {
  editEntry.value = detailEntry.value
  showDetail.value = false
  showForm.value = true
}

function onSaved(entry: CodexEntry) {
  const idx = entries.value.findIndex((e) => e.id === entry.id)
  if (idx >= 0) entries.value[idx] = entry
  else entries.value = [...entries.value, entry].sort((a, b) => a.name.localeCompare(b.name))
}

onMounted(load)
</script>

<template>
  <div class="codex-tab">
    <AppEmptyState v-if="!campaignId">
      Les fiches appartiennent à ta campagne active. Rejoins une campagne pour en créer.
    </AppEmptyState>

    <template v-else>
      <div class="codex-toolbar">
        <div class="search-wrap">
          <Search :size="16" class="search-icon" />
          <AppInput v-model="search" placeholder="Chercher une fiche…" class="search-input" />
        </div>
        <AppIconBtn variant="primary" title="Nouvelle fiche" @click="openCreate">
          <Plus :size="18" />
        </AppIconBtn>
      </div>

      <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
      <AppEmptyState v-else-if="!entries.length">
        Aucune fiche pour le moment. Crée la première : un PNJ, un lieu, un mystère…
      </AppEmptyState>
      <AppEmptyState v-else-if="!filtered.length">
        Aucune fiche ne correspond à "{{ search }}".
      </AppEmptyState>
      <ul v-else class="codex-list">
        <li v-for="entry in filtered" :key="entry.id" class="codex-item" @click="openDetail(entry)">
          <span class="codex-icon">
            <User v-if="entry.type === 'personnage'" :size="16" />
            <MapPin v-else-if="entry.type === 'lieu'" :size="16" />
            <FileText v-else :size="16" />
          </span>
          <div class="codex-info">
            <span class="codex-name">{{ entry.name }}</span>
            <span class="codex-meta">{{ typeLabels[entry.type] }}</span>
          </div>
        </li>
      </ul>

      <!-- ── Détail ── -->
      <AppBottomSheet v-model="showDetail" :title="detailEntry?.name">
        <div v-if="detailEntry" class="detail">
          <span class="detail-type">
            <User v-if="detailEntry.type === 'personnage'" :size="14" />
            <MapPin v-else-if="detailEntry.type === 'lieu'" :size="14" />
            <FileText v-else :size="14" />
            {{ typeLabels[detailEntry.type] }}
          </span>
          <p v-if="detailEntry.description" class="detail-description">{{ detailEntry.description }}</p>
          <p v-else class="detail-empty">Pas encore de description.</p>
          <p class="detail-meta">Mise à jour {{ relativeTime(detailEntry.updatedAt) }}</p>
          <div v-if="confirmingDelete" class="detail-actions">
            <AppButton variant="danger" @click="handleDelete">
              <Trash2 :size="15" />
              Confirmer la suppression ?
            </AppButton>
            <AppButton @click="confirmingDelete = false">Annuler</AppButton>
          </div>
          <div v-else class="detail-actions">
            <AppButton @click="openDigest">
              <AtSign :size="15" />
              Mentions
            </AppButton>
            <AppButton @click="openEdit">
              <Pencil :size="15" />
              Modifier
            </AppButton>
            <AppButton v-if="canDelete" variant="danger" @click="handleDelete">
              <Trash2 :size="15" />
              Supprimer
            </AppButton>
          </div>
        </div>
      </AppBottomSheet>

      <!-- ── Mentions ── -->
      <MentionDigestSheet
        v-if="digestEntry"
        v-model="showDigest"
        :entry-id="digestEntry.id"
        :entry-name="digestEntry.name"
      />

      <!-- ── Création / édition ── -->
      <CodexFormSheet
        v-model="showForm"
        :campaign-id="campaignId"
        :entry="editEntry"
        @saved="onSaved"
      />
    </template>
  </div>
</template>

<style scoped>
.codex-tab {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.codex-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.6rem;
  flex-shrink: 0;
}

.search-wrap {
  position: relative;
  flex: 1;
  display: flex;
}

.search-icon {
  position: absolute;
  left: 0.7rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}

.search-input {
  flex: 1;
  padding-left: 2.1rem;
}

.codex-list {
  list-style: none;
  margin: 0;
  padding: 0 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
}

.codex-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 120ms, background 120ms;
}

.codex-item:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}

.codex-icon {
  color: var(--muted);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.codex-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.codex-name {
  font-weight: 600;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.codex-meta {
  font-size: 0.76rem;
  color: var(--muted);
}

/* ── Détail ── */

.detail {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.detail-type {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  align-self: flex-start;
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

.detail-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.3rem;
}
</style>
