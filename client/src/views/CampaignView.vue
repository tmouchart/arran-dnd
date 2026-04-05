<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Crown, LogOut, User, Plus, Trash2, Swords } from 'lucide-vue-next'
import { fetchCampaign, leaveCampaign, fetchEncounters, createEncounter, deleteEncounter, type CampaignDetail, type EncounterSummary } from '../api/campaigns'
import { user } from '../composables/useAuth'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppIconBtn from '../components/ui/AppIconBtn.vue'
import AppButton from '../components/ui/AppButton.vue'
import AppInput from '../components/ui/AppInput.vue'
import AppEmptyState from '../components/ui/AppEmptyState.vue'

const route = useRoute()
const router = useRouter()

const campaign = ref<CampaignDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const isGm = computed(() => campaign.value?.gmUserId === user.value?.id)
const isMember = computed(() =>
  campaign.value?.members.some((m) => m.userId === user.value?.id) ?? false,
)

// Tabs (Rencontres only visible to GM)
type TabId = 'joueurs' | 'rencontres'
const activeTab = ref<TabId>('joueurs')

// Encounters
const encounters = ref<EncounterSummary[]>([])
const showCreateEncounter = ref(false)
const newEncounterName = ref('')
const encounterError = ref<string | null>(null)

onMounted(load)

