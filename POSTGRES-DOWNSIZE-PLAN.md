# Fly.io Postgres — plan de downsize (`arran-dnd-db`)

> Rédigé le 2026-07-23 depuis une session Claude Code (diagnostic fait au fly CLI + facture Fly de juin).
> Objectif : passer de **~85 $/mois → ~2 $/mois** sans perdre de données.

## Le diagnostic

La facture Fly de juin (Personal) : **84,97 $**, dont l'écrasante majorité vient du cluster Postgres
`arran-dnd-db`, créé avec le preset **"Production — High Availability"** alors que l'usage réel
(sessions D&D entre voisins) relève du preset "Development".

| Poste facturé | Cause | Montant (juin) |
|---|---|---|
| Machines Shared 2x: Additional RAM (ams) | 3 machines × **4 GB RAM** | **54,51 $** |
| Machines Shared CPU 2x (ams) | 3 × shared-cpu-**2x**, h24 | 12,10 $ |
| Volumes | 3 × **40 GB** | 18,00 $ |
| auraforge (cdg) + snapshots | négligeable | 0,32 $ |

État du cluster constaté au CLI (2026-07-23) :

| Machine | Rôle | État | Taille | Volume |
|---|---|---|---|---|
| `7815997f259008` still-wind-1157 | **primary** | started h24 | shared-cpu-2x / 4096MB | 40 GB |
| `7815dedb339438` empty-pond-7771 | replica | started h24 | shared-cpu-2x / 4096MB | 40 GB |
| `d899730a455178` red-snow-9052 | **zombie** ⚠️ | started h24 | shared-cpu-2x / 4096MB | 40 GB |

Trois problèmes cumulés :

1. **Surdimensionnement** — 4 GB de RAM par nœud pour une DB D&D, c'est ~15× trop. 1 GB est déjà large.
2. **HA inutile** — réplica + failover automatique, utile quand 1 min de downtime coûte de l'argent.
   Ici, si la DB redémarre en 30 s une fois tous les 6 mois, personne ne le remarque.
3. **Nœud `zombie`** — un ancien membre du cluster, résidu d'un remplacement automatique raté
   (le primary date du 22 juin, red-snow du 1er juillet). Il ne sert plus au cluster mais tourne
   et facture ses 4 GB h24. On paie 3 machines au lieu de 2 (et il n'en faut qu'1).

## La cible

> Taille réelle mesurée le 2026-07-23 : **`arran_dnd` = 25 MB**, dont 14 MB de `generated_images`.
> Le minimum Fly suffit très largement.

Un **Postgres single-node "Development"**, au plancher :

- 1 machine `shared-cpu-1x`, **256 MB RAM** (~1,94 $/mois)
- 1 volume **1 GB** (0,15 $/mois) — 40× la taille actuelle de la DB ; extensible plus tard si besoin
  (Fly sait agrandir un volume, jamais le rétrécir)
- Coût : **~2,10 $/mois** tout compris → économie **~83 $/mois ≈ 1000 $/an**

## Contrainte clé

Fly ne sait **pas rétrécir un volume** (40 GB → 10 GB impossible en place), et on ne peut pas
retirer la RAM d'un cluster postgres-flex proprement nœud par nœud. Donc : **on migre vers un
nouveau cluster, on ne modifie pas l'ancien.**

## Le plan (dump → nouveau cluster → restore → switch → destroy)

> À faire **hors session D&D**. Downtime réel pour l'app : quelques minutes (étapes 4-5).
> L'ancien cluster reste intact jusqu'à la toute fin — rollback trivial à chaque étape.

### 1. Dump de la DB existante (ne touche à rien)

```bash
# Terminal A — tunnel local vers le primary
fly proxy 15432:5432 -a arran-dnd-db

# Terminal B — trouver le nom de la base + son mot de passe
fly ssh console -a arran-dnd-db -C "psql -U postgres -l"   # liste les bases
# Le password superuser : `fly ssh console -a arran-dnd-db` puis `env | grep OPERATOR_PASSWORD`
# (ou retrouver le DATABASE_URL courant : fly ssh console -a arran-dnd -C "env" | grep DATABASE_URL)

# Le dump (adapter <dbname> ; pg_dump v17 requis — brew install libpq si besoin)
pg_dump "postgres://postgres:<password>@localhost:15432/<dbname>" \
  --no-owner --format=custom --file=arran-dnd-$(date +%Y%m%d).dump

# Sanity check : taille réelle de la DB
psql "postgres://postgres:<password>@localhost:15432/<dbname>" \
  -c "SELECT pg_size_pretty(pg_database_size('<dbname>'));"
```

