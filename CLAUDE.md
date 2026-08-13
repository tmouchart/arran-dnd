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
│   └── characters.ts     # CRUD for character sheets
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
│   └── ChatView.vue            # AI chat interface
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

---

## Design

This is a **roleplay game tool**, not a corporate app. Design must feel fun, immersive, and magical.

### Principles
- **Style**: Fun, medieval fantasy, colorful, curvy, bold. Think tavern signs, spell tomes, and adventure maps — not dashboards.
- **Responsive**: All UI must work well on mobile (phone-first). The app is used almost exclusively on phones.
- **Dense**: Compact spacing everywhere. Use the `--space-*` tokens; avoid paddings above `--space-lg` (0.85rem) on list items, cards, and controls. Generous whitespace is a bug, not a feature.
- **Buttons**: Prefer icon-only buttons. Avoid text labels on action buttons whenever an icon clearly conveys the intent.
- **Icons**: Use [Lucide](https://lucide.dev/icons) exclusively for all icons (`lucide-vue-next`).

### Tone
We are building a tool people use to *have fun*. Every design decision should reinforce that: warm colors, rounded shapes, playful typography, expressive iconography.

## UI Components

All shared UI primitives live in `client/src/components/ui/`.

**THE RULE — no exceptions: ALWAYS use the shared `App*` components. NEVER re-implement an existing pattern (modal, tabs, button, input, select, textarea, badge, empty state…) with raw HTML + scoped CSS.** Historically this app accumulated 17 hand-rolled modals and 8 hand-rolled tab bars because each feature re-created its own — that variance is exactly what we are eliminating. Before writing any piece of UI, check the catalog below and the live showcase at `/component-library` (dev only).

If a recurring UI pattern has no component yet, **first create a new `App*` component** in `client/src/components/ui/` (dense, token-based, mobile-first), add it to the catalog below and to `ComponentLibraryView.vue`, then use it. Creating new shared components is encouraged; re-styling raw elements inline is not.

### Design tokens

All defined in `client/src/style.css` and overridden by themes. Never hardcode what a token covers:
- **Colors**: `--bg`, `--surface(-2/-3)`, `--text`, `--muted`, `--border(-strong)`, `--accent(-strong/-soft)`, `--brand(-strong)`, `--on-brand`, `--danger`. No raw hex in scoped CSS unless the color is genuinely unique.
  - `--on-brand` is the text color to use **on top of** a `--brand` background. Never hardcode a text color on a brand surface — the 3 alternate themes redefine it.
- **Radius**: `--radius-xs/sm/md/lg/xl/xxl/pill`. The 7 names map to only **3 real values** (8 / 12 / 16px) + pill. Never hardcode `border-radius` (only `50%` for circles is fine).
- **Spacing**: `--space-xs/sm/md/lg` for padding/gap.
- **Shadows**: `--shadow-soft`, `--shadow-card`. Both are deliberately near-invisible (`0 1px 3px`). Don't reintroduce heavy drop shadows.
- **Heights**: every interactive control is **40px**. Don't invent 34/38/44px variants.

### Tailwind + shadcn-vue

The `App*` components run on **Tailwind v4** and **reka-ui** (the engine behind shadcn-vue).
See `plans/08-shadcn-tailwind.md` for the full rationale.

Four things that will bite you if you don't know them:

1. **No Tailwind preflight.** `style.css` imports only `theme.css` + `utilities.css`. Consequence: `border-style` defaults to `none`, so a bare `border` class draws nothing — **always add `border-solid`**.
2. **`--spacing: 4px`.** The root font-size is 17px, not 16px, so Tailwind's rem-based spacing would be off. It's forced to px. `min-h-10` really is 40px.
3. **Class names are theme hooks.** `.btn`, `.card`, `.card-head`, `.badge`, `.icon-btn`, `.input` are still set on the components because the 3 themes target `html[data-style=...] .btn.primary` etc. **Never remove them.** Their *base* styles live in the component (CVA + Tailwind), not in `style.css`.
4. **App CSS is unlayered, so it beats Tailwind utilities.** If a Tailwind class seems ignored, a plain CSS rule is winning. Don't fight it with `!important` — move the base style into the component.
5. **Never wrap a reka-ui component in Vue's `<Transition>`.** reka controls mounting itself; the two deadlock and the element stays in the DOM forever. Animate with CSS keyframes on `[data-state='open']` instead — and **only on open**: reka doesn't recognise a different exit animation, so a `[data-state='closed']` animation leaks the element too.
6. **Every dialog needs a `DialogDescription`**, or reka warns on every open. The React `aria-describedby={undefined}` trick does not work in Vue. `AppModal` / `AppBottomSheet` already ship an sr-only one with an optional `description` prop.

Use `cn()` from `@/utils/cn` to merge classes, and `cva` for variants. The `@` alias points to `client/src`.
Add a shadcn component with `npx shadcn-vue@latest add <name> -y -o` (writes into `client/src/components/shadcn/`), but **prefer reka-ui primitives directly** — the shadcn wrappers ship their own look and depend on `tw-animate-css`.

### Component catalog

| Component | Usage |
|---|---|
| `AppInput` | All `<input>` fields (text, number, password). Fixed `font-size: 0.92rem` for consistent height. Props: `modelValue`, `type`, `placeholder`, `min`, `max`, `step`, `required`, `autofocus`, `autocomplete`, `disabled`, `textAlign` (`left`/`center`), `id`. Emits numbers automatically for `type="number"`. Layout sizing (width, flex) is controlled by the parent via `class`. |
| `AppButton` | All text buttons. Props: `variant` (`ghost` (default), `primary`, `danger`), `size` (`normal`/`small`), `type` (`button`/`submit`), `disabled`, `block` (full-width), `as` (render as another tag/component, e.g. `RouterLink`). |
| `AppIconBtn` | 40×40 px icon-only button. Variants: `ghost` (default), `primary`, `danger`. Use `size` prop to override dimensions. |
| `AppPageLayout` | **Every page wrapper.** Provides consistent layout with 3 slots: `#top-bar` (header), default (main content), `#bottom-bar` (optional footer). Props: `mode` (`scroll` (default) / `full` — full-height viewport), `width` (`default` (640px) / `wide` (800px)). All views except LoginView must use this. |
| `AppPageHead` | Every page header with an `<h1>`. Slot `#actions` for buttons on the right. Goes inside `AppPageLayout`'s `#top-bar` slot. |
| `AppCard` | Any bordered surface card. Use `title` prop for a simple heading, `#titleActions` slot for buttons next to the title, or place a manual `.card-head` div in the default slot for complex headers. |
| `AppBadge` | Colored pill badges. Variants: `attaque`, `limitée`, `gratuite`, `info`, `pm`, `active`. |
| `AppEmptyState` | Loading / empty / error feedback. Variants: `loading`, `empty` (default), `error`. Slot `#actions` for retry buttons. |
| `AppModal` | **Every centered dialog** (confirmations, forms, pickers). `v-model` boolean, props `title`, `wide` (560px). Slots: default, `#footer` (action buttons). Built on reka-ui `Dialog`: focus trap, Escape, click-outside, scroll lock and focus restore come for free. |
| `AppBottomSheet` | **Every bottom sheet** (mobile-first panels; centered dialog on desktop). `v-model` + `title`. Same reka-ui `Dialog` engine as AppModal — pick sheet for mobile flows, modal for confirmations. |
| `AppTabs` | **Every tab bar.** `v-model` string + `tabs: { value, label, icon?, dot? }[]` (icon = emoji string or Lucide component). Prop `iconOnlyMobile` hides labels on phones. Built on reka-ui `Tabs`: arrow-key navigation included. Active state is `[data-state="active"]`, not `.active`. |
| `AppSelect` | All `<select>` fields. `v-model` + `<option>` in default slot. Stays a **native** `<select>` on purpose — the OS picker is better UX on phones. |
| `AppTextarea` | All `<textarea>` fields. `v-model`, `rows`, `placeholder`. Same look as AppInput. |
| `AppToast` | Global toasts — never instantiate; call `showToast(message, options?)` from `composables/useToast.ts`. |

### Rules

- **Never** create a new view without wrapping it in `<AppPageLayout>`. Place `<AppPageHead>` in the `#top-bar` slot.
- **Never** set `max-width`, `margin: 0 auto`, or `height: calc(100vh - ...)` in a view's scoped CSS — `AppPageLayout` handles this.
- **Never** use `<input class="input">` — use `<AppInput>` instead.
- **Never** use `<button class="btn ...">Text</button>` — use `<AppButton>` instead. Exception: highly specialized buttons (`.hp-btn`, `.dice-btn`, etc.) with unique visual treatment.
- **Never** redefine `.btn` or `.input` styles in scoped CSS. If a variant is missing, extend the component.
- Need a link that looks like a button? `<AppButton :as="RouterLink" to="/...">` — don't hand-style a `RouterLink`.
- **Never** use raw `<select class="input">` or `<textarea class="input">` — use `<AppSelect>` / `<AppTextarea>`.
- **Never** hand-roll a modal, overlay, bottom sheet, or tab bar — use `<AppModal>`, `<AppBottomSheet>`, `<AppTabs>`.
- **Never** hardcode `border-radius`, paddings, or colors a token covers — use `--radius-*`, `--space-*`, and the color tokens.
- When adding a new `App*` component, showcase it in `client/src/views/ComponentLibraryView.vue` (`/component-library`, dev only).

## Code Quality

### Working principles

These four habits come before the rules below — they're how you should *think*, not just what you should write.

**1. Think before coding.** Don't assume. Don't hide confusion.
- State assumptions out loud. If something's uncertain, ask — don't guess and run with it silently.
- When the request is ambiguous, name the interpretations instead of secretly picking one.
- Push back when a simpler path exists. You're a co-adventurer, not an order-taker.
- When you're confused, stop and say *what* is unclear. A blocked question beats a confident wrong turn.

**2. Simplicity first.** The minimum code that solves the problem — nothing speculative.
- No features beyond what was asked. No abstractions for single-use code.
- No "flexibility" or config that nobody requested. No error handling for impossible cases.
- If 200 lines could be 50, rewrite it. The test: *would a senior engineer call this overcomplicated?* If yes, simplify.

**3. Surgical changes.** Touch only what you must; clean up only your own mess.
- Don't "improve" adjacent code, comments, or formatting. Don't refactor what isn't broken.
- Match the existing style even if you'd personally do it differently.
- Remove imports/variables YOUR change orphaned — but leave pre-existing dead code alone (mention it, don't delete it).
- Every changed line should trace directly back to the request.

**4. Goal-driven execution.** Define success, then loop until it's verified.
- Turn vague tasks into checkable ones: "fix the bug" → "write a test that reproduces it, then make it pass"; "add validation" → "write tests for the invalid inputs, then make them pass".
- For multi-step work, state a short plan with a verify step per item:
  1. [step] → verify: [check]
  2. [step] → verify: [check]
- Strong success criteria let you run independently; "make it work" doesn't.

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

## Plans

All implementation plans must be saved as Markdown files in the `plans/` directory at the project root. Use numbered prefixes for ordering (e.g., `01-campagnes.md`, `02-rencontres.md`). Always write the plan to this directory — never only in `.claude/plans/`.

## Project Skills

These skills are available via `/skill-name`. They are **not** auto-injected into context — invoke them explicitly.

| Skill | Trigger | Purpose |
|---|---|---|
| `/add-knowledge` | Adding rules/lore from a `.txt` file | Analyse le contenu et l'intègre dans `knowledge/topics/` |
| `/commit-push` | After completing a feature or fix | Commit + push with a conventional commit message |
| `/write-tests` | After writing non-trivial logic | Generate Vitest unit tests for the current feature |
| `/quick-start` | New developer onboarding | Step-by-step guide to run the project locally |
| `/db-prod` | Production database access | Connect and query the production PostgreSQL database |

## Subagents

Specialized agents live in `.claude/agents/`. **Use them proactively** when the task matches — don't wait for the user to ask.

| Agent | When to use |
|---|---|
| `game-designer` | Designing, balancing, or evaluating game mechanics, rules, or systems. Use when the user asks about combat pacing, progression balance, new RPG mechanics, etc. |
| `ux-designer` | Designing new UI features, improving layouts, choosing interaction patterns, evaluating mobile UX. Use **before implementing** any significant UI change to get a concrete design proposal. |
| `wild-card` | Brainstorming bold/creative ideas, rethinking features, finding the "fun factor". Use when the user asks "what should we build next?", "this feels bland", or when a plan feels too conventional. **Not** for implementation details. |
| `playtester` | Getting real user feedback on the app. Uses Chrome MCP to navigate and interact with the running app as a real player would. Use **after implementing** a feature to catch UX issues, friction points, and missing affordances. |

### Rules
- **Before a significant UI feature**: use `ux-designer` to propose the design, then implement.
- **After implementing a feature**: consider using `playtester` to validate the result.
- **When exploring ideas or priorities**: use `wild-card` for creative input, `game-design-expert` for mechanics.
- Agents can be launched in parallel when their tasks are independent.

## Database Migrations

Whenever a new migration file is created under `server/src/db/migrations/`, **immediately run it**:

```bash
npm run db:migrate
```

Do not wait for the user to run it manually.
