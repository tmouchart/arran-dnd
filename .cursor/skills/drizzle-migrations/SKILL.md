---
name: drizzle-migrations
description: >-
  PostgreSQL migrations for the arran-dnd server: hand-written SQL under
  server/src/db/migrations, applied by the custom Node runner (not Drizzle
  migrator). Use when changing server/src/db/schema.ts, adding columns/tables,
  writing raw SQL migrations, running db:migrate, create-migration, or
  __applied_migrations.
---

# Database migrations (arran-dnd server)

## Scope

- **Schema (Drizzle types)**: [`server/src/db/schema.ts`](server/src/db/schema.ts)
- **Applied migrations**: [`server/src/db/migrations/*.sql`](server/src/db/migrations/) — files named `{msEpoch}_{slug}.sql`, sorted lexicographically = execution order
- **Tracking table**: `public.__applied_migrations` (`name` PK, `applied_at`) — created by the migrator
- **Drizzle Kit diff only**: [`server/drizzle.config.ts`](server/drizzle.config.ts) writes to `server/src/db/drizzle-kit/` — **not** executed by the app. Copy or adapt generated SQL into a new file under `migrations/` after `create-migration`

## Workflow

1. **New migration file**: from `server/`, run `npm run create-migration -- <name>` (slug becomes alphanumerics + underscores). This creates `src/db/migrations/${Date.now()}_${slug}.sql`.
2. **Edit the SQL** — keep statements **idempotent** where possible (`IF NOT EXISTS`, `DROP … IF EXISTS`, `DO` blocks for constraints) so a file can be re-run safely if needed.
3. **Optional schema diff**: edit `schema.ts`, then `npm run db:generate` — review output under `src/db/drizzle-kit/`, merge into your new `.sql` in `migrations/` as needed.
4. **Apply**: `npm run db:migrate` (requires `DATABASE_URL` in `server/.env`).

## Verify

- New `.sql` lives only under `server/src/db/migrations/` with a leading millisecond epoch so it sorts after existing files.
- Run `npm run db:migrate` against a dev database before production.

## Commands

From **`server/`**:

| Command | Role |
|--------|------|
| `npm run db:generate` | Diff `schema.ts` → `src/db/drizzle-kit/` (review only) |
| `npm run create-migration -- <name>` | New `{timestamp}_{name}.sql` stub |
| `npm run db:migrate` | Apply pending migrations to the database |

From **repo root**: `npm run db:migrate` runs the server workspace script (`-w server`).