Garder ce fichier `.dump` précieusement — c'est le filet de sécurité de toute l'opération.

### 2. Créer le nouveau Postgres (Development)

```bash
fly postgres create \
  --name arran-dnd-pg \
  --region ams \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --vm-memory 256 \
  --volume-size 1
# → NOTER le mot de passe superuser affiché à la création (montré UNE seule fois)
```

> Fly propose aussi la "Managed Postgres" (MPG) dans le dashboard — plus cher au plancher.
> Pour ce besoin, le postgres-flex non managé ci-dessus est le bon choix.

### 3. Restaurer le dump dedans

```bash
# Terminal A — tunnel vers le NOUVEAU cluster (couper l'ancien proxy d'abord)
fly proxy 15433:5432 -a arran-dnd-pg

# Terminal B — recréer la base + restore
psql  "postgres://postgres:<newpass>@localhost:15433/postgres" -c "CREATE DATABASE <dbname>;"
pg_restore --no-owner --dbname="postgres://postgres:<newpass>@localhost:15433/<dbname>" \
  arran-dnd-YYYYMMDD.dump

# Vérif rapide : compter des lignes dans 2-3 tables importantes, comparer avec l'ancien
psql "postgres://postgres:<newpass>@localhost:15433/<dbname>" -c "\dt+"
```

### 4. Re-pointer l'app `arran-dnd`

```bash
# Attacher l'app au nouveau cluster (crée un user dédié + set DATABASE_URL automatiquement) :
fly postgres attach arran-dnd-pg -a arran-dnd
# → ceci REDÉMARRE l'app avec le nouveau DATABASE_URL

# Alternative manuelle si attach râle (ex. user déjà existant) :
# fly secrets set DATABASE_URL="postgres://<user>:<pass>@arran-dnd-pg.flycast:5432/<dbname>" -a arran-dnd
```

### 5. Vérifier que tout marche

- Ouvrir l'app, se logger, vérifier que les données de campagne sont là (persos, sessions, notes…).
- Écrire quelque chose (créer/modifier une note) et vérifier que ça persiste.
- `fly logs -a arran-dnd` : pas d'erreur de connexion DB.

### 6. Détruire l'ancien cluster — SEULEMENT après l'étape 5 validée

```bash
# Optionnel : le laisser tourner 1 semaine en parallèle par prudence (~20 $ prorata), sinon direct :
fly apps destroy arran-dnd-db
# → détruit les 3 machines ET les 3 volumes de 40 GB (confirmation demandée)
```

Le fichier `.dump` local reste le backup ultime même après destruction.

## Après la migration

- **Snapshots** : Fly snapshotte les volumes quotidiennement (rétention 5 j) — automatique, rien à faire.
- **Backup occasionnel** : relancer le `pg_dump` de l'étape 1 (port du nouveau cluster) avant/après
  les grosses sessions, ou croner-le si envie.
- **Facture attendue** : ~2 $/mois pour la DB + quelques centimes pour auraforge (qui auto-stop).

## Checklist

- [x] 0. Taille réelle mesurée : 25 MB (dont 14 MB `generated_images`)
- [x] 1. `pg_dump` local (`arran-dnd-20260723.dump`, 11 MB, gitignoré)
- [x] 2. Nouveau cluster `arran-dnd-pg` créé (1 nœud, 256 MB RAM, volume 1 GB, PG 18.1) — password superuser noté à part
- [x] 3. Dump restauré + comptages de lignes identiques sur les 13 tables
- [x] 4. `arran-dnd` re-pointée (attach refusé car secret existant → user `arran_dnd` créé à la main + `fly secrets set DATABASE_URL`)
- [x] 5. App testée en réel : migrations Drizzle "already applied", health check OK, GET/PUT 200, aucune écriture perdue sur l'ancienne DB
- [ ] 6. `fly apps destroy arran-dnd-db`

## Suite : 256 MB ne suffisaient pas (2026-08-12)

Le cluster a été monté à **512 MB** le 12 août : 256 MB était trop juste pour Postgres en
usage réel. La cible de 256 MB écrite plus haut est donc périmée — **ne pas redescendre**.

État constaté le 2026-09-03 :

```
arran-dnd-pg  │ 1 │ shared-cpu-1x │ 512 MB │ ams   (machine 8ed433f7d056d8, volume 1 GB)
```

Le surcoût est de l'ordre du dollar par mois : l'économie de ~83 $/mois tient toujours.

L'app elle-même (`arran-dnd`) tourne en 256 MB depuis le début et n'a jamais manqué de
mémoire — le problème était bien côté base.
