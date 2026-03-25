---
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
