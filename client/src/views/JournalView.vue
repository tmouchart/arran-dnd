<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { BookText, Lock, Users } from "lucide-vue-next";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import {
  fetchNotesPerso,
  saveNotesPerso,
  fetchJournalCompagnie,
  saveJournalCompagnie,
} from "../api/journal";

type Tab = "perso" | "compagnie";
const activeTab = ref<Tab>("perso");

const persoContent = ref("");
const compagnieContent = ref("");
const loading = ref(true);
const error = ref<string | null>(null);
const saveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");

let debounce: ReturnType<typeof setTimeout> | null = null;

async function load() {
  loading.value = true;
  error.value = null;
  try {
    [persoContent.value, compagnieContent.value] = await Promise.all([
      fetchNotesPerso(),
      fetchJournalCompagnie(),
    ]);
  } catch {
    error.value = "Impossible de charger le journal.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function scheduleSave(tab: Tab, content: string) {
  if (debounce) clearTimeout(debounce);
  saveStatus.value = "saving";
  debounce = setTimeout(async () => {
    try {
      if (tab === "perso") await saveNotesPerso(content);
      else await saveJournalCompagnie(content);
      saveStatus.value = "saved";
      setTimeout(() => { saveStatus.value = "idle"; }, 2000);
    } catch {
      saveStatus.value = "error";
    }
  }, 800);
}

watch(persoContent, (v) => { if (!loading.value) scheduleSave("perso", v); });
watch(compagnieContent, (v) => { if (!loading.value) scheduleSave("compagnie", v); });
</script>

<template>
  <div class="journal-page">
    <AppPageHead>
      <BookText :size="22" />
      Journal
      <template #actions>
        <span v-if="saveStatus === 'saving'" class="save-indicator saving">Sauvegarde…</span>
        <span v-else-if="saveStatus === 'saved'" class="save-indicator saved">Sauvegardé ✓</span>
        <span v-else-if="saveStatus === 'error'" class="save-indicator error">Erreur</span>
      </template>
    </AppPageHead>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <template v-else>
      <nav class="tab-bar">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'perso' }"
          @click="activeTab = 'perso'"
        >
          <Lock :size="15" />
          Notes personnelles
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'compagnie' }"
          @click="activeTab = 'compagnie'"
        >
          <Users :size="15" />
          Journal de la compagnie
        </button>
      </nav>

      <div class="editor-wrapper">
        <textarea
          v-if="activeTab === 'perso'"
          v-model="persoContent"
          class="journal-editor"
          placeholder="Tes notes personnelles, secrètes et privées…"
          spellcheck="true"
        />
        <textarea
          v-else
          v-model="compagnieContent"
          class="journal-editor"
          placeholder="Le journal de la compagnie, visible et éditable par tous…"
          spellcheck="true"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.journal-page {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 4rem);
}

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
  border-radius: 999px;
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

.save-indicator {
  font-size: 0.8rem;
  font-style: italic;
}
.save-indicator.saving { color: var(--muted); }
.save-indicator.saved  { color: var(--accent-strong); }
.save-indicator.error  { color: #c95f56; }
</style>
