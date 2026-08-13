<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { BookText, Users, StickyNote, Brush, BookUser, Pencil, BookPlus } from "lucide-vue-next";
import AppPageLayout from "../components/ui/AppPageLayout.vue";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppButton from "../components/ui/AppButton.vue";
import AppInput from "../components/ui/AppInput.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import AppBottomSheet from "../components/ui/AppBottomSheet.vue";
import AppTabs from "../components/ui/AppTabs.vue";
import NotesTab from "../components/journal/NotesTab.vue";
import MentionTextarea from "../components/journal/MentionTextarea.vue";
import CodexTab from "../components/journal/CodexTab.vue";
import {
  fetchJournalCompagnie,
  saveJournalCompagnie,
  createPage,
} from "../api/journal";
import { useJournalLock } from "../composables/useJournalLock";
import { showToast } from "../composables/useToast";
import { relativeTime } from "../utils/relativeTime";

const route = useRoute();

type Tab = "compagnie" | "notes" | "dessins" | "fiches";
const initialTab = ["compagnie", "notes", "dessins", "fiches"].includes(String(route.query.tab))
  ? (String(route.query.tab) as Tab)
  : "compagnie";
const activeTab = ref<Tab>(initialTab);

const TABS = [
  { value: "compagnie", label: "Journal de bord", icon: Users },
  { value: "notes", label: "Notes", icon: StickyNote },
  { value: "dessins", label: "Dessins", icon: Brush },
  { value: "fiches", label: "Fiches", icon: BookUser },
];

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
    showToast("Page sauvegardée");
  } catch {
    showToast("Erreur lors de la sauvegarde.");
  } finally {
    savingPage.value = false;
  }
}

// ── Loading ──────────────────────────────────────────────────────────────────

const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const compagnie = await fetchJournalCompagnie();
    compagnieContent.value = compagnie.content;
    compagnieLastEditedBy.value = compagnie.lastEditedBy;
    compagnieUpdatedAt.value = compagnie.updatedAt;
    if (compagnie.lock) compagnieLock.value = compagnie.lock;
    connectCompagnieSSE();
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
        </template>
      </AppPageHead>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <template v-else>
      <AppTabs
        class="journal-tabs"
        :model-value="activeTab"
        :tabs="TABS"
        :icon-only-mobile="true"
        @update:model-value="activeTab = $event as Tab"
      />

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
          <MentionTextarea
            v-model="compagnieContent"
            :readonly="compagnieLockedByOther"
            placeholder="Le journal de la compagnie, visible et éditable par tous… Tape @ pour mentionner."
            @focus="onCompagnieFocus"
            @blur="onCompagnieBlur"
          />
        </div>

        <!-- Save as page sheet -->
        <AppBottomSheet v-model="showSaveAsPage" title="Sauvegarder en page">
          <p class="modal-hint">Le contenu actuel du journal sera copié dans une nouvelle page.</p>
          <form class="save-as-page-form" @submit.prevent="handleSaveAsPage">
            <AppInput
              v-model="saveAsPageTitle"
              placeholder="Titre de la page (ex: Session 1)"
              :required="true"
              :autofocus="true"
            />
            <AppButton variant="primary" type="submit" :disabled="savingPage" :block="true">
              {{ savingPage ? "Sauvegarde…" : "Sauvegarder" }}
            </AppButton>
          </form>
        </AppBottomSheet>
      </div>

      <!-- ── Notes ── -->
      <NotesTab v-if="activeTab === 'notes'" class="tab-content" />

      <!-- ── Dessins ── -->
      <NotesTab v-if="activeTab === 'dessins'" kind="drawing" class="tab-content" />

      <!-- ── Fiches ── -->
      <CodexTab v-if="activeTab === 'fiches'" class="tab-content" />
    </template>
  </AppPageLayout>
</template>

<style scoped>

.journal-tabs {
  margin: 0.5rem 0;
  flex-shrink: 0;
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

/* ── Toolbar ── */

.compagnie-toolbar {
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
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.last-edit-info {
  font-size: 0.78rem;
  color: var(--muted);
  font-style: italic;
}

/* ── Save as page sheet ── */

.modal-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.save-as-page-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Misc ── */

.save-indicator {
  font-size: 0.8rem;
  font-style: italic;
}
.save-indicator.saving { color: var(--muted); }
.save-indicator.saved  { color: var(--accent-strong); }
.save-indicator.error  { color: #c95f56; }
</style>
