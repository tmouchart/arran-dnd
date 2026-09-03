<script setup lang="ts">
import { ref, watch, onMounted, computed, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Pencil, Trash2, Maximize, Minimize, BookOpen, History } from "lucide-vue-next";
import AppPageLayout from "../components/ui/AppPageLayout.vue";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppButton from "../components/ui/AppButton.vue";
import AppInput from "../components/ui/AppInput.vue";
import AppIconBtn from "../components/ui/AppIconBtn.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import AppModal from "../components/ui/AppModal.vue";
import DrawingCanvas from "../components/DrawingCanvas.vue";
import MentionTextarea from "../components/journal/MentionTextarea.vue";
import NoteContent from "../components/journal/NoteContent.vue";
import MentionSheet from "../components/journal/MentionSheet.vue";
import { fetchPage, savePage, deletePage, type JournalPage, type Stroke } from "../api/journal";
import { useJournalLock } from "../composables/useJournalLock";
import { useAutosave } from "../composables/useAutosave";
import JournalHistorySheet from "../components/journal/JournalHistorySheet.vue";
import { mergeStrokes } from "../utils/strokes";
import { showToast } from "../composables/useToast";
import { relativeTime } from "../utils/relativeTime";
import type { MentionKind } from "../utils/mentions";

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
const editingTitle = ref(false);
const showHistory = ref(false);
const titleInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const canvasRef = ref<InstanceType<typeof DrawingCanvas> | null>(null);

const {
  lock,
  content: sseContent,
  version,
  hasLocalEdits,
  lockLost,
  isLockedByMe,
  isLockedByOther,
  lockedByName,
  connectSSE,
  acquire,
  ensureLock,
  release,
} = useJournalLock(
  `/api/journal/pages/${pageId.value}/events`,
  `/api/journal/pages/${pageId.value}/lock`,
  `/api/journal/pages/${pageId.value}/lock`,
);

/** Dernier état qu'on sait identique à celui du serveur. Il sert de référence
 *  pour distinguer « l'utilisateur a tapé » de « on vient de recevoir/charger »
 *  — sans ça, ouvrir la page déclenche une sauvegarde et vole le verrou. */
let syncedContent = "";
let syncedTitle = "";

// Contenu venu des autres. Pour le texte le composable ne le publie que quand
// c'est sans risque ; pour les dessins on fusionne trait par trait.
watch(sseContent, (v) => {
  if (!v || v === content.value) return;
  const next = isDrawing.value ? mergeStrokes(content.value, v) : v;
  if (next === null || next === content.value) return;
  // La fusion fait autorité côté serveur : ce qu'on affiche est déjà à jour,
  // inutile de le lui renvoyer.
  syncedContent = next;
  content.value = next;
});

const {
  status: saveStatus,
  hasPending,
  schedule,
  flush: flushSave,
} = useAutosave<{ title: string; content: string }>(async (value) => {
  // Le verrou a pu expirer entre deux frappes (téléphone en veille). On le
  // reprend avant d'écrire au lieu de partir en 423. Les dessins n'en ont pas.
  if (!isDrawing.value && !(await ensureLock())) {
    throw new Error("verrou indisponible");
  }
  try {
    // Les dessins n'annoncent pas de version : plusieurs personnes dessinent en
    // même temps et les traits fusionnent par id. L'historique sert de filet.
    const saved = await savePage(pageId.value, {
      ...value,
      expectedVersion: isDrawing.value ? null : version.value,
    });
    version.value = saved.version;
    syncedTitle = value.title;
    // Le serveur a fusionné avec les traits arrivés entre-temps : on adopte son
    // résultat, sinon l'écran reste amputé du dessin des autres.
    syncedContent = saved.content ?? value.content;
    if (saved.content) content.value = saved.content;
  } catch (e: any) {
    // 409 : on garde CE QUI EST TAPÉ — l'autre version reste dans l'historique
    // — et on rejoue la sauvegarde avec la version à jour.
    if (e?.status === 409) {
      version.value = e.body?.currentVersion ?? null;
      showToast("Quelqu'un a écrit en même temps — sa version est dans l'historique.");
    }
    throw e;
  }
});

