<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { User, MapPin, FileText, Plus } from 'lucide-vue-next'
import CodexFormSheet from './CodexFormSheet.vue'
import { fetchCodexEntries, type CodexEntry, type CodexType } from '../../api/codex'
import { fetchCampaign, type CampaignMember } from '../../api/campaigns'
import { user } from '../../composables/useAuth'
import { mentionToken, parseMentions, type MentionKind } from '../../utils/mentions'

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

const editorRef = ref<HTMLDivElement | null>(null)

defineExpose({
  focus: () => editorRef.value?.focus(),
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

// ── Rendu contenteditable : texte + pills ────────────────────────────────────

const X_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

function makePill(name: string, kind: MentionKind, id: number): HTMLSpanElement {
  const pill = document.createElement('span')
  pill.className = 'mention-pill'
  pill.contentEditable = 'false'
  pill.dataset.kind = kind
  pill.dataset.id = String(id)
  pill.dataset.name = name
  const label = document.createElement('span')
  label.className = 'mention-pill-label'
  label.textContent = '@' + name
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'mention-pill-x'
  remove.tabIndex = -1
  remove.setAttribute('aria-label', 'Retirer la mention')
  remove.innerHTML = X_SVG
  pill.append(label, remove)
  return pill
}

/** Reconstruit le contenu de l'éditeur depuis le texte à tokens. */
function render(text: string) {
  const el = editorRef.value
  if (!el) return
  el.textContent = ''
  let last = 0
  for (const m of parseMentions(text)) {
    if (m.index > last) el.append(document.createTextNode(text.slice(last, m.index)))
    el.append(makePill(m.name, m.kind, m.id))
    last = m.index + m.length
  }
  if (last < text.length) el.append(document.createTextNode(text.slice(last)))
}

/** Sérialise le DOM de l'éditeur vers le texte à tokens. */
function serializeNode(n: Node): string {
  if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? ''
  if (!(n instanceof HTMLElement)) return ''
  if (n.classList.contains('mention-pill')) {
    return mentionToken(
      n.dataset.name ?? '',
      (n.dataset.kind as MentionKind) ?? 'codex',
      Number(n.dataset.id),
    )
  }
  if (n.tagName === 'BR') return '\n'
  const children = Array.from(n.childNodes)
  // <div><br></div> = ligne vide : le <br> n'est qu'un placeholder
  const isEmptyLine = children.length === 1 && (children[0] as HTMLElement).tagName === 'BR'
  const inner = isEmptyLine ? '' : children.map(serializeNode).join('')
  const isBlock = /^(DIV|P)$/.test(n.tagName)
  return (isBlock ? '\n' : '') + inner
}

function serialize(): string {
  const el = editorRef.value
  if (!el) return ''
  let out = ''
  el.childNodes.forEach((n, i) => {
    let s = serializeNode(n)
    // Pas de saut de ligne avant le tout premier bloc
    if (i === 0 && s.startsWith('\n')) s = s.slice(1)
    out += s
  })
  return out
}

let lastEmitted = props.modelValue

function emitFromDom() {
  lastEmitted = serialize()
  emit('update:modelValue', lastEmitted)
}

watch(
  () => props.modelValue,
  (v) => {
    if (v !== lastEmitted) {
      lastEmitted = v
      render(v)
    }
  },
)

onMounted(() => render(props.modelValue))

// ── Détection du "@texte" tapé ───────────────────────────────────────────────

const query = ref<string | null>(null)
let triggerNode: Text | null = null
let triggerStart = 0
let triggerEnd = 0

function caretInEditor(): { node: Text; offset: number } | null {
  const el = editorRef.value
  const sel = window.getSelection()
  if (!el || !sel || !sel.isCollapsed || !sel.anchorNode) return null
  if (!el.contains(sel.anchorNode)) return null
  if (sel.anchorNode.nodeType !== Node.TEXT_NODE) return null
  return { node: sel.anchorNode as Text, offset: sel.anchorOffset }
}

function updateTrigger() {
  if (!campaignId.value || props.readonly) {
    query.value = null
    return
  }
  const caret = caretInEditor()
  if (!caret) {
    query.value = null
    return
  }
  const before = (caret.node.textContent ?? '').slice(0, caret.offset)
  const m = /(^|[\s(])@([^\s@\][]{0,30})$/.exec(before)
  if (m) {
    query.value = m[2]
    triggerNode = caret.node
    triggerStart = caret.offset - m[2].length - 1
    triggerEnd = caret.offset
    activeIndex.value = 0
    updateMenuPos()
  } else {
    query.value = null
  }
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
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

const showMenu = computed(
  () => query.value !== null && (suggestions.value.length > 0 || canCreate.value),
)

// ── Position du menu flottant (desktop : ancré au caret) ────────────────────

const menuPos = ref({ left: 0, top: 0, above: false })

function updateMenuPos() {
  const el = editorRef.value
  const wrap = el?.parentElement
  const sel = window.getSelection()
  if (!el || !wrap || !sel || sel.rangeCount === 0) return
  const rect = sel.getRangeAt(0).getBoundingClientRect()
  const wrapRect = wrap.getBoundingClientRect()
  const left = Math.min(rect.left - wrapRect.left, wrapRect.width - 240)
  const above = rect.bottom - wrapRect.top > wrapRect.height - 180
  menuPos.value = {
    left: Math.max(0, left),
    top: above ? rect.top - wrapRect.top : rect.bottom - wrapRect.top + 4,
    above,
  }
}

// ── Navigation clavier dans le menu ──────────────────────────────────────────

const activeIndex = ref(0)
const menuItemCount = computed(() => suggestions.value.length + (canCreate.value ? 1 : 0))

function onKeydown(e: KeyboardEvent) {
  if (showMenu.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeIndex.value = (activeIndex.value + 1) % menuItemCount.value
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeIndex.value = (activeIndex.value - 1 + menuItemCount.value) % menuItemCount.value
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const i = activeIndex.value
      if (i < suggestions.value.length) pick(suggestions.value[i])
      else openCreate()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      query.value = null
      return
    }
  }
  // Une pill ne se supprime qu'avec sa croix, pas au backspace/delete
  if (e.key === 'Backspace' || e.key === 'Delete') {
    const sel = window.getSelection()
    if (!sel || !sel.isCollapsed || !sel.anchorNode) return
    const back = e.key === 'Backspace'
    let neighbor: Node | null = null
    const node = sel.anchorNode
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0
      if (back && sel.anchorOffset === 0) neighbor = node.previousSibling
      if (!back && sel.anchorOffset === len) neighbor = node.nextSibling
    } else if (node instanceof HTMLElement) {
      const kids = node.childNodes
      neighbor = back ? kids[sel.anchorOffset - 1] ?? null : kids[sel.anchorOffset] ?? null
    }
    if (neighbor instanceof HTMLElement && neighbor.classList.contains('mention-pill')) {
      e.preventDefault()
    }
  }
}

// ── Input / paste / clic sur croix ───────────────────────────────────────────

function onInput() {
  emitFromDom()
  updateTrigger()
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') ?? ''
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !text) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  emitFromDom()
  updateTrigger()
}

function onClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('.mention-pill-x')
  if (btn && !props.readonly) {
    const pill = btn.closest('.mention-pill')
    if (pill) {
      // Avale l'espace qui suit la pill pour ne pas laisser un double espace
      const next = pill.nextSibling
      if (next?.nodeType === Node.TEXT_NODE && next.textContent?.startsWith(' ')) {
        next.textContent = next.textContent.slice(1)
      }
      pill.remove()
      emitFromDom()
    }
    return
  }
  updateTrigger()
}

