<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Crown, LogOut, User } from 'lucide-vue-next'
import { fetchCampaign, leaveCampaign, type CampaignDetail } from '../api/campaigns'
import { user } from '../composables/useAuth'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppIconBtn from '../components/ui/AppIconBtn.vue'
import AppButton from '../components/ui/AppButton.vue'
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

onMounted(load)

async function load() {
  loading.value = true
  error.value = null
  try {
    campaign.value = await fetchCampaign(Number(route.params.id))
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

function avatarUrl(url: string | null): string {
  return url || ''
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

      <section class="members-section">
        <h2 class="section-title">Joueurs ({{ campaign.members.length }})</h2>

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

.section-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
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
</style>
