---
name: cto-plan
description: Plan review pour Arran DnD — architecture, data flow, edge cases, tests, performance. Review interactif avec recommandations tranchees.
allowed_tools: Read, Grep, Glob, AskUserQuestion, Bash
---

# Plan Review Mode

Review this plan thoroughly before making any code changes. For every issue or recommendation, explain the concrete tradeoffs, give me an opinionated recommendation, and ask for my input before assuming a direction.

## Priority hierarchy

If you are running low on context or the user asks you to compress: Step 0 > Test diagram > Opinionated recommendations > Everything else. Never skip Step 0 or the test diagram.

## Engineering preferences (use these to guide your recommendations):

- **Simple > clever.** The best solution is the easiest to read and change.
- **DRY is important** — flag repetition aggressively.
- **Well-tested code is non-negotiable** for non-trivial logic (game mechanics, calculations, state transformations). Use Vitest.
- **"Engineered enough"** — not under-engineered (fragile, hacky) and not over-engineered (premature abstraction, unnecessary complexity).
- **Handle edge cases thoughtfully** — err on the side of covering more, not fewer.
- **Explicit over clever.**
- **Minimal diff:** achieve the goal with the fewest new abstractions and files touched.
- **No workarounds.** Fix the root cause. If a solution feels disproportionately complex, flag it.
- **Modular by default.** One file, one responsibility. Split large files into focused, reusable units.
- **Reuse UI components** from `client/src/components/ui/` — never redefine their patterns inline.

## Documentation and diagrams:

- Use ASCII art diagrams liberally — for data flow, state machines, dependency graphs, and processing pipelines.
- For complex designs, embed ASCII diagrams directly in code comments where they help: models (data relationships), services (processing pipelines), composables (state flow).
- **Diagram maintenance is part of the change.** When modifying code with nearby ASCII diagrams, update them in the same commit. Stale diagrams are worse than no diagrams.

## BEFORE YOU START:

### Step 0: Scope Challenge

Before reviewing anything, answer these questions:

1. **What existing code already partially or fully solves each sub-problem?** Can we reuse existing flows rather than building parallel ones?
2. **What is the minimum set of changes that achieves the stated goal?** Flag any work that could be deferred. Be ruthless about scope creep.
3. **Complexity check:** If the plan touches more than 8 files or introduces more than 2 new components/services, treat that as a smell and challenge whether the same goal can be achieved with fewer moving parts.

Then ask if I want one of three options:

1. **SCOPE REDUCTION:** The plan is overbuilt. Propose a minimal version, then review that.
2. **BIG CHANGE:** Work through interactively, one section at a time (Architecture > Code Quality > Tests > Performance) with at most 8 top issues per section.
3. **SMALL CHANGE:** Compressed review — Step 0 + one combined pass covering all 4 sections. Pick the single most important issue per section. Present as a single numbered list with lettered options + mandatory test diagram + completion summary. One AskUserQuestion round at the end.

**Critical: If I do not select SCOPE REDUCTION, respect that decision fully.** Your job becomes making the chosen plan succeed, not lobbying for a smaller plan. Raise scope concerns once in Step 0 — after that, commit to the chosen scope and optimize within it.

## Review Sections (after scope is agreed)

### 1. Architecture review

Evaluate:

- Overall system design and component boundaries.
- Vue component hierarchy and composable patterns.
- API route structure and Express middleware chain.
- Drizzle schema changes — migration impact.
- Data flow patterns (client > API > DB and back).
- Security: auth middleware coverage, data access boundaries.
- Whether key flows deserve ASCII diagrams.

**STOP.** For each issue, call AskUserQuestion individually. O---
name: db-prod
description: Connect to the arran-dnd production PostgreSQL database via Flyctl tunnel
allowed_tools: Bash
---

Provide the user with the exact steps to connect to the prod database.

## App info
- Fly app: `arran-dnd`
- Postgres app: `arran-dnd-db`
- DB name: `arran_dnd`
- DB user: `arran_dnd`

## Step 1 — Open the tunnel

Tell the user to run this in a terminal and leave it open:

```bash
flyctl proxy 5433:5432 -a arran-dnd-db
```

## Step 2 — pgAdmin connection settings

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `arran_dnd` |
| Username | `arran_dnd` |
| Password | (see below) |

## Step 3 — Get the password (if needed)

Run this to retrieve the DATABASE_URL directly from the running app:

```bash
flyctl ssh console -a arran-dnd -C "printenv DATABASE_URL"
```

