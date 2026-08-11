<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock, Users, Plus, PenLine, MoreVertical, Send, BookUser, Trash2 } from 'lucide-vue-next'
import AppButton from '../ui/AppButton.vue'
import AppInput from '../ui/AppInput.vue'
import AppIconBtn from '../ui/AppIconBtn.vue'
import AppEmptyState from '../ui/AppEmptyState.vue'
import AppBottomSheet from '../ui/AppBottomSheet.vue'
import CodexFormSheet from './CodexFormSheet.vue'
import { createNote, deleteNote, type Note } from '../../api/notes'
import { createPage, deletePage } from '../../api/journal'
import { useJournalLists } from '../../composables/useJournalLists'
import { user } from '../../composables/useAuth'
import { showToast } from '../../composables/useToast'
import { relativeTime } from '../../utils/relativeTime'
import { plainExcerpt } from '../../utils/noteMarkdown'

const props = withDefaults(defineProps<{ kind?: 'text' | 'drawing' }>(), { kind: 'text' })
const isDrawing = computed(() => props.kind === 'drawing')

const router = useRouter()
const route = useRoute()

type Filter = 'private' | 'shared'
const filter = ref<Filter>(route.query.filter === 'shared' ? 'shared' : 'private')

// ── Notes privées ────────────────────────────────────────────────────────────

const { notes, notesLoading, pages, pagesLoading, loadNotes, loadPages } = useJournalLists()

// Les listes sont globales (partagées entre onglets) : chaque onglet filtre par type.
const visibleNotes = computed(() => notes.value.filter((n) => n.type === props.kind))
const visiblePages = computed(() => pages.value.filter((p) => p.type === props.kind))

const noteRoute = computed(() => (isDrawing.value ? 'journal-dessin' : 'journal-note'))

async function handleCreateNote() {
  try {
    const note = await createNote({ type: props.kind })
    router.push({ name: noteRoute.value, params: { id: note.id } })
  } catch {
    showToast('Erreur lors de la création.')
  }
}

function openNote(id: number) {
  router.push({ name: noteRoute.value, params: { id } })
}

// ── Menu ⋮ d'une note ────────────────────────────────────────────────────────

const menuNote = ref<Note | null>(null)
const showMenu = ref(false)

function openMenu(note: Note) {
  menuNote.value = note
  showMenu.value = true
}

async function handlePublish() {
  const note = menuNote.value
  if (!note) return
  showMenu.value = false
  // Optimistic: remove from private list right away
  notes.value = notes.value.filter((n) => n.id !== note.id)
  try {
    const page = await createPage(note.title.trim() || 'Sans titre', note.content, props.kind)
    await deleteNote(note.id)
    await loadPages()
    showToast(isDrawing.value ? 'Dessin publié' : 'Note publiée', {
      actionLabel: 'Annuler',
      onAction: async () => {
        // Optimistic : la page disparaît de la liste partagée tout de suite
        pages.value = pages.value.filter((p) => p.id !== page.id)
        try {
          const recreated = await createNote({ title: note.title, content: note.content, type: props.kind })
          notes.value = [recreated, ...notes.value]
          await deletePage(page.id)
        } catch {
          await Promise.all([loadNotes(), loadPages()])
          showToast("Impossible d'annuler la publication.")
        }
      },
    })
  } catch {
    await loadNotes()
    showToast('Erreur lors de la publication.')
  }
}

async function handleDelete() {
  const note = menuNote.value
  if (!note) return
  showMenu.value = false
  notes.value = notes.value.filter((n) => n.id !== note.id)
  try {
    await deleteNote(note.id)
    showToast(isDrawing.value ? 'Dessin supprimé' : 'Note supprimée', {
      actionLabel: 'Annuler',
      onAction: async () => {
        try {
          const recreated = await createNote({ title: note.title, content: note.content, type: props.kind })
          notes.value = [recreated, ...notes.value]
        } catch {
          showToast("Impossible de restaurer la note.")
        }
      },
    })
  } catch {
    await loadNotes()
    showToast('Erreur lors de la suppression.')
  }
}

