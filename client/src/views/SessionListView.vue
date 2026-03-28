<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, LogIn, Users } from 'lucide-vue-next'
import { fetchSessions, createSession, joinSession, type SessionSummary } from '../api/sessions'
import { useCharacter } from '../composables/useCharacter'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppIconBtn from '../components/ui/AppIconBtn.vue'
import AppInput from '../components/ui/AppInput.vue'
import AppButton from '../components/ui/AppButton.vue'
import AppEmptyState from '../components/ui/AppEmptyState.vue'

const router = useRouter()
const { character } = useCharacter()


const sessions = ref<SessionSummary[]>([])
const loading = ref(false)
const showCreate = ref(false)
const newName = ref('')
const createError = ref<string | null>(null)
const joinError = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  try {
    sessions.value = await fetchSessions()
  } finally {
    loading.value = false
  }
})

async function handleCreate() {
  createError.value = null
  try {
    const session = await createSession(newName.value.trim())
    router.push(`/sessions/${session.id}`)
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Erreur'
  }
}

async function handleJoin(id: string) {
  joinError.value = null
  try {
    const session = await joinSession(id, character.value.hpCurrent)
    router.push(`/sessions/${session.id}`)
  } catch (e) {
    joinError.value = e instanceof Error ? e.message : 'Erreur'
  }
}
</script>

<template>
  <div class="session-list-page">
    <AppPageHead>
      <Users :size="22" />
      Sessions de jeu
      <template #actions>
        <AppIconBtn variant="primary" title="Nouvelle session" @click="showCreate = !showCreate">
          <Plus :size="18" />
        </AppIconBtn>
      </template>
    </AppPageHead>

    <form v-if="showCreate" class="create-form" @submit.prevent="handleCreate">
      <AppInput
        v-model="newName"
        class="create-session-name"
        placeholder="Nom de la session"
        :required="true"
        :autofocus="true"
      />
      <AppButton type="submit" variant="primary">Créer</AppButton>
      <p v-if="createError" class="form-error">{{ createError }}</p>
    </form>

    <p v-if="joinError" class="form-error">{{ joinError }}</p>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>

    <AppEmptyState v-else-if="sessions.length === 0 && !showCreate">
      Aucune session active. Crée-en une !
    </AppEmptyState>

    <div v-else class="sessions-list">
      <div v-for="s in sessions" :key="s.id" class="session-card">
        <div class="session-info">
          <span class="session-name">{{ s.name }}</span>
          <span class="session-meta">{{ s.participantCount }} joueur{{ s.participantCount > 1 ? 's' : '' }}</span>
        </div>
        <AppIconBtn title="Rejoindre" @click="handleJoin(s.id)">
          <LogIn :size="18" />
        </AppIconBtn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-list-page {
  max-width: 520px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.create-form .create-session-name {
  flex: 1;
  min-width: 0;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.session-card {
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

.session-card:hover {
  border-color: var(--accent);
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.session-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  font-size: 0.8rem;
  color: var(--muted);
}


.form-error {
  width: 100%;
  color: var(--danger, #e05252);
  font-size: 0.85rem;
  margin: 0;
}
</style>