// ── Insertion d'une mention ──────────────────────────────────────────────────

function insertPill(name: string, kind: MentionKind, id: number, node: Text, start: number, end: number) {
  const text = node.textContent ?? ''
  node.textContent = text.slice(0, start)
  const pill = makePill(name, kind, id)
  const rest = text.slice(end)
  const after = document.createTextNode(rest.startsWith(' ') || rest.startsWith('\n') ? rest : ' ' + rest)
  node.after(pill, after)
  const sel = window.getSelection()
  if (sel) {
    const range = document.createRange()
    range.setStart(after, 1)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }
  emitFromDom()
}

function pick(s: Suggestion) {
  if (!triggerNode) return
  const node = triggerNode
  query.value = null
  editorRef.value?.focus()
  insertPill(s.name, s.kind, s.id, node, triggerStart, triggerEnd)
}

// ── Création de fiche à la volée ─────────────────────────────────────────────

const showCreate = ref(false)
const createName = ref('')
let pendingInsert: { node: Text; start: number; end: number } | null = null

function openCreate() {
  if (!triggerNode) return
  createName.value = (query.value ?? '').trim()
  pendingInsert = { node: triggerNode, start: triggerStart, end: triggerEnd }
  query.value = null
  showCreate.value = true
}

function onCreated(entry: CodexEntry) {
  codexEntries.value = [...codexEntries.value, entry]
  if (!pendingInsert) return
  const p = pendingInsert
  pendingInsert = null
  editorRef.value?.focus()
  insertPill(entry.name, 'codex', entry.id, p.node, p.start, p.end)
}