// Une seule source de vérité pour « du texte n'est pas encore arrivé au
// serveur » : c'est ce qui protège l'écran et maintient le verrou en vie.
watch(hasPending, (v) => { hasLocalEdits.value = v; });

function scheduleSave() {
  schedule({ title: title.value, content: content.value });
}

watch(content, (v) => {
  if (loading.value || v === syncedContent) return;
  if (!isDrawing.value && isLockedByOther.value && !isLockedByMe.value) return;
  scheduleSave();
});
watch(title, (v) => {
  if (loading.value || v === syncedTitle) return;
  if (isLockedByOther.value && !isLockedByMe.value) return;
  scheduleSave();
});

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
  if (!isLockedByMe.value) {
    editing.value = false;
    return;
  }
  // Delay to allow focus to move between title and content
  blurTimeout = setTimeout(async () => {
    await exitEditing();
  }, 200);
}

// ── Mode lecture / édition (pages texte) ─────────────────────────────────────

const editing = ref(false);
const editorRef = ref<InstanceType<typeof MentionTextarea> | null>(null);

function startEditing() {
  if (isLockedByOther.value) return;
  editing.value = true;
  nextTick(() => editorRef.value?.focusEnd());
}

async function exitEditing() {
  await flushSave();
  // Du texte pas encore parti ? On garde le verrou, sinon quelqu'un peut écrire
  // par-dessus ce qui n'est pas sauvegardé.
  if (hasPending.value) return;
  if (isLockedByMe.value) await release();
  editing.value = false;
}

const showMention = ref(false);
const mentionKind = ref<MentionKind | null>(null);
const mentionId = ref<number | null>(null);

