<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { BookText, Users, StickyNote, Brush, BookUser, Pencil, BookPlus, History } from "lucide-vue-next";
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
import { useAutosave } from "../composables/useAutosave";
import JournalHistorySheet from "../components/journal/JournalHistorySheet.vue";
import AppIconBtn from "../components/ui/AppIconBtn.vue";
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
const showCompagnieHistory = ref(false);

const {
  lock: compagnieLock,
  content: compagnieSseContent,
  version: compagnieVersion,
  hasLocalEdits: compagnieHasLocalEdits,
  lockLost: compagnieLockLost,
  isLockedByMe: compagnieLockedByMe,
  isLockedByOther: compagnieLockedByOther,
  lockedByName: compagnieLockedByName,
  connectSSE: connectCompagnieSSE,
  acquire: acquireCompagnie,
  ensureLock: ensureCompagnieLock,
  release: releaseCompagnie,
} = useJournalLock(
  "/api/journal/compagnie/events",
  "/api/journal/compagnie/lock",
  "/api/journal/compagnie/lock",
);

/** Dernier contenu qu'on sait identique à celui du serveur. Il sert de
 *  référence pour distinguer « l'utilisateur a tapé » de « on vient de
 *  recevoir/charger du texte » — sans ça, ouvrir la page déclenche une
 *  sauvegarde et vole le verrou à celui qui écrit. */
let compagnieSynced = "";

// Contenu venu des autres. Le composable ne le publie que quand c'est sans risque.
watch(compagnieSseContent, (v) => {
  if (!v || v === compagnieContent.value) return;
  compagnieSynced = v;
  compagnieContent.value = v;
});

const {
  status: compagnieSaveStatus,
  hasPending: compagniePending,
  schedule: scheduleCompagnieSave,
  flush: flushCompagnieSave,
} = useAutosave<string>(async (content) => {
  // Le verrou a pu expirer entre deux frappes (téléphone en veille). On le
  // reprend avant d'écrire au lieu de partir en 423.
  if (!(await ensureCompagnieLock())) {
    throw new Error("verrou indisponible");
  }
  try {
    compagnieVersion.value = await saveJournalCompagnie(content, compagnieVersion.value);
    compagnieSynced = content;
  } catch (e: any) {
    // 409 : quelqu'un a écrit entre-temps. On garde CE QUI EST TAPÉ — sa
    // version n'est pas perdue, elle est dans l'historique — et on rejoue la
    // sauvegarde avec la version à jour.
    if (e?.status === 409) {
      compagnieVersion.value = e.body?.currentVersion ?? null;
      showToast("Quelqu'un a écrit en même temps — sa version est dans l'historique.");
    }
    throw e;
  }
});

// Une seule source de vérité pour « du texte n'est pas encore arrivé au
// serveur » : c'est ce qui protège l'écran et maintient le verrou en vie.
watch(compagniePending, (v) => { compagnieHasLocalEdits.value = v; });

watch(compagnieContent, (v) => {
  if (loading.value || v === compagnieSynced) return;
  if (compagnieLockedByOther.value && !compagnieLockedByMe.value) return;
  scheduleCompagnieSave(v);
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
  await flushCompagnieSave();
  // Tant que du texte n'est pas parti, on garde le verrou : le relâcher
  // laisserait quelqu'un écrire par-dessus ce qui n'est pas encore sauvegardé.
  if (compagniePending.value) return;
  await releaseCompagnie();
}

async function onCompagnieHistoryRestored() {
  await load();
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
    compagnieSynced = compagnie.content;
    compagnieVersion.value = compagnie.version;
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
            <span v-else-if="compagnieLastEditedBy && compagnieUpdatedAt" class="last-edit-info">
              par {{ compagnieLastEditedBy }} · {{ relativeTime(compagnieUpdatedAt) }}
            </span>
            <AppIconBtn title="Historique" @click="showCompagnieHistory = true">
              <History :size="18" />
            </AppIconBtn>
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

        <!-- Une sauvegarde bloquée doit se voir : c'est ce silence qui a fait
             perdre du texte. -->
        <div v-if="compagnieLockLost" class="save-alert">
          {{ compagnieLockedByName ?? "Quelqu'un" }} écrit dans le journal en ce
          moment. Ton texte est conservé et sera renvoyé dès que la place se
          libère. Ne ferme pas la page.
        </div>
        <div v-else-if="compagnieSaveStatus === 'error'" class="save-alert">
          Sauvegarde impossible pour l'instant — ton texte est conservé et sera
          renvoyé automatiquement. Ne ferme pas la page.
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

        <JournalHistorySheet
          v-model="showCompagnieHistory"
          type="journal_compagnie"
          :entity-id="1"
          @restored="onCompagnieHistoryRestored"
        />

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
</style>
