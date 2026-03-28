<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import { streamChat, type ChatMessage, type ToolUseEntry } from "../api/chat";
import { SendHorizonal, SquarePen, Sparkles } from "lucide-vue-next";
import AppIconBtn from "../components/ui/AppIconBtn.vue";
import { useCharacter, loadCharacter } from "../composables/useCharacter";
import {
  loadChatMessages,
  useChatPersistence,
} from "../composables/useChatHistory";
const input = ref("");
const messages = ref<ChatMessage[]>(loadChatMessages());
useChatPersistence(messages);
const loading = ref(false);
const error = ref<string | null>(null);
const threadEl = ref<HTMLElement | null>(null);
const textareaEl = ref<HTMLTextAreaElement | null>(null);

// Typewriter effect: buffer incoming delta chars and drip them out slowly.
const TYPEWRITER_INTERVAL_MS = 5; // ~45 chars/sec
const typewriterQueue = ref<string[]>([]);
let typewriterTimer: ReturnType<typeof setInterval> | null = null;

function startTypewriter() {
  if (typewriterTimer !== null) return;
  typewriterTimer = setInterval(() => {
    if (typewriterQueue.value.length === 0) return;
    const char = typewriterQueue.value.shift()!;
    const last = messages.value[messages.value.length - 1];
    if (last && last.role === "assistant") {
      last.content += char;
      scrollToBottom();
    }
  }, TYPEWRITER_INTERVAL_MS);
}

function stopTypewriter() {
  if (typewriterTimer !== null) {
    clearInterval(typewriterTimer);
    typewriterTimer = null;
  }
}

function flushTypewriterQueue() {
  // Drain remaining chars instantly (e.g. on stream end or error)
  const last = messages.value[messages.value.length - 1];
  if (last && last.role === "assistant") {
    last.content += typewriterQueue.value.join("");
  }
  typewriterQueue.value = [];
  stopTypewriter();
}

onUnmounted(() => {
  stopTypewriter();
});

const TOPIC_LABELS: Record<string, string> = {
  "creation-personnage": "Création de personnage",
  combat: "Combat",
  equipement: "Équipement",
  magie: "Magie",
  "monde-arran": "Monde d'Arran",
  "monde-lore-chroniques": "Chroniques",
  "monde-lore-peuples-elfes": "Peuples elfes",
  "monde-lore-peuples-nains-humains": "Peuples nains & humains",
  "monde-lore-peuples-autres": "Autres peuples",
  races: "Races",
  "voies-de-profil": "Voies de profil",
  "voies-de-prestige": "Voies de prestige",
  bestiaire: "Bestiaire",
};

function toolUseLabel(entry: ToolUseEntry): string {
  if (entry.tool === "load_knowledge" && entry.topic) {
    return `Consulté les astres : ${TOPIC_LABELS[entry.topic] ?? entry.topic}`;
  }
  if (entry.tool === "edit_character") {
    return "Modifié la fiche du personnage";
  }
  return entry.tool;
}

const { character, loadError } = useCharacter();
const undoSnapshot = ref<Record<string, unknown> | null>(null);

onMounted(() => {
  if (!character.value.id) loadCharacter();
  // Restore scroll to latest messages after reload (localStorage hydrates before paint).
  scrollToBottom();
  requestAnimationFrame(() => {
    if (threadEl.value) {
      threadEl.value.scrollTop = threadEl.value.scrollHeight;
    }
  });
});

let scrollPending = false;
function scrollToBottom() {
  if (scrollPending) return;
  scrollPending = true;
  nextTick(() => {
    scrollPending = false;
    if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight;
  });
}

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

function renderAssistantContent(content: string): string {
  return DOMPurify.sanitize(markdown.render(content));
}

async function submit() {
  const text = input.value.trim();
  if (!text || loading.value) return;
  error.value = null;
  const next: ChatMessage[] = [
    ...messages.value,
    { role: "user", content: text },
  ];
  const withAssistant: ChatMessage[] = [
    ...next,
    { role: "assistant", content: "" },
  ];
  messages.value = withAssistant;
  input.value = "";
  loading.value = true;
  scrollToBottom();
  try {
    typewriterQueue.value = [];
    startTypewriter();
    await streamChat(
      next,
      {
        onDelta: (delta) => {
          for (const char of delta) {
            typewriterQueue.value.push(char);
          }
        },
        onToolUse: (entry) => {
          const last = messages.value[messages.value.length - 1];
          if (last && last.role === "assistant") {
            if (!last.toolUses) last.toolUses = [];
            last.toolUses.push(entry);
          }
        },
        onError: (msg) => {
          flushTypewriterQueue();
          error.value = msg;
        },
        onCharacterUpdated: (row, previous) => {
          undoSnapshot.value = previous;
          loadCharacter((row as { id?: number }).id);
          const last = messages.value[messages.value.length - 1];
          if (last && last.role === "assistant") {
            if (!last.toolUses) last.toolUses = [];
            last.toolUses.push({ tool: "edit_character" });
          }
        },
      },
      character.value.id
        ? (character.value as unknown as Record<string, unknown>)
        : undefined,
      undoSnapshot.value ?? undefined,
    );
    // Wait for the typewriter to drain before releasing loading state.
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (typewriterQueue.value.length === 0) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
    flushTypewriterQueue();
  } catch (e) {
    flushTypewriterQueue();
    if (!error.value) {
      error.value = e instanceof Error ? e.message : "Erreur inconnue";
    }
    messages.value = next.slice(0, -1);
    input.value = text;
  } finally {
    loading.value = false;
    nextTick(() => textareaEl.value?.focus());
  }
}