async function load() {
  loading.value = true
  error.value = null
  try {
    campaign.value = await fetchCampaign(Number(route.params.id))
    if (isGm.value) {
      encounters.value = await fetchEncounters(campaign.value.id)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  } finally {
    loading.value = false
  }
}

async function handleLeave() {
  if (!campaign.value) return
  try {
    await leaveCampaign(campaign.value.id)
    router.push('/campagnes')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  }
}

function viewCharacter(memberId: number) {
  if (!campaign.value) return
  router.push(`/campagnes/${campaign.value.id}/personnage/${memberId}`)
}

async function handleCreateEncounter() {
  if (!campaign.value) return
  encounterError.value = null
  try {
    const enc = await createEncounter(campaign.value.id, { name: newEncounterName.value.trim() })
    newEncounterName.value = ''
    showCreateEncounter.value = false
    router.push(`/campagnes/${campaign.value.id}/rencontres/${enc.id}`)
  } catch (e) {
    encounterError.value = e instanceof Error ? e.message : 'Erreur'
  }
}

async function handleDeleteEncounter(eid: number) {
  if (!campaign.value) return
  try {
    await deleteEncounter(campaign.value.id, eid)
    encounters.value = encounters.value.filter((e) => e.id !== eid)
  } catch (e) {
    encounterError.value = e instanceof Error ? e.message : 'Erreur'
  }
}
</script>

<template>
  <div class="campaign-page">
    <AppPageHead>
      <template #actions>
        <AppIconBtn title="Retour" @click="router.push('/campagnes')">
          <ArrowLeft :size="18" />
        </AppIconBtn>
      </template>
      {{ campaign?.name ?? 'Campagne' }}
    </AppPageHead>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <template v-else-if="campaign">
      <div class="gm-banner">
        <Crown :size="16" class="gm-icon" />
        <span>MJ : <strong>{{ campaign.gmUsername }}</strong></span>
      </div>

      <!-- Tabs (Rencontres only for GM) -->
      <nav v-if="isGm" class="tab-bar">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'joueurs' }"
          @click="activeTab = 'joueurs'"
        >
          <User :size="16" />
          <span class="tab-label">Joueurs</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'rencontres' }"
          @click="activeTab = 'rencontres'"
        >
          <Swords :size="16" />
          <span class="tab-label">Rencontres</span>
        </button>
      </nav>

      <!-- Tab: Joueurs -->
      <template v-if="activeTab === 'joueurs'">
        <section class="members-section">
          <h2 v-if="!isGm" class="section-title">Joueurs ({{ campaign.members.length }})</h2>

          <AppEmptyState v-if="campaign.members.length === 0">
            Aucun joueur n'a encore rejoint cette campagne.
          </AppEmptyState>

          <div v-else class="members-grid">
            <div
              v-for="m in campaign.members"
              :key="m.userId"
              class="member-card clickable"
              @click="viewCharacter(m.userId)"
            >
              <div class="member-avatar">
                <img v-if="m.portraitUrl" :src="m.portraitUrl" alt="" />
                <img v-else-if="m.avatarUrl" :src="m.avatarUrl" alt="" />
                <User v-else :size="28" class="avatar-placeholder" />
              </div>
              <div class="member-info">
                <span class="member-character">{{ m.characterName ?? '—' }}</span>
                <span class="member-username">{{ m.username }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Bouton quitter (joueur membre uniquement) -->
        <div v-if="isMember && !isGm" class="leave-section">
          <AppButton variant="danger" @click="handleLeave">
            <LogOut :size="16" />
            Quitter la campagne
          </AppButton>
        </div>
      </template>

      <!-- Tab: Rencontres (GM only) -->
      <template v-if="activeTab === 'rencontres' && isGm">
        <div class="encounters-header">
          <h2 class="section-title">Rencontres ({{ encounters.length }})</h2>
          <AppIconBtn variant="primary" title="Nouvelle rencontre" @click="showCreateEncounter = !showCreateEncounter">
            <Plus :size="18" />
          </AppIconBtn>
        </div>

        <form v-if="showCreateEncounter" class="create-form" @submit.prevent="handleCreateEncounter">
          <AppInput
            v-model="newEncounterName"
            class="create-name"
            placeholder="Nom de la rencontre"
            :required="true"
            :autofocus="true"
          />
          <AppButton type="submit" variant="primary">Créer</AppButton>
        </form>

        <p v-if="encounterError" class="form-error">{{ encounterError }}</p>

        <AppEmptyState v-if="encounters.length === 0 && !showCreateEncounter">
          Aucune rencontre. Prépare tes combats !
        </AppEmptyState>

        <div v-else class="encounters-list">
          <div
            v-for="enc in encounters"
            :key="enc.id"
            class="encounter-card"
            @click="router.push(`/campagnes/${campaign!.id}/rencontres/${enc.id}`)"
          >
            <div class="encounter-info">
              <span class="encounter-name">{{ enc.name }}</span>
              <span class="encounter-meta">{{ enc.monsterCount }} monstre{{ enc.monsterCount > 1 ? 's' : '' }}</span>
            </div>
            <AppIconBtn
              variant="danger"
              title="Supprimer"
              @click.stop="handleDeleteEncounter(enc.id)"
            >
              <Trash2 :size="16" />
            </AppIconBtn>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.campaign-page {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gm-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.gm-icon {
  color: var(--accent);
}

/* Tab bar */
.tab-bar {
  display: flex;
  gap: 0.35rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.3rem;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.42rem 0.5rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  transition: background 150ms ease, color 150ms ease;
}

.tab-btn:hover {
  background: color-mix(in srgb, var(--accent-soft) 60%, transparent);
  color: var(--accent-strong);
}

.tab-btn.active {
  background: var(--surface);
  color: var(--accent-strong);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.tab-label {
  white-space: nowrap;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}

.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}

.member-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1.1rem;
  transition: border-color 160ms ease, transform 160ms ease;
}

.member-card.clickable {
  cursor: pointer;
}

.member-card.clickable:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.member-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface-3, var(--border));
  display: flex;
  align-items: center;
  justify-content: center;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  color: var(--muted);
}

.member-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  min-width: 0;
  width: 100%;
}

.member-character {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.member-username {
  font-size: 0.75rem;
  color: var(--muted);
}

.leave-section {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

/* Encounters */
.encounters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.create-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.85rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1rem;
}

.create-form .create-name {
  flex: 1;
  min-width: 0;
}

.form-error {
  color: var(--danger, #e05252);
  font-size: 0.85rem;
  margin: 0;
}

.encounters-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.encounter-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1.1rem;
  gap: 0.75rem;
  cursor: pointer;
  transition: border-color 160ms ease;
}

.encounter-card:hover {
  border-color: var(--accent);
}

.encounter-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.encounter-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.encounter-meta {
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
