# Incident — Postgres Fly.io surdimensionné (~85 $/mois pour une DB de 25 MB)

> Découvert et corrigé le 2026-07-23. Coût total de l'erreur : **~286 $** sur 4 mois (mars → juin 2026).
> Runbook détaillé de la migration : [`POSTGRES-DOWNSIZE-PLAN.md`](../POSTGRES-DOWNSIZE-PLAN.md).

## Ce qui s'est passé

En mars 2026, la DB de prod (`arran-dnd-db`) a été créée avec le preset Fly
**"Production — High Availability"** au lieu de "Development" : 3 machines shared-cpu-2x avec
4 GB de RAM chacune + 3 volumes de 40 GB, facturées h24. L'usage réel : une base de **25 MB**
(dont 14 MB de `generated_images`) pour un groupe de D&D de ~8 joueurs.

Les factures sont passées en prélèvement automatique sans qu'on les regarde :

| Invoice | Période | Montant |
|---|---|---|
| #20F1E7FA-0015 | Mars 2026 (partiel) | 29,09 $ |
| #20F1E7FA-0016 | Avril 2026 | 84,76 $ |
| #20F1E7FA-0017 | Mai 2026 | 87,53 $ |
| #20F1E7FA-0018 | Juin 2026 | 84,73 $ |
| **Total** | | **~286 $** |

Facteur aggravant : un **nœud zombie** (`red-snow-9052`), résidu d'un remplacement automatique
de membre raté début juillet, qui ne servait plus au cluster mais tournait et facturait ses
4 GB h24 — 3 machines payées au lieu de 2 (et il n'en fallait qu'une).

## La correction (2026-07-23)

Migration vers un cluster minimal `arran-dnd-pg` : 1 machine shared-cpu-1x / 256 MB RAM,
volume 1 GB, Postgres 18.1, région ams. **Coût : ~2,10 $/mois** (économie ~83 $/mois ≈ 1000 $/an).

> Suite : 256 MB se sont révélés trop justes en usage réel. Le cluster tourne à **512 MB**
> depuis le 2026-08-12. Ne pas redescendre. Détail dans `POSTGRES-DOWNSIZE-PLAN.md`.

Déroulé (~30 min, zéro perte de données, joueur actif pendant la bascule sans interruption) :

1. `pg_dump` sur la machine primary + rapatriement `fly sftp` → `arran-dnd-20260723.dump` (11 MB, gitignoré)
2. `fly postgres create` du nouveau cluster (password superuser noté à part, jamais commité)
3. `pg_restore` + vérification : comptages identiques sur les 13 tables
4. User `arran_dnd` recréé à la main + `fly secrets set DATABASE_URL` (l'app redémarre)
5. Vérif en réel : migrations Drizzle "already applied", health check OK, lectures/écritures 200
6. Destruction de l'ancien cluster (voir statut ci-dessous)

Un mail a été envoyé à `billing@fly.io` pour demander une note de crédit en geste commercial
(draft : `fly-support-email.txt`).

## Leçons apprises

1. **Toujours le preset "Development" pour un hobby project.** Le preset Production HA de Fly
   triple les machines. On upgrade le jour où on en a besoin, pas avant.
2. **Regarder ses factures.** 4 mois de prélèvements à ~85 $ sans que personne ne tique.
   → Vérifier la facture Fly au moins une fois par mois, ou configurer une alerte de budget.
3. **Fly ne sait pas rétrécir un volume ni dé-RAM-er un cluster postgres-flex proprement.**
   Le seul chemin de downsize est dump → nouveau cluster → restore → switch → destroy.
4. **Surveiller les remplacements automatiques de nœuds.** Un remplacement raté peut laisser
   un zombie qui facture. `fly machine list -a <db-app>` de temps en temps.

## Pièges techniques rencontrés (utile si on remigre un jour)

- **`fly proxy` coupe les gros streams COPY** : le `pg_dump` distant échouait sur
  `generated_images`. Solution : dumper sur la machine elle-même
  (`fly ssh console -C "pg_dump -h localhost ..."`) puis `fly ssh sftp get`.
- **Pas de socket Unix Postgres sur postgres-flex** : passer par TCP (`-h localhost -p 5432`).
- **`fly ssh console` sans `--machine` tombe sur une machine au hasard** (y compris le zombie).
  Toujours pinner : `--machine <id>`.
- **`fly postgres attach` refuse si l'app a déjà un secret `DATABASE_URL`**. Alternative :
  créer le rôle à la main (ownership des tables + séquences inclus) puis `fly secrets set`.

## Statut

- [x] Nouveau cluster `arran-dnd-pg` en prod, app basculée et validée (2026-07-23)
- [x] Backup local `arran-dnd-20260723.dump` conservé (filet de sécurité)
- [ ] Mail envoyé à billing@fly.io — réponse en attente
- [ ] Ancien cluster `arran-dnd-db` détruit (`fly apps destroy arran-dnd-db`)
