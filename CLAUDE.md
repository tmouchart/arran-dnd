# Arran DnD — Rules for Claude

## Project Structure

Arran DnD is a monorepo with three workspaces. Run everything from the root with `npm run dev`.

```
arran-dnd/
├── client/          # Vue 3 SPA (Vite + TypeScript)
├── server/          # Express API (Node + TypeScript + Drizzle ORM)
└── knowledge/       # Game rules & lore (Markdown, loaded at runtime by the AI)
```

### `knowledge/`

Static Markdown files describing the game rules and world lore. The server reads these files at startup to populate the AI's context.

```
knowledge/
└── topics/
    ├── 00-index.md          # Master index — lists all topics
    ├── combat.md
    ├── creation-personnage.md
    ├── equipement.md
    ├── magie.md
    ├── races.md
    ├── voies-de-profil.md
    ├── voies-de-prestige.md
    ├── monde-arran.md
    └── monde-lore-*.md      # World lore (peoples, chronicles…)
```

- Never edit these files by hand unless correcting a factual error in the game rules.
- Use `/add-knowledge` to ingest new rules from a `.txt` source file.
- The server exposes topics as AI tool calls via `server/src/knowledge/tools.ts`.

### `server/`

Express REST API + AI chat endpoint. Entry point: `server/src/index.ts`.

```
server/src/
├── index.ts              # App bootstrap, AI /api/chat endpoint
├── routes/
│   ├── auth.ts           # Login / logout / Google OAuth callback
│   ├── characters.ts     # CRUD for character sheets
│   └── sessions.ts       # Game session management
├── auth/
│   └── middleware.ts     # requireAuth — protects all non-public routes
├── db/
│   ├── schema.ts         # Drizzle table definitions (users, characters, sessions)
│   ├── index.ts          # db client (postgres-js + drizzle)
│   ├── migrations/       # SQL migration files — run with `npm run db:migrate`
│   └── runMigrations.ts
├── knowledge/
│   ├── loadKnowledge.ts  # Reads topics/ at startup
│   └── tools.ts          # Exposes knowledge as Anthropic/Gemini tool definitions
└── sessions/             # Session state helpers
```

Key env vars (`.env` at root): `DATABASE_URL`, `SESSION_SECRET`, `AI_PROVIDER` (`anthropic` | `gemini`), `ANTHROPIC_MODEL`, `GEMINI_MODEL`.

### `client/`

Vue 3 SPA built with Vite. Entry point: `client/src/main.ts`.

```
client/src/
├── views/                      # One file per route
│   ├── LoginView.vue
│   ├── CharacterListView.vue
│   ├── CharacterSheetView.vue  # Main character sheet (tabs)
│   ├── ActionsView.vue         # Combat actions reference
│   ├── ChatView.vue            # AI chat interface
│   ├── SessionListView.vue
│   └── SessionView.vue
├── components/
│   ├── ui/                     # Shared primitives (AppCard, AppBadge…) — see below
│   └── character-sheet/        # Cards rendered inside CharacterSheetView
│       ├── AbilitiesCard.vue
│       ├── CombatCard.vue
│       ├── VoiesCard.vue
│       ├── ItemsCard.vue
│       └── …
├── composables/                # useAuth, useCharacter, etc.
├── api/                        # Typed fetch wrappers for each API route
├── data/                       # Static game data (catalogs, lookups)
├── types/                      # Shared TypeScript interfaces
└── utils/                      # Pure helpers (game calculations, formatting)
```

Routes (defined in `client/src/router/index.ts`):

| Path | View | Notes |
|---|---|---|
| `/login` | `LoginView` | Public |
| `/personnage` | `CharacterSheetView` | Default redirect from `/` |
| `/personnages` | `CharacterListView` | |
| `/actions` | `ActionsView` | |
| `/chat` | `ChatView` | |
| `/sessions` | `SessionListView` | |
| `/sessions/:id` | `SessionView` | |

---

## Design

This is a **roleplay game tool**, not a corporate app. Design must feel fun, immersive, and magical.

