<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { User, MapPin, FileText, History } from 'lucide-vue-next'
import AppBottomSheet from '../ui/AppBottomSheet.vue'
import JournalHistorySheet from './JournalHistorySheet.vue'
import AppInput from '../ui/AppInput.vue'
import AppButton from '../ui/AppButton.vue'
import AppTextarea from '../ui/AppTextarea.vue'
import {
  createCodexEntry,
  updateCodexEntry,
  type CodexEntry,
  type CodexType,
} from '../../api/codex'

const props = defineProps<{
  modelValue: boolean
  campaignId: number
  entry?: CodexEntry | null
  prefillName?: string
  prefillDescription?: string
  convertMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', entry: CodexEntry, opts: { deleteNote: boolean }): void
  (e: 'restored'): void
}>()

const showHistory = ref(false)

/** On ferme le formulaire avant d'ouvrir l'historique : deux feuilles
 *  superposées sont illisibles sur un téléphone. */
function openHistory() {
  emit('update:modelValue', false)
  showHistory.value = true
}

const name = ref('')
const type = ref<CodexType>('personnage')
const description = ref('')
const deleteNoteAfter = ref(true)
const saving = ref(false)
const errorMsg = ref<string | null>(null)

const isEdit = computed(() => !!props.entry)
const sheetTitle = computed(() => {
  if (isEdit.value) return 'Modifier la fiche'
  if (props.convertMode) return 'Convertir en fiche'
  return 'Nouvelle fiche'
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = props.entry?.name ?? props.prefillName ?? ''
    type.value = props.entry?.type ?? 'personnage'
    description.value = props.entry?.description ?? props.prefillDescription ?? ''
    deleteNoteAfter.value = true
    errorMsg.value = null
  },
)

const types: { value: CodexType; label: string }[] = [
  { value: 'personnage', label: 'Personnage' },
  { value: 'lieu', label: 'Lieu' },
  { value: 'autre', label: 'Autre' },
]

async function submit() {
  if (!name.value.trim() || saving.value) return
  saving.value = true
  errorMsg.value = null
  try {
    const data = { name: name.value.trim(), type: type.value, description: description.value }
    const entry = props.entry
      ? await updateCodexEntry(props.campaignId, props.entry.id, data)
      : await createCodexEntry(props.campaignId, data)
    emit('saved', entry, { deleteNote: props.convertMode ? deleteNoteAfter.value : false })
    emit('update:modelValue', false)
  } catch {
    errorMsg.value = 'Erreur lors de la sauvegarde de la fiche.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppBottomSheet
    :model-value="modelValue"
    :title="sheetTitle"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="codex-form" @submit.prevent="submit">
      <AppInput
        v-model="name"
        placeholder="Nom (ex: Isilwen, Taverne du Sanglier…)"
        :required="true"
        :autofocus="true"
      />

      <div class="type-toggle">
        <button
          v-for="t in types"
          :key="t.value"
          type="button"
          class="type-btn"
          :class="{ active: type === t.value }"
          @click="type = t.value"
        >
          <User v-if="t.value === 'personnage'" :size="15" />
          <MapPin v-else-if="t.value === 'lieu'" :size="15" />
          <FileText v-else :size="15" />
          {{ t.label }}
        </button>
      </div>

      <AppTextarea
        v-model="description"
        class="codex-description"
        placeholder="Description (optionnelle)…"
        :rows="5"
      />

      <label v-if="convertMode" class="delete-note-check">
        <input v-model="deleteNoteAfter" type="checkbox" />
        Supprimer la note après conversion
      </label>

      <p v-if="errorMsg" class="form-error">{{ errorMsg }}</p>

      <AppButton variant="primary" type="submit" :disabled="saving || !name.trim()" :block="true">
        {{ saving ? 'Sauvegarde…' : isEdit ? 'Enregistrer' : 'Créer la fiche' }}
      </AppButton>

      <AppButton v-if="isEdit" :block="true" @click="openHistory">
        <History :size="15" />
        Historique
      </AppButton>
    </form>
  </AppBottomSheet>

  <JournalHistorySheet
    v-if="entry"
    v-model="showHistory"
    type="codex_entry"
    :entity-id="entry.id"
    content-key="description"
    @restored="emit('restored')"
  />
</template>

<style scoped>
.codex-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.type-toggle {
  display: flex;
  gap: 0.35rem;
}

.type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem 0.4rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 0.84rem;
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

.codex-description {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
  line-height: 1.5;
}

.delete-note-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  color: var(--text);
  cursor: pointer;
}

.delete-note-check input {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
}

.form-error {
  margin: 0;
  font-size: 0.85rem;
  color: #c95f56;
}
</style>
