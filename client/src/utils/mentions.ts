import type MarkdownIt from 'markdown-it'

export type MentionKind = 'codex' | 'membre'

export interface Mention {
  kind: MentionKind
  id: number
  name: string
  /** Index du token complet dans le texte. */
  index: number
  /** Longueur du token complet. */
  length: number
}

/** Format stocké : @[Nom](codex:123) ou @[Nom](membre:45) */
const MENTION_RE = /@\[([^\]\n]*)\]\((codex|membre):(\d+)\)/g

/** Extrait toutes les mentions d'un texte. */
export function parseMentions(text: string): Mention[] {
  const out: Mention[] = []
  for (const m of text.matchAll(MENTION_RE)) {
    out.push({
      name: m[1],
      kind: m[2] as MentionKind,
      id: Number(m[3]),
      index: m.index ?? 0,
      length: m[0].length,
    })
  }
  return out
}

/** Construit le token d'une mention. Les crochets et retours ligne du nom sont retirés. */
export function mentionToken(name: string, kind: MentionKind, id: number): string {
  const safe = name.replace(/[\[\]\n]/g, ' ').replace(/\s+/g, ' ').trim()
  return `@[${safe}](${kind}:${id})`
}

/**
 * Remplace la plage [start, end) (le "@texte" tapé) par le token, suivi d'une espace.
 * Retourne le nouveau texte et la position du curseur après insertion.
 */
export function insertMention(
  text: string,
  start: number,
  end: number,
  token: string,
): { text: string; caret: number } {
  const rest = text.slice(end)
  const space = rest.startsWith(' ') || rest.startsWith('\n') ? '' : ' '
  const next = text.slice(0, start) + token + space + rest
  return { text: next, caret: start + token.length + 1 }
}

/** Remplace les tokens de mention par "@Nom" (texte brut, extraits de liste). */
export function stripMentions(text: string): string {
  return text.replace(MENTION_RE, '@$1')
}

/** Extrait ~radius caractères autour de la première mention (kind:id). */
export function mentionExcerpt(text: string, kind: MentionKind, id: number, radius = 45): string {
  const m = parseMentions(text).find((x) => x.kind === kind && x.id === id)
  const flatten = (s: string) => stripMentions(s).replace(/\s+/g, ' ')
  if (!m) return flatten(text).trim().slice(0, radius * 2)
  const before = flatten(text.slice(0, m.index))
  const after = flatten(text.slice(m.index + m.length))
  const b = before.slice(-radius)
  const a = after.slice(0, radius)
  return (before.length > radius ? '…' : '') + b + '@' + m.name + a + (after.length > radius ? '…' : '')
}

/**
 * Plugin markdown-it : transforme les tokens @[Nom](kind:id) en
 * <a class="mention" data-kind data-id>@Nom</a>.
 */
export function mentionPlugin(md: MarkdownIt): void {
  md.core.ruler.push('mention', (state) => {
    for (const blockToken of state.tokens) {
      if (blockToken.type !== 'inline' || !blockToken.children) continue
      const out: typeof blockToken.children = []
      for (const child of blockToken.children) {
        if (child.type !== 'text' || !child.content.includes('@[')) {
          out.push(child)
          continue
        }
        const src = child.content
        let last = 0
        for (const m of src.matchAll(MENTION_RE)) {
          const idx = m.index ?? 0
          if (idx > last) {
            const t = new state.Token('text', '', 0)
            t.content = src.slice(last, idx)
            out.push(t)
          }
          const t = new state.Token('mention', '', 0)
          t.content = m[1]
          t.meta = { kind: m[2], id: Number(m[3]) }
          out.push(t)
          last = idx + m[0].length
        }
        if (last === 0) {
          out.push(child)
        } else if (last < src.length) {
          const t = new state.Token('text', '', 0)
          t.content = src.slice(last)
          out.push(t)
        }
      }
      blockToken.children = out
    }
  })

  md.renderer.rules.mention = (tokens, idx) => {
    const t = tokens[idx]
    const meta = t.meta as { kind: MentionKind; id: number }
    return `<a class="mention" data-kind="${meta.kind}" data-id="${meta.id}">@${md.utils.escapeHtml(t.content)}</a>`
  }
}