function clearChat() {
  messages.value = [];
  error.value = null;
  undoSnapshot.value = null;
}
</script>

<template>
  <div class="page chat-page">
    <header class="page-head">
      <div class="head-row">
        <h1>
          <span class="chat-title-short">🔮 Isilwen</span>
          <span class="chat-title-full">🔮 Isilwen, miroir astral</span>
        </h1>
        <AppIconBtn
          :size="34"
          title="Nouvelle conversation"
          class="new-chat-btn"
          @click="clearChat"
        >
          <SquarePen :size="18" />
        </AppIconBtn>
      </div>
    </header>

    <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>

    <div ref="threadEl" class="thread" role="log">
      <p v-if="messages.length === 0" class="empty">
        Je suis Isilwen : le miroir ne montre rien sans une question posée avec
        intention. Héros des Terres d’Arran, qu’aimerais-tu éclaircir — une
        règle, un sort ? Écris ta question, et nous tisserons la réponse
        ensemble.
      </p>
      <article
        v-for="(m, i) in messages"
        :key="i"
        class="bubble"
        :data-role="m.role"
      >
        <span class="who">{{
          m.role === "user"
            ? character.id
              ? character.name.trim() || "Vous"
              : "Vous"
            : "Isilwen"
        }}</span>
        <div v-if="m.toolUses?.length" class="tool-chips">
          <span v-for="(tu, j) in m.toolUses" :key="j" class="tool-chip">
            <Sparkles :size="13" class="tool-chip-icon" />
            {{ toolUseLabel(tu) }}
          </span>
        </div>
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
        rows="2"
        placeholder="Pose une question à Isilwen…"
        :disabled="loading"
        @keydown.enter.exact.prevent="submit"
      />
      <div class="composer-footer">
        <div v-if="character.id" class="character-chip">
          <span class="chip-icon">⚔️</span>
          <span class="chip-name">{{ character.name }}</span>
        </div>
        <div v-else class="chip-placeholder" />
        <button
          type="submit"
          class="send-icon-btn"
          :disabled="loading || !input.trim()"
          :title="loading ? 'Envoi…' : 'Envoyer'"
        >
          <SendHorizonal :size="20" aria-hidden="true" />
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.chat-page {
  max-width: 46rem;
  margin: 0 auto -1.5rem; /* absorb main's padding-bottom on mobile */
  /* nav (~3.6rem) + main padding-top (1rem) */
  height: calc(100dvh - 4.6rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (min-width: 740px) {
  .chat-page {
    margin-bottom: -2rem; /* main padding-bottom at desktop */
    height: calc(100dvh - 4.85rem); /* nav + 1.25rem padding-top */
  }
}

.page-head {
  margin-bottom: 0.5rem;
  flex: 0 0 auto;
}

.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0;
}

.page-head h1 {
  margin: 0;
  font-size: clamp(1.1rem, 4.5vw, 1.95rem);
  font-family: var(--title-font);
  letter-spacing: 0.01em;
  color: var(--brand-strong);
}

.chat-title-full {
  display: none;
}

@media (min-width: 700px) {
  .chat-title-short {
    display: none;
  }

  .chat-title-full {
    display: inline;
  }
}

.new-chat-btn {
  color: var(--muted);
}

.new-chat-btn:hover {
  color: var(--brand-strong);
  border-color: var(--brand) !important;
  background: color-mix(in srgb, var(--brand) 10%, var(--surface-2)) !important;
}

.lede {
  margin: 0;
  color: var(--muted);
  font-size: 0.97rem;
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
  box-sizing: border-box;
  width: fit-content;
  max-width: min(32rem, calc(100% - 2.75rem));
  min-width: 0;
}

/* WhatsApp-like lanes: user on the right (gutter on the left), assistant on the left (gutter on the right) */
.bubble[data-role="user"] {
  align-self: flex-end;
  border-color: color-mix(in srgb, var(--brand) 45%, var(--border));
  background: color-mix(in srgb, var(--brand) 16%, var(--surface-2));
}

.bubble[data-role="assistant"] {
  align-self: flex-start;
}

.bubble[data-role="user"] .who {
  text-align: right;
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
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  background: color-mix(in srgb, var(--surface) 70%, black 12%);
  border-radius: 4px;
  padding: 0.08rem 0.25rem;
}

.tool-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.45rem;
}

.tool-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--brand-strong) 80%, var(--muted));
  background: color-mix(in srgb, var(--brand) 10%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--brand) 25%, var(--border));
}

.tool-chip-icon {
  flex-shrink: 0;
  opacity: 0.7;
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
  min-height: 4rem;
  padding: 0.55rem 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  font-size: 1rem;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.character-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand) 18%, var(--surface-2));
  border: 1px solid color-mix(in srgb, var(--brand) 40%, var(--border));
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--brand-strong);
  max-width: 16rem;
  overflow: hidden;
}

.chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-placeholder {
  flex: 0 0 auto;
}

.send-icon-btn {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 10px;
  border: none;
  background: var(--brand);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;
}

.send-icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.send-icon-btn:not(:disabled):hover {
  opacity: 0.85;
}

@media (min-width: 700px) {
  .toolbar {
    gap: 0.75rem;
  }
}
</style>
