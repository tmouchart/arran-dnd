<script setup lang="ts">
import { computed } from 'vue'
import { renderNoteHtml } from '../../utils/noteMarkdown'
import type { MentionKind } from '../../utils/mentions'

const props = defineProps<{
  content: string
  /** Rend la zone cliquable pour passer en édition. */
  editable?: boolean
}>()

const emit = defineEmits<{
  (e: 'mention', kind: MentionKind, id: number): void
  (e: 'edit'): void
}>()

const html = computed(() => renderNoteHtml(props.content))

function onClick(e: MouseEvent) {
  const link = (e.target as HTMLElement).closest?.('a.mention')
  if (!link) {
    // Cliquer n'importe où ailleurs ouvre l'édition — pas de bouton à viser.
    if (props.editable) emit('edit')
    return
  }
  const kind = link.getAttribute('data-kind') as MentionKind | null
  const id = Number(link.getAttribute('data-id'))
  if ((kind === 'codex' || kind === 'membre') && Number.isFinite(id)) {
    emit('mention', kind, id)
  }
}
</script>

<template>
  <div
    class="note-render"
    :class="{ 'note-render--editable': editable }"
    v-html="html"
    @click="onClick"
  />
</template>

<style scoped>
.note-render {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.95rem;
  line-height: 1.65;
  overflow-wrap: break-word;
}

.note-render--editable {
  cursor: text;
  transition: border-color 0.15s ease;
}

/* Le survol n'existe pas au doigt : sur mobile la bordure resterait allumée
   après un tap. Le clic, lui, marche partout. */
@media (hover: hover) {
  .note-render--editable:hover {
    border-color: var(--accent-strong);
  }
}

.note-render :deep(p) {
  margin: 0 0 0.6rem;
}

.note-render :deep(h1),
.note-render :deep(h2),
.note-render :deep(h3),
.note-render :deep(h4),
.note-render :deep(h5),
.note-render :deep(h6) {
  margin: 0.8rem 0 0.4rem;
  font-family: var(--title-font);
  color: var(--accent-strong);
  line-height: 1.3;
}

.note-render :deep(h1) { font-size: 1.35rem; }
.note-render :deep(h2) { font-size: 1.2rem; }
.note-render :deep(h3) { font-size: 1.05rem; }

.note-render :deep(ul),
.note-render :deep(ol) {
  margin: 0 0 0.6rem;
  padding-left: 1.4rem;
}

.note-render :deep(li) {
  margin-bottom: 0.2rem;
}

.note-render :deep(.mention) {
  color: var(--accent-strong);
  font-weight: 600;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: var(--radius-xs);
  padding: 0.05rem 0.3rem;
  cursor: pointer;
}

.note-render :deep(.mention:hover) {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}
</style>