// ── Convertir en fiche ───────────────────────────────────────────────────────

const showConvert = ref(false)
const convertNote = ref<Note | null>(null)

function handleConvert() {
  const note = menuNote.value
  if (!note) return
  if (!user.value?.activeCampaignId) {
    showMenu.value = false
    showToast('Rejoins une campagne pour créer des fiches.')
    return
  }
  showMenu.value = false
  convertNote.value = note
  showConvert.value = true
}

async function onConverted(_entry: unknown, opts: { deleteNote: boolean }) {
  const note = convertNote.value
  if (!note) return
  if (!opts.deleteNote) {
    showToast('Fiche créée')
    return
  }
  notes.value = notes.value.filter((n) => n.id !== note.id)
  try {
    await deleteNote(note.id)
    showToast('Fiche créée · Note supprimée', {
      actionLabel: 'Annuler',
      onAction: async () => {
        try {
          const recreated = await createNote({ title: note.title, content: note.content })
          notes.value = [recreated, ...notes.value]
        } catch {
          showToast("Impossible de restaurer la note.")
        }
      },
    })
  } catch {
    await loadNotes()
    showToast('Fiche créée, mais erreur en supprimant la note.')
  }
}

// ── Pages partagées ──────────────────────────────────────────────────────────

function openPage(id: number) {
  router.push({ name: 'journal-page', params: { id } })
}

const showNewPage = ref(false)
const newPageTitle = ref('')
const creatingPage = ref(false)

async function handleCreatePage() {
  if (!newPageTitle.value.trim() || creatingPage.value) return
  creatingPage.value = true
  try {
    const page = await createPage(newPageTitle.value.trim(), undefined, props.kind)
    newPageTitle.value = ''
    showNewPage.value = false
    router.push({ name: 'journal-page', params: { id: page.id } })
  } catch {
    showToast('Erreur lors de la création.')
  } finally {
    creatingPage.value = false
  }
}

onMounted(() => {
  loadNotes()
  loadPages()
})
</script>

