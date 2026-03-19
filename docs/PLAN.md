---
name: Terres d'Arran Web App
overview: "Greenfield monorepo: add AGENTS.md and Cursor rules that capture the RPG-assistant vision; Phase 1 builds a curated, LLM-readable rules corpus by having a human work from the PDF and an LLM (e.g. in Cursor) help draft/structure content—no PDF parsing scripts in-repo; Phase 2 ships a Vue 3 + Node Q&A app that injects that corpus into Claude; Phase 3 extends the UI with character-sheet tooling, designed so data models align with Chroniques Oubliées / Terres d’Arran."
todos:
  - id: agents-and-rules
    content: Create AGENTS.md, .gitignore (.env, optional local scratch), and .cursor/rules (project, rules integrity, optional knowledge authoring)
    status: pending
  - id: knowledge-phase1
    content: Add knowledge/README.md and first curated knowledge/topics/*.md (+ reference tables); document LLM-assisted authoring workflow (no PDF scripts)
    status: pending
  - id: phase2-stack
    content: Scaffold server/ (Node API, knowledge loader, Claude Messages) and client/ (Vue3+Vite chat UI, topic selector)
    status: pending
  - id: phase3-character
    content: Define TS character model + persistence v1; build sheet, HP/resources, and attacks/skills views
    status: pending
---

> **Note:** This file is the project plan kept in-repo for version control. Cursor may also keep a copy under your user `.cursor/plans/` directory; edit whichever you treat as canonical and sync the other if needed.

# Terres d’Arran — assistant web (plan)

## Scope and constraints

- **Source of truth**: Your legally obtained PDF (*Livre du joueur Terres d’Arran*) is copyrighted. The repo should treat extracted text as **private reference material**: avoid publishing full reproductions; prefer **summaries, mechanics in your own words, or short quoted excerpts** where fair use applies. AGENTS.md and rules will state this explicitly for future contributors and AI.
- **Stack (your choices)**: **Vue 3** frontend, **Node** backend, **Claude (Sonnet)** via API, **static context** (curated Markdown/JSON loaded into the system prompt or a small set of topic files per request — no embeddings/RAG in v1).

## Repository layout (proposed)

```text
arran-dnd/
  AGENTS.md
  .cursor/rules/*.mdc          # project + RPG behavior rules
  knowledge/                   # LLM-oriented rules (Markdown + optional JSON schemas)
    README.md                  # how topics map to files; “do not ship raw book” note
    topics/                    # e.g. creation-personnage.md, combat.md, magie.md, monde.md
    reference/                 # tables, formulas — structured where possible
  server/                      # Node API (Phase 2)
  client/                      # Vue 3 + Vite (Phase 2–3)
  package.json                 # optional npm workspaces: ["client", "server"]
```

## 1 — AGENTS.md and Cursor rules

**[AGENTS.md](../AGENTS.md)** (single entry point for humans + agents):

- **Project goal**: Reduce bookkeeping for *Les Terres d’Arran* (CO engine) so tables can focus on play.
- **Language**: UI copy and player-facing text **French**; code/comments **English** (common convention) unless you prefer French everywhere — pick one in AGENTS and stick to it.
- **Phases**: (1) knowledge corpus, (2) Q&A web app, (3) character tools — with explicit “current phase” line you update as you go.
- **Where rules live**: `knowledge/topics/*`; never invent numbers — if missing, say so and point to the book/PDF.
- **Copyright**: short policy as above.
- **How to run**: later sections for `client`/`server` env vars (e.g. `ANTHROPIC_API_KEY`).

**[.cursor/rules/](../.cursor/rules/)** (2–3 focused rules, not one giant file):

- **terres-arran-project.mdc**: stack, folder map, phase boundaries, French UX.
- **rpg-rules-integrity.mdc**: when answering rules questions, prefer `knowledge/`; cite topic filenames; do not contradict CO/TdA without labeling homebrew.
- Optionally **knowledge-authoring.mdc**: Markdown templates (H1 = topic, stable anchors), frontmatter keys (`source: tda-livre-joueur`, `version`, `last_reviewed`), and **how you author**: attach/reference the PDF in the IDE, prompt an LLM chapter-by-chapter, paste results into `knowledge/` after review (no automated PDF pipeline in this repo).

## 2 — Phase 1: PDF → LLM-friendly knowledge

**Workflow (LLM-assisted, fully manual commit path)** — **no `pdf-parse`, no extraction scripts, no checked-in raw dumps**:

1. **Source**: You keep the PDF locally (e.g. Downloads); it is **not** required in the repo. In Cursor (or another tool), **@‑reference the PDF** or relevant pages when asking an LLM to produce structured notes.
2. **Draft with LLM**: For each domain (création, combat, magie, etc.), prompt for: headings, bullet mechanics, Markdown tables, and explicit “unknown / verify in PDF” gaps. Prefer **paraphrase + mechanical facts** over pasting entire copyrighted sections.
3. **Human review**: You verify numbers, caps, and edge cases against the PDF, then save into `knowledge/topics/*.md` (and `knowledge/reference/*` for dense tables/JSON if useful).
4. **Optional Cursor skills**: mirror heavy domains as `.cursor/skills/.../SKILL.md` only where it helps *editing* the repo (e.g. “how to format combat rules”). Keep **canonical rules** in `knowledge/` so the **runtime app** does not depend on Cursor-only paths.

**Deliverable**: `knowledge/README.md` index linking topics to game chapters (page refs optional, for your use only) plus a short **Authoring** subsection describing this three-step loop.

## 3 — Phase 2: Vue 3 + Node Q&A

**Backend (`server/`)**:

- Minimal REST API, e.g. `POST /api/chat` with `{ messages, topic? }`.
- Load **static context**: concatenate a **base system preamble** (role: assistant MJ/joueur, French, cite `knowledge/` topics) + **topic file(s)** from `knowledge/topics/` (simple map: `topic` query/body → file list; default = “core” bundle).
- Call **Anthropic Messages API** (Sonnet); stream optional in a follow-up.
- **Secrets**: `ANTHROPIC_API_KEY` in `.env` (never commit). Rate-limit / simple auth later if exposed beyond localhost.

**Frontend (`client/`)**:

- Vue 3 + Vite + TypeScript; one **chat view**; optional topic selector matching server bundles.
- Env: `VITE_API_URL` for dev proxy or direct API URL.

**Dev ergonomics**: root script `dev` runs API + Vite (concurrently) or document two terminals.

```mermaid
flowchart LR
  subgraph client [Vue_client]
    UI[Chat_UI]
  end
  subgraph server [Node_server]
    API[/api/chat]
    Loader[Knowledge_loader]
  end
  Claude[Claude_API]
  KB[knowledge_topics]
  UI --> API
  API --> Loader
  Loader --> KB
  API --> Claude
```

## 4 — Phase 3: Character tools (frontend-first)

- **Data model** in `client/` (TypeScript types + JSON schema optional): PC fields aligned with CO/TdA — stats, dérivés, PV, compétences, voies, équipement, états.
- **Persistence v1**: `localStorage` or IndexedDB; **v2** optional: sync to server + DB if you add accounts later.
- **UI modules**: fiche personnage, liste attaques/actions disponibles (derived from sheet), suivi PV / ressources (PM, etc.).
- **Integration with chat**: later, “send current character context” as a compact system or user attachment block (still static text — no RAG).

## 5 — Suggested implementation order (after plan approval)

1. Add `AGENTS.md` + `.cursor/rules/*` + `knowledge/README.md` + `.gitignore` for `.env` (and any local scratch files you use—**not** committed full book text).
2. Author first curated topic files using the LLM-assisted workflow (start with one chapter, e.g. création de personnage); cross-check against the PDF.
3. Scaffold `server/` and `client/`; wire chat + knowledge loader; verify answers against your curated files.
4. Add character types + sheet UI; then attacks/skills views driven from the same types.

## Risks / mitigations

- **LLM transcription errors**: models can misread or invent numbers — mitigate with **mandatory human pass** against the PDF and small, testable tables in `knowledge/reference/`.
- **Token limits**: large `knowledge/` — mitigate with **topic bundles** (only load 2–4 files per request) and a short “index” file the model sees every time.
- **Rule drift**: version `knowledge/` and note book printing/edition in README.
