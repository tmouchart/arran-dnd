<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, LogIn, Trash2, Map, Crown, DoorOpen } from 'lucide-vue-next'
import {
  fetchCampaigns,
  createCampaign,
  deleteCampaign,
  joinCampaign,
  type CampaignSummary,
} from '../api/campaigns'
import { user } from '../composables/useAuth'
import AppPageLayout from '../components/ui/AppPageLayout.vue'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppIconBtn from '../components/ui/AppIconBtn.vue'
import AppInput from '../components/ui/AppInput.vue'
import AppButton from '../components/ui/AppButton.vue'
import AppEmptyState from '../components/ui/AppEmptyState.vue'

const router = useRouter()

const campaigns = ref<CampaignSummary[]>([])
const loading = ref(false)
const showCreate = ref(false)
const newName = ref('')
const error = ref<string | null>(null)
const confirmDeleteId = ref<number | null>(null)

onMounted(load)

async function load() {
  loading.value = true
  try {
    campaigns.value = await fetchCampaigns()
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  error.value = null
  try {
    const campaign = await createCampaign(newName.value.trim())
    newName.value = ''
    showCreate.value = false
    router.push(`/campagnes/${campaign.id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  }
}

async function handleJoin(id: number) {
  error.value = null
  try {
    await joinCampaign(id)
    router.push(`/campagnes/${id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  }
}

async function handleDelete(id: number) {
  error.value = null
  try {
    await deleteCampaign(id)
    campaigns.value = campaigns.value.filter((c) => c.id !== id)
    confirmDeleteId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  }
}

function isGm(c: CampaignSummary) {
  return c.gmUserId === user.value?.id
}
</script>

<template>
  <AppPageLayout>
    <template #top-bar>
      <AppPageHead>
      <Map :size="22" />
      Campagnes
      <template #actions>
        <AppIconBtn variant="primary" title="Nouvelle campagne" @click="showCreate = !showCreate">
          <Plus :size="18" />
        </AppIconBtn>
      </template>
    </AppPageHead>
    </template>

    <form v-if="showCreate" class="create-form" @submit.prevent="handleCreate">
      <AppInput
        v-model="newName"
        class="create-name"
        placeholder="Nom de la campagne"
        :required="true"
        :autofocus="true"
      />
      <AppButton type="submit" variant="primary">Créer</AppButton>
    </form>

    <p v-if="error" class="form-error">{{ error }}</p>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>

    <AppEmptyState v-else-if="campaigns.length === 0 && !showCreate">
      Aucune campagne pour le moment. Lance-toi !
    </AppEmptyState>

    <div v-else class="campaigns-list">
      <div
        v-for="c in campaigns"
        :key="c.id"
        class="campaign-card"
        :class="{ clickable: isGm(c) || c.isMember }"
        @click="(isGm(c) || c.isMember) && router.push(`/campagnes/${c.id}`)"
      >
        <div class="campaign-info">
          <span class="campaign-name">{{ c.name }}</span>
          <span class="campaign-meta">
            <Crown :size="13" class="meta-icon" />
            {{ c.gmUsername }}
            <span class="meta-sep">&middot;</span>
            {{ c.memberCount }} joueur{{ c.memberCount > 1 ? 's' : '' }}
          </span>
        </div>

        <div class="campaign-actions">
          <!-- Rejoindre -->
          <AppIconBtn
            v-if="!isGm(c) && !c.isMember"
            title="Rejoindre"
            @click.stop="handleJoin(c.id)"
          >
            <LogIn :size="18" />
          </AppIconBtn>

          <!-- Ouvrir -->
          <AppIconBtn
            v-if="!isGm(c) && c.isMember"
            title="Ouvrir"
            @click.stop="router.push(`/campagnes/${c.id}`)"
          >
            <DoorOpen :size="18" />
          </AppIconBtn>

          <!-- Delete (GM only) -->
          <AppIconBtn
            v-if="isGm(c)"
            variant="danger"
            title="Supprimer"
            @click.stop="confirmDeleteId = c.id"
          >
            <Trash2 :size="18" />
          </AppIconBtn>
        </div>
      </div>
    </div>

    <!-- Modal de confirmation suppression -->
    <Teleport to="body">
      <div v-if="confirmDeleteId" class="modal-overlay" @click.self="confirmDeleteId = null">
        <div class="modal-box">
          <p>Supprimer cette campagne ? Cette action est irréversible.</p>
          <div class="modal-actions">
            <AppButton variant="ghost" @click="confirmDeleteId = null">Annuler</AppButton>
            <AppButton variant="danger" @click="handleDelete(confirmDeleteId!)">Supprimer</AppButton>
          </div>
        </div>
      </div>
    </Teleport>
  </AppPageLayout>
</template>

<style scoped>
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

.campaigns-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.campaign-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1.1rem;
  gap: 0.75rem;
  transition: border-color 160ms ease;
}

.campaign-card.clickable {
  cursor: pointer;
}

.campaign-card:hover {
  border-color: var(--accent);
}

.campaign-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.campaign-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.campaign-meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.meta-icon {
  opacity: 0.6;
}

.meta-sep {
  margin: 0 0.1rem;
}

.campaign-actions {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.form-error {
  width: 100%;
  color: var(--danger, #e05252);
  font-size: 0.85rem;
  margin: 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1.2rem;
  padding: 1.5rem;
  max-width: 360px;
  width: 90%;
  text-align: center;
}

.modal-box p {
  margin: 0 0 1.2rem;
  font-size: 0.95rem;
  color: var(--text);
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}
</style>
