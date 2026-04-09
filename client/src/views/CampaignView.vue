<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Crown, LogOut, User, Plus, Trash2, Swords, Play, Settings } from 'lucide-vue-next'
import { fetchCampaign, leaveCampaign, fetchEncounters, createEncounter, deleteEncounter, type CampaignDetail, type EncounterSummary } from '../api/campaigns'
import { fetchCombats, createCombat, type CombatSummary } from '../api/combats'
import { user } from '../composables/useAuth'
import AppPageLayout from '../components/ui/AppPageLayout.vue'
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

// Tabs
type TabId = 'joueurs' | 'rencontres' | 'combat'
const activeTab = ref<TabId>('joueurs')

// Encounters
const encounters = ref<EncounterSummary[]>([])
const showCreateEncounter = ref(false)
const newEncounterName = ref('')
const encounterError = ref<string | null>(null)

// Combats
const combatsList = ref<CombatSummary[]>([])
const activeCombat = computed(() => combatsList.value.find((c) => c.status === 'active'))

// Launch combat bottom sheet
const showLaunchSheet = ref(false)
const selectedEncounterId = ref<number | null>(null)
const excludedUserIds = ref<Set<number>>(new Set())
const launchError = ref<string | null>(null)

// Settings menu
const showSettings = ref(false)

onMounted(load)

