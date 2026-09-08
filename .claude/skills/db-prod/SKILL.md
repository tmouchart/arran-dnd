---
name: db-prod
description: Connect to the arran-dnd production PostgreSQL database via Flyctl tunnel (read-only queries from Claude, pgAdmin for humans)
allowed_tools: Bash
---

## App info
- Fly app: `arran-dnd` (auto-stop : souvent en veille)
- Postgres app: `arran-dnd-pg`
- DB name: `arran_dnd`
- DB user: `arran_dnd`

## Claude en autonomie (lecture seule)

Claude ne peut pas lire le secret lui-même (garde-fou permissions). Le
script `prod-query.cjs` de ce dossier lit `~/prod.env`, se connecte via le
tunnel local 5433 en `default_transaction_read_only`, et n'affiche que les
résultats. Le mot de passe ne transite jamais par le chat.

1. Tunnel (Claude peut le lancer en arrière-plan) :
   `flyctl proxy 5433:5432 -a arran-dnd-pg`
2. Si `~/prod.env` n'existe pas, demander à l'utilisateur de le créer.
   L'app doit être réveillée d'abord (`curl -s https://arran-dnd.fly.dev/`),
   sinon « app has no started VMs ». Une seule ligne, chemin court :
   `! flyctl ssh console -a arran-dnd -C "printenv DATABASE_URL" > ~/prod.env`
3. Requêtes (une string par requête, résultat en table) :
   `node .claude/skills/db-prod/prod-query.cjs 'select ...' 'select ...'`

Rappels schéma : table utilisateurs = `"user"` (guillemets), personnages =
`character`, jets = `roll_event`, révisions = `revision`. Pas de colonne
`race` ni `family` : le peuple est `people`, la famille se déduit de `paths`.

## Humain — pgAdmin

Tunnel : `flyctl proxy 5433:5432 -a arran-dnd-pg`

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `arran_dnd` |
| Username | `arran_dnd` |
| Password | partie entre `:` et `@` de `DATABASE_URL` (cf. étape 2) |
