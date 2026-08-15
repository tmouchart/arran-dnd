<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ArrowLeft, History, RotateCcw } from "lucide-vue-next";
import AppBottomSheet from "../ui/AppBottomSheet.vue";
import AppModal from "../ui/AppModal.vue";
import AppButton from "../ui/AppButton.vue";
import AppBadge from "../ui/AppBadge.vue";
import AppEmptyState from "../ui/AppEmptyState.vue";
import DrawingCanvas from "../DrawingCanvas.vue";
import {
  fetchRevisions,
  fetchRevisionSnapshot,
  restoreRevision,
  type RevisionEntity,
  type RevisionSummary,
  type RevisionSnapshot,
} from "../../api/revisions";
import type { Stroke } from "../../api/journal";
import { showToast } from "../../composables/useToast";
import { relativeTime } from "../../utils/relativeTime";

const props = defineProps<{
  modelValue: boolean;
  type: RevisionEntity;
  entityId: number;
  /** Champ du snapshot à prévisualiser. */
  contentKey?: string;
  isDrawing?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  restored: [];
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const list = ref<RevisionSummary[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const selected = ref<RevisionSummary | null>(null);
const snapshot = ref<RevisionSnapshot | null>(null);
const loadingSnapshot = ref(false);

const confirming = ref(false);
const restoring = ref(false);

const key = computed(() => props.contentKey ?? "content");
const previewText = computed(() => snapshot.value?.[key.value] ?? "");

const previewStrokes = computed<Stroke[]>(() => {
  if (!props.isDrawing) return [];
  try {
    const parsed = JSON.parse(previewText.value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
});

async function load() {
  loading.value = true;
  error.value = null;
  selected.value = null;
  snapshot.value = null;
  try {
    list.value = await fetchRevisions(props.type, props.entityId);
  } catch {
    error.value = "Impossible de charger l'historique.";
  } finally {
    loading.value = false;
  }
}

watch(open, (isOpen) => { if (isOpen) void load(); });

async function select(revision: RevisionSummary) {
  selected.value = revision;
  loadingSnapshot.value = true;
  snapshot.value = null;
  try {
    snapshot.value = await fetchRevisionSnapshot(props.type, props.entityId, revision.id);
  } catch {
    error.value = "Impossible de charger cette version.";
    selected.value = null;
  } finally {
    loadingSnapshot.value = false;
  }
}

async function confirmRestore() {
  if (!selected.value) return;
  restoring.value = true;
  try {
    await restoreRevision(props.type, props.entityId, selected.value.id);
    confirming.value = false;
    open.value = false;
    showToast("Version restaurée");
    emit("restored");
  } catch (e: any) {
    showToast(
      e?.status === 423
        ? "Quelqu'un est en train d'éditer — réessaie dans un instant."
        : "La restauration a échoué.",
    );
  } finally {
    restoring.value = false;
  }
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toLocaleString("fr-FR")}`;
}
</script>

<template>
  <AppBottomSheet
    v-model="open"
    title="Historique"
    description="Consulte et restaure une version antérieure de ce contenu."
  >
    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>
    <AppEmptyState v-else-if="!list.length" variant="empty">
      Aucune version enregistrée pour l'instant.
    </AppEmptyState>

    <!-- ── Liste ── -->
    <div v-else-if="!selected" class="revision-list">
      <button
        v-for="revision in list"
        :key="revision.id"
        type="button"
        class="revision-row"
        @click="select(revision)"
      >
        <div class="revision-main">
          <span class="revision-author">{{ revision.authorName }}</span>
          <span class="revision-time">{{ relativeTime(revision.createdAt) }}</span>
        </div>
        <div class="revision-meta">
          <AppBadge v-if="revision.kind === 'restore'" variant="info">restaurée</AppBadge>
          <span class="revision-delta" :class="{ loss: revision.sizeDelta < 0 }">
            {{ formatDelta(revision.sizeDelta) }}
          </span>
        </div>
      </button>
    </div>

    <!-- ── Aperçu ── -->
    <div v-else class="revision-preview">
      <div class="preview-head">
        <AppButton size="small" @click="selected = null">
          <ArrowLeft :size="14" />
          Retour
        </AppButton>
        <span class="preview-label">
          {{ selected.authorName }} · {{ relativeTime(selected.createdAt) }}
        </span>
      </div>

      <AppEmptyState v-if="loadingSnapshot" variant="loading">Chargement…</AppEmptyState>
      <div v-else-if="isDrawing" class="preview-drawing">
        <DrawingCanvas :strokes="previewStrokes" :readonly="true" />
      </div>
      <pre v-else class="preview-text">{{ previewText || "(vide)" }}</pre>

      <AppButton
        variant="primary"
        :block="true"
        :disabled="loadingSnapshot"
        @click="confirming = true"
      >
        <RotateCcw :size="15" />
        Restaurer cette version
      </AppButton>
    </div>
  </AppBottomSheet>

  <AppModal v-model="confirming" title="Restaurer cette version ?">
    <p class="confirm-text">
      Le contenu actuel sera remplacé par la version de
      <strong>{{ selected?.authorName }}</strong>.
    </p>
    <p class="confirm-hint">
      <History :size="13" />
      La version actuelle reste dans l'historique — tu pourras revenir en arrière.
    </p>
    <template #footer>
      <AppButton @click="confirming = false">Annuler</AppButton>
      <AppButton variant="primary" :disabled="restoring" @click="confirmRestore">
        {{ restoring ? "Restauration…" : "Restaurer" }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.revision-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.revision-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  width: 100%;
  min-height: 40px;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.revision-row:hover {
  border-color: var(--border-strong);
}

.revision-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.revision-author {
  font-weight: 600;
  font-size: 0.9rem;
}

.revision-time {
  font-size: 0.78rem;
  color: var(--muted);
}

.revision-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.revision-delta {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

/* Une grosse perte doit sauter aux yeux : c'est le repère pour retrouver
   l'accident (Ctrl+A, suppression massive). */
.revision-delta.loss {
  color: var(--danger);
  font-weight: 700;
}

.revision-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 0;
}

.preview-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.preview-label {
  font-size: 0.8rem;
  color: var(--muted);
}

.preview-text {
  margin: 0;
  padding: var(--space-md);
  max-height: 45vh;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  font-family: inherit;
  font-size: 0.88rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-drawing {
  height: 45vh;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.confirm-text {
  margin: 0 0 var(--space-sm);
  font-size: 0.9rem;
}

.confirm-hint {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted);
}
</style>