<template>
  <div class="notes-tab">
    <div class="notes-toolbar">
      <div class="filter-chips">
        <button class="chip" :class="{ active: filter === 'private' }" @click="filter = 'private'">
          <Lock :size="13" />
          {{ isDrawing ? 'Privés' : 'Privées' }}
        </button>
        <button class="chip" :class="{ active: filter === 'shared' }" @click="filter = 'shared'">
          <Users :size="13" />
          {{ isDrawing ? 'Partagés' : 'Partagées' }}
        </button>
      </div>
      <AppIconBtn
        v-if="filter === 'private'"
        variant="primary"
        :title="isDrawing ? 'Nouveau dessin' : 'Nouvelle note'"
        @click="handleCreateNote"
      >
        <Plus :size="18" />
      </AppIconBtn>
      <AppIconBtn
        v-else
        variant="primary"
        :title="isDrawing ? 'Nouveau dessin partagé' : 'Nouvelle page partagée'"
        @click="showNewPage = !showNewPage"
      >
        <Plus :size="18" />
      </AppIconBtn>
    </div>

    <!-- ── Privées ── -->
    <template v-if="filter === 'private'">
      <AppEmptyState v-if="notesLoading" variant="loading">Chargement…</AppEmptyState>
      <AppEmptyState v-else-if="!visibleNotes.length">
        {{ isDrawing
          ? 'Aucun dessin privé. Appuie sur + pour esquisser ton premier dessin.'
          : 'Aucune note privée. Appuie sur + pour griffonner ta première note.' }}
      </AppEmptyState>
      <ul v-else class="note-list">
        <li v-for="note in visibleNotes" :key="note.id" class="note-item" @click="openNote(note.id)">
          <span class="note-icon"><Lock :size="16" /></span>
          <div class="note-info">
            <span class="note-title">{{ note.title.trim() || 'Sans titre' }}</span>
            <span v-if="!isDrawing && plainExcerpt(note.content)" class="note-excerpt">{{ plainExcerpt(note.content) }}</span>
            <span class="note-meta">{{ relativeTime(note.updatedAt) }}</span>
          </div>
          <AppIconBtn :size="34" title="Actions" @click.stop="openMenu(note)">
            <MoreVertical :size="16" />
          </AppIconBtn>
        </li>
      </ul>
    </template>

    <!-- ── Partagées ── -->
    <template v-else>
      <form v-if="showNewPage" class="new-page-form" @submit.prevent="handleCreatePage">
        <AppInput
          v-model="newPageTitle"
          placeholder="Titre de la page"
          :required="true"
          :autofocus="true"
          class="new-page-input"
        />
        <AppButton variant="primary" type="submit" :disabled="creatingPage">Créer</AppButton>
        <AppButton @click="showNewPage = false">Annuler</AppButton>
      </form>

      <AppEmptyState v-if="pagesLoading" variant="loading">Chargement…</AppEmptyState>
      <AppEmptyState v-else-if="!visiblePages.length">
        {{ isDrawing ? 'Aucun dessin partagé pour le moment.' : 'Aucune note partagée pour le moment.' }}
      </AppEmptyState>
      <ul v-else class="note-list">
        <li v-for="page in visiblePages" :key="page.id" class="note-item" @click="openPage(page.id)">
          <span class="note-icon">
            <PenLine v-if="page.type === 'drawing'" :size="16" />
            <Users v-else :size="16" />
          </span>
          <div class="note-info">
            <span class="note-title">{{ page.title }}</span>
            <span class="note-meta">
              par {{ page.createdByCharacterName }} · {{ relativeTime(page.updatedAt) }}
            </span>
          </div>
        </li>
      </ul>
    </template>

    <!-- ── Menu ⋮ (bottom sheet) ── -->
    <AppBottomSheet v-model="showMenu" :title="menuNote?.title.trim() || 'Sans titre'">
      <div class="menu-actions">
        <button class="menu-action" @click="handlePublish">
          <Send :size="18" />
          <span>Publier pour le groupe</span>
        </button>
        <button v-if="!isDrawing" class="menu-action" @click="handleConvert">
          <BookUser :size="18" />
          <span>Convertir en fiche</span>
        </button>
        <button class="menu-action menu-action--danger" @click="handleDelete">
          <Trash2 :size="18" />
          <span>Supprimer</span>
        </button>
      </div>
    </AppBottomSheet>

    <!-- ── Convertir en fiche ── -->
    <CodexFormSheet
      v-if="!isDrawing && user?.activeCampaignId"
      v-model="showConvert"
      :campaign-id="user.activeCampaignId"
      :prefill-name="convertNote?.title.trim() || ''"
      :prefill-description="convertNote?.content ?? ''"
      :convert-mode="true"
      @saved="onConverted"
    />
  </div>
</template>

<style scoped>
.notes-tab {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.notes-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.6rem;
  flex-shrink: 0;
}

.filter-chips {
  display: flex;
  gap: 0.35rem;
}

.chip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, color 120ms, border-color 120ms;
}

.chip:hover {
  color: var(--text);
  border-color: var(--accent);
}

.chip.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

/* ── Listes ── */

.note-list {
  list-style: none;
  margin: 0;
  padding: 0 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
}

.note-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 120ms, background 120ms;
}

.note-item:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}

.note-icon {
  color: var(--muted);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.note-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.note-title {
  font-weight: 600;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-excerpt {
  font-size: 0.83rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-meta {
  font-size: 0.76rem;
  color: var(--muted);
}

/* ── Nouvelle page ── */

.new-page-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.6rem;
  flex-wrap: wrap;
}

.new-page-input {
  flex: 1;
  min-width: 140px;
}

/* ── Menu bottom sheet ── */

.menu-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.menu-action {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 0.6rem;
  border: none;
  border-radius: 10px;
  background: none;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background 120ms;
}

.menu-action:hover {
  background: var(--surface-2);
}

.menu-action--danger {
  color: #c95f56;
}
</style>