### Principles
- **Style**: Fun, medieval fantasy, colorful, curvy, bold. Think tavern signs, spell tomes, and adventure maps — not dashboards.
- **Responsive**: All UI must work well on mobile (phone-first).
- **Buttons**: Prefer icon-only buttons. Avoid text labels on action buttons whenever an icon clearly conveys the intent.
- **Icons**: Use [Lucide](https://lucide.dev/icons) exclusively for all icons (`lucide-vue-next`).

### Tone
We are building a tool people use to *have fun*. Every design decision should reinforce that: warm colors, rounded shapes, playful typography, expressive iconography.

## UI Components

All shared UI primitives live in `client/src/components/ui/`. **Always use these components** when writing new code — never use raw HTML elements with manual styling for inputs, buttons, or other primitives that have a component equivalent.

If a new recurring UI pattern emerges (e.g. select, textarea, modal) that doesn't have a component yet, **create a new `App*` component** in `client/src/components/ui/` rather than styling raw elements inline.

### Component catalog

| Component | Usage |
|---|---|
| `AppInput` | All `<input>` fields (text, number, password). Fixed `font-size: 0.92rem` for consistent height. Props: `modelValue`, `type`, `placeholder`, `min`, `max`, `step`, `required`, `autofocus`, `autocomplete`, `disabled`, `textAlign` (`left`/`center`), `id`. Emits numbers automatically for `type="number"`. Layout sizing (width, flex) is controlled by the parent via `class`. |
| `AppButton` | All text buttons. Props: `variant` (`ghost` (default), `primary`, `danger`), `size` (`normal`/`small`), `type` (`button`/`submit`), `disabled`, `block` (full-width). Uses global `.btn` styles. |
| `AppIconBtn` | 40×40 px icon-only button. Variants: `ghost` (default), `primary`, `danger`. Use `size` prop to override dimensions. |
| `AppPageHead` | Every page header with an `<h1>`. Slot `#actions` for buttons on the right. |
| `AppCard` | Any bordered surface card. Use `title` prop for a simple heading, `#titleActions` slot for buttons next to the title, or place a manual `.card-head` div in the default slot for complex headers. |
| `AppBadge` | Colored pill badges. Variants: `attaque`, `limitée`, `gratuite`, `info`, `pm`, `active`. |
| `AppEmptyState` | Loading / empty / error feedback. Variants: `loading`, `empty` (default), `error`. Slot `#actions` for retry buttons. |

### Rules

- **Never** use `<input class="input">` — use `<AppInput>` instead.
- **Never** use `<button class="btn ...">Text</button>` — use `<AppButton>` instead. Exception: highly specialized buttons (`.hp-btn`, `.dice-btn`, `.mode-tab`, etc.) with unique visual treatment.
- **Never** redefine `.btn` or `.input` styles in scoped CSS. If a variant is missing, extend the component.
- `<select>` and `<textarea>` still use `class="input"` from `style.css` — these don't have components yet.

## Code Quality

### Core principles
- **Simple > clever.** The best solution is the easiest to read and change.
- **No workarounds.** Fix the root cause. If a solution feels disproportionately complex, stop and confirm with the user before implementing.
- **Modular by default.** One file, one responsibility. Split large files into focused, reusable units.

### Rules
- Avoid premature abstractions — don't generalize until there are 2–3 real use cases.
- Keep route handlers thin; extract business logic into service functions.
- Extract reusable UI into `client/src/components/`. Split large Vue files into sub-components.
- A file getting long is a signal to refactor, not to keep adding.
- If an implementation requires a non-obvious trick, a framework workaround, or complexity that feels disproportionate to the feature → **ask the user before proceeding**.

### Unit tests
Any new feature that contains non-trivial logic (game mechanics, calculations, state transformations) **must have unit tests**.

- Tests live next to the source file: `foo.ts` → `foo.test.ts`
- Run with `npm test` (root), `npm test -w client`, or `npm test -w server`
- Use **Vitest** (already installed). Same API as Jest: `describe`, `it`, `expect`
- Test pure functions first; for Vue composables, mutate `character.value` directly and read computed `.value`
- Use `/write-tests` to generate tests interactively

## Project Skills

These skills are available via `/skill-name`. They are **not** auto-injected into context — invoke them explicitly.

| Skill | Trigger | Purpose |
|---|---|---|
| `/add-knowledge` | Adding rules/lore from a `.txt` file | Analyse le contenu et l'intègre dans `knowledge/topics/` |
| `/commit-push` | After completing a feature or fix | Commit + push with a conventional commit message |
| `/write-tests` | After writing non-trivial logic | Generate Vitest unit tests for the current feature |
| `/quick-start` | New developer onboarding | Step-by-step guide to run the project locally |
| `/db-prod` | Production database access | Connect and query the production PostgreSQL database |

## Database Migrations

Whenever a new migration file is created under `server/src/db/migrations/`, **immediately run it**:

```bash
npm run db:migrate
```

Do not wait for the user to run it manually.