function onMention(kind: MentionKind, id: number) {
  mentionKind.value = kind;
  mentionId.value = id;
  showMention.value = true;
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
    showDeleteConfirm.value = false;
    showToast("Erreur lors de la suppression.");
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
    syncedContent = data.content;
    version.value = data.version;
    title.value = data.title;
    syncedTitle = data.title;
    lastEditedBy.value = data.lastEditedBy;
    updatedAt.value = data.updatedAt;
    if (data.lock) lock.value = data.lock;
    // Page texte vide : on démarre directement en édition
    if (data.type === "text" && !data.content.trim()) editing.value = true;
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
  <AppPageLayout mode="full" width="wide" :class="{ 'page-view--drawing': isDrawing }">
    <template #top-bar>
      <AppPageHead>
      <AppIconBtn variant="ghost" :size="34" title="Retour" @click="router.push({ name: 'journal' })">
        <ArrowLeft :size="18" />
      </AppIconBtn>
      <template v-if="editingTitle">
        <AppInput
          ref="titleInputRef"
          v-model="title"
          class="title-input"
          placeholder="Titre de la page"
          @focus="onFocus"
          @blur="editingTitle = false; onBlur()"
          @keydown.enter.prevent="editingTitle = false"
        />
      </template>
      <template v-else>
        <span class="title-text">{{ title || 'Sans titre' }}</span>
        <AppIconBtn v-if="!isLockedByOther" variant="ghost" :size="28" title="Renommer" @click="editingTitle = true; $nextTick(() => (titleInputRef as any)?.$el?.querySelector?.('input')?.focus())">
          <Pencil :size="14" />
        </AppIconBtn>
        <AppIconBtn v-if="isDrawing" variant="ghost" :size="28" :title="canvasRef?.isFullscreen ? 'Réduire' : 'Plein écran'" @click="canvasRef?.toggleFullscreen()">
          <Minimize v-if="canvasRef?.isFullscreen" :size="14" />
          <Maximize v-else :size="14" />
        </AppIconBtn>
      </template>

      <template #actions>
        <span v-if="saveStatus === 'saving'" class="save-indicator saving">Sauvegarde…</span>
        <span v-else-if="saveStatus === 'saved'" class="save-indicator saved">Sauvegardé ✓</span>
        <span v-else-if="lastEditedBy && updatedAt" class="last-edit-info">
          par {{ lastEditedBy }} · {{ relativeTime(updatedAt) }}
        </span>

        <AppIconBtn variant="ghost" :size="34" title="Historique" @click="showHistory = true">
          <History :size="16" />
        </AppIconBtn>

        <span v-if="isLockedByOther" class="lock-badge">
          <Pencil :size="13" />
          En cours d'édition par {{ lockedByName }}
        </span>

        <AppIconBtn
          v-if="!isDrawing && editing"
          variant="ghost"
          :size="34"
          title="Mode lecture"
          @click="exitEditing"
        >
          <BookOpen :size="16" />
        </AppIconBtn>

        <AppIconBtn variant="ghost" :size="34" title="Supprimer" @click="showDeleteConfirm = true">
          <Trash2 :size="16" />
        </AppIconBtn>
      </template>
    </AppPageHead>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <!-- Le verrou perdu pendant qu'on écrit doit se voir : c'est ce silence
         qui faisait perdre du texte. -->
    <div v-else-if="lockLost" class="save-alert">
      {{ lockedByName ?? "Quelqu'un" }} édite cette page en ce moment. Ton texte
      est conservé et sera renvoyé dès que la place se libère. Ne ferme pas la page.
    </div>

    <!-- Une sauvegarde bloquée doit se voir. -->
    <div v-else-if="saveStatus === 'error'" class="save-alert">
      Sauvegarde impossible pour l'instant — ton contenu est conservé et sera
      renvoyé automatiquement. Ne ferme pas la page.
    </div>

    <div v-if="!loading && !error" class="editor-wrapper">
      <!-- Drawing page -->
      <DrawingCanvas
        ref="canvasRef"
        v-if="isDrawing"
        :shared="true"
        :strokes="drawingStrokes"
        :readonly="isLockedByOther"
        @update:strokes="onStrokesUpdate"
        @focus="onFocus"
      />
      <!-- Text page : édition -->
      <MentionTextarea
        v-else-if="editing"
        ref="editorRef"
        v-model="content"
        :readonly="isLockedByOther"
        placeholder="Contenu de la page… Tape @ pour mentionner."
        @focus="onFocus"
        @blur="onBlur"
      />
      <!-- Text page : lecture -->
      <NoteContent
        v-else-if="content.trim()"
        :content="content"
        :editable="!isLockedByOther"
        @mention="onMention"
        @edit="startEditing"
      />
      <button v-else type="button" class="empty-editor" @click="startEditing">
        Page vide. Touche ici pour écrire.
      </button>
    </div>

    <MentionSheet v-model="showMention" :kind="mentionKind" :id="mentionId" />

    <JournalHistorySheet
      v-model="showHistory"
      type="journal_page"
      :entity-id="pageId"
      :is-drawing="isDrawing"
      @restored="load"
    />

    <!-- Delete confirmation -->
    <AppModal v-model="showDeleteConfirm" title="Supprimer cette page ?">
      <p class="modal-hint">Cette action est irréversible.</p>
      <template #footer>
        <AppButton @click="showDeleteConfirm = false">Annuler</AppButton>
        <AppButton variant="danger" :disabled="deleting" @click="handleDelete">
          {{ deleting ? "Suppression…" : "Supprimer" }}
        </AppButton>
      </template>
    </AppModal>
  </AppPageLayout>
</template>

<style scoped>
.page-view--drawing {
  max-width: none !important;
  padding: 0 !important;
}

.empty-editor {
  flex: 1;
  min-height: 0;
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  cursor: text;
}

@media (hover: hover) {
  .empty-editor:hover {
    border-color: var(--accent-strong);
  }
}

.save-alert {
  flex-shrink: 0;
  margin-bottom: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--danger);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  font-size: 0.84rem;
  font-weight: 600;
}

.title-text {
  font-weight: 700;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
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

.lock-badge {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--accent-strong);
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-pill);
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

.modal-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
}
</style>
