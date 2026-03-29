<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Pencil, Trash2 } from "lucide-vue-next";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppButton from "../components/ui/AppButton.vue";
import AppInput from "../components/ui/AppInput.vue";
import AppIconBtn from "../components/ui/AppIconBtn.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import DrawingCanvas from "../components/DrawingCanvas.vue";
import { fetchPage, savePage, deletePage, type JournalPage, type Stroke } from "../api/journal";
import { useJournalLock } from "../composables/useJournalLock";
import { relativeTime } from "../utils/relativeTime";

const route = useRoute();
const router = useRouter();
const pageId = computed(() => Number(route.params.id));

const page = ref<JournalPage | null>(null);
const content = ref("");
const title = ref("");
const lastEditedBy = ref<string | null>(null);
const updatedAt = ref<string | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const saveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
let debounce: ReturnType<typeof setTimeout> | null = null;

const {
  lock,
  content: sseContent,
  isLockedByMe,
  isLockedByOther,
  lockedByName,
  connectSSE,
  acquire,
  release,
} = useJournalLock(
  `/api/journal/pages/${pageId.value}/events`,
  `/api/journal/pages/${pageId.value}/lock`,
  `/api/journal/pages/${pageId.value}/lock`,
);

// SSE content updates
watch(sseContent, (v) => {
  if (!v) return;
  if (isDrawing.value) {
    // Merge remote strokes into local strokes
    try {
      const remote: Stroke[] = JSON.parse(v);
      const local: Stroke[] = content.value ? JSON.parse(content.value) : [];
      const localIds = new Set(local.map((s) => s.id));
      const merged = [...local, ...remote.filter((s) => !localIds.has(s.id))];
      if (merged.length !== local.length) {
        content.value = JSON.stringify(merged);
      }
    } catch { /* ignore malformed */ }
  } else {
    if (!isLockedByMe.value) content.value = v;
  }
});

function scheduleSave() {
  if (debounce) clearTimeout(debounce);
  saveStatus.value = "saving";
  debounce = setTimeout(async () => {
    try {
      await savePage(pageId.value, { title: title.value, content: content.value });
      saveStatus.value = "saved";
      setTimeout(() => { saveStatus.value = "idle"; }, 2000);
    } catch {
      saveStatus.value = "error";
    }
  }, 800);
}

// For text pages: save only when holding lock. For drawings: save freely.
watch(content, () => {
  if (!loading.value && (isDrawing.value || isLockedByMe.value)) scheduleSave();
});
watch(title, () => { if (!loading.value && isLockedByMe.value) scheduleSave(); });

let acquiring = false;
async function onFocus() {
  // No lock needed for drawing pages
  if (isDrawing.value) return;
  if (blurTimeout) { clearTimeout(blurTimeout); blurTimeout = null; }
  if (isLockedByMe.value || isLockedByOther.value || acquiring) return;
  acquiring = true;
  await acquire();
  acquiring = false;
}

let blurTimeout: ReturnType<typeof setTimeout> | null = null;
function onBlur() {
  if (!isLockedByMe.value) return;
  // Delay to allow focus to move between title and content
  blurTimeout = setTimeout(async () => {
    if (debounce) {
      clearTimeout(debounce);
      debounce = null;
      try { await savePage(pageId.value, { title: title.value, content: content.value }); } catch { /* best effort */ }
    }
    await release();
  }, 200);
}

// ── Drawing support ─────────────────────────────────────────────────────────

const isDrawing = computed(() => page.value?.type === "drawing");

const drawingStrokes = computed<Stroke[]>(() => {
  if (!isDrawing.value || !content.value) return [];
  try {
    return JSON.parse(content.value);
  } catch {
    return [];
  }
});

function onStrokesUpdate(strokes: Stroke[]) {
  content.value = JSON.stringify(strokes);
}

const showDeleteConfirm = ref(false);
const deleting = ref(false);

