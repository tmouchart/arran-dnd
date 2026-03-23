# Arran DnD — Rules for Claude

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

All shared UI primitives live in `client/src/components/ui/`. **Always use these components** when writing new code — never redefine their patterns inline.

| Component | Usage |
|---|---|
| `AppPageHead` | Every page header with an `<h1>`. Slot `#actions` for buttons on the right. |
| `AppCard` | Any bordered surface card. Use `title` prop for a simple heading, `#titleActions` slot for buttons next to the title, or place a manual `.card-head` div in the default slot for complex headers. |
| `AppBadge` | Colored pill badges. Variants: `attaque`, `limitée`, `gratuite`, `info`, `pm`, `active`. |
| `AppEmptyState` | Loading / empty / error feedback. Variants: `loading`, `empty` (default), `error`. Slot `#actions` for retry buttons. |
| `AppIconBtn` | 40×40 px icon-only button. Variants: `ghost` (default), `primary`, `danger`. Use `size` prop to override dimensions. |

Do **not** re-create `.page-head`, `.card`, `.badge`, `.empty-state`, or `.icon-btn` patterns in scoped styles. Extend these components instead.

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

## Database Migrations

Whenever a new migration file is created under `server/src/db/migrations/`, **immediately run it**:

```bash
npm run db:migrate
```

Do not wait for the user to run it manually.
