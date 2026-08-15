<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Lock, Send, BookOpen, History } from "lucide-vue-next";
import AppPageLayout from "../components/ui/AppPageLayout.vue";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppButton from "../components/ui/AppButton.vue";
import AppIconBtn from "../components/ui/AppIconBtn.vue";
import AppInput from "../components/ui/AppInput.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import MentionTextarea from "../components/journal/MentionTextarea.vue";
import NoteContent from "../components/journal/NoteContent.vue";
import MentionSheet from "../components/journal/MentionSheet.vue";
import { fetchNotes, updateNote, deleteNote, createNote, type Note } from "../api/notes";
import { createPage, deletePage } from "../api/journal";
import { useJournalLists } from "../composables/useJournalLists";
import { useAutosave } from "../composables/useAutosave";
import JournalHistorySheet from "../components/journal/JournalHistorySheet.vue";
import { showToast } from "../composables/useToast";
import type { MentionKind } from "../utils/mentions";

const route = useRoute();
const router = useRouter();
const noteId = computed(() => Number(route.params.id));
const { notes: journalNotes, pages: journalPages } = useJournalLists();

const note = ref<Note | null>(null);
const title = ref("");
const content = ref("");
const loading = ref(true);
const error = ref<string | null>(null);
const showHistory = ref(false);

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

function goBack() {
  router.push({ name: "journal", query: { tab: "notes" } });
}

// ── Mode lecture / édition ───────────────────────────────────────────────────

const editing = ref(false);
const editorRef = ref<InstanceType<typeof MentionTextarea> | null>(null);

function startEditing() {
  editing.value = true;
  nextTick(() => editorRef.value?.focusEnd());
}

function stopEditing() {
  editing.value = false;
  void saveNow();
}

// ── Mention cliquée ──────────────────────────────────────────────────────────

const showMention = ref(false);
const mentionKind = ref<MentionKind | null>(null);
const mentionId = ref<number | null>(null);

function onMention(kind: MentionKind, id: number) {
  mentionKind.value = kind;
  mentionId.value = id;
  showMention.value = true;
}

// ── Publier ──────────────────────────────────────────────────────────────────

const publishing = ref(false);

async function handlePublish() {
  if (publishing.value || !note.value) return;
  const currentId = note.value.id;
  publishing.value = true;
  const savedTitle = title.value;
  const savedContent = content.value;
  try {
    const page = await createPage(savedTitle.trim() || "Sans titre", savedContent, "text");
    await deleteNote(currentId);
    router.push({ name: "journal", query: { tab: "notes", filter: "shared" } });
    showToast("Note publiée", {
      actionLabel: "Annuler",
      onAction: async () => {
        // Optimistic : la page disparaît de la liste partagée tout de suite
        journalPages.value = journalPages.value.filter((p) => p.id !== page.id);
        try {
          const recreated = await createNote({ title: savedTitle, content: savedContent });
          // Mise à jour immédiate de la liste privée affichée par NotesTab
          journalNotes.value = [recreated, ...journalNotes.value];
          await deletePage(page.id);
          router.push({ name: "journal", query: { tab: "notes" } });
        } catch {
          showToast("Impossible d'annuler la publication.");
        }
      },
    });
  } catch {
    showToast("Erreur lors de la publication.");
    publishing.value = false;
  }
}

// ── Chargement ───────────────────────────────────────────────────────────────

async function load() {
  loading.value = true;
  try {
    const notes = await fetchNotes();
    const found = notes.find((n) => n.id === noteId.value);
    if (!found) {
      error.value = "Note introuvable.";
    } else {
      note.value = found;
      title.value = found.title;
      content.value = found.content;
      // Note vide : on démarre directement en édition
      if (!found.content.trim()) editing.value = true;
    }
  } catch {
    error.value = "Impossible de charger la note.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

onBeforeUnmount(() => {
  // Flush pending save when leaving
  if (!publishing.value) void saveNow();
});
</script>

<template>
  <AppPageLayout mode="full" width="wide">
    <template #top-bar>
      <AppPageHead>
        <AppIconBtn title="Retour" @click="goBack">
          <ArrowLeft :size="18" />
        </AppIconBtn>
        <Lock :size="18" class="lock-icon" />
        Note privée
        <template #actions>
          <span v-if="saveStatus === 'saving'" class="save-indicator saving">Sauvegarde…</span>
          <span v-else-if="saveStatus === 'saved'" class="save-indicator saved">Sauvegardé ✓</span>
          <span v-else-if="saveStatus === 'error'" class="save-indicator error">Erreur</span>
          <AppIconBtn v-if="note" :size="34" title="Historique" @click="showHistory = true">
            <History :size="16" />
          </AppIconBtn>
          <AppIconBtn
            v-if="note && editing"
            :size="34"
            title="Mode lecture"
            @click="stopEditing"
          >
            <BookOpen :size="16" />
          </AppIconBtn>
          <AppButton
            v-if="note"
            variant="primary"
            size="small"
            :disabled="publishing"
            @click="handlePublish"
          >
            <Send :size="14" />
            Publier
          </AppButton>
        </template>
      </AppPageHead>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <div v-else class="note-editor">
      <template v-if="editing">
        <AppInput v-model="title" placeholder="Titre de la note" class="note-title-input" />
        <MentionTextarea
          ref="editorRef"
          v-model="content"
          placeholder="Griffonne ici… personne d'autre ne le verra. Tape @ pour mentionner."
        />
      </template>
      <template v-else>
        <h2 class="note-read-title" @click="startEditing">{{ title.trim() || "Sans titre" }}</h2>
        <NoteContent
          v-if="content.trim()"
          :content="content"
          :editable="true"
          @mention="onMention"
          @edit="startEditing"
        />
        <button v-else type="button" class="empty-editor" @click="startEditing">
          Note vide. Touche ici pour écrire.
        </button>
      </template>
    </div>

    <MentionSheet v-model="showMention" :kind="mentionKind" :id="mentionId" />

    <JournalHistorySheet
      v-if="note"
      v-model="showHistory"
      type="note"
      :entity-id="note.id"
      @restored="load"
    />
  </AppPageLayout>
</template>

<style scoped>
.lock-icon {
  color: var(--muted);
}

.note-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-height: 0;
  padding-bottom: 0.75rem;
}

.note-title-input {
  width: 100%;
  font-weight: 600;
}

.note-read-title {
  margin: 0;
  font-size: 1.25rem;
  font-family: var(--title-font);
  color: var(--accent-strong);
  cursor: text;
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

.save-indicator {
  font-size: 0.8rem;
  font-style: italic;
}
.save-indicator.saving { color: var(--muted); }
.save-indicator.saved  { color: var(--accent-strong); }
.save-indicator.error  { color: #c95f56; }
</style>
