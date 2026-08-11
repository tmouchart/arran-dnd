<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { User, MapPin, FileText, Plus } from 'lucide-vue-next'
import CodexFormSheet from './CodexFormSheet.vue'
import { fetchCodexEntries, type CodexEntry, type CodexType } from '../../api/codex'
import { fetchCampaign, type CampaignMember } from '../../api/campaigns'
import { user } from '../../composables/useAuth'
import { mentionToken, insertMention, type MentionKind } from '../../utils/mentions'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

defineExpose({
  focus: () => textareaRef.value?.focus(),
})

// ── Sources de suggestions ───────────────────────────────────────────────────

const campaignId = computed(() => user.value?.activeCampaignId ?? null)
const members = ref<CampaignMember[]>([])
const codexEntries = ref<CodexEntry[]>([])
let loaded = false

async function loadSources() {
  if (loaded || !campaignId.value) return
  loaded = true
  try {
    const [campaign, entries] = await Promise.all([
      fetchCampaign(campaignId.value),
      fetchCodexEntries(campaignId.value),
    ])
    members.value = campaign.members
    codexEntries.value = entries
  } catch {
    loaded = false
  }
}

onMounted(loadSources)

// ── Détection du "@texte" tapé ───────────────────────────────────────────────

const query = ref<string | null>(null)
const triggerStart = ref(0)
const caretEnd = ref(0)

