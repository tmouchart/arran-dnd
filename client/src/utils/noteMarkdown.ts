import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { mentionPlugin, stripMentions } from './mentions'

// Markdown léger uniquement : gras, italique, titres, listes.
// Pas de HTML brut, pas de tables, pas de liens/images.
const md = new MarkdownIt('zero', { breaks: true })
md.enable(['heading', 'lheading', 'list', 'emphasis', 'newline', 'escape'])
md.use(mentionPlugin)

/** Rendu markdown brut (non sanitisé). Pur, testable hors navigateur. */
export function renderNoteMarkdown(text: string): string {
  return md.render(text)
}

const SANITIZE_OPTS = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a'],
  ALLOWED_ATTR: ['class', 'data-kind', 'data-id'],
}

/** Rendu final pour v-html : markdown + mentions, sanitisé par DOMPurify. */
export function renderNoteHtml(text: string): string {
  return DOMPurify.sanitize(renderNoteMarkdown(text), SANITIZE_OPTS)
}

/** Texte brut pour les extraits de liste : mentions → @Nom, syntaxe markdown retirée. */
export function plainExcerpt(text: string, max = 90): string {
  const flat = stripMentions(text)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/(\*\*|__|\*|_)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return flat.length > max ? flat.slice(0, max) + '…' : flat
}