The password is the part between `:` and `@` in the URL.
Format: `postgres://arran_dnd:<PASSWORD>@arran-dnd-db.flycast:5432/arran_dnd`

Display all of this clearly and concisely to the user.
ne issue per call. Present options, state your recommendation, explain WHY. Only proceed to the next section after ALL issues are resolved.

### 2. Code quality review

Evaluate:

- Code organization and module structure.
- DRY violations — be aggressive.
- Error handling patterns and missing edge cases.
- Whether existing UI components (`AppCard`, `AppBadge`, `AppPageHead`, etc.) are reused properly.
- Areas that are over-engineered or under-engineered.
- Existing ASCII diagrams in touched files — still accurate?

**STOP.** Same flow: one AskUserQuestion per issue.

### 3. Test review

Make a diagram of all new UX, new data flow, new codepaths, and new branching. For each, note what is new. Then, for each new item in the diagram, verify there is a Vitest test covering it.

Tests live next to the source file: `foo.ts` > `foo.test.ts`.

**STOP.** Same flow: one AskUserQuestion per issue.

### 4. Performance review

Evaluate:

- N+1 queries and database access patterns (Drizzle ORM).
- Unnecessary re-renders in Vue components (watch/computed misuse).
- Bundle size concerns (lazy loading, code splitting).
- Slow or high-complexity code paths.

**STOP.** Same flow: one AskUserQuestion per issue.

## CRITICAL RULE — How to ask questions

Every AskUserQuestion MUST: (1) present 2-3 concrete lettered options, (2) state which option you recommend FIRST, (3) explain in 1-2 sentences WHY that option over the others, mapping to engineering preferences. No batching multiple issues into one question. No yes/no questions. Open-ended questions are allowed ONLY when you have genuine ambiguity about intent or architecture direction — and you must explain what specifically is ambiguous. **Exception:** SMALL CHANGE mode batches one issue per section into a single AskUserQuestion — but each issue still requires its own recommendation + WHY + lettered options.

## For each issue you find

- **One issue = one AskUserQuestion call.** Never combine multiple issues into one question.
- Describe the problem concretely, with file and line references.
- Present 2-3 options, including "do nothing" where reasonable.
- For each option, specify in one line: effort, risk, and maintenance burden.
- **Lead with your recommendation.** State it as a directive: "Do B. Here's why:" — not "Option B might be worth considering."
- **Map the reasoning to engineering preferences above.**
- **AskUserQuestion format:** Start with "We recommend [LETTER]: [one-line reason]" then list all options as `A) ... B) ... C) ...`. Label with issue NUMBER + option LETTER (e.g., "3A", "3B").
- **Escape hatch:** If a section has no issues, say so and move on. If an issue has an obvious fix with no real alternatives, state what you'll do and move on.

## Required outputs

### "NOT in scope" section

Every plan review MUST produce a "NOT in scope" section listing work considered and explicitly deferred, with a one-line rationale for each item.

### "What already exists" section

List existing code/flows that already partially solve sub-problems, and whether the plan reuses them or unnecessarily rebuilds them.

### Diagrams

The plan itself should use ASCII diagrams for any non-trivial data flow, state machine, or processing pipeline. Identify which files should get inline ASCII diagram comments.

### Failure modes

For each new codepath in the test review diagram, list one realistic way it could fail and whether:

1. A test covers that failure
2. Error handling exists for it
3. The user would see a clear error or a silent failure

If any failure mode has no test AND no error handling AND would be silent, flag it as a **critical gap**.

### Completion summary

At the end of the review, display this summary:

- Step 0: Scope Challenge (user chose: ___)
- Architecture Review: ___ issues found
- Code Quality Review: ___ issues found
- Test Review: diagram produced, ___ gaps identified
- Performance Review: ___ issues found
- NOT in scope: written
- What already exists: written
- Failure modes: ___ critical gaps flagged

## Retrospective learning

Check the git log for this branch. If there are prior commits suggesting a previous review cycle, note what was changed and whether the current plan touches the same areas. Be more aggressive reviewing areas that were previously problematic.

## Formatting rules

- NUMBER issues (1, 2, 3...) and give LETTERS for options (A, B, C...).
- When using AskUserQuestion, label each option with issue NUMBER and option LETTER.
- Recommended option is always listed first.
- Keep each option to one sentence max.
- After each review section, pause and ask for feedback before moving on.

## Unresolved decisions

If the user does not respond to an AskUserQuestion or interrupts to move on, note which decisions were left unresolved. At the end of the review, list these as "Unresolved decisions that may bite you later" — never silently default to an option.
