---
name: quick-start
description: Guide a new developer through running arran-dnd locally after cloning the repo
allowed_tools: Bash, Read, Glob, Grep
---

Help the user get the project running locally. Walk through each step below, run checks where possible, and surface errors immediately.

## Prerequisites

Check that the following are available before proceeding:

- **Node.js ≥ 20** — `node --version`
- **Docker** (for PostgreSQL) — `docker --version` and `docker compose version`

If either is missing, tell the user to install it and stop there.

## Step 1 — Install dependencies

From the repo root:

```bash
npm install
```

This installs dependencies for both the `client/` and `server/` workspaces via npm workspaces.

## Step 2 — Environment variables

Check whether `server/.env` exists. If not, copy the template:

```bash
cp server/.env.example server/.env
```

Then display the required values the user must fill in:

| Variable                                    | Required             | Default / Note                                                                |
| ------------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                            | **Yes** (default AI) | Get from Google AI Studio                                                     |
| `JWT_SECRET`                                | **Yes**              | Any string ≥ 32 chars                                                         |
| `DATABASE_URL`                              | No                   | `postgres://arran:arran_dev@localhost:5432/arrandnd` (matches docker-compose) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No                   | Only for Google OAuth login                                                   |

Tell the user to edit `server/.env` and set at minimum `GEMINI_API_KEY` and `JWT_SECRET` before continuing.

## Step 3 — Start PostgreSQL

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container:

- Host: `localhost`, Port: `5432`
- DB: `arrandnd`, User: `arran`, Password: `arran_dev`

Verify it's running: `docker compose ps`

## Step 4 — Run database migrations

```bash
npm run db:migrate
```

This applies all SQL migrations from `server/src/db/migrations/` to initialize the schema.

## Step 5 — Create a user account

There is no signup UI. Users are created via script:

```bash
npm run create-user -- <username> <password>
```

Replace `<username>` and `<password>` with the desired credentials.

## Step 6 — Start dev servers

```bash
npm run dev
```

This runs both servers concurrently:

- **API**: http://localhost:3001 (health check: `GET /api/health`)
- **Client**: http://localhost:5173

Open http://localhost:5173 in a browser and log in with the credentials from Step 5.

## Troubleshooting

| Symptom                       | Fix                                                              |
| ----------------------------- | ---------------------------------------------------------------- |
| PostgreSQL connection refused | Run `docker compose up -d` and wait a few seconds                |
| `npm run db:migrate` fails    | Check `DATABASE_URL` in `server/.env`                            |
| 401 Unauthorized              | Create a user with `npm run create-user`                         |
| Client can't reach API        | Ensure server is on port 3001; Vite proxies `/api` automatically |
| AI responses fail             | Check `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`) is set and valid |

Display all steps clearly to the user, running checks after each step where possible.
