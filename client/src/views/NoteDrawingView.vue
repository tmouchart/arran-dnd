<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Lock, Pencil, Maximize, Minimize, History } from "lucide-vue-next";
import AppPageLayout from "../components/ui/AppPageLayout.vue";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppIconBtn from "../components/ui/AppIconBtn.vue";
import AppInput from "../components/ui/AppInput.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import DrawingCanvas from "../components/DrawingCanvas.vue";
import JournalHistorySheet from "../components/journal/JournalHistorySheet.vue";
import { fetchNotes, updateNote, type Note } from "../api/notes";
import { useAutosave } from "../composables/useAutosave";
import type { Stroke } from "../api/journal";

const route = useRoute();
const router = useRouter();
const noteId = computed(() => Number(route.params.id));

const note = ref<Note | null>(null);
const title = ref("");
const content = ref("");
const loading = ref(true);
const error = ref<string | null>(null);
const editingTitle = ref(false);
const showHistory = ref(false);
const titleInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const canvasRef = ref<InstanceType<typeof DrawingCanvas> | null>(null);

const { status: saveStatus, schedule, flush: saveNow } = useAutosave<{
  title: string;
  content: string;
}>(async (value) => {
  // note.value.id, pas noteId : au flush de depart de page, la route a deja change
  if (!note.value) return;
  await updateNote(note.value.id, value);
});

function scheduleSave() {
  schedule({ title: title.value, content: content.value });
}

watch([title, content], () => {
  if (!loading.value) scheduleSave();
});

const drawingStrokes = computed<Stroke[]>(() => {
  if (!content.value) return [];
  try {
    return JSON.parse(content.value);
  } catch {
    return [];
  }
});

function onStrokesUpdate(strokes: Stroke[]) {
  content.value = JSON.stringify(strokes);
}

function goBack() {
  router.push({ name: "journal", query: { tab: "dessins" } });
}

function startRenaming() {
  editingTitle.value = true;
  nextTick(() => (titleInputRef.value as any)?.$el?.querySelector?.("input")?.focus());
}

async function load() {
  loading.value = true;
  try {
    const notes = await fetchNotes();
    const found = notes.find((n) => n.id === noteId.value);
    if (!found) {
      error.value = "Dessin introuvable.";
    } else {
      note.value = found;
      title.value = found.title;
      content.value = found.content;
    }
  } catch {
    error.value = "Impossible de charger le dessin.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

onBeforeUnmount(() => {
  // Flush pending save when leaving
  void saveNow();
});
</script>

<template>
  <AppPageLayout mode="full" width="wide" class="drawing-view">
    <template #top-bar>
      <AppPageHead>
        <AppIconBtn title="Retour" :size="34" @click="goBack">
          <ArrowLeft :size="18" />
        </AppIconBtn>
        <Lock :size="18" class="lock-icon" />
        <template v-if="editingTitle">
          <AppInput
            ref="titleInputRef"
            v-model="title"
            class="title-input"
            placeholder="Titre du dessin"
            @blur="editingTitle = false"
            @keydown.enter.prevent="editingTitle = false"
          />
        </template>
        <template v-else>
          <span class="title-text">{{ title.trim() || 'Sans titre' }}</span>
          <AppIconBtn variant="ghost" :size="28" title="Renommer" @click="startRenaming">
            <Pencil :size="14" />
          </AppIconBtn>
          <AppIconBtn variant="ghost" :size="28" :title="canvasRef?.isFullscreen ? 'Réduire' : 'Plein écran'" @click="canvasRef?.toggleFullscreen()">
            <Minimize v-if="canvasRef?.isFullscreen" :size="14" />
            <Maximize v-else :size="14" />
          </AppIconBtn>
        </template>
        <template #actions>
          <span v-if="saveStatus === 'saving'" class="save-indicator saving">Sauvegarde…</span>
          <span v-else-if="saveStatus === 'saved'" class="save-indicator saved">Sauvegardé ✓</span>
          <span v-else-if="saveStatus === 'error'" class="save-indicator error">Erreur</span>
          <AppIconBtn v-if="note" :size="34" title="Historique" @click="showHistory = true">
            <History :size="16" />
          </AppIconBtn>
        </template>
      </AppPageHead>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <div v-else class="editor-wrapper">
      <DrawingCanvas
        ref="canvasRef"
        :strokes="drawingStrokes"
        :readonly="false"
        @update:strokes="onStrokesUpdate"
      />
    </div>

    <JournalHistorySheet
      v-if="note"
      v-model="showHistory"
      type="note"
      :entity-id="note.id"
      :is-drawing="true"
      @restored="load"
    />
  </AppPageLayout>
</template>

<style scoped>
.drawing-view {
  max-width: none !important;
  padding: 0 !important;
}

.lock-icon {
  color: var(--muted);
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

.save-indicator {
  font-size: 0.8rem;
  font-style: italic;
}
.save-indicator.saving { color: var(--muted); }
.save-indicator.saved  { color: var(--accent-strong); }
.save-indicator.error  { color: #c95f56; }
</style>
