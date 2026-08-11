import { describe, it, expect } from 'vitest'
import {
  parseMentions,
  mentionToken,
  insertMention,
  stripMentions,
  mentionExcerpt,
} from './mentions'
import { renderNoteMarkdown, plainExcerpt } from './noteMarkdown'

describe('parseMentions', () => {
  it('extrait une mention codex', () => {
    const text = 'On a vu @[Isilwen](codex:12) au marché.'
    const mentions = parseMentions(text)
    expect(mentions).toHaveLength(1)
    expect(mentions[0]).toMatchObject({ kind: 'codex', id: 12, name: 'Isilwen' })
    expect(text.slice(mentions[0].index, mentions[0].index + mentions[0].length)).toBe(
      '@[Isilwen](codex:12)',
    )
  })

  it('extrait une mention membre', () => {
    const mentions = parseMentions('Merci @[Korgan](membre:4) !')
    expect(mentions).toHaveLength(1)
    expect(mentions[0]).toMatchObject({ kind: 'membre', id: 4, name: 'Korgan' })
  })

  it('extrait plusieurs mentions', () => {
    const mentions = parseMentions('@[A](codex:1) parle à @[B](membre:2) de @[C](codex:3)')
    expect(mentions.map((m) => `${m.kind}:${m.id}`)).toEqual(['codex:1', 'membre:2', 'codex:3'])
  })

  it('retourne [] sans mention', () => {
    expect(parseMentions('Rien à voir ici, même avec un @arobase seul.')).toEqual([])
  })

  it('ignore les tokens malformés', () => {
    expect(parseMentions('@[Nom](codex:abc) @[Nom](autre:1) @[Nom](codex:)')).toEqual([])
  })

  it('ne matche pas au-delà d\'un crochet fermant', () => {
    // Un "]" dans le nom coupe le token : pas de match sur l'ensemble
    const mentions = parseMentions('@[Nom [x]](codex:1)')
    expect(mentions).toEqual([])
  })
})

describe('mentionToken', () => {
  it('construit le token', () => {
    expect(mentionToken('Isilwen', 'codex', 12)).toBe('@[Isilwen](codex:12)')
  })

  it('retire crochets et retours ligne du nom', () => {
    expect(mentionToken('Nom [le] Grand\n', 'membre', 3)).toBe('@[Nom le Grand](membre:3)')
  })

  it('produit un token re-parsable', () => {
    const token = mentionToken('Taverne du Sanglier', 'codex', 7)
    expect(parseMentions(token)).toHaveLength(1)
  })
})

describe('insertMention', () => {
  it('remplace le @texte tapé par le token', () => {
    const text = 'On a vu @Isi au marché.'
    const { text: next, caret } = insertMention(text, 8, 12, '@[Isilwen](codex:12)')
    expect(next).toBe('On a vu @[Isilwen](codex:12) au marché.')
    expect(next.slice(caret)).toBe('au marché.')
  })

  it('insère en fin de texte', () => {
    const { text: next, caret } = insertMention('Salut @K', 6, 8, '@[Korgan](membre:4)')
    expect(next).toBe('Salut @[Korgan](membre:4) ')
    expect(caret).toBe(next.length)
  })
})

describe('stripMentions', () => {
  it('remplace les tokens par @Nom', () => {
    expect(stripMentions('Vu @[Isilwen](codex:12) et @[Korgan](membre:4).')).toBe(
      'Vu @Isilwen et @Korgan.',
    )
  })

  it('laisse le texte sans mention intact', () => {
    expect(stripMentions('Rien ici.')).toBe('Rien ici.')
  })
})

describe('mentionExcerpt', () => {
  it('extrait le texte autour de la mention avec ellipses', () => {
    const before = 'a'.repeat(60)
    const after = 'b'.repeat(60)
    const text = `${before} @[Isilwen](codex:12) ${after}`
    const excerpt = mentionExcerpt(text, 'codex', 12)
    expect(excerpt.startsWith('…')).toBe(true)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt).toContain('@Isilwen')
  })

  it('pas d\'ellipses sur un texte court', () => {
    const excerpt = mentionExcerpt('Vu @[Isilwen](codex:12) hier.', 'codex', 12)
    expect(excerpt).toBe('Vu @Isilwen hier.')
  })

  it('strip les autres mentions dans l\'extrait', () => {
    const excerpt = mentionExcerpt('@[Korgan](membre:4) et @[Isilwen](codex:12).', 'codex', 12)
    expect(excerpt).toBe('@Korgan et @Isilwen.')
  })
})

describe('renderNoteMarkdown (plugin mention)', () => {
  it('rend une mention en lien cliquable', () => {
    const html = renderNoteMarkdown('Vu @[Isilwen](codex:12) hier.')
    expect(html).toContain('<a class="mention" data-kind="codex" data-id="12">@Isilwen</a>')
  })

  it('rend plusieurs mentions', () => {
    const html = renderNoteMarkdown('@[A](codex:1) et @[B](membre:2)')
    expect(html).toContain('data-id="1"')
    expect(html).toContain('data-id="2"')
    expect(html).toContain('@A')
    expect(html).toContain('@B')
  })

  it('rend gras, italique, titres et listes', () => {
    expect(renderNoteMarkdown('**gras**')).toContain('<strong>gras</strong>')
    expect(renderNoteMarkdown('*italique*')).toContain('<em>italique</em>')
    expect(renderNoteMarkdown('## Titre')).toContain('<h2>Titre</h2>')
    expect(renderNoteMarkdown('- un\n- deux')).toContain('<li>un</li>')
  })

  it('ne rend pas le HTML brut (échappé)', () => {
    const html = renderNoteMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('échappe le HTML dans le nom de la mention', () => {
    const html = renderNoteMarkdown('@[<b>x</b>](codex:1)')
    expect(html).toContain('@&lt;b&gt;x&lt;/b&gt;')
    expect(html).not.toContain('<b>')
  })

  it('mention dans du gras', () => {
    const html = renderNoteMarkdown('**vu @[Isilwen](codex:12)**')
    expect(html).toContain('<strong>')
    expect(html).toContain('data-id="12"')
  })
})

describe('plainExcerpt', () => {
  it('strip markdown et mentions', () => {
    const text = '## Titre\n- **Vu** @[Isilwen](codex:12)\n- *hier*'
    expect(plainExcerpt(text)).toBe('Titre Vu @Isilwen hier')
  })

  it('tronque à max caractères', () => {
    const excerpt = plainExcerpt('a'.repeat(200), 90)
    expect(excerpt).toHaveLength(91)
    expect(excerpt.endsWith('…')).toBe(true)
  })
})
