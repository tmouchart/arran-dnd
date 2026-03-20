<script setup lang="ts">
import { ref, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { streamChat, type ChatMessage } from '../api/chat'
const input = ref('')
const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const threadEl = ref<HTMLElement | null>(null)
const textareaEl = ref<HTMLTextAreaElement | null>(null)

let scrollPending = false
function scrollToBottom() {
  if (scrollPending) return
  scrollPending = true
  nextTick(() => {
    scrollPending = false
    if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight
  })
}

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

function renderAssistantContent(content: string): string {
  return DOMPurify.sanitize(markdown.render(content))
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
  scrollToBottom()
  try {
    await streamChat(next, {
      onDelta: (delta) => {
        const last = messages.value[messages.value.length - 1]
        if (!last || last.role !== 'assistant') return
        last.content += delta
        scrollToBottom()
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
    nextTick(() => textareaEl.value?.focus())
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
      <h1>🔮 Isilwen, miroir astral</h1>
      <p class="lede">
        Pose une question à Isilwen sur les Terres d’Arran
      </p>
    </header>

    <div class="toolbar">
      <button type="button" class="btn ghost" @click="clearChat">
        Nouvelle conversation
      </button>
    </div>

    <div ref="threadEl" class="thread" role="log">
      <p v-if="messages.length === 0" class="empty">
        Commence par une question, par exemple : « Comment fonctionne l’initiative ? »
      </p>
      <article
        v-for="(m, i) in messages"
        :key="i"
        class="bubble"
        :data-role="m.role"
      >
        <span class="who">{{ m.role === 'user' ? 'Vous' : 'Isilwen' }}</span>
        <div
          v-if="m.role === 'assistant'"
          class="content assistant-content"
          v-html="renderAssistantContent(m.content)"
        />
        <div v-else class="content user-content">{{ m.content }}</div>
      </article>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <form class="composer" @submit.prevent="submit">
      <textarea
        ref="textareaEl"
        v-model="input"
        class="textarea"
        rows="3"
        placeholder="Pose une question à Isilwen…"
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
  max-width: 46rem;
  margin: 0 auto;
  height: calc(100dvh - 7.5rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-head {
  margin-bottom: 0.95rem;
  flex: 0 0 auto;
}

.page-head h1 {
  margin: 0 0 0.4rem;
  font-size: clamp(1.35rem, 4.5vw, 1.95rem);
  font-family: var(--title-font);
  letter-spacing: 0.01em;
  color: var(--brand-strong);
}

.lede {
  margin: 0;
  color: var(--muted);
  font-size: 0.97rem;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin: 1rem 0 0.85rem;
  flex: 0 0 auto;
}

.thread {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex: 1 1 auto;
  min-height: 0;
  margin-bottom: 0.85rem;
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  overflow-y: auto;
}

.empty {
  color: var(--muted);
  font-style: italic;
  margin: 0;
  padding: 0.35rem 0.2rem;
}

.bubble {
  padding: 0.76rem 0.9rem;
  border-radius: 13px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.bubble[data-role='user'] {
  border-color: color-mix(in srgb, var(--brand) 45%, var(--border));
  background: color-mix(in srgb, var(--brand) 16%, var(--surface-2));
}

.who {
  display: block;
  font-size: 0.73rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 0.35rem;
  font-weight: 700;
}

.content {
  line-height: 1.6;
}

.user-content {
  white-space: pre-wrap;
}

.content :deep(p) {
  margin: 0 0 0.65rem;
}

.content :deep(p:last-child) {
  margin-bottom: 0;
}

.content :deep(ul),
.content :deep(ol) {
  margin: 0 0 0.7rem;
  padding-left: 1.2rem;
}

.content :deep(li + li) {
  margin-top: 0.2rem;
}

.content :deep(h1),
.content :deep(h2),
.content :deep(h3),
.content :deep(h4) {
  margin: 0.15rem 0 0.5rem;
  line-height: 1.3;
}

.content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  background: color-mix(in srgb, var(--surface) 70%, black 12%);
  border-radius: 4px;
  padding: 0.08rem 0.25rem;
}

.error {
  color: var(--danger);
  font-size: 0.92rem;
  margin: 0 0 0.75rem;
}

.composer {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  flex: 0 0 auto;
}

.textarea {
  width: 100%;
  resize: vertical;
  min-height: 7.3rem;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  font-size: 1rem;
}

@media (min-width: 700px) {
  .toolbar {
    gap: 0.75rem;
  }
}
</style>
