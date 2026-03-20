<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { streamChat, fetchHealth, type ChatMessage } from '../api/chat'

const bundles = ref<string[]>(['core'])
const topic = ref('core')
const input = ref('')
const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const h = await fetchHealth()
    if (h.bundles?.length) bundles.value = h.bundles
  } catch {
    /* API may be down during dev */
  }
})

const bundleLabels: Record<string, string> = {
  core: 'Vue d’ensemble',
  creation: 'Création',
  combat: 'Combat',
  magic: 'Magie',
  monde: 'Monde',
  voies: 'Voies',
}

function labelFor(id: string): string {
  return bundleLabels[id] ?? id
}

async function submit() {
  const text = input.value.trim()
  if (!text || loading.value) return
  error.value = null
  const next: ChatMessage[] = [...messages.value, { role: 'user', content: text }]
  const withAssistant: ChatMessage[] = [...next, { role: 'assistant', content: '' }]
  messages.value = withAssistant
  input.value = ''
  loading.value = true
  try {
    await streamChat(next, topic.value, {
      onDelta: (delta) => {
        const lastIndex = messages.value.length - 1
        if (lastIndex < 0) return
        const last = messages.value[lastIndex]
        if (!last || last.role !== 'assistant') return
        const updated = [...messages.value]
        updated[lastIndex] = { ...last, content: `${last.content}${delta}` }
        messages.value = updated
      },
      onError: (msg) => {
        error.value = msg
      },
    })
  } catch (e) {
    if (!error.value) {
      error.value = e instanceof Error ? e.message : 'Erreur inconnue'
    }
    messages.value = next.slice(0, -1)
    input.value = text
  } finally {
    loading.value = false
  }
}

function clearChat() {
  messages.value = []
  error.value = null
}
</script>

<template>
  <div class="page chat-page">
    <header class="page-head">
      <h1>Assistant règles</h1>
      <p class="lede">
        Pose une question sur les Terres d’Arran / Chroniques Oubliées. Les réponses
        s’appuient sur la base <code>knowledge/</code> du projet (incomplète par design).
      </p>
    </header>

    <div class="toolbar">
      <label class="field">
        <span>Sujet</span>
        <select v-model="topic" class="select">
          <option v-for="b in bundles" :key="b" :value="b">
            {{ labelFor(b) }}
          </option>
        </select>
      </label>
      <button type="button" class="btn ghost" @click="clearChat">
        Nouvelle conversation
      </button>
    </div>

    <div class="thread" role="log">
      <p v-if="messages.length === 0" class="empty">
        Commence par une question, par exemple : « Comment fonctionne l’initiative ? »
      </p>
      <article
        v-for="(m, i) in messages"
        :key="i"
        class="bubble"
        :data-role="m.role"
      >
        <span class="who">{{ m.role === 'user' ? 'Vous' : 'Assistant' }}</span>
        <div class="content">{{ m.content }}</div>
      </article>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <form class="composer" @submit.prevent="submit">
      <textarea
        v-model="input"
        class="textarea"
        rows="3"
        placeholder="Votre question…"
        :disabled="loading"
        @keydown.enter.exact.prevent="submit"
      />
      <button type="submit" class="btn primary" :disabled="loading || !input.trim()">
        {{ loading ? 'Envoi…' : 'Envoyer' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat-page {
  max-width: 44rem;
  margin: 0 auto;
}

.page-head h1 {
  font-size: 1.5rem;
  margin: 0 0 0.5rem;
}

.lede {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
  margin: 1.25rem 0 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.select {
  min-width: 12rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}

.thread {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 12rem;
  margin-bottom: 1rem;
}

.empty {
  color: var(--muted);
  font-style: italic;
  margin: 0;
}

.bubble {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.bubble[data-role='user'] {
  border-color: var(--accent-dim);
  background: rgba(180, 120, 60, 0.08);
}

.who {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 0.35rem;
}

.content {
  white-space: pre-wrap;
  line-height: 1.5;
}

.error {
  color: var(--danger);
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
}

.composer {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.textarea {
  width: 100%;
  resize: vertical;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  font-size: 1rem;
}
</style>
