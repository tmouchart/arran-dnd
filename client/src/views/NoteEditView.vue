<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Lock, Send, Pencil, BookOpen } from "lucide-vue-next";
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
const saveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
let debounce: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (debounce) clearTimeout(debounce);
  saveStatus.value = "saving";
  debounce = setTimeout(saveNow, 800);
}

async function saveNow() {
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
  // note.value.id, pas noteId : au flush de depart de page, la route a deja change
  if (!note.value) return;
  try {
    await updateNote(note.value.id, { title: title.value, content: content.value });
    saveStatus.value = "saved";
    setTimeout(() => { saveStatus.value = "idle"; }, 2000);
  } catch {
    saveStatus.value = "error";
  }
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
  nextTick(() => editorRef.value?.focus());
}

function stopEditing() {
  editing.value = false;
  if (debounce) saveNow();
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

onMounted(async () => {
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
});

onBeforeUnmount(() => {
  // Flush pending save when leaving
  if (debounce && !publishing.value) saveNow();
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
          <AppIconBtn
            v-if="note && !editing"
            :size="34"
            title="Modifier"
            @click="startEditing"
          >
            <Pencil :size="16" />
          </AppIconBtn>
          <AppIconBtn
            v-else-if="note"
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
        <NoteContent v-if="content.trim()" :content="content" @mention="onMention" />
        <AppEmptyState v-else>Note vide. Appuie sur le crayon pour écrire.</AppEmptyState>
      </template>
    </div>

    <MentionSheet v-model="showMention" :kind="mentionKind" :id="mentionId" />
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
}

.save-indicator {
  font-size: 0.8rem;
  font-style: italic;
}
.save-indicator.saving { color: var(--muted); }
.save-indicator.saved  { color: var(--accent-strong); }
.save-indicator.error  { color: #c95f56; }
</style>