async function handleDelete() {
  deleting.value = true;
  try {
    await deletePage(pageId.value);
    router.replace({ name: "journal" });
  } catch {
    alert("Erreur lors de la suppression.");
  } finally {
    deleting.value = false;
  }
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchPage(pageId.value);
    page.value = data;
    content.value = data.content;
    title.value = data.title;
    lastEditedBy.value = data.lastEditedBy;
    updatedAt.value = data.updatedAt;
    if (data.lock) lock.value = data.lock;
    connectSSE();
  } catch {
    error.value = "Page introuvable.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page-view" :class="{ 'page-view--drawing': isDrawing }">
    <AppPageHead>
      <AppIconBtn variant="ghost" :size="34" title="Retour" @click="router.push({ name: 'journal' })">
        <ArrowLeft :size="18" />
      </AppIconBtn>
      <AppInput
        v-model="title"
        class="title-input"
        :readonly="isLockedByOther"
        placeholder="Titre de la page"
        @focus="onFocus"
        @blur="onBlur"
      />

      <template #actions>
        <span v-if="saveStatus === 'saving'" class="save-indicator saving">Sauvegarde…</span>
        <span v-else-if="saveStatus === 'saved'" class="save-indicator saved">Sauvegardé ✓</span>
        <span v-else-if="saveStatus === 'error'" class="save-indicator error">Erreur</span>
        <span v-else-if="lastEditedBy && updatedAt" class="last-edit-info">
          par {{ lastEditedBy }} · {{ relativeTime(updatedAt) }}
        </span>

        <span v-if="isLockedByOther" class="lock-badge">
          <Pencil :size="13" />
          En cours d'édition par {{ lockedByName }}
        </span>

        <AppIconBtn variant="ghost" :size="34" title="Supprimer" @click="showDeleteConfirm = true">
          <Trash2 :size="16" />
        </AppIconBtn>
      </template>
    </AppPageHead>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <div v-else class="editor-wrapper">
      <!-- Drawing page -->
      <DrawingCanvas
        v-if="isDrawing"
        :strokes="drawingStrokes"
        :readonly="isLockedByOther"
        @update:strokes="onStrokesUpdate"
        @focus="onFocus"
      />
      <!-- Text page -->
      <textarea
        v-else
        v-model="content"
        class="journal-editor"
        :class="{ 'journal-editor--readonly': isLockedByOther }"
        :readonly="isLockedByOther"
        placeholder="Contenu de la page…"
        spellcheck="true"
        @focus="onFocus"
        @blur="onBlur"
      />
    </div>

    <!-- Delete confirmation -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="modal-backdrop" @click.self="showDeleteConfirm = false">
        <div class="modal-box">
          <h3 class="modal-title">Supprimer cette page ?</h3>
          <p class="modal-hint">Cette action est irréversible.</p>
          <div class="modal-actions">
            <AppButton variant="danger" :disabled="deleting" @click="handleDelete">
              {{ deleting ? "Suppression…" : "Supprimer" }}
            </AppButton>
            <AppButton @click="showDeleteConfirm = false">Annuler</AppButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page-view {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 4rem);
}

.page-view--drawing {
  max-width: none;
  margin: -1rem -0.78rem -1.5rem;
  height: calc(100vh - 4rem + 1rem + 1.5rem);
}

@media (min-width: 740px) {
  .page-view--drawing {
    margin: -1.25rem -1rem -2rem;
    height: calc(100vh - 4rem + 1.25rem + 2rem);
  }
}

.title-input {
  flex: 1;
  font-weight: 700;
  font-size: 1rem;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.journal-editor {
  flex: 1;
  width: 100%;
  min-height: 0;
  resize: none;
  padding: 1rem;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.65;
  box-sizing: border-box;
  transition: border-color 150ms;
}

.journal-editor:focus {
  outline: none;
  border-color: var(--accent);
}

.journal-editor--readonly {
  cursor: default;
  opacity: 0.7;
}

.journal-editor--readonly:focus {
  border-color: var(--border);
}

.lock-badge {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--accent-strong);
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.last-edit-info {
  font-size: 0.78rem;
  color: var(--muted);
  font-style: italic;
}

.save-indicator {
  font-size: 0.8rem;
  font-style: italic;
}
.save-indicator.saving { color: var(--muted); }
.save-indicator.saved  { color: var(--accent-strong); }
.save-indicator.error  { color: #c95f56; }

/* ── Modal ── */

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.5rem;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-title {
  margin: 0;
  font-size: 1.1rem;
}

.modal-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
