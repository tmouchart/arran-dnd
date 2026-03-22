---
name: create-user
description: >-
  Creates app login users in PostgreSQL for arran-dnd (bcrypt hash, table
  "user"). Use when the user asks to add a user, account, login, prod DB user,
  Fly.io, or how to register — there is no public signup. Prefer the one-shot
  fly ssh -C node …create-user.js on production; locally use npm run create-user
  with DATABASE_URL.
---

# Create user (arran-dnd)

## What it does

- Inserts a row into `"user"` (`username`, `password_hash`). Implementation: [`server/src/scripts/create-user.ts`](server/src/scripts/create-user.ts).
- **No HTTP signup** — only login exists ([`server/src/routes/auth.ts`](server/src/routes/auth.ts)).

## Requirements

- **`DATABASE_URL`** — same as the API (`server/src/loadEnv.ts` loads `server/.env`; on Fly/Railway etc. it is usually already in the environment). The script must reach the **intended** database (dev vs prod).

## Command

From **repo root**:

```bash
npm run create-user -- <username> <password>
```

From **`server/`** (equivalent):

```bash
npm run create-user -- <username> <password>
```

The `--` before `<username>` is required so npm forwards the arguments.

## Production (Fly.io) — one command

App name in repo: [`fly.toml`](fly.toml) → `app = "arran-dnd"`. Image runs from `/app`; the built script is `server/dist/scripts/create-user.js` (no `tsx` in prod).

**Copy-paste** (replace user and password):

```bash
fly ssh console -a arran-dnd -C "node server/dist/scripts/create-user.js <username> <password>"
```

Uses the same **`DATABASE_URL`** as the running app (Fly secrets). If `-C` fails because env is missing in SSH, fall back to **local**: `npm run create-user -- …` with `DATABASE_URL` set to prod (e.g. via `fly proxy` + connection string from the Fly Postgres dashboard).

## Errors

- **Unique violation (`23505`)**: username already taken.
