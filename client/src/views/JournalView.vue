<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { BookText, Lock, Users, FileText, Pencil, BookPlus, Plus, PenLine } from "lucide-vue-next";
import AppPageLayout from "../components/ui/AppPageLayout.vue";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppButton from "../components/ui/AppButton.vue";
import AppInput from "../components/ui/AppInput.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import {
  fetchNotesPerso,
  saveNotesPerso,
  fetchJournalCompagnie,
  saveJournalCompagnie,
  fetchPages,
  createPage,
  type JournalPageSummary,
  type JournalPageType,
} from "../api/journal";
import { useJournalLock } from "../composables/useJournalLock";
import { relativeTime } from "../utils/relativeTime";

const router = useRouter();

type Tab = "compagnie" | "pages" | "perso";
const activeTab = ref<Tab>("compagnie");

// ── Notes perso ──────────────────────────────────────────────────────────────

const persoContent = ref("");
const persoSaveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
let persoDebounce: ReturnType<typeof setTimeout> | null = null;

function schedulePersoSave(content: string) {
  if (persoDebounce) clearTimeout(persoDebounce);
  persoSaveStatus.value = "saving";
  persoDebounce = setTimeout(async () => {
    try {
      await saveNotesPerso(content);
      persoSaveStatus.value = "saved";
      setTimeout(() => { persoSaveStatus.value = "idle"; }, 2000);
    } catch {
      persoSaveStatus.value = "error";
    }
  }, 800);
}

watch(persoContent, (v) => { if (!loading.value) schedulePersoSave(v); });

// ── Journal compagnie (live) ─────────────────────────────────────────────────

const compagnieContent = ref("");
const compagnieLastEditedBy = ref<string | null>(null);
const compagnieUpdatedAt = ref<string | null>(null);
const compagnieSaveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
let compagnieDebounce: ReturnType<typeof setTimeout> | null = null;

const {
  lock: compagnieLock,
  content: compagnieSseContent,
  isLockedByMe: compagnieLockedByMe,
  isLockedByOther: compagnieLockedByOther,
  lockedByName: compagnieLockedByName,
  connectSSE: connectCompagnieSSE,
  acquire: acquireCompagnie,
  release: releaseCompagnie,
} = useJournalLock(
  "/api/journal/compagnie/events",
  "/api/journal/compagnie/lock",
  "/api/journal/compagnie/lock",
);

// SSE content updates (from other users)
watch(compagnieSseContent, (v) => {
  if (v && !compagnieLockedByMe.value) {
    compagnieContent.value = v;
  }
});

function scheduleCompagnieSave(content: string) {
  if (compagnieDebounce) clearTimeout(compagnieDebounce);
  compagnieSaveStatus.value = "saving";
  compagnieDebounce = setTimeout(async () => {
    try {
      await saveJournalCompagnie(content);
      compagnieSaveStatus.value = "saved";
      setTimeout(() => { compagnieSaveStatus.value = "idle"; }, 2000);
    } catch {
      compagnieSaveStatus.value = "error";
    }
  }, 800);
}

watch(compagnieContent, (v) => {
  if (!loading.value && compagnieLockedByMe.value) scheduleCompagnieSave(v);
});

let acquiringCompagnie = false;
async function onCompagnieFocus() {
  if (compagnieLockedByMe.value || compagnieLockedByOther.value || acquiringCompagnie) return;
  acquiringCompagnie = true;
  await acquireCompagnie();
  acquiringCompagnie = false;
}

async function onCompagnieBlur() {
  if (!compagnieLockedByMe.value) return;
  // Flush pending save before releasing
  if (compagnieDebounce) {
    clearTimeout(compagnieDebounce);
    compagnieDebounce = null;
    try { await saveJournalCompagnie(compagnieContent.value); } catch { /* best effort */ }
  }
  await releaseCompagnie();
}

// ── Save as page ─────────────────────────────────────────────────────────────

const showSaveAsPage = ref(false);
const saveAsPageTitle = ref("");
const savingPage = ref(false);

async function handleSaveAsPage() {
  if (!saveAsPageTitle.value.trim()) return;
  savingPage.value = true;
  try {
    await createPage(saveAsPageTitle.value.trim(), compagnieContent.value);
    showSaveAsPage.value = false;
    saveAsPageTitle.value = "";
    await loadPages();
  } catch {
    alert("Erreur lors de la sauvegarde.");
  } finally {
    savingPage.value = false;
  }
}