function updateTrigger() {
  const el = textareaRef.value
  if (!el || !campaignId.value || props.readonly) {
    query.value = null
    return
  }
  const caret = el.selectionStart
  const before = el.value.slice(0, caret)
  const m = /(^|[\s(])@([^\s@\][]{0,30})$/.exec(before)
  if (m) {
    query.value = m[2]
    triggerStart.value = caret - m[2].length - 1
    caretEnd.value = caret
  } else {
    query.value = null
  }
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
  updateTrigger()
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

interface Suggestion {
  kind: MentionKind
  id: number
  name: string
  type?: CodexType
}

const suggestions = computed<Suggestion[]>(() => {
  if (query.value === null) return []
  const q = norm(query.value)
  const list: Suggestion[] = [
    ...members.value.map((m) => ({
      kind: 'membre' as const,
      id: m.userId,
      name: m.characterName ?? m.username,
    })),
    ...codexEntries.value.map((e) => ({
      kind: 'codex' as const,
      id: e.id,
      name: e.name,
      type: e.type,
    })),
  ]
  const filtered = q ? list.filter((s) => norm(s.name).includes(q)) : list
  return filtered.slice(0, 8)
})

const canCreate = computed(() => {
  const q = query.value?.trim()
  if (!q) return false
  return !suggestions.value.some((s) => norm(s.name) === norm(q))
})

const showBar = computed(
  () => query.value !== null && (suggestions.value.length > 0 || canCreate.value),
)

// ── Insertion ────────────────────────────────────────────────────────────────

function applyToken(token: string, start: number, end: number) {
  const el = textareaRef.value
  if (!el) return
  const { text, caret } = insertMention(el.value, start, end, token)
  emit('update:modelValue', text)
  query.value = null
  nextTick(() => {
    el.focus()
    el.setSelectionRange(caret, caret)
  })
}

function pick(s: Suggestion) {
  applyToken(mentionToken(s.name, s.kind, s.id), triggerStart.value, caretEnd.value)
}

// ── Création de fiche à la volée ─────────────────────────────────────────────

const showCreate = ref(false)
const createName = ref('')
let pendingRange: { start: number; end: number } | null = null

function openCreate() {
  createName.value = (query.value ?? '').trim()
  pendingRange = { start: triggerStart.value, end: caretEnd.value }
  query.value = null
  showCreate.value = true
}

function onCreated(entry: CodexEntry) {
  codexEntries.value = [...codexEntries.value, entry]
  if (!pendingRange) return
  const range = pendingRange
  pendingRange = null
  applyToken(mentionToken(entry.name, 'codex', entry.id), range.start, range.end)
}

watch(showCreate, (open) => {
  // Sheet fermé (créé ou annulé) : on rend le focus au textarea
  if (!open) nextTick(() => textareaRef.value?.focus())
})

// ── Focus / blur ─────────────────────────────────────────────────────────────

function onBlur() {
  // Le sheet de création vole le focus : on n'émet pas blur pour garder
  // le lock d'édition côté parent.
  if (showCreate.value) return
  query.value = null
  emit('blur')
}

// ── Position de la barre (mobile : au-dessus du clavier) ─────────────────────

const isMobile = ref(!window.matchMedia('(min-width: 700px)').matches)
const mq = window.matchMedia('(min-width: 700px)')
function onMq(e: MediaQueryListEvent) {
  isMobile.value = !e.matches
}
mq.addEventListener('change', onMq)

const barOffset = ref(0)
function updateBarOffset() {
  const vv = window.visualViewport
  if (!vv) {
    barOffset.value = 0
    return
  }
  barOffset.value = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
}

watch(showBar, (open) => {
  const vv = window.visualViewport
  if (!vv || !isMobile.value) return
  if (open) {
    updateBarOffset()
    vv.addEventListener('resize', updateBarOffset)
    vv.addEventListener('scroll', updateBarOffset)
  } else {
    vv.removeEventListener('resize', updateBarOffset)
    vv.removeEventListener('scroll', updateBarOffset)
  }
})

onBeforeUnmount(() => {
  mq.removeEventListener('change', onMq)
  const vv = window.visualViewport
  if (vv) {
    vv.removeEventListener('resize', updateBarOffset)
    vv.removeEventListener('scroll', updateBarOffset)
  }
})
</script>

<template>
  <div class="mention-wrap">
    <textarea
      ref="textareaRef"
      class="mention-editor"
      :class="{ 'mention-editor--readonly': readonly }"
      :value="modelValue"
      :readonly="readonly"
      :placeholder="placeholder"
      spellcheck="true"
      @input="onInput"
      @keyup="updateTrigger"
      @click="updateTrigger"
      @focus="emit('focus')"
      @blur="onBlur"
      @keydown.esc="query = null"
    />

    <Teleport to="body" :disabled="!isMobile">
      <div
        v-if="showBar"
        class="mention-bar"
        :class="isMobile ? 'mention-bar--mobile' : 'mention-bar--desktop'"
        :style="isMobile ? { bottom: barOffset + 'px' } : undefined"
      >
        <button
          v-for="s in suggestions"
          :key="s.kind + ':' + s.id"
          type="button"
          class="mention-chip"
          @mousedown.prevent
          @click="pick(s)"
        >
          <User v-if="s.kind === 'membre' || s.type === 'personnage'" :size="14" />
          <MapPin v-else-if="s.type === 'lieu'" :size="14" />
          <FileText v-else :size="14" />
          {{ s.name }}
        </button>
        <button
          v-if="canCreate"
          type="button"
          class="mention-chip mention-chip--create"
          @mousedown.prevent
          @click="openCreate"
        >
          <Plus :size="14" />
          Créer la fiche "{{ query?.trim() }}"
        </button>
      </div>
    </Teleport>

    <CodexFormSheet
      v-if="campaignId"
      v-model="showCreate"
      :campaign-id="campaignId"
      :prefill-name="createName"
      @saved="onCreated"
    />
  </div>
</template>

<style scoped>
.mention-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

.mention-editor {
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

.mention-editor:focus {
  outline: none;
  border-color: var(--accent);
}

.mention-editor--readonly {
  cursor: default;
  opacity: 0.7;
}

.mention-editor--readonly:focus {
  border-color: var(--border);
}

/* ── Barre de suggestions ── */

.mention-bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow-x: auto;
  padding: 0.5rem 0.6rem;
  background: var(--surface);
  scrollbar-width: none;
}

.mention-bar--mobile {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 950;
  border-top: 1px solid var(--border-strong);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.12);
}

.mention-bar--desktop {
  position: absolute;
  left: 0.5rem;
  right: 0.5rem;
  bottom: 0.5rem;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}

.mention-chip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
}

.mention-chip:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-2));
}

.mention-chip--create {
  color: var(--accent-strong);
  border-color: var(--accent);
}
</style>