watch(showCreate, (open) => {
  // Sheet fermé (créé ou annulé) : on rend le focus à l'éditeur
  if (!open) nextTick(() => editorRef.value?.focus())
})

// ── Focus / blur ─────────────────────────────────────────────────────────────

function onBlur() {
  // Le sheet de création vole le focus : on n'émet pas blur pour garder
  // le lock d'édition côté parent.
  if (showCreate.value) return
  query.value = null
  emit('blur')
}

// ── Mobile : barre au-dessus du clavier ──────────────────────────────────────

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

watch(showMenu, (open) => {
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
    <div
      ref="editorRef"
      class="mention-editor"
      :class="{ 'mention-editor--readonly': readonly }"
      :contenteditable="!readonly"
      :data-placeholder="placeholder"
      spellcheck="true"
      @input="onInput"
      @keydown="onKeydown"
      @keyup="updateTrigger"
      @click="onClick"
      @paste="onPaste"
      @focus="emit('focus')"
      @blur="onBlur"
    />

    <!-- Desktop : menu flottant ancré au caret -->
    <div
      v-if="showMenu && !isMobile"
      class="mention-menu"
      :style="{
        left: menuPos.left + 'px',
        top: menuPos.above ? 'auto' : menuPos.top + 'px',
        bottom: menuPos.above ? `calc(100% - ${menuPos.top}px + 4px)` : 'auto',
      }"
    >
      <button
        v-for="(s, i) in suggestions"
        :key="s.kind + ':' + s.id"
        type="button"
        class="mention-item"
        :class="{ 'mention-item--active': i === activeIndex }"
        @mousedown.prevent
        @mouseenter="activeIndex = i"
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
        class="mention-item mention-item--create"
        :class="{ 'mention-item--active': activeIndex === suggestions.length }"
        @mousedown.prevent
        @mouseenter="activeIndex = suggestions.length"
        @click="openCreate"
      >
        <Plus :size="14" />
        Créer la fiche "{{ query?.trim() }}"
      </button>
    </div>

    <!-- Mobile : barre horizontale au-dessus du clavier -->
    <Teleport to="body">
      <div
        v-if="showMenu && isMobile"
        class="mention-bar"
        :style="{ bottom: barOffset + 'px' }"
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
  overflow-y: auto;
  white-space: pre-wrap;
  overflow-wrap: break-word;
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

.mention-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--text-dim, #999);
  opacity: 0.6;
  pointer-events: none;
}

.mention-editor--readonly {
  cursor: default;
  opacity: 0.7;
}

.mention-editor--readonly:focus {
  border-color: var(--border);
}

/* ── Pills de mention ── */

.mention-editor :deep(.mention-pill) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  vertical-align: baseline;
  padding: 0.05rem 0.3rem 0.05rem 0.5rem;
  margin: 0 1px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface-2));
  color: var(--accent-strong);
  font-weight: 600;
  font-size: 0.88em;
  line-height: 1.3;
  white-space: nowrap;
  user-select: none;
}

.mention-editor :deep(.mention-pill-x) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  opacity: 0.55;
  cursor: pointer;
  transition: opacity 120ms, background 120ms;
}

.mention-editor :deep(.mention-pill-x:hover) {
  opacity: 1;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

.mention-editor--readonly :deep(.mention-pill-x) {
  display: none;
}

/* ── Menu flottant (desktop) ── */

.mention-menu {
  position: absolute;
  z-index: 40;
  min-width: 200px;
  max-width: 260px;
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 0.3rem;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.6rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mention-item--active {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-2));
}

.mention-item--create {
  color: var(--accent-strong);
}

/* ── Barre de suggestions (mobile) ── */

.mention-bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow-x: auto;
  padding: 0.5rem 0.6rem;
  background: var(--surface);
  scrollbar-width: none;
  position: fixed;
  left: 0;
  right: 0;
  z-index: 950;
  border-top: 1px solid var(--border-strong);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.12);
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