// ── Pages list ───────────────────────────────────────────────────────────────

const pages = ref<JournalPageSummary[]>([]);
const pagesLoading = ref(false);

async function loadPages() {
  pagesLoading.value = true;
  try {
    pages.value = await fetchPages();
  } catch { /* ignore */ }
  pagesLoading.value = false;
}

function openPage(id: number) {
  router.push({ name: "journal-page", params: { id } });
}

const showNewPage = ref(false);
const newPageTitle = ref("");
const newPageType = ref<JournalPageType>("text");
const creatingPage = ref(false);

async function handleCreatePage() {
  if (!newPageTitle.value.trim()) return;
  creatingPage.value = true;
  try {
    const page = await createPage(newPageTitle.value.trim(), undefined, newPageType.value);
    newPageTitle.value = "";
    newPageType.value = "text";
    showNewPage.value = false;
    router.push({ name: "journal-page", params: { id: page.id } });
  } catch {
    alert("Erreur lors de la création.");
  } finally {
    creatingPage.value = false;
  }
}

// ── Loading ──────────────────────────────────────────────────────────────────

const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [perso, compagnie] = await Promise.all([
      fetchNotesPerso(),
      fetchJournalCompagnie(),
    ]);
    persoContent.value = perso;
    compagnieContent.value = compagnie.content;
    compagnieLastEditedBy.value = compagnie.lastEditedBy;
    compagnieUpdatedAt.value = compagnie.updatedAt;
    if (compagnie.lock) compagnieLock.value = compagnie.lock;
    connectCompagnieSSE();
    await loadPages();
  } catch {
    error.value = "Impossible de charger le journal.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AppPageLayout mode="full" width="wide">
    <template #top-bar>
      <AppPageHead>
        <BookText :size="22" />
        Journal
        <template #actions>
          <!-- Save status for active tab -->
          <template v-if="activeTab === 'compagnie'">
            <span v-if="compagnieSaveStatus === 'saving'" class="save-indicator saving">Sauvegarde…</span>
            <span v-else-if="compagnieSaveStatus === 'saved'" class="save-indicator saved">Sauvegardé ✓</span>
            <span v-else-if="compagnieSaveStatus === 'error'" class="save-indicator error">Erreur</span>
            <span v-else-if="compagnieLastEditedBy && compagnieUpdatedAt" class="last-edit-info">
              par {{ compagnieLastEditedBy }} · {{ relativeTime(compagnieUpdatedAt) }}
            </span>
          </template>
          <template v-if="activeTab === 'perso'">
            <span v-if="persoSaveStatus === 'saving'" class="save-indicator saving">Sauvegarde…</span>
            <span v-else-if="persoSaveStatus === 'saved'" class="save-indicator saved">Sauvegardé ✓</span>
            <span v-else-if="persoSaveStatus === 'error'" class="save-indicator error">Erreur</span>
          </template>
        </template>
      </AppPageHead>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <template v-else>
      <nav class="tab-bar">
        <button class="tab-btn" :class="{ active: activeTab === 'compagnie' }" @click="activeTab = 'compagnie'">
          <Users :size="15" />
          <span class="tab-text">Journal de bord</span>
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'pages' }" @click="activeTab = 'pages'">
          <FileText :size="15" />
          <span class="tab-text">Pages</span>
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'perso' }" @click="activeTab = 'perso'">
          <Lock :size="15" />
          <span class="tab-text">Notes perso</span>
        </button>
      </nav>

      <!-- ── Journal de bord ── -->
      <div v-if="activeTab === 'compagnie'" class="tab-content">
        <div class="compagnie-toolbar">
          <span v-if="compagnieLockedByOther" class="lock-badge">
            <Pencil :size="13" />
            En cours d'édition par {{ compagnieLockedByName }}
          </span>

          <AppButton size="small" @click="showSaveAsPage = true">
            <BookPlus :size="14" />
            Sauvegarder en page
          </AppButton>
        </div>

        <div class="editor-wrapper">
          <textarea
            v-model="compagnieContent"
            class="journal-editor"
            :class="{ 'journal-editor--readonly': compagnieLockedByOther }"
            :readonly="compagnieLockedByOther"
            placeholder="Le journal de la compagnie, visible et éditable par tous…"
            spellcheck="true"
            @focus="onCompagnieFocus"
            @blur="onCompagnieBlur"
          />
        </div>

        <!-- Save as page modal -->
        <Teleport to="body">
          <div v-if="showSaveAsPage" class="modal-backdrop" @click.self="showSaveAsPage = false">
            <div class="modal-box">
              <h3 class="modal-title">Sauvegarder en page</h3>
              <p class="modal-hint">Le contenu actuel du journal sera copié dans une nouvelle page.</p>
              <form @submit.prevent="handleSaveAsPage">
                <AppInput
                  v-model="saveAsPageTitle"
                  placeholder="Titre de la page (ex: Session 1)"
                  :required="true"
                  :autofocus="true"
                  class="modal-input"
                />
                <div class="modal-actions">
                  <AppButton variant="primary" type="submit" :disabled="savingPage">
                    {{ savingPage ? "Sauvegarde…" : "Sauvegarder" }}
                  </AppButton>
                  <AppButton @click="showSaveAsPage = false">Annuler</AppButton>
                </div>
              </form>
            </div>
          </div>
        </Teleport>
      </div>

      <!-- ── Pages ── -->
      <div v-if="activeTab === 'pages'" class="tab-content">
        <div class="pages-toolbar">
          <AppButton size="small" @click="showNewPage = true">
            <Plus :size="14" />
            Nouvelle page
          </AppButton>
        </div>

        <!-- New page inline form -->
        <form v-if="showNewPage" class="new-page-form" @submit.prevent="handleCreatePage">
          <div class="type-toggle">
            <button type="button" class="type-btn" :class="{ active: newPageType === 'text' }" @click="newPageType = 'text'">
              <FileText :size="15" /> Texte
            </button>
            <button type="button" class="type-btn" :class="{ active: newPageType === 'drawing' }" @click="newPageType = 'drawing'">
              <PenLine :size="15" /> Dessin
            </button>
          </div>
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
        <ul v-else-if="pages.length" class="pages-list">
          <li v-for="page in pages" :key="page.id" class="page-item" @click="openPage(page.id)">
            <span class="page-type-icon">
              <PenLine v-if="page.type === 'drawing'" :size="16" />
              <FileText v-else :size="16" />
            </span>
            <div class="page-info">
              <span class="page-title">{{ page.title }}</span>
              <span class="page-meta">
                par {{ page.createdByCharacterName }} · {{ relativeTime(page.updatedAt) }}
              </span>
            </div>
          </li>
        </ul>
        <p v-else class="muted">Aucune page sauvegardée.</p>
      </div>

      <!-- ── Notes perso ── -->
      <div v-if="activeTab === 'perso'" class="tab-content editor-wrapper">
        <textarea
          v-model="persoContent"
          class="journal-editor"
          placeholder="Tes notes personnelles, secrètes et privées…"
          spellcheck="true"
        />
      </div>
    </template>
  </AppPageLayout>
</template>

<style scoped>

.tab-bar {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0;
  flex-shrink: 0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 120ms, color 120ms, border-color 120ms;
}

.tab-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}

.tab-btn.active {
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

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
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

/* ── Toolbar ── */

.compagnie-toolbar,
.pages-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  flex-shrink: 0;
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

/* ── Pages list ── */

.new-page-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  flex-wrap: wrap;
}

.type-toggle {
  display: flex;
  gap: 0.25rem;
}

.type-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, color 120ms, border-color 120ms;
}

.type-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}

.type-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.new-page-input {
  flex: 1;
}

.pages-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.page-type-icon {
  color: var(--muted);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.page-item {
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

.page-item:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}

.page-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.page-title {
  font-weight: 600;
  font-size: 0.95rem;
}

.page-meta {
  font-size: 0.78rem;
  color: var(--muted);
}

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

.modal-input {
  width: 100%;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/* ── Misc ── */

.save-indicator {
  font-size: 0.8rem;
  font-style: italic;
}
.save-indicator.saving { color: var(--muted); }
.save-indicator.saved  { color: var(--accent-strong); }
.save-indicator.error  { color: #c95f56; }

.muted { color: var(--muted); font-size: 0.9rem; margin: 0; padding: 1rem 0; }
</style>