async function load() {
  loading.value = true
  error.value = null
  try {
    campaign.value = await fetchCampaign(Number(route.params.id))
    if (isGm.value) {
      encounters.value = await fetchEncounters(campaign.value.id)
    }
    combatsList.value = await fetchCombats(campaign.value.id)
    // Auto-switch to combat tab if there's an active combat and user is not GM
    if (activeCombat.value && !isGm.value) {
      activeTab.value = 'combat'
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

function openLaunchSheet() {
  excludedUserIds.value = new Set()
  selectedEncounterId.value = null
  launchError.value = null
  showLaunchSheet.value = true
}

function togglePlayer(userId: number) {
  if (excludedUserIds.value.has(userId)) {
    excludedUserIds.value.delete(userId)
  } else {
    excludedUserIds.value.add(userId)
  }
  // Trigger reactivity
  excludedUserIds.value = new Set(excludedUserIds.value)
}

async function handleLaunchCombat() {
  if (!campaign.value) return
  launchError.value = null
  try {
    const result = await createCombat(campaign.value.id, {
      encounterId: selectedEncounterId.value ?? undefined,
      excludedUserIds: [...excludedUserIds.value],
    })
    showLaunchSheet.value = false
    router.push(`/campagnes/${campaign.value.id}/combat/${result.id}`)
  } catch (e) {
    launchError.value = e instanceof Error ? e.message : 'Erreur'
  }
}
</script>

<template>
  <AppPageLayout>
    <template #top-bar>
      <AppPageHead>
        <template #actions>
          <AppIconBtn title="Retour" @click="router.push('/campagnes')">
            <ArrowLeft :size="18" />
          </AppIconBtn>
          <AppIconBtn v-if="isMember && !isGm" title="Options" @click="showSettings = true">
            <Settings :size="18" />
          </AppIconBtn>
        </template>
        {{ campaign?.name ?? 'Campagne' }}
      </AppPageHead>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <template v-else-if="campaign">
      <div class="gm-banner">
        <Crown :size="16" class="gm-icon" />
        <span>MJ : <strong>{{ campaign.gmUsername }}</strong></span>
      </div>

      <!-- Tabs -->
      <nav class="tab-bar">
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
          v-if="isGm"
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'rencontres' }"
          @click="activeTab = 'rencontres'"
        >
          <Swords :size="16" />
          <span class="tab-label">Rencontres</span>
        </button>
        <button
          v-if="activeCombat"
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'combat' }"
          @click="activeTab = 'combat'"
        >
          <Play :size="16" />
          <span class="tab-label">Combat</span>
        </button>
      </nav>

      <!-- Tab: Joueurs -->
      <template v-if="activeTab === 'joueurs'">
        <section class="members-section">
          <AppEmptyState v-if="campaign.members.length === 0">
            Aucun joueur n'a encore rejoint cette campagne.
          </AppEmptyState>

          <div v-else class="members-grid">
            <div
              v-for="m in campaign.members"
              :key="m.userId"
              class="member-card"
              :class="{ clickable: isGm || isMember }"
              @click="(isGm || isMember) ? viewCharacter(m.userId) : undefined"
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

      </template>

      <!-- Tab: Rencontres (GM only) -->
      <template v-if="activeTab === 'rencontres' && isGm">
        <div class="encounters-header">
          <h2 class="section-title">Rencontres ({{ encounters.length }})</h2>
          <div class="encounters-header-actions">
            <AppButton variant="primary" size="small" @click="openLaunchSheet">
              <Play :size="16" />
              Jouer
            </AppButton>
            <AppIconBtn title="Nouvelle rencontre" @click="showCreateEncounter = !showCreateEncounter">
              <Plus :size="18" />
            </AppIconBtn>
          </div>
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

      <!-- Tab: Combat (visible par tous quand actif) -->
      <template v-if="activeTab === 'combat' && activeCombat">
        <div class="active-combat-card" @click="router.push(`/campagnes/${campaign!.id}/combat/${activeCombat!.id}`)">
          <div class="active-combat-info">
            <Swords :size="20" class="combat-icon" />
            <div>
              <span class="combat-name">{{ activeCombat!.name }}</span>
              <span class="combat-round">Round {{ activeCombat!.roundNumber }}</span>
            </div>
          </div>
          <AppButton variant="primary" size="small">Rejoindre</AppButton>
        </div>
      </template>
    </template>

    <!-- Bottom sheet: Settings -->
    <Teleport to="body">
      <div v-if="showSettings" class="sheet-overlay" @click.self="showSettings = false">
        <div class="sheet-panel">
          <h2 class="sheet-title">Options</h2>
          <AppButton variant="danger" block @click="handleLeave">
            <LogOut :size="16" />
            Quitter la campagne
          </AppButton>
          <AppButton variant="ghost" block @click="showSettings = false">Fermer</AppButton>
        </div>
      </div>
    </Teleport>

    <!-- Bottom sheet: Lancer un combat -->
    <Teleport to="body">
      <div v-if="showLaunchSheet" class="sheet-overlay" @click.self="showLaunchSheet = false">
        <div class="sheet-panel">
          <h2 class="sheet-title">Lancer un combat</h2>

          <!-- Choix de la rencontre -->
          <div class="sheet-section">
            <label class="sheet-label">Rencontre</label>
            <select v-model="selectedEncounterId" class="input">
              <option :value="null">Combat vide</option>
              <option v-for="enc in encounters" :key="enc.id" :value="enc.id">
                {{ enc.name }} ({{ enc.monsterCount }} monstres)
              </option>
            </select>
          </div>

          <!-- Sélection des joueurs -->
          <div class="sheet-section">
            <label class="sheet-label">Joueurs</label>
            <div class="player-toggles">
              <div
                v-for="m in campaign!.members"
                :key="m.userId"
                class="player-toggle"
                :class="{ excluded: excludedUserIds.has(m.userId) }"
                @click="togglePlayer(m.userId)"
              >
                <span class="player-toggle-name">{{ m.characterName ?? m.username }}</span>
              </div>
            </div>
          </div>

          <p v-if="launchError" class="form-error">{{ launchError }}</p>

          <div class="sheet-actions">
            <AppButton variant="ghost" @click="showLaunchSheet = false">Annuler</AppButton>
            <AppButton variant="primary" @click="handleLaunchCombat">
              <Play :size="16" />
              Lancer !
            </AppButton>
          </div>
        </div>
      </div>
    </Teleport>
  </AppPageLayout>
</template>

<style scoped>

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

.gm-icon { color: var(--accent); }

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

.tab-label { white-space: nowrap; }

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

.member-card.clickable { cursor: pointer; }
.member-card.clickable:hover { border-color: var(--accent); transform: translateY(-2px); }

.member-avatar {
  width: 52px; height: 52px; border-radius: 50%; overflow: hidden;
  background: var(--surface-3, var(--border));
  display: flex; align-items: center; justify-content: center;
}

.member-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { color: var(--muted); }

.member-info {
  display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
  min-width: 0; width: 100%;
}

.member-character {
  font-weight: 700; font-size: 0.9rem; color: var(--text); text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}

.member-username { font-size: 0.75rem; color: var(--muted); }

/* Encounters */
.encounters-header { display: flex; align-items: center; justify-content: space-between; }
.encounters-header-actions { display: flex; gap: 0.35rem; align-items: center; }

.create-form {
  display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
  padding: 0.85rem 1rem; background: var(--surface-2);
  border: 1px solid var(--border); border-radius: 1rem;
}

.create-form .create-name { flex: 1; min-width: 0; }

.form-error { color: var(--danger, #e05252); font-size: 0.85rem; margin: 0; }

.encounters-list { display: flex; flex-direction: column; gap: 0.65rem; }

.encounter-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; background: var(--surface-2);
  border: 1px solid var(--border); border-radius: 1.1rem;
  gap: 0.75rem; cursor: pointer; transition: border-color 160ms ease;
}

.encounter-card:hover { border-color: var(--accent); }

.encounter-info { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }

.encounter-name {
  font-weight: 700; font-size: 1rem; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.encounter-meta { font-size: 0.8rem; color: var(--muted); }

/* Active combat card */
.active-combat-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.2rem; background: var(--surface-2);
  border: 2px solid var(--accent); border-radius: 1.2rem;
  cursor: pointer; gap: 1rem;
}

.active-combat-info { display: flex; align-items: center; gap: 0.75rem; }
.combat-icon { color: var(--accent); }

.combat-name {
  font-weight: 700; font-size: 1rem; color: var(--text); display: block;
}

.combat-round { font-size: 0.8rem; color: var(--muted); }

/* Bottom sheet */
.sheet-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 1000;
}

.sheet-panel {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1.4rem 1.4rem 0 0;
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sheet-title {
  font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--text); text-align: center;
}

.sheet-section { display: flex; flex-direction: column; gap: 0.4rem; }

.sheet-label {
  font-size: 0.78rem; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.04em;
}

.player-toggles { display: flex; flex-wrap: wrap; gap: 0.4rem; }

.player-toggle {
  padding: 0.45rem 0.8rem;
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  border-radius: 2rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent-strong);
  transition: all 150ms ease;
}

.player-toggle.excluded {
  background: var(--surface-3, var(--border));
  border-color: var(--border);
  color: var(--muted);
  opacity: 0.5;
  text-decoration: line-through;
}

.sheet-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
</style>
