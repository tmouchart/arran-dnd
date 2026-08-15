<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Lock, Users } from 'lucide-vue-next'
import AppBottomSheet from '../ui/AppBottomSheet.vue'
import AppEmptyState from '../ui/AppEmptyState.vue'
import { fetchCodexMentions, type MentionSource } from '../../api/codex'
import { user } from '../../composables/useAuth'
import { mentionExcerpt } from '../../utils/mentions'
import { relativeTime } from '../../utils/relativeTime'

const props = defineProps<{
  modelValue: boolean
  entryId: number
  entryName: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const router = useRouter()
const campaignId = computed(() => user.value?.activeCampaignId ?? null)

const loading = ref(false)
const error = ref(false)
const myNotes = ref<MentionSource[]>([])
const pages = ref<MentionSource[]>([])
const board = ref<MentionSource | null>(null)

// immediate : la sheet est montée avec modelValue déjà à true (v-if côté parent),
// sans ça le watch ne se déclenche jamais au premier affichage.
watch(
  () => props.modelValue,
  async (open) => {
    if (!open || !campaignId.value) return
    loading.value = true
    error.value = false
    try {
      const data = await fetchCodexMentions(campaignId.value, props.entryId)
      myNotes.value = data.notes
      pages.value = data.pages
      board.value = data.board
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

function excerpt(source: MentionSource): string {
  return mentionExcerpt(source.content, 'codex', props.entryId)
}

function openNote(id: number) {
  emit('update:modelValue', false)
  router.push({ name: 'journal-note', params: { id } })
}

function openPage(id: number) {
  emit('update:modelValue', false)
  router.push({ name: 'journal-page', params: { id } })
}

function openBoard() {
  emit('update:modelValue', false)
  router.push({ name: 'journal' })
}
</script>

<template>
  <AppBottomSheet
    :model-value="modelValue"
    :title="`Mentions de ${entryName}`"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <AppEmptyState v-if="loading" variant="loading">Recherche…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">Impossible de charger les mentions.</AppEmptyState>
    <AppEmptyState v-else-if="!myNotes.length && !pages.length && !board">
      Personne n'a encore mentionné cette fiche.
    </AppEmptyState>

    <div v-else class="digest">
      <template v-if="board">
        <h4 class="digest-section"><BookOpen :size="13" /> Journal de bord</h4>
        <button type="button" class="digest-item" @click="openBoard()">
          <span class="digest-title">{{ board.title }}</span>
          <span class="digest-excerpt">{{ excerpt(board) }}</span>
          <span class="digest-meta">{{ relativeTime(board.updatedAt) }}</span>
        </button>
      </template>

      <template v-if="myNotes.length">
        <h4 class="digest-section"><Lock :size="13" /> Mes notes privées</h4>
        <button
          v-for="note in myNotes"
          :key="'n' + note.id"
          type="button"
          class="digest-item"
          @click="openNote(note.id)"
        >
          <span class="digest-title">{{ note.title.trim() || 'Sans titre' }}</span>
          <span class="digest-excerpt">{{ excerpt(note) }}</span>
          <span class="digest-meta">{{ relativeTime(note.updatedAt) }}</span>
        </button>
      </template>

      <template v-if="pages.length">
        <h4 class="digest-section"><Users :size="13" /> Notes partagées</h4>
        <button
          v-for="page in pages"
          :key="'p' + page.id"
          type="button"
          class="digest-item"
          @click="openPage(page.id)"
        >
          <span class="digest-title">{{ page.title.trim() || 'Sans titre' }}</span>
          <span class="digest-excerpt">{{ excerpt(page) }}</span>
          <span class="digest-meta">{{ relativeTime(page.updatedAt) }}</span>
        </button>
      </template>
    </div>
  </AppBottomSheet>
</template>

<style scoped>
.digest {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.digest-section {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.5rem 0 0.1rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.digest-section:first-child {
  margin-top: 0;
}

.digest-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: var(--text);
  transition: border-color 120ms, background 120ms;
}

.digest-item:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}

.digest-title {
  font-weight: 600;
  font-size: 0.92rem;
}

.digest-excerpt {
  font-size: 0.83rem;
  color: var(--muted);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.digest-meta {
  font-size: 0.74rem;
  color: var(--muted);
}
</style>
