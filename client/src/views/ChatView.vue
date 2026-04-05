<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import { streamChat, type ChatMessage, type ToolUseEntry } from "../api/chat";
import { SendHorizonal, SquarePen, Sparkles, Download, X, Volume2, Loader, Mic } from "lucide-vue-next";
import { useTtsQueue } from "../composables/useTtsQueue";
import AppPageLayout from "../components/ui/AppPageLayout.vue";
import AppIconBtn from "../components/ui/AppIconBtn.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import { useCharacter, loadCharacter } from "../composables/useCharacter";
import {
  loadChatMessages,
  useChatPersistence,
} from "../composables/useChatHistory";
const input = ref("");
const messages = ref<ChatMessage[]>(loadChatMessages());
useChatPersistence(messages);
const loading = ref(false);
const generatingImage = ref(false);
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
  if (entry.label) return entry.label;
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
    // Start auto-play TTS pipeline before streaming begins
    if (autoVoice.value) {
      ttsQueue.startAutoPlay(messages.value.length - 1);
    }
    await streamChat(
      next,
      {
        onDelta: (delta) => {
          for (const char of delta) {
            typewriterQueue.value.push(char);
          }
          if (autoVoice.value) {
            ttsQueue.feedDelta(delta);
          }
        },
        onToolUse: (entry) => {
          if (entry.tool === "generate_image") generatingImage.value = true;
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
        onImage: (url, alt) => {
          generatingImage.value = false;
          const last = messages.value[messages.value.length - 1];
          if (last && last.role === "assistant") {
            if (!last.images) last.images = [];
            last.images.push({ url, alt });
            scrollToBottom();
          }
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

    // Auto-voice: flush remaining text to TTS pipeline
    if (autoVoice.value) {
      ttsQueue.flushAutoPlay();
    }
  } catch (e) {
    flushTypewriterQueue();
    if (!error.value) {
      error.value = e instanceof Error ? e.message : "Erreur inconnue";
    }
    messages.value = next.slice(0, -1);
    input.value = text;
  } finally {
    loading.value = false;
    generatingImage.value = false;
    nextTick(() => textareaEl.value?.focus());
  }
}

function clearChat() {
  messages.value = [];
  error.value = null;
  undoSnapshot.value = null;
}

// ── Tab system ────────────────────────────────────────────────────────────────
type Tab = "chat" | "images";
const activeTab = ref<Tab>("chat");

// ── Image gallery ─────────────────────────────────────────────────────────────
interface GalleryImage {
  id: number;
  url: string;
  prompt: string;
  createdAt: string;
}

const galleryImages = ref<GalleryImage[]>([]);
const galleryLoading = ref(false);

async function loadGallery() {
  galleryLoading.value = true;
  try {
    const res = await fetch("/api/images", { credentials: "include" });
    if (res.ok) {
      galleryImages.value = (await res.json()) as GalleryImage[];
    }
  } catch {
    // ignore
  }
  galleryLoading.value = false;
}

function switchTab(tab: Tab) {
  activeTab.value = tab;
  if (tab === "images" && galleryImages.value.length === 0) {
    loadGallery();
  }
}

// ── Image modal ───────────────────────────────────────────────────────────────
const modalImage = ref<{ url: string; alt: string } | null>(null);

function openImageModal(url: string, alt: string) {
  modalImage.value = { url, alt };
}

function closeImageModal() {
  modalImage.value = null;
}

// ── Text-to-Speech ───────────────────────────────────────────────────────────
const ttsQueue = useTtsQueue();
const { playingIndex, ttsLoadingIndex } = ttsQueue;
const autoVoice = ref(false);

function toggleAutoVoice() {
  autoVoice.value = !autoVoice.value;
}

function playTts(text: string, index: number) {
  ttsQueue.play(text, index);
}

onUnmounted(() => {
  ttsQueue.stop();
  stopListening();
});

// ── Speech-to-Text (voice input) ────────────────────────────────────────────
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const sttSupported = !!SpeechRecognition;
const listening = ref(false);
let recognition: any = null;

function toggleListening() {
  if (listening.value) {
    stopListening();
  } else {
    startListening();
  }
}

function startListening() {
  if (!SpeechRecognition || listening.value) return;

  recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event: any) => {
    let finalTranscript = "";
    let interim = "";
    for (let i = 0; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    // Show live transcription in the textarea
    input.value = finalTranscript + interim;
  };

  recognition.onend = () => {
    listening.value = false;
    recognition = null;
  };

  recognition.onerror = (event: any) => {
    console.error("[stt]", event.error);
    listening.value = false;
    recognition = null;
  };

  recognition.start();
  listening.value = true;
}

function stopListening() {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
  listening.value = false;
}

async function downloadImage() {
  if (!modalImage.value) return;
  try {
    const res = await fetch(modalImage.value.url, { credentials: "include" });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `isilwen-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    // ignore
  }
}
</script>

<template>
  <AppPageLayout mode="full" width="wide" class="chat-page">
    <template #top-bar>
      <header class="page-head">
        <h1>
          <span class="chat-title-short">🔮 Isilwen</span>
          <span class="chat-title-full">🔮 Isilwen, miroir astral</span>
        </h1>
        <nav class="isilwen-tabs">
          <button class="isilwen-tab" :class="{ active: activeTab === 'chat' }" @click="switchTab('chat')">
            <span class="tab-icon">💬</span><span class="tab-text"> Chat</span>
          </button>
          <button class="isilwen-tab" :class="{ active: activeTab === 'images' }" @click="switchTab('images')">
            <span class="tab-icon">🎨</span><span class="tab-text"> Images</span>
          </button>
        </nav>
      </header>
    </template>

    <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>

    <!-- Chat tab -->
    <div v-show="activeTab === 'chat'" ref="threadEl" class="thread" role="log">
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
        <button
          v-if="m.role === 'assistant' && m.content.trim()"
          class="tts-btn"
          :title="playingIndex === i ? 'Arrêter' : 'Écouter'"
          :disabled="ttsLoadingIndex === i"
          @click="playTts(m.content, i)"
        >
          <Loader v-if="ttsLoadingIndex === i" :size="14" class="tts-spinner" />
          <Volume2 v-else :size="14" :class="{ 'tts-playing': playingIndex === i }" />
        </button>
        <div v-else class="content user-content">{{ m.content }}</div>
        <div v-if="generatingImage && i === messages.length - 1 && m.role === 'assistant'" class="tool-chips">
          <span class="tool-chip">
            <Loader :size="13" class="tool-chip-icon spin" />
            Création de l'illustration…
          </span>
        </div>
        <div v-if="m.images?.length" class="message-images">
          <img
            v-for="(img, k) in m.images"
            :key="k"
            :src="img.url"
            :alt="img.alt"
            class="generated-image"
            loading="lazy"
            @click="openImageModal(img.url, img.alt)"
          />
        </div>
      </article>
    </div>

    <p v-if="error && activeTab === 'chat'" class="error" role="alert">{{ error }}</p>

    <!-- Images tab -->
    <div v-if="activeTab === 'images'" class="gallery-container">
      <AppEmptyState v-if="galleryLoading" variant="loading">Chargement…</AppEmptyState>
      <div v-else-if="galleryImages.length === 0" class="gallery-empty">
        Aucune image générée pour le moment. Demande à Isilwen d'illustrer une scène !
      </div>
      <div v-else class="gallery-grid">
        <div
          v-for="img in galleryImages"
          :key="img.id"
          class="gallery-card"
          @click="openImageModal(img.url, img.prompt)"
        >
          <img :src="img.url" :alt="img.prompt" class="gallery-thumb" loading="lazy" />
          <p class="gallery-prompt">{{ img.prompt }}</p>
        </div>
      </div>
    </div>

    <!-- Image modal -->
    <Teleport to="body">
      <div v-if="modalImage" class="img-modal-backdrop" @click.self="closeImageModal">
        <div class="img-modal-box">
          <div class="img-modal-toolbar">
            <button type="button" class="img-modal-btn" title="Enregistrer" @click="downloadImage">
              <Download :size="18" />
            </button>
            <button type="button" class="img-modal-btn" title="Fermer" @click="closeImageModal">
              <X :size="18" />
            </button>
          </div>
          <img :src="modalImage.url" :alt="modalImage.alt" class="img-modal-full" />
        </div>
      </div>
    </Teleport>

    <template #bottom-bar>
      <form v-show="activeTab === 'chat'" class="composer" @submit.prevent="submit">
        <textarea
          ref="textareaEl"
          v-model="input"
          class="textarea"
          rows="2"
          placeholder="Pose une question à Isilwen…"
          @keydown.enter.exact.prevent="submit"
        />
        <div class="composer-footer">
          <div class="composer-left">
            <div v-if="character.id" class="character-chip">
              <span class="chip-icon">⚔️</span>
              <span class="chip-name">{{ character.name }}</span>
            </div>
            <AppIconBtn
              :size="28"
              title="Nouvelle conversation"
              class="new-chat-btn"
              @click="clearChat"
            >
              <SquarePen :size="14" />
            </AppIconBtn>
          </div>
          <div class="composer-right">
            <button
              type="button"
              class="voice-toggle-btn"
              :class="{ active: autoVoice }"
              :title="autoVoice ? 'Désactiver la voix auto' : 'Activer la voix auto'"
              @click="toggleAutoVoice"
            >
              <Volume2 :size="17" />
            </button>
            <button
              v-if="sttSupported"
              type="button"
              class="mic-btn"
              :class="{ recording: listening }"
              :title="listening ? 'Arrêter l\'écoute' : 'Dicter un message'"
              :disabled="loading"
              @click="toggleListening"
            >
              <Mic :size="17" aria-hidden="true" />
            </button>
            <button
              type="submit"
              class="send-icon-btn"
              :disabled="loading || !input.trim()"
              :title="loading ? 'Envoi…' : 'Envoyer'"
            >
              <SendHorizonal :size="17" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>
    </template>
  </AppPageLayout>
</template>

<style scoped>
.chat-page {
  padding-bottom: 0.5rem !important;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex: 0 0 auto;
}

.page-head h1 {
  margin: 0;
  font-size: clamp(1.1rem, 4.5vw, 1.95rem);
  font-family: var(--title-font);
  letter-spacing: 0.01em;
  color: var(--brand-strong);
  white-space: nowrap;
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

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}


.message-images {
  margin: 0.4rem 0;
}

.generated-image {
  max-width: 100%;
  border-radius: 10px;
  border: 1px solid var(--border);
  display: block;
}

.error {
  color: var(--danger);
  font-size: 0.92rem;
  margin: 0 0 0.75rem;
}

.composer {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
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
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
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

@media (max-width: 600px) {
  .content {
    font-size: 15px;
  }
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */

.isilwen-tabs {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.isilwen-tab {
  padding: 0.35rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 120ms, color 120ms, border-color 120ms;
}

.isilwen-tab:hover {
  color: var(--text);
  border-color: var(--accent);
}

.isilwen-tab.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.tab-text {
  display: none;
}

@media (min-width: 500px) {
  .tab-text {
    display: inline;
  }
}

/* ── Gallery ───────────────────────────────────────────────────────────────── */

.gallery-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.gallery-empty {
  color: var(--muted);
  font-style: italic;
  text-align: center;
  padding: 2rem 1rem;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}

.gallery-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 150ms, box-shadow 150ms;
}

.gallery-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.gallery-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.gallery-prompt {
  padding: 0.4rem 0.55rem;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.3;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Image modal ───────────────────────────────────────────────────────────── */

.img-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.img-modal-box {
  max-width: min(90vw, 800px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.img-modal-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.img-modal-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  transition: background 120ms;
}

.img-modal-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.img-modal-full {
  max-width: 100%;
  max-height: calc(90vh - 3rem);
  border-radius: 10px;
  object-fit: contain;
}

.generated-image {
  cursor: pointer;
}

/* ── TTS ──────────────────────────────────────────────────────────────────── */

.composer-left {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.voice-toggle-btn {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  opacity: 0.55;
  cursor: pointer;
  transition: color 150ms, opacity 150ms, border-color 150ms, background 150ms;
}

.voice-toggle-btn:hover {
  opacity: 0.85;
}

.voice-toggle-btn.active {
  opacity: 1;
  color: var(--brand-strong);
  border-color: var(--brand);
  background: color-mix(in srgb, var(--brand) 15%, var(--surface-2));
}

.composer-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.mic-btn {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 150ms, border-color 150ms, background 150ms, box-shadow 150ms;
}

.mic-btn:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--accent);
}

.mic-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mic-btn.recording {
  color: #fff;
  background: var(--danger);
  border-color: var(--danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 30%, transparent);
  animation: mic-pulse 1.5s ease-in-out infinite;
}

@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 30%, transparent); }
  50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--danger) 15%, transparent); }
}

.tts-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-top: 0.35rem;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 120ms, border-color 120ms, background 120ms;
}

.tts-btn:hover:not(:disabled) {
  color: var(--brand-strong);
  border-color: var(--brand);
  background: color-mix(in srgb, var(--brand) 10%, var(--surface-2));
}

.tts-btn:disabled {
  cursor: wait;
}

.tts-playing {
  color: var(--brand-strong);
}

@keyframes tts-spin {
  to { transform: rotate(360deg); }
}

.tts-spinner {
  animation: tts-spin 1s linear infinite;
}
</style>
