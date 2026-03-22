<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, LogIn, Users } from 'lucide-vue-next'
import { fetchSessions, createSession, joinSession, type SessionSummary } from '../api/sessions'
import { useCharacter } from '../composables/useCharacter'

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
    <header class="page-header">
      <h1 class="page-title">
        <Users :size="22" />
        Sessions de jeu
      </h1>
      <button
        class="btn primary icon-btn"
        title="Nouvelle session"
        @click="showCreate = !showCreate"
      >
        <Plus :size="18" />
      </button>
    </header>

    <form v-if="showCreate" class="create-form" @submit.prevent="handleCreate">
      <input
        v-model="newName"
        class="text-input"
        placeholder="Nom de la session"
        required
        autofocus
      />
      <button type="submit" class="btn primary">Créer</button>
      <p v-if="createError" class="form-error">{{ createError }}</p>
    </form>

    <p v-if="joinError" class="form-error">{{ joinError }}</p>

    <div v-if="loading" class="empty-state">Chargement…</div>

    <div v-else-if="sessions.length === 0 && !showCreate" class="empty-state">
      Aucune session active. Crée-en une !
    </div>

    <div v-else class="sessions-list">
      <div v-for="s in sessions" :key="s.id" class="session-card">
        <div class="session-info">
          <span class="session-name">{{ s.name }}</span>
          <span class="session-meta">{{ s.participantCount }} joueur{{ s.participantCount > 1 ? 's' : '' }}</span>
        </div>
        <button
          class="btn ghost icon-btn"
          title="Rejoindre"
          @click="handleJoin(s.id)"
        >
          <LogIn :size="18" />
        </button>
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

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--title-font);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--brand-strong);
  margin: 0;
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

.create-form .text-input {
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

.empty-state {
  text-align: center;
  color: var(--muted);
  padding: 2rem 1rem;
  font-size: 0.95rem;
}

.form-error {
  width: 100%;
  color: var(--danger, #e05252);
  font-size: 0.85rem;
  margin: 0;
}
</style>
