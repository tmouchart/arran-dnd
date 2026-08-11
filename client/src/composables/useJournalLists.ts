import { ref } from 'vue'
import { fetchNotes, type Note } from '../api/notes'
import { fetchPages, type JournalPageSummary } from '../api/journal'

// État partagé (niveau module) : NotesTab et NoteEditView voient les mêmes listes.
// Un undo déclenché depuis un toast met donc à jour la liste affichée immédiatement.
const notes = ref<Note[]>([])
const notesLoading = ref(true)
const pages = ref<JournalPageSummary[]>([])
const pagesLoading = ref(true)

export function useJournalLists() {
  async function loadNotes() {
    try {
      notes.value = await fetchNotes()
    } catch { /* ignore */ }
    notesLoading.value = false
  }

  async function loadPages() {
    try {
      pages.value = await fetchPages()
    } catch { /* ignore */ }
    pagesLoading.value = false
  }

  return { notes, notesLoading, pages, pagesLoading, loadNotes, loadPages }
}
