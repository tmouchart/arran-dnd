# Knowledge base — Terres d’Arran

Curated rules and references for the **in-app Q&A** (Claude) and for agents working in this repo. This is **not** a full reproduction of the *Livre du joueur*.

## Authoring (LLM-assisted, no PDF scripts)

1. Open the official PDF locally. In Cursor, attach it with **@** when prompting an LLM.
2. Ask the model to produce structured Markdown: sections, bullets, tables, and explicit gaps marked *à vérifier dans le PDF*.
3. **Manually verify** all numbers, caps, and prerequisites against the book.
4. Save under `topics/` (narrative rules) or `reference/` (dense tables, JSON).
5. Add an entry in the table below and, if needed, register the file in `server/src/knowledge/bundles.ts`.

## Topic index

| File | Covers (summary) |
|------|-------------------|
| [topics/00-index.md](topics/00-index.md) | Short overview + topic list for small context windows |
| [topics/creation-personnage.md](topics/creation-personnage.md) | Character creation pipeline (CO / TdA) |
| [topics/combat.md](topics/combat.md) | Combat flow, attacks, damage (CO-style) |
| [topics/magie.md](topics/magie.md) | Magic / resources overview *(expand from PDF)* |
| [topics/monde-arran.md](topics/monde-arran.md) | Peuples d’Arran — aperçu création *(voir aussi `races.md` pour le détail)* |
| [topics/races.md](topics/races.md) | Peuples jouables : lore, roleplay, modificateurs, voie de peuple, voies culturelles |
| [topics/voies-de-profil.md](topics/voies-de-profil.md) | Detailed profile paths, ranks, effects and prerequisites |
| [topics/voies-de-prestige.md](topics/voies-de-prestige.md) | Prestige paths and progression details |
| [topics/equipement.md](topics/equipement.md) | Currency, weapons/armor tables, encumbrance, gear, mounts, lodging, poisons (summary) |

## Reference data

| File | Purpose |
|------|---------|
| [reference/derived-stats.example.json](reference/derived-stats.example.json) | Example shape for programmatic tables *(replace with verified data)* |

## Bundles (API)

The server loads **bundles** of files per request (see `server/src/knowledge/bundles.ts`). Default bundle: `core`.
