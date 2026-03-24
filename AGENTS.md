# Terres d’Arran — assistant web

## Purpose

Web app to support **Les Terres d’Arran**, a French tabletop RPG using the **Chroniques Oubliées** engine, set in the world of the Arran comic series (*Elfes*, *Nains*, *Orcs & Gobelins*, *Mages*, etc.). The goal is to reduce bookkeeping (math, reference lookup, character tracking) so players and GMs spend more time playing.

## Current phase

**Phase 3 (initial)** — Q&A (`/`), fiche personnage (`/personnage`) with localStorage, PV/PM, caractéristiques, compétences, attaques, voies. **Phase 1** — enrich `knowledge/` from the official PDF (LLM-assisted, manual review).

## Repository map

| Path | Role |
|------|------|
| `AGENTS.md` | This file — orientation for humans and agents |
| `docs/PLAN.md` | Product/technical plan (in-repo copy) |
| `knowledge/` | Curated rules for the app and for agents (Markdown + optional JSON) |
| `server/` | Node API: loads `knowledge/`, calls Anthropic Claude |
| `client/` | Vue 3 + Vite + TypeScript UI (chat + character tools) |

## Language

- **Player-facing UI**: French.
- **Code, comments, commit messages**: English.

## Rules integrity

- Canonical mechanics live in **`knowledge/topics/`** and **`knowledge/reference/`**. Do not invent scores, DCs, or tables: if something is missing, say so and point to the official book/PDF.
- Homebrew or house rules must be labeled explicitly.

## Copyright

The *Livre du joueur Terres d’Arran* PDF is copyrighted. Do **not** commit the PDF or large verbatim excerpts. Prefer paraphrase, mechanical summaries, and short quotes where appropriate. Treat `knowledge/` as **private reference** for your table; be careful what you publish publicly.

## Running locally

1. **API keys**: Copy `server/.env.example` to `server/.env` and set `ANTHROPIC_API_KEY`.
2. **Install**: From repo root, `npm install` (workspaces install `client` and `server`).
3. **Dev**: `npm run dev` — runs the API on port 3566 and Vite on 5173 with proxy to the API.

## Anthropic

The server uses the **Messages API** (default model configurable via `ANTHROPIC_MODEL`, e.g. `claude-sonnet-4-20250514`). See `server/.env.example`.
